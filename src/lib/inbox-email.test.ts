import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { MockReceiptReader, pdfToText, type ReceiptReader } from "@/providers/receipt-reader";
import { buildEmailReceiptPdf } from "./email-receipt-pdf";
import {
  handleInboundRequest,
  inboundAddress,
  inboxCodesFrom,
  personalInboxAddress,
  receiveInboxEmail,
  type InboundEmail,
} from "./inbound-email";
import { listReceipts, resolveUploadPath } from "./receipts";
import { createTrip, type Trip } from "./trips";
import { getUnfiledReceipt, listUnfiledReceipts } from "./unfiled-receipts";
import { createOrg, createUser, getInboxCode, type User } from "./users";

const SECRET = "s3cret-inbound";
// Always the mock: these tests must never reach a real reader.
const mock = new MockReceiptReader();
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

async function textPdf(lines: string[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 400]);
  lines.forEach((l, i) => page.drawText(l, { x: 20, y: 370 - i * 14, size: 10, font }));
  return doc.save();
}

/** Counts reads; optionally fails. */
class SpyReader implements ReceiptReader {
  readonly name = "spy";
  calls: string[] = [];
  constructor(private readonly fail = false) {}
  async read(input: Parameters<ReceiptReader["read"]>[0]) {
    this.calls.push(input.mimeType);
    if (this.fail) throw new Error("reader down");
    return new MockReceiptReader().read(input);
  }
}

describe("personal inbox addresses", () => {
  it("parses inbox-<code> addresses only", () => {
    expect(inboxCodesFrom(personalInboxAddress("0123456789ab"))).toEqual(["0123456789ab"]);
    expect(inboxCodesFrom('"Hoggy" <INBOX-0123456789AB@in.studyleave.app>, x@y.example')).toEqual(["0123456789ab"]);
    expect(inboxCodesFrom(inboundAddress("0123456789ab"))).toEqual([]);
    expect(inboxCodesFrom("inbox-0123456789ab@in.studyleave.app.evil.example")).toEqual([]);
  });
});

