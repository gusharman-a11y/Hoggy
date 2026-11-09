import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDb, getDb } from "@/db";
import { MockReceiptReader, ReceiptReadError, type ReceiptReader } from "@/providers/receipt-reader";
import { getReceipt, listReceiptsNeedingReview, receiptExtraction, resolveUploadPath } from "./receipts";
import { receiptKindFromReading, reviewReceipt, snapReceipt, type ReceiptReview } from "./receipt-snap";
import { UploadError } from "./receipt-uploads";
import { createTrip, transitionTrip } from "./trips";
import { createOrg, createUser } from "./users";

const FIX = path.join(process.cwd(), "src/providers/__fixtures__/receipts");
const TAXI_PHOTO = new Uint8Array(fs.readFileSync(path.join(FIX, "taxi-photo.png")));
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 1]);
const file = (bytes: Uint8Array, name = "photo.png") => ({ name, size: bytes.length, bytes });

async function invoicePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([400, 600]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lines = fs.readFileSync(path.join(FIX, "tax-invoice.txt"), "utf8").split("\n").filter(Boolean);
  lines.forEach((t, i) => page.drawText(t, { x: 20, y: 560 - i * 20, size: 9, font }));
  return doc.save();
}

describe("snap receipt", () => {
  let db: DatabaseSync;
  let dir: string;
  let tripId: number;
  let doc: { id: number; org_id: number | null; role: "doctor" };
  let other: { id: number; org_id: number | null; role: "doctor" };
  const reader = new MockReceiptReader();

  beforeEach(() => {
    db = getDb(":memory:");
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "sl-snap-"));
    const orgId = createOrg(db, { name: "A Hospital", financeEmail: "fin@a.example" }).id;
    doc = { ...createUser(db, { orgId, email: "doc@a.example", name: "Dr A", password: "pw123456", role: "doctor" }), role: "doctor" };
    other = { ...createUser(db, { orgId, email: "b@a.example", name: "Dr B", password: "pw123456", role: "doctor" }), role: "doctor" };
    const confId = Number(
      db
        .prepare(
          `INSERT INTO conferences (slug, name, specialty, start_date, end_date, city, country, currency, source)
           VALUES ('c', 'SAMPLE Meeting 2027', 'Cardiology', '2027-03-10', '2027-03-12', 'Melbourne', 'Australia', 'AUD', 'sample')`,
        )
        .run().lastInsertRowid,
    );
    tripId = createTrip({ orgId, userId: doc.id, conferenceId: confId }, db).id;
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reads a photo and saves it as needs_review with the extracted fields", async () => {
    const r = await snapReceipt(tripId, doc, file(TAXI_PHOTO, "IMG_0042.png"), { db, dir, reader });
    expect(r).toMatchObject({
      trip_id: tripId,
      source: "upload",
      status: "needs_review",
      kind: "taxi",
      description: "SAMPLE Harbour Taxis",
      amount_cents: 4575,
      gst_cents: 416,
      supplier_name: "SAMPLE Harbour Taxis",
      supplier_abn: "51824753556",
      receipt_date: "2027-03-10",
      is_tax_invoice: 1,
      uploaded_by: doc.id,
      original_name: "IMG_0042.png",
      mime_type: "image/png",
    });
    expect(receiptExtraction(r)).toMatchObject({ totalCents: 4575, kind: "taxi" });
    expect(fs.readFileSync(resolveUploadPath(r.file_path!, dir))).toEqual(Buffer.from(TAXI_PHOTO));
    expect(listReceiptsNeedingReview(tripId, db).map((x) => x.id)).toEqual([r.id]);
  });

  it("reads a PDF tax invoice", async () => {
    const r = await snapReceipt(tripId, doc, file(await invoicePdf(), "invoice.pdf"), { db, dir, reader });
    expect(r).toMatchObject({
      status: "needs_review",
      kind: "registration",
      amount_cents: 110_000,
      gst_cents: 10_000,
      supplier_abn: "51824753556",
      receipt_date: "2027-02-14",
      is_tax_invoice: 1,
    });
  });

  it("still saves the receipt (empty, to fill in) when nothing is read or the reader fails", async () => {
    const blank = await snapReceipt(tripId, doc, file(PNG), { db, dir, reader });
    expect(blank).toMatchObject({ status: "needs_review", amount_cents: 0, kind: "other", description: "Other", supplier_name: null });

    const broken: ReceiptReader = { name: "broken", read: async () => Promise.reject(new ReceiptReadError("nope")) };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await snapReceipt(tripId, doc, file(TAXI_PHOTO), { db, dir, reader: broken });
    spy.mockRestore();
    expect(r).toMatchObject({ status: "needs_review", amount_cents: 0, supplier_abn: null });
    expect(listReceiptsNeedingReview(tripId, db)).toHaveLength(2);
  });

  it("rejects bad files and other people's trips without saving anything", async () => {
    const snap = (f: Parameters<typeof snapReceipt>[2], who = doc) => snapReceipt(tripId, who, f, { db, dir, reader });
    await expect(snap(undefined)).rejects.toThrow(/Choose a file/);
    await expect(snap(file(new TextEncoder().encode("GIF89a"), "a.gif"))).rejects.toThrow(/PDF, JPG or PNG/);
    await expect(snap(file(TAXI_PHOTO), other)).rejects.toBeInstanceOf(UploadError);
    transitionTrip(tripId, "pending_approval", {}, db);
    transitionTrip(tripId, "approved", {}, db);
    transitionTrip(tripId, "booked", {}, db);
    transitionTrip(tripId, "claimed", {}, db);
    await expect(snap(file(TAXI_PHOTO))).rejects.toThrow(/can't add receipts/);
    expect(db.prepare("SELECT COUNT(*) AS n FROM receipts").get()).toEqual({ n: 0 });
    expect(fs.readdirSync(dir)).toEqual([]);
  });

  it("'Looks right' saves the corrected fields and confirms", async () => {
    const r = await snapReceipt(tripId, doc, file(TAXI_PHOTO), { db, dir, reader });
    const review: ReceiptReview = {
      supplierName: "SAMPLE Harbour Taxis Pty Ltd",
      supplierAbn: "51 824 753 556",
      gstCents: 420,
      amountCents: 4620,
      receiptDate: "2027-03-11",
      kind: "transport",
    };
    const saved = reviewReceipt(tripId, r.id, doc, review, { db });
    expect(saved).toMatchObject({
      status: "confirmed",
      supplier_name: "SAMPLE Harbour Taxis Pty Ltd",
      description: "SAMPLE Harbour Taxis Pty Ltd",
      supplier_abn: "51824753556",
      gst_cents: 420,
      amount_cents: 4620,
      receipt_date: "2027-03-11",
      kind: "transport",
      is_tax_invoice: 1,
    });
    expect(listReceiptsNeedingReview(tripId, db)).toEqual([]);
  });

  it("validates the review and leaves the receipt unchanged on error", async () => {
    const r = await snapReceipt(tripId, doc, file(TAXI_PHOTO), { db, dir, reader });
    const ok: ReceiptReview = { supplierName: "X", supplierAbn: "", gstCents: null, amountCents: 1000, receiptDate: "", kind: "taxi" };
    const bad = (over: Partial<ReceiptReview>, who = doc) => () => reviewReceipt(tripId, r.id, who, { ...ok, ...over }, { db });
    expect(bad({ amountCents: undefined })).toThrow(/Enter the amount/);
    expect(bad({ gstCents: undefined })).toThrow(/GST/);
    expect(bad({ gstCents: 2000 })).toThrow(/more than the amount/);
    expect(bad({ supplierAbn: "123" })).toThrow(/11 digits/);
    expect(bad({ receiptDate: "2027-02-31" })).toThrow(/real date/);
    expect(bad({ kind: "yacht" })).toThrow(/Choose what/);
    expect(bad({}, other)).toThrow(/can't change/);
    expect(getReceipt(r.id, db)).toMatchObject({ status: "needs_review", amount_cents: 4575, kind: "taxi", supplier_abn: "51824753556" });
    // Blank optional fields clear what was read
    expect(reviewReceipt(tripId, r.id, doc, ok, { db })).toMatchObject({
      status: "confirmed",
      supplier_abn: null,
      gst_cents: null,
      receipt_date: null,
    });
  });

  it("maps reader kinds to receipt kinds", () => {
    expect(receiptKindFromReading("flight")).toBe("flight");
    expect(receiptKindFromReading("accommodation")).toBe("accommodation");
    expect(receiptKindFromReading("meals")).toBe("meals");
  });
});
