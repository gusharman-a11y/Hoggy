import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { listMigrations, migrate, MIGRATIONS_DIR } from "@/db/migrate";
import { personalInboxAddress } from "./inbound-email";
import {
  confirmReceipt,
  createBooking,
  formatAbn,
  generateBookingReceipt,
  getReceipt,
  isValidAbn,
  listReceiptsNeedingReview,
  normaliseAbn,
  receiptDetailColumns,
  receiptExtraction,
  ReceiptDetailsError,
  setReceiptDetails,
} from "./receipts";
import { createTrip } from "./trips";
import { createOrg, createUser, findUserByInboxCode, getInboxCode } from "./users";

const cols = (db: DatabaseSync, t: string) =>
  (db.prepare(`PRAGMA table_info(${t})`).all() as { name: string }[]).map((c) => c.name);

describe("migration 013 (receipt details + personal inbox)", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sl-mig-"));
  });
  afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("adds the columns, makes existing receipts confirmed and backfills unique inbox codes", () => {
    // Build a database as it was before 013, with data in it.
    for (const f of listMigrations().filter((f) => f < "013")) fs.copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(tmp, f));
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db, tmp);
    db.exec(`INSERT INTO orgs (name, join_code, finance_email) VALUES ('H', 'CODE1234', 'fin@h.example')`);
    for (const e of ["a@h.example", "b@h.example", "c@h.example"])
      db.prepare(`INSERT INTO users (org_id, email, name, password_hash, role) VALUES (1, ?, 'Dr X', 'x', 'doctor')`).run(e);
    db.exec(`INSERT INTO conferences (slug, name, specialty, start_date, end_date, city, country, currency, source)
             VALUES ('c', 'SAMPLE Meeting', 'Cardiology', '2027-03-10', '2027-03-12', 'Melbourne', 'Australia', 'AUD', 'sample')`);
    db.exec(`INSERT INTO trips (org_id, user_id, conference_id) VALUES (1, 1, 1)`);
    db.exec(`INSERT INTO receipts (trip_id, kind, amount_cents, source) VALUES (1, 'taxi', 4500, 'upload'), (1, 'flight', 9000, 'generated')`);

    // Now apply the rest (013+).
    expect(migrate(db)).toContain("013_receipt_details.sql");
    expect(cols(db, "receipts")).toEqual(
      expect.arrayContaining(["supplier_name", "supplier_abn", "gst_cents", "receipt_date", "is_tax_invoice", "status", "extraction_json"]),
    );
    const receipts = db.prepare("SELECT status, supplier_name, gst_cents, is_tax_invoice FROM receipts").all();
    expect(receipts).toEqual([
      { status: "confirmed", supplier_name: null, gst_cents: null, is_tax_invoice: null },
      { status: "confirmed", supplier_name: null, gst_cents: null, is_tax_invoice: null },
    ]);
    const codes = (db.prepare("SELECT inbox_code FROM users").all() as { inbox_code: string }[]).map((r) => r.inbox_code);
    expect(codes).toHaveLength(3);
    for (const c of codes) expect(c).toMatch(/^[0-9a-f]{12}$/);
    expect(new Set(codes).size).toBe(3);

    // New users get one from the trigger; codes are unique.
    db.exec(`INSERT INTO users (org_id, email, name, password_hash, role) VALUES (1, 'd@h.example', 'Dr D', 'x', 'doctor')`);
    const d = db.prepare("SELECT inbox_code FROM users WHERE email = 'd@h.example'").get() as { inbox_code: string };
    expect(d.inbox_code).toMatch(/^[0-9a-f]{12}$/);
    expect(() => db.prepare("UPDATE users SET inbox_code = ? WHERE email = 'd@h.example'").run(codes[0])).toThrow();

    // CHECK constraints.
    expect(() => db.exec("UPDATE receipts SET status = 'maybe'")).toThrow();
    expect(() => db.exec("UPDATE receipts SET is_tax_invoice = 2")).toThrow();
    expect(() => db.exec("UPDATE receipts SET gst_cents = -1")).toThrow();
    db.close();
  });
});

