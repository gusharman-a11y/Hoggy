import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { getBudget } from "./budget";
import { listReceipts, resolveUploadPath } from "./receipts";
import {
  canDeleteReceipt,
  deleteUploadedReceipt,
  detectFileType,
  MAX_UPLOAD_BYTES,
  saveUploadedReceipt,
  UploadError,
  type UploadInput,
} from "./receipt-uploads";
import { createTrip, transitionTrip } from "./trips";
import { createOrg, createUser } from "./users";

const PDF = new TextEncoder().encode("%PDF-1.4\n%fake\n");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);

const file = (bytes: Uint8Array, name = "taxi.pdf") => ({ name, size: bytes.length, bytes });
const input = (over: Partial<UploadInput> = {}): UploadInput => ({
  file: file(PDF),
  description: "Taxi to venue",
  amountCents: 4_250,
  kind: "taxi",
  ...over,
});

describe("detectFileType", () => {
  it("recognises PDF, JPG and PNG by their bytes and nothing else", () => {
    expect(detectFileType(PDF)?.mime).toBe("application/pdf");
    expect(detectFileType(PNG)?.ext).toBe("png");
    expect(detectFileType(JPG)?.ext).toBe("jpg");
    expect(detectFileType(new TextEncoder().encode("GIF89a"))).toBeUndefined();
    expect(detectFileType(new TextEncoder().encode("<html>"))).toBeUndefined();
    expect(detectFileType(new Uint8Array())).toBeUndefined();
  });
});