describe("receiveInboxEmail", () => {
  let db: DatabaseSync;
  let dir: string;
  let doc: User;
  let other: User;
  let trip: Trip;
  let address: string;
  let conf: (name: string, start: string, end: string, city: string) => number;

  beforeEach(() => {
    db = getDb(":memory:");
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "sl-inbox-"));
    const orgId = createOrg(db, { name: "A Hospital", financeEmail: "fin@a.example" }).id;
    doc = createUser(db, { orgId, email: "Doc@A.example", name: "Dr A", password: "pw123456", role: "doctor" });
    other = createUser(db, { orgId, email: "b@a.example", name: "Dr B", password: "pw123456", role: "doctor" });
    conf = (name, start, end, city) =>
      Number(
        db
          .prepare(
            `INSERT INTO conferences (slug, name, specialty, start_date, end_date, city, country, currency, source)
             VALUES (?, ?, 'Cardiology', ?, ?, ?, 'Australia', 'AUD', 'sample')`,
          )
          .run(name.toLowerCase().replace(/\W+/g, "-"), name, start, end, city).lastInsertRowid,
      );
    trip = createTrip({ orgId, userId: doc.id, conferenceId: conf("SAMPLE Heart Meeting 2027", "2027-03-10", "2027-03-12", "Melbourne") }, db);
    address = personalInboxAddress(getInboxCode(db, doc.id)!);
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const email = async (over: Partial<InboundEmail> = {}): Promise<InboundEmail> => ({
    to: address,
    from: "Dr A <doc@a.example>",
    subject: "Fwd: taxi",
    attachments: [
      {
        filename: "taxi.pdf",
        contentType: "application/pdf",
        base64: b64(await textPdf(["SAMPLE Harbour Cabs", "Tax invoice", "Date: 11/03/2027", "Total $45.00", "GST $4.09"])),
      },
    ],
    ...over,
  });

  it("reads each attachment and files a matching one on the trip as needs_review", async () => {
    const reader = new SpyReader();
    const res = await receiveInboxEmail(await email(), { db, dir, reader });
    expect(res).toMatchObject({ ok: true, userId: doc.id, unfiled: [] });
    expect(reader.calls).toEqual(["application/pdf"]);
    const [r] = listReceipts(trip.id, db);
    expect(r).toMatchObject({
      source: "email",
      status: "needs_review",
      kind: "taxi",
      amount_cents: 4500,
      gst_cents: 409,
      receipt_date: "2027-03-11",
      supplier_name: "SAMPLE Harbour Cabs",
      is_tax_invoice: 1,
      uploaded_by: doc.id,
      original_name: "taxi.pdf",
    });
    expect(r.file_path!.startsWith(`${trip.id}/email-`)).toBe(true);
    expect(fs.existsSync(resolveUploadPath(r.file_path!, dir))).toBe(true);
    expect(JSON.parse(r.extraction_json!)).toMatchObject({ totalCents: 4500 });
  });

  it("renders an email with no attachment to a one-page PDF and reads it", async () => {
    const reader = new SpyReader();
    const text = [
      "---------- Forwarded message ---------",
      'From: "SAMPLE Skyways" <noreply@sample-skyways.example.org>',
      "Date: Mon, 1 Mar 2027 09:30:00 +1100",
      "This is your tax invoice. Flight SY 412 Sydney to Melbourne.",
      "Total paid $420.20",
      "Includes GST of $38.20",
    ].join("\n");
    const res = await receiveInboxEmail(await email({ subject: "Fwd: Your e-ticket receipt", text, attachments: [] }), { db, dir, reader });
    expect(res.ok).toBe(true);
    expect(reader.calls).toEqual(["application/pdf"]);
    const [r] = listReceipts(trip.id, db);
    expect(r).toMatchObject({ kind: "flight", amount_cents: 42020, receipt_date: "2027-03-01", supplier_name: "SAMPLE Skyways", mime_type: "application/pdf" });
    const bytes = new Uint8Array(fs.readFileSync(resolveUploadPath(r.file_path!, dir)));
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(await pdfToText(bytes)).toContain("Total paid $420.20");
  });

  it("refuses an email with nothing to read", async () => {
    expect(await receiveInboxEmail(await email({ attachments: [], text: "  " }), { db, dir, reader: mock })).toMatchObject({ ok: false, status: 422 });
    const html = { filename: "x.html", contentType: "text/html", base64: b64(Buffer.from("<html>")) };
    expect(await receiveInboxEmail(await email({ attachments: [html] }), { db, dir, reader: mock })).toMatchObject({ ok: false, status: 422 });
  });

  it("puts receipts that match no trip in the doctor's private Unfiled receipts", async () => {
    const pdf = await textPdf(["SAMPLE Bali Beach Resort", "Date: 20/05/2027", "Total $800.00"]);
    const res = await receiveInboxEmail(
      await email({ subject: "Holiday", attachments: [{ filename: "bali.pdf", contentType: "application/pdf", base64: b64(pdf) }] }),
      { db, dir },
    );
    expect(res).toMatchObject({ ok: true, filed: [], unfiled: [{ reason: "no_match", description: "SAMPLE Bali Beach Resort" }] });
    expect(listReceipts(trip.id, db)).toHaveLength(0);
    const [u] = listUnfiledReceipts(doc.id, db);
    expect(u).toMatchObject({ user_id: doc.id, amount_cents: 80000, receipt_date: "2027-05-20", email_subject: "Holiday", reason: "no_match" });
    expect(u.file_path.startsWith(`unfiled/${doc.id}/inbox-`)).toBe(true);
    expect(fs.readFileSync(resolveUploadPath(u.file_path, dir))).toEqual(Buffer.from(pdf));
    // Private: nobody else sees it.
    expect(listUnfiledReceipts(other.id, db)).toHaveLength(0);
    expect(getUnfiledReceipt(u.id, other.id, db)).toBeUndefined();
    expect(getUnfiledReceipt(u.id, doc.id, db)?.id).toBe(u.id);
  });

  it("leaves receipts unfiled when two trips fit equally well", async () => {
    createTrip({ orgId: doc.org_id!, userId: doc.id, conferenceId: conf("SAMPLE Lung Meeting 2027", "2027-03-11", "2027-03-13", "Perth") }, db);
    const pdf = await textPdf(["SAMPLE Corner Cafe", "Date: 11/03/2027", "Total $12.00"]);
    const res = await receiveInboxEmail(
      await email({ attachments: [{ filename: "cafe.pdf", contentType: "application/pdf", base64: b64(pdf) }] }),
      { db, dir },
    );
    expect(res).toMatchObject({ ok: true, filed: [], unfiled: [{ reason: "ambiguous" }] });
  });

  it("files each attachment separately", async () => {
    const holiday = await textPdf(["SAMPLE Bali Beach Resort", "Date: 20/05/2027", "Total $800.00"]);
    const e = await email();
    e.attachments.push({ filename: "bali.pdf", contentType: "application/pdf", base64: b64(holiday) });
    const res = await receiveInboxEmail(e, { db, dir, reader: mock });
    expect(res).toMatchObject({ ok: true, filed: [{ tripId: trip.id }], unfiled: [{ reason: "no_match" }] });
  });

  it("keeps the receipt when the reader fails", async () => {
    const res = await receiveInboxEmail(await email(), { db, dir, reader: new SpyReader(true) });
    // Nothing read = no date or place, so it waits in Unfiled for the doctor.
    expect(res).toMatchObject({ ok: true, unfiled: [{ reason: "no_match", description: "Fwd: taxi".replace("Fwd: ", "") }] });
  });

  it("only accepts mail from the account's own email address", async () => {
    for (const from of ["b@a.example", "Dr A <doc@a.example.evil.example>", "not an email"]) {
      expect(await receiveInboxEmail(await email({ from }), { db, dir, reader: mock })).toMatchObject({ ok: false, status: 404 });
    }
    expect(await receiveInboxEmail(await email({ to: personalInboxAddress("ffffffffffff") }), { db, dir, reader: mock })).toMatchObject({
      ok: false,
      status: 404,
    });
    expect(listReceipts(trip.id, db)).toHaveLength(0);
    expect(listUnfiledReceipts(doc.id, db)).toHaveLength(0);
  });

  describe("POST /api/inbound", () => {
    const post = (body: unknown, headers: Record<string, string> = { "x-inbound-secret": SECRET }) =>
      new Request("http://localhost/api/inbound", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify(body),
      });

    it("applies the same secret check to inbox addresses", async () => {
      const bad: Record<string, string>[] = [{}, { "x-inbound-secret": "wrong" }];
      for (const headers of bad) {
        expect((await handleInboundRequest(post(await email(), headers), { secret: SECRET, db, dir, reader: mock })).status).toBe(401);
      }
      expect((await handleInboundRequest(post(await email()), { secret: undefined, db, dir, reader: mock })).status).toBe(401);
      expect(listReceipts(trip.id, db)).toHaveLength(0);
    });

    it("routes inbox mail and reports what was filed", async () => {
      const res = await handleInboundRequest(post(await email()), { secret: SECRET, db, dir, reader: new MockReceiptReader() });
      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({ filed: [{ tripId: trip.id, description: "SAMPLE Harbour Cabs" }], unfiled: [], skipped: [] });
    });

    it("keeps trip-<code> addresses working", async () => {
      const res = await handleInboundRequest(post(await email({ to: inboundAddress(trip.inbound_code) })), { secret: SECRET, db, dir, reader: mock });
      expect(res.status).toBe(201);
      expect(await res.json()).toMatchObject({ tripId: trip.id });
      expect(listReceipts(trip.id, db)[0]).toMatchObject({ source: "email", amount_cents: 0, status: "confirmed" });
    });

    it("answers 404 for a stranger and for mail to no StudyLeave address", async () => {
      expect((await handleInboundRequest(post(await email({ from: "b@a.example" })), { secret: SECRET, db, dir, reader: mock })).status).toBe(404);
      expect((await handleInboundRequest(post(await email({ to: "x@y.example" })), { secret: SECRET, db, dir, reader: mock })).status).toBe(404);
    });

    it("rejects a non-string text body", async () => {
      expect((await handleInboundRequest(post({ ...(await email()), text: 5 }), { secret: SECRET, db, dir, reader: mock })).status).toBe(400);
    });
  });
});

describe("buildEmailReceiptPdf", () => {
  it("fits any body on one page and keeps the forwarder out of the text readers see first", async () => {
    const long = Array.from({ length: 300 }, (_, i) => `Line ${i} ${"word ".repeat(30)}`).join("\n");
    const bytes = await buildEmailReceiptPdf({ from: "Dr A <doc@a.example>", subject: "Fwd: café ✓", text: long });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    const text = await pdfToText(bytes);
    expect(text).toContain("rest of the email not shown");
    expect(text.indexOf("Line 0")).toBeLessThan(text.indexOf("doc@a.example"));
    expect(text).not.toMatch(/^From:/m);
  });
});