describe("receipt details", () => {
  let db: DatabaseSync;
  let dir: string;
  let tripId: number;
  let doctorId: number;

  beforeEach(() => {
    db = getDb(":memory:");
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "sl-uploads-"));
    const orgId = createOrg(db, { name: "A Hospital", financeEmail: "fin@a.example" }).id;
    doctorId = createUser(db, { orgId, email: "doc@a.example", name: "Dr Ng", password: "pw123456", role: "doctor" }).id;
    const confId = Number(
      db
        .prepare(
          `INSERT INTO conferences (slug, name, specialty, start_date, end_date, city, country, currency, source)
           VALUES ('c', 'SAMPLE Meeting 2027', 'Cardiology', '2027-03-10', '2027-03-12', 'Melbourne', 'Australia', 'AUD', 'sample')`,
        )
        .run().lastInsertRowid,
    );
    tripId = createTrip({ orgId, userId: doctorId, conferenceId: confId }, db).id;
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const generated = async () => {
    const b = createBooking({ tripId, kind: "flight", provider: "mock", reference: "R1", totalCents: 11_000 }, db);
    return generateBookingReceipt(b, { db, dir });
  };

  it("new receipts default to confirmed with empty details", async () => {
    const r = await generated();
    expect(r).toMatchObject({
      status: "confirmed",
      supplier_name: null,
      supplier_abn: null,
      gst_cents: null,
      receipt_date: null,
      is_tax_invoice: null,
      extraction_json: null,
    });
    expect(listReceiptsNeedingReview(tripId, db)).toEqual([]);
  });

  it("saves only the fields given, then confirms", async () => {
    const r = await generated();
    const extraction = { supplierName: "SAMPLE Cabs", confidence: 0.9 };
    const saved = setReceiptDetails(
      r.id,
      {
        supplierName: "  SAMPLE Cabs Pty Ltd ",
        supplierAbn: "51 824 753 556",
        gstCents: 1000,
        receiptDate: "2027-03-10",
        isTaxInvoice: true,
        status: "needs_review",
        extraction,
      },
      db,
    )!;
    expect(saved).toMatchObject({
      supplier_name: "SAMPLE Cabs Pty Ltd",
      supplier_abn: "51824753556",
      gst_cents: 1000,
      receipt_date: "2027-03-10",
      is_tax_invoice: 1,
      status: "needs_review",
    });
    expect(receiptExtraction(saved)).toEqual(extraction);
    expect(listReceiptsNeedingReview(tripId, db).map((x) => x.id)).toEqual([r.id]);

    // Partial update leaves the rest alone; null clears.
    const again = setReceiptDetails(r.id, { isTaxInvoice: false, gstCents: null }, db)!;
    expect(again).toMatchObject({ supplier_name: "SAMPLE Cabs Pty Ltd", is_tax_invoice: 0, gst_cents: null, status: "needs_review" });

    expect(confirmReceipt(r.id, db)!.status).toBe("confirmed");
    expect(listReceiptsNeedingReview(tripId, db)).toEqual([]);
    expect(getReceipt(r.id, db)!.supplier_abn).toBe("51824753556");
    expect(setReceiptDetails(99_999, { supplierName: "x" }, db)).toBeUndefined();
  });

  it("rejects bad details with a user-facing error", () => {
    expect(() => receiptDetailColumns({ supplierAbn: "1234" })).toThrow(ReceiptDetailsError);
    expect(() => receiptDetailColumns({ gstCents: -5 })).toThrow(ReceiptDetailsError);
    expect(() => receiptDetailColumns({ gstCents: 1.5 })).toThrow(ReceiptDetailsError);
    expect(() => receiptDetailColumns({ receiptDate: "2027-02-30" })).toThrow(ReceiptDetailsError);
    expect(() => receiptDetailColumns({ receiptDate: "10/03/2027" })).toThrow(ReceiptDetailsError);
    expect(() => receiptDetailColumns({ status: "maybe" as never })).toThrow(ReceiptDetailsError);
    expect(receiptDetailColumns({ supplierName: "  ", supplierAbn: "", receiptDate: "" })).toEqual({
      supplier_name: null,
      supplier_abn: null,
      receipt_date: null,
    });
    expect(receiptDetailColumns({})).toEqual({});
  });

  it("normalises, checks and formats ABNs", () => {
    expect(normaliseAbn("51 824 753 556")).toBe("51824753556");
    expect(normaliseAbn("51-824-753-556")).toBe("51824753556");
    expect(normaliseAbn("5182475355")).toBeUndefined();
    expect(normaliseAbn(null)).toBeUndefined();
    expect(isValidAbn("51 824 753 556")).toBe(true); // the ATO's documented example
    expect(isValidAbn("51 824 753 557")).toBe(false);
    expect(formatAbn("51824753556")).toBe("51 824 753 556");
    expect(formatAbn("nope")).toBe("");
  });

  it("tolerates bad extraction JSON", () => {
    expect(receiptExtraction({ extraction_json: null })).toBeUndefined();
    expect(receiptExtraction({ extraction_json: "{nope" })).toBeUndefined();
  });

  it("every user gets a personal inbox code and address", () => {
    const code = getInboxCode(db, doctorId)!;
    expect(code).toMatch(/^[0-9a-f]{12}$/);
    expect(personalInboxAddress(code)).toBe(`inbox-${code}@in.studyleave.app`);
    expect(findUserByInboxCode(db, code.toUpperCase())?.id).toBe(doctorId);
    expect(findUserByInboxCode(db, "ffffffffffff")).toBeUndefined();
    expect(getInboxCode(db, 99_999)).toBeUndefined();
  });
});
