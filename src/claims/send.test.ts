import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { getBudget } from "@/lib/budget";
import { getOutboxAttachment, listOutbox, OutboxMailer, type Mailer } from "@/lib/mailer";
import { createTrip, getTrip, transitionTrip } from "@/lib/trips";
import { createOrg, createUser, setFinanceEmail, type User } from "@/lib/users";
import { canSendClaim, ClaimError, getClaimForTrip, sendClaim } from "./send";

async function pdfWithPages(n: number): Promise<Uint8Array> {
  const d = await PDFDocument.create();
  for (let i = 0; i < n; i++) d.addPage([300, 400]);
  return d.save();
}

describe("send claim", () => {
  let db: DatabaseSync;
  let dir: string;
  let orgId: number;
  let doc: User, other: User, finance: User;
  let tripId: number;
  let mailer: OutboxMailer;
  const addReceipt = async (desc: string, cents: number, pages: number) => {
    const rel = `${tripId}/${desc.replace(/\W+/g, "-")}.pdf`;
    fs.mkdirSync(path.join(dir, String(tripId)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), await pdfWithPages(pages));
    db.prepare(
      "INSERT INTO receipts (trip_id, kind, description, amount_cents, source, file_path, mime_type) VALUES (?, 'other', ?, ?, 'upload', ?, 'application/pdf')",
    ).run(tripId, desc, cents, rel);
  };
  const book = () => {
    transitionTrip(tripId, "pending_approval", {}, db);
    transitionTrip(tripId, "approved", {}, db);
    transitionTrip(tripId, "booked", {}, db);
  };

  beforeEach(() => {
    db = getDb(":memory:");
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "send-"));
    mailer = new OutboxMailer(db);
    orgId = createOrg(db, { name: "SAMPLE District Hospital", financeEmail: "Claims@Hospital.example" }).id;
    db.prepare("UPDATE orgs SET default_allowance_cents = 300000 WHERE id = ?").run(orgId);
    const mk = (email: string, name: string, role: User["role"]) =>
      createUser(db, { orgId, email, name, password: "pw123456", role });
    doc = mk("zoe@a.example", "Dr Zoe Ng", "doctor");
    other = mk("sam@a.example", "Dr Sam Lee", "doctor");
    finance = mk("fin@a.example", "Fran Finance", "finance");
    const confId = Number(
      db
        .prepare(
          `INSERT INTO conferences (slug, name, specialty, start_date, end_date, city, country, currency, source)
           VALUES ('sample-cardio-2027', 'SAMPLE Cardiology Meeting 2027', 'Cardiology', '2027-03-10', '2027-03-12', 'Melbourne', 'Australia', 'AUD', 'sample')`,
        )
        .run().lastInsertRowid,
    );
    tripId = createTrip({ orgId, userId: doc.id, conferenceId: confId, estFlightsCents: 100_000, estHotelCents: 80_000 }, db).id;
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("emails finance ONE pack (cc the doctor), marks the trip claimed and records the claim", async () => {
    book();
    await addReceipt("SAMPLE Air SYD-MEL", 41_250, 1);
    await addReceipt("SAMPLE Hotel", 66_000, 2);
    await addReceipt("Taxi", 4_550, 1);

    const claim = await sendClaim(tripId, doc, mailer, { db, dir, now: new Date("2027-03-20T01:02:03Z") });

    const emails = listOutbox({}, db);
    expect(emails).toHaveLength(1);
    const [email] = emails;
    expect(email.to_addr).toBe("claims@hospital.example");
    expect(email.cc_addr).toBe("zoe@a.example");
    expect(email.org_id).toBe(orgId);
    expect(email.subject).toContain("Dr Zoe Ng");
    expect(email.subject).toContain("AUD 1,118.00");
    expect(email.body_text).toContain("SAMPLE Cardiology Meeting 2027");
    expect(email.attachments).toHaveLength(1);
    expect(email.attachments[0]).toMatchObject({
      filename: "claim-sample-cardio-2027-ng.pdf",
      content_type: "application/pdf",
    });
    const file = getOutboxAttachment(email.attachments[0].id, {}, db)!;
    const pdf = await PDFDocument.load(new Uint8Array(file.content));
    // cover (1) + form (1) + receipts (1 + 2 + 1)
    expect(pdf.getPageCount()).toBe(6);

    expect(getTrip(tripId, db)!.status).toBe("claimed");
    expect(claim).toMatchObject({
      trip_id: tripId,
      org_id: orgId,
      sent_by: doc.id,
      to_addr: "claims@hospital.example",
      cc_addr: "zoe@a.example",
      filename: "claim-sample-cardio-2027-ng.pdf",
      total_cents: 111_800,
      receipt_count: 3,
      page_count: 6,
      email_id: email.id,
      sent_at: "2027-03-20T01:02:03.000Z",
    });
    expect(getClaimForTrip(tripId, db)?.id).toBe(claim.id);
  });

  it("budget 'spent' switches from the estimate to the actual receipt total", async () => {
    book();
    await addReceipt("Flight", 41_250, 1);
    await addReceipt("Hotel", 20_000, 1);
    const before = getBudget(doc, 2027, db);
    expect(before.spentCents).toBe(0);
    expect(before.committedCents).toBe(180_000); // estimate while booked
    await sendClaim(tripId, doc, mailer, { db, dir });
    const after = getBudget(doc, 2027, db);
    expect(after.committedCents).toBe(0);
    expect(after.spentCents).toBe(61_250);
    expect(after.remainingCents).toBe(300_000 - 61_250);
  });

  it("only the owner of a booked trip can send, and only once", async () => {
    await addReceipt("Taxi", 4_550, 1);
    const draft = getTrip(tripId, db)!;
    expect(canSendClaim(draft, doc)).toBe(false);
    await expect(sendClaim(tripId, doc, mailer, { db, dir })).rejects.toThrow("Book your travel");
    book();
    const booked = getTrip(tripId, db)!;
    expect(canSendClaim(booked, doc)).toBe(true);
    expect(canSendClaim(booked, other)).toBe(false);
    expect(canSendClaim(booked, finance)).toBe(false);
    await expect(sendClaim(tripId, other, mailer, { db, dir })).rejects.toThrow("Trip not found");
    await expect(sendClaim(tripId, finance, mailer, { db, dir })).rejects.toThrow("Trip not found");
    expect(listOutbox({}, db)).toHaveLength(0);

    await sendClaim(tripId, doc, mailer, { db, dir });
    await expect(sendClaim(tripId, doc, mailer, { db, dir })).rejects.toThrow("already been sent");
    expect(listOutbox({}, db)).toHaveLength(1);
  });

  it("needs a receipt and a finance address; nothing is sent or changed otherwise", async () => {
    book();
    await expect(sendClaim(tripId, doc, mailer, { db, dir })).rejects.toBeInstanceOf(ClaimError);
    await addReceipt("Taxi", 4_550, 1);
    db.prepare("UPDATE orgs SET finance_email = NULL WHERE id = ?").run(orgId);
    await expect(sendClaim(tripId, doc, mailer, { db, dir })).rejects.toThrow("finance email");
    expect(listOutbox({}, db)).toHaveLength(0);
    expect(getTrip(tripId, db)!.status).toBe("booked");

    setFinanceEmail(db, orgId, "new-finance@hospital.example");
    await sendClaim(tripId, doc, mailer, { db, dir });
    expect(listOutbox({}, db)[0].to_addr).toBe("new-finance@hospital.example");
  });

  it("leaves the trip booked when the email fails", async () => {
    book();
    await addReceipt("Taxi", 4_550, 1);
    const broken: Mailer = { send: async () => Promise.reject(new Error("SMTP down")) };
    await expect(sendClaim(tripId, doc, broken, { db, dir })).rejects.toThrow("SMTP down");
    expect(getTrip(tripId, db)!.status).toBe("booked");
    expect(getClaimForTrip(tripId, db)).toBeUndefined();
  });

  it("setFinanceEmail validates and normalises", () => {
    expect(() => setFinanceEmail(db, orgId, "not an email")).toThrow();
    expect(setFinanceEmail(db, orgId, " Pay@Hospital.Example ").finance_email).toBe("pay@hospital.example");
  });
});