describe("uploaded receipts", () => {
  let db: DatabaseSync;
  let dir: string;
  let tripId: number;
  let doc: { id: number; org_id: number | null; role: "doctor" };
  let other: { id: number; org_id: number | null; role: "doctor" };
  let manager: { id: number; org_id: number | null; role: "manager" };

  beforeEach(() => {
    db = getDb(":memory:");
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "sl-uploads-"));
    const orgId = createOrg(db, { name: "A Hospital", financeEmail: "fin@a.example" }).id;
    doc = { ...createUser(db, { orgId, email: "doc@a.example", name: "Dr A", password: "pw123456", role: "doctor" }), role: "doctor" };
    other = { ...createUser(db, { orgId, email: "b@a.example", name: "Dr B", password: "pw123456", role: "doctor" }), role: "doctor" };
    manager = { ...createUser(db, { orgId, email: "m@a.example", name: "M", password: "pw123456", role: "manager" }), role: "manager" };
    const confId = Number(
      db
        .prepare(
          `INSERT INTO conferences (slug, name, specialty, start_date, end_date, city, country, currency, source)
           VALUES ('c', 'SAMPLE Meeting 2027', 'Cardiology', '2027-03-10', '2027-03-12', 'Melbourne', 'Australia', 'AUD', 'sample')`,
        )
        .run().lastInsertRowid,
    );
    tripId = createTrip({ orgId, userId: doc.id, conferenceId: confId, estOtherCents: 10_000 }, db).id;
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("saves the file under <trip_id>/ and a source='upload' row", () => {
    const r = saveUploadedReceipt(tripId, doc, input(), { db, dir });
    expect(r).toMatchObject({
      trip_id: tripId,
      source: "upload",
      kind: "taxi",
      description: "Taxi to venue",
      amount_cents: 4_250,
      currency: "AUD",
      mime_type: "application/pdf",
      uploaded_by: doc.id,
      original_name: "taxi.pdf",
    });
    expect(r.file_path).toMatch(new RegExp(`^${tripId}/upload-[0-9a-f]{16}\\.pdf$`));
    expect(fs.readFileSync(resolveUploadPath(r.file_path!, dir))).toEqual(Buffer.from(PDF));
    const png = saveUploadedReceipt(tripId, doc, input({ file: file(PNG, "C:\\pics\\meal.png"), kind: "meals" }), { db, dir });
    expect(png.file_path).toMatch(/\.png$/);
    expect(png.original_name).toBe("meal.png");
    expect(listReceipts(tripId, db)).toHaveLength(2);
  });

  it("rejects other file types, empty, oversized and incomplete uploads with clear messages", () => {
    const up = (over: Partial<UploadInput>) => () => saveUploadedReceipt(tripId, doc, input(over), { db, dir });
    expect(up({ file: file(new TextEncoder().encode("GIF89a..."), "a.gif") })).toThrow(/PDF, JPG or PNG/);
    // A renamed file is still judged by its bytes
    expect(up({ file: file(new TextEncoder().encode("MZ..."), "virus.pdf") })).toThrow(/PDF, JPG or PNG/);
    expect(up({ file: undefined })).toThrow(/Choose a file/);
    expect(up({ file: { name: "big.pdf", size: MAX_UPLOAD_BYTES + 1, bytes: PDF } })).toThrow(/10 MB/);
    expect(up({ description: "  " })).toThrow(/description/);
    expect(up({ amountCents: undefined })).toThrow(/amount/);
    expect(up({ kind: "yacht" })).toThrow(UploadError);
    expect(listReceipts(tripId, db)).toHaveLength(0);
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });

  it("only the trip owner can upload, and not after the claim is sent", () => {
    expect(() => saveUploadedReceipt(tripId, other, input(), { db, dir })).toThrow(/can't add/);
    expect(() => saveUploadedReceipt(tripId, manager, input(), { db, dir })).toThrow(/can't add/);
    expect(() => saveUploadedReceipt(tripId, { ...doc, org_id: 999 }, input(), { db, dir })).toThrow(/can't add/);
    for (const s of ["pending_approval", "approved", "booked", "claimed"] as const) transitionTrip(tripId, s, {}, db);
    expect(() => saveUploadedReceipt(tripId, doc, input(), { db, dir })).toThrow(/can't add/);
  });

  it("deletes own uploads (row + file) only", () => {
    const r = saveUploadedReceipt(tripId, doc, input(), { db, dir });
    const trip = { org_id: doc.org_id!, user_id: doc.id, status: "draft" as const };
    expect(canDeleteReceipt(r, trip, doc)).toBe(true);
    expect(canDeleteReceipt(r, trip, manager)).toBe(false);
    expect(canDeleteReceipt({ ...r, source: "generated" }, trip, doc)).toBe(false);
    expect(canDeleteReceipt(r, { ...trip, status: "claimed" }, doc)).toBe(false);

    expect(() => deleteUploadedReceipt(tripId, r.id, other, { db, dir })).toThrow(/can't delete/);
    expect(() => deleteUploadedReceipt(tripId + 1, r.id, doc, { db, dir })).toThrow(/can't delete/);
    const generated = Number(
      db
        .prepare("INSERT INTO receipts (trip_id, kind, amount_cents, source) VALUES (?, 'flight', 100, 'generated')")
        .run(tripId).lastInsertRowid,
    );
    expect(() => deleteUploadedReceipt(tripId, generated, doc, { db, dir })).toThrow(/can't delete/);

    deleteUploadedReceipt(tripId, r.id, doc, { db, dir });
    expect(listReceipts(tripId, db).map((x) => x.id)).toEqual([generated]);
    expect(fs.existsSync(resolveUploadPath(r.file_path!, dir))).toBe(false);
  });

  it("uploaded amounts count as spent once claimed", () => {
    saveUploadedReceipt(tripId, doc, input({ amountCents: 4_250 }), { db, dir });
    saveUploadedReceipt(tripId, doc, input({ amountCents: 1_000, kind: "meals" }), { db, dir });
    for (const s of ["pending_approval", "approved", "booked", "claimed"] as const) transitionTrip(tripId, s, {}, db);
    expect(getBudget(doc, 2027, db).spentCents).toBe(5_250);
  });
});
