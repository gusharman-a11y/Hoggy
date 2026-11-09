import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { getBudget } from "@/lib/budget";
import { listOutbox, OutboxMailer } from "@/lib/mailer";
import { createTrip, getTrip, transitionTrip } from "@/lib/trips";
import { createOrg, createUser, type User } from "@/lib/users";
import { canManageClaims, claimPackForFinance, FinanceError, listClaims, markClaimPaid } from "./finance";
import { sendClaim } from "./send";

describe("finance view", () => {
  let db: DatabaseSync;
  let dir: string;
  let mailer: OutboxMailer;
  let orgId: number;
  let doc: User, finance: User, admin: User, manager: User, outsider: User;
  let confId: number;

  const claimedTrip = async (owner: User, cents: number, now: string) => {
    const tripId = createTrip({ orgId: owner.org_id!, userId: owner.id, conferenceId: confId }, db).id;
    transitionTrip(tripId, "pending_approval", {}, db);
    transitionTrip(tripId, "approved", {}, db);
    transitionTrip(tripId, "booked", {}, db);
    const d = await PDFDocument.create();
    d.addPage([300, 400]);
    const rel = `${tripId}/r.pdf`;
    fs.mkdirSync(path.join(dir, String(tripId)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), await d.save());
    db.prepare(
      "INSERT INTO receipts (trip_id, kind, description, amount_cents, source, file_path, mime_type) VALUES (?, 'other', 'Taxi', ?, 'upload', ?, 'application/pdf')",
    ).run(tripId, cents, rel);
    await sendClaim(tripId, owner, mailer, { db, dir, now: new Date(now) });
    return tripId;
  };

  beforeEach(() => {
    db = getDb(":memory:");
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "finance-"));
    mailer = new OutboxMailer(db);
    orgId = createOrg(db, { name: "SAMPLE Hospital", financeEmail: "claims@hospital.example" }).id;
    const otherOrg = createOrg(db, { name: "SAMPLE Other", financeEmail: "claims@other.example" }).id;
    const mk = (o: number, email: string, name: string, role: User["role"]) =>
      createUser(db, { orgId: o, email, name, password: "pw123456", role });
    doc = mk(orgId, "zoe@a.example", "Dr Zoe Ng", "doctor");
    finance = mk(orgId, "fin@a.example", "Fran Finance", "finance");
    admin = mk(orgId, "ada@a.example", "Ada Admin", "admin");
    manager = mk(orgId, "max@a.example", "Max Manager", "manager");
    outsider = mk(otherOrg, "fin@b.example", "Other Finance", "finance");
    confId = Number(
      db
        .prepare(
          `INSERT INTO conferences (slug, name, specialty, start_date, end_date, city, country, currency, source)
           VALUES ('sample-derm-2027', 'SAMPLE Dermatology Meeting 2027', 'Dermatology', '2027-05-10', '2027-05-12', 'Perth', 'Australia', 'AUD', 'sample')`,
        )
        .run().lastInsertRowid,
    );
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("only finance and admin manage claims", () => {
    expect(canManageClaims(finance)).toBe(true);
    expect(canManageClaims(admin)).toBe(true);
    expect(canManageClaims(manager)).toBe(false);
    expect(canManageClaims(doc)).toBe(false);
    expect(canManageClaims({ role: "finance", org_id: null })).toBe(false);
  });

  it("lists the hospital's claimed and paid trips with doctor, conference, total and sent date", async () => {
    const a = await claimedTrip(doc, 4_550, "2027-05-20T00:00:00Z");
    const b = await claimedTrip(doc, 10_000, "2027-05-21T00:00:00Z");
    createTrip({ orgId, userId: doc.id, conferenceId: confId }, db); // a draft: not a claim

    const list = listClaims(finance, db);
    expect(list.map((c) => c.trip_id)).toEqual([a, b]); // unpaid, oldest first
    expect(list[0]).toMatchObject({
      status: "claimed",
      doctor_name: "Dr Zoe Ng",
      doctor_email: "zoe@a.example",
      conference_name: "SAMPLE Dermatology Meeting 2027",
      total_cents: 4_550,
      sent_at: "2027-05-20T00:00:00.000Z",
      paid_at: null,
    });
    expect(listClaims(admin, db)).toHaveLength(2);
    expect(listClaims(manager, db)).toEqual([]);
    expect(listClaims(doc, db)).toEqual([]);
    expect(listClaims(outsider, db)).toEqual([]);

    await markClaimPaid(a, finance, mailer, { db });
    expect(listClaims(finance, db).map((c) => [c.trip_id, c.status])).toEqual([
      [b, "claimed"],
      [a, "paid"],
    ]);
  });

  it("mark paid moves the trip to paid, records who/when and emails the doctor", async () => {
    const tripId = await claimedTrip(doc, 4_550, "2027-05-20T00:00:00Z");
    const before = listOutbox({}, db).length;

    const paid = await markClaimPaid(tripId, finance, mailer, { db, now: new Date("2027-06-01T02:00:00Z") });

    expect(paid.status).toBe("paid");
    expect(paid.paid_at).toBe("2027-06-01T02:00:00.000Z");
    expect(paid.paid_by).toBe(finance.id);
    expect(getTrip(tripId, db)!.status).toBe("paid");
    const emails = listOutbox({ to: "zoe@a.example" }, db).filter((e) => e.subject.startsWith("Claim paid"));
    expect(listOutbox({}, db)).toHaveLength(before + 1);
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toBe("Claim paid: SAMPLE Dermatology Meeting 2027 (AUD 45.50)");
    expect(emails[0].org_id).toBe(orgId);
    expect(emails[0].body_text).toContain("AUD 45.50");
    // Paid still counts as spent
    expect(getBudget(doc, 2027, db).spentCents).toBe(4_550);
  });

  it("refuses twice, other roles, other hospitals and unknown trips", async () => {
    const tripId = await claimedTrip(doc, 4_550, "2027-05-20T00:00:00Z");
    await expect(markClaimPaid(tripId, doc, mailer, { db })).rejects.toThrow(FinanceError);
    await expect(markClaimPaid(tripId, manager, mailer, { db })).rejects.toThrow("Only finance");
    await expect(markClaimPaid(tripId, outsider, mailer, { db })).rejects.toThrow("Claim not found.");
    await expect(markClaimPaid(9999, finance, mailer, { db })).rejects.toThrow("Claim not found.");
    expect(getTrip(tripId, db)!.status).toBe("claimed");
    await markClaimPaid(tripId, admin, mailer, { db });
    const count = listOutbox({}, db).length;
    await expect(markClaimPaid(tripId, finance, mailer, { db })).rejects.toThrow("already marked paid");
    expect(listOutbox({}, db)).toHaveLength(count);
  });

  it("downloads the exact pack that was emailed, scoped to the hospital's finance", async () => {
    const tripId = await claimedTrip(doc, 4_550, "2027-05-20T00:00:00Z");
    const file = await claimPackForFinance(tripId, finance, { db, dir });
    expect(file!.filename).toMatch(/^claim-sample-derm-2027-ng\.pdf$/);
    const att = db.prepare("SELECT content FROM outbox_attachments").get() as { content: Uint8Array };
    expect(Buffer.from(file!.bytes).equals(Buffer.from(att.content))).toBe(true);
    expect(await claimPackForFinance(tripId, outsider, { db, dir })).toBeUndefined();
    expect(await claimPackForFinance(tripId, doc, { db, dir })).toBeUndefined();

    // Outbox cleared: rebuilt from the receipts instead
    db.exec("DELETE FROM outbox_attachments");
    const rebuilt = await claimPackForFinance(tripId, finance, { db, dir });
    expect((await PDFDocument.load(rebuilt!.bytes)).getPageCount()).toBeGreaterThanOrEqual(3);
  });
});
