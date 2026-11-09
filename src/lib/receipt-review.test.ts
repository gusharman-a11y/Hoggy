import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { MockReceiptReader } from "@/providers/receipt-reader";
import { handleInboundRequest } from "./inbound-email";
import {
  confirmReviewReceipt,
  countReceiptsToReview,
  deletePersonalReceipt,
  deleteUnfiledReceipt,
  editReviewReceipt,
  editUnfiledReceipt,
  listMoveTargets,
  listReceiptsToReview,
  moveReviewReceipt,
  moveUnfiledReceipt,
  purgeUnfiled,
} from "./receipt-review";
import { getReceipt, listReceipts, resolveUploadPath } from "./receipts";
import { UploadError } from "./receipt-uploads";
import { createTrip, type Trip } from "./trips";
import { getUnfiledReceipt, listUnfiledReceipts } from "./unfiled-receipts";
import { createOrg, createUser, type User } from "./users";

describe("receipt review", () => {
  let db: DatabaseSync;
  let dir: string;
  let doc: User;
  let other: User;
  let tripA: Trip;
  let tripB: Trip;
  let otherTrip: Trip;
  let n = 0;

  const conf = (name: string, start: string) =>
    Number(
      db
        .prepare(
          `INSERT INTO conferences (slug, name, specialty, start_date, end_date, city, country, currency, source)
           VALUES (?, ?, 'Cardiology', ?, ?, 'Melbourne', 'Australia', 'AUD', 'sample')`,
        )
        .run(`c-${++n}`, name, start, start).lastInsertRowid,
    );

  const file = (rel: string, body = "%PDF-1.4 test") => {
    const full = resolveUploadPath(rel, dir);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, body);
    return full;
  };

  const receipt = (tripId: number, over: { source?: string; status?: string } = {}) => {
    const rel = `${tripId}/email-${++n}.pdf`;
    file(rel);
    return (
      db
        .prepare(
          `INSERT INTO receipts (trip_id, kind, description, amount_cents, file_path, mime_type, source, status, supplier_name)
           VALUES (?, 'taxi', 'SAMPLE Cabs', 4500, ?, 'application/pdf', ?, ?, 'SAMPLE Cabs') RETURNING id`,
        )
        .get(tripId, rel, over.source ?? "email", over.status ?? "needs_review") as { id: number }
    ).id;
  };

  const unfiled = (userId: number, createdAt?: string) => {
    const rel = `unfiled/${userId}/inbox-${++n}.pdf`;
    file(rel);
    return (
      db
        .prepare(
          `INSERT INTO unfiled_receipts (user_id, kind, description, amount_cents, file_path, mime_type, reason, supplier_name, gst_cents, created_at)
           VALUES (?, 'other', 'SAMPLE Surf Hire', 6000, ?, 'application/pdf', 'no_match', 'SAMPLE Surf Hire', 545,
                   COALESCE(?, strftime('%Y-%m-%d %H:%M:%f', 'now'))) RETURNING id`,
        )
        .get(userId, rel, createdAt ?? null) as { id: number }
    ).id;
  };

  const review = (over: Partial<Parameters<typeof editReviewReceipt>[2]> = {}) => ({
    supplierName: "SAMPLE Harbour Cabs",
    supplierAbn: "51 824 753 556",
    gstCents: 409,
    amountCents: 4500,
    receiptDate: "2027-03-11",
    kind: "taxi",
    ...over,
  });

  beforeEach(() => {
    db = getDb(":memory:");
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "sl-review-"));
    const orgId = createOrg(db, { name: "A Hospital", financeEmail: "fin@a.example" }).id;
    doc = createUser(db, { orgId, email: "doc@a.example", name: "Dr A", password: "pw123456", role: "doctor" });
    other = createUser(db, { orgId, email: "b@a.example", name: "Dr B", password: "pw123456", role: "doctor" });
    tripA = createTrip({ orgId, userId: doc.id, conferenceId: conf("SAMPLE Heart 2027", "2027-03-10") }, db);
    tripB = createTrip({ orgId, userId: doc.id, conferenceId: conf("SAMPLE Lung 2027", "2027-05-10") }, db);
    otherTrip = createTrip({ orgId, userId: other.id, conferenceId: conf("SAMPLE Skin 2027", "2027-06-10") }, db);
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("lists only the doctor's own needs_review receipts on open trips, and counts them with unfiled", () => {
    const mine = receipt(tripA.id);
    receipt(tripA.id, { status: "confirmed" });
    receipt(otherTrip.id);
    const claimed = createTrip({ orgId: doc.org_id!, userId: doc.id, conferenceId: conf("SAMPLE Old 2027", "2027-01-10") }, db);
    receipt(claimed.id);
    db.prepare("UPDATE trips SET status = 'claimed' WHERE id = ?").run(claimed.id);
    unfiled(doc.id);
    unfiled(other.id);

    expect(listReceiptsToReview(doc, db).map((r) => r.id)).toEqual([mine]);
    expect(listReceiptsToReview(doc, db)[0].conference_name).toBe("SAMPLE Heart 2027");
    expect(countReceiptsToReview(doc, db)).toBe(2);
    expect(countReceiptsToReview(other, db)).toBe(2);
    expect(listMoveTargets(doc, db).map((t) => t.id)).toEqual([tripA.id, tripB.id]);
  });

  it("confirms and edits a filed receipt; others can't", () => {
    const id = receipt(tripA.id);
    expect(() => confirmReviewReceipt(id, other, { db })).toThrow(UploadError);
    const edited = editReviewReceipt(id, doc, review(), { db });
    expect(edited).toMatchObject({ supplier_name: "SAMPLE Harbour Cabs", supplier_abn: "51824753556", gst_cents: 409, status: "needs_review" });
    expect(() => editReviewReceipt(id, doc, review({ gstCents: 9999 }), { db })).toThrow("GST can't be more");
    expect(confirmReviewReceipt(id, doc, { db }).status).toBe("confirmed");
    expect(countReceiptsToReview(doc, db)).toBe(0);
  });

  it("moves a filed receipt and its file to another of my trips only", () => {
    const id = receipt(tripA.id);
    const before = getReceipt(id, db)!.file_path!;
    expect(() => moveReviewReceipt(id, otherTrip.id, doc, { db, dir })).toThrow(UploadError);
    expect(() => moveReviewReceipt(id, tripA.id, doc, { db, dir })).toThrow("already on that trip");
    const moved = moveReviewReceipt(id, tripB.id, doc, { db, dir });
    expect(moved).toMatchObject({ trip_id: tripB.id, status: "needs_review" });
    expect(moved.file_path!.startsWith(`${tripB.id}/`)).toBe(true);
    expect(fs.existsSync(resolveUploadPath(moved.file_path!, dir))).toBe(true);
    expect(fs.existsSync(resolveUploadPath(before, dir))).toBe(false);
    const gen = receipt(tripA.id, { source: "generated" });
    expect(() => moveReviewReceipt(gen, tripB.id, doc, { db, dir })).toThrow("stay with their booking");
  });

  it("deletes a personal receipt (row and file), never a booking receipt", () => {
    const id = receipt(tripA.id);
    const full = resolveUploadPath(getReceipt(id, db)!.file_path!, dir);
    expect(() => deletePersonalReceipt(id, other, { db, dir })).toThrow(UploadError);
    deletePersonalReceipt(id, doc, { db, dir });
    expect(getReceipt(id, db)).toBeUndefined();
    expect(fs.existsSync(full)).toBe(false);
    const gen = receipt(tripA.id, { source: "generated" });
    expect(() => deletePersonalReceipt(gen, doc, { db, dir })).toThrow(UploadError);
  });

  it("edits, files and deletes unfiled receipts, owner only", () => {
    const a = unfiled(doc.id);
    expect(() => editUnfiledReceipt(a, other, review(), { db })).toThrow(UploadError);
    expect(editUnfiledReceipt(a, doc, review({ kind: "meals", supplierName: "SAMPLE Cafe" }), { db })).toMatchObject({
      kind: "meals",
      description: "SAMPLE Cafe",
      supplier_abn: "51824753556",
    });
    const oldPath = resolveUploadPath(getUnfiledReceipt(a, doc.id, db)!.file_path, dir);
    expect(() => moveUnfiledReceipt(a, otherTrip.id, doc, { db, dir })).toThrow(UploadError);
    const filed = moveUnfiledReceipt(a, tripB.id, doc, { db, dir });
    expect(filed).toMatchObject({ trip_id: tripB.id, source: "email", status: "needs_review", kind: "meals", supplier_name: "SAMPLE Cafe", gst_cents: 409 });
    expect(fs.existsSync(resolveUploadPath(filed.file_path!, dir))).toBe(true);
    expect(fs.existsSync(oldPath)).toBe(false);
    expect(listUnfiledReceipts(doc.id, db)).toEqual([]);

    const b = unfiled(doc.id);
    const bPath = resolveUploadPath(getUnfiledReceipt(b, doc.id, db)!.file_path, dir);
    expect(() => deleteUnfiledReceipt(b, other, { db, dir })).toThrow(UploadError);
    deleteUnfiledReceipt(b, doc, { db, dir });
    expect(getUnfiledReceipt(b, doc.id, db)).toBeUndefined();
    expect(fs.existsSync(bPath)).toBe(false);
    expect(listReceipts(tripB.id, db)).toHaveLength(1);
  });

  it("purgeUnfiled deletes unfiled receipts older than 7 days, rows and files", () => {
    const now = new Date("2027-03-20T12:00:00Z");
    const old = unfiled(doc.id, "2027-03-13 11:59:59.000");
    const fresh = unfiled(doc.id, "2027-03-13 12:00:01.000");
    const oldPath = resolveUploadPath(getUnfiledReceipt(old, doc.id, db)!.file_path, dir);
    expect(purgeUnfiled({ db, dir, now })).toBe(1);
    expect(getUnfiledReceipt(old, doc.id, db)).toBeUndefined();
    expect(fs.existsSync(oldPath)).toBe(false);
    expect(getUnfiledReceipt(fresh, doc.id, db)).toBeDefined();
    expect(purgeUnfiled({ db, dir, now })).toBe(0);
  });

  it("runs the purge on each trusted inbound POST, never for a bad secret", async () => {
    const now = new Date("2027-03-20T12:00:00Z");
    const old = unfiled(doc.id, "2027-03-01 00:00:00.000");
    const post = (secret: string) =>
      handleInboundRequest(
        new Request("http://x/api/inbound", {
          method: "POST",
          headers: { "x-inbound-secret": secret },
          body: JSON.stringify({ to: "nobody@example.test", from: "a@b.example", subject: "x", attachments: [] }),
        }),
        { secret: "s3cret", db, dir, now, reader: new MockReceiptReader() },
      );
    expect((await post("wrong")).status).toBe(401);
    expect(getUnfiledReceipt(old, doc.id, db)).toBeDefined();
    expect((await post("s3cret")).status).toBe(404);
    expect(getUnfiledReceipt(old, doc.id, db)).toBeUndefined();
  });
});
