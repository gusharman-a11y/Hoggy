import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { PDFDocument } from "pdf-lib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { getBudget } from "./budget";
import { createTrip, transitionTrip } from "./trips";
import { createOrg, createUser } from "./users";
import {
  buildBookingReceiptPdf,
  createBooking,
  describeBooking,
  generateBookingReceipt,
  listBookings,
  listReceipts,
  resolveUploadPath,
  type Booking,
} from "./receipts";

const flightDetails = {
  offer: {
    airline: "SAMPLE Air",
    outbound: { from: "SYD", to: "MEL", flightNumber: "SA123", departAt: "2027-03-09T06:30", arriveAt: "2027-03-09T08:00" },
    inbound: { from: "MEL", to: "SYD", flightNumber: "SA124", departAt: "2027-03-12T17:45", arriveAt: "2027-03-12T19:15" },
  },
  passenger: { name: "Dr Zoë Ng", email: "doc@a.example" },
};

describe("booking receipts", () => {
  let db: DatabaseSync;
  let dir: string;
  let tripId: number;
  let doc: { id: number; org_id: number | null };

  beforeEach(() => {
    db = getDb(":memory:");
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "sl-uploads-"));
    const orgId = createOrg(db, { name: "A Hospital", financeEmail: "fin@a.example" }).id;
    doc = createUser(db, { orgId, email: "doc@a.example", name: "Dr Zoë Ng", password: "pw123456", role: "doctor" });
    const confId = Number(
      db
        .prepare(
          `INSERT INTO conferences (slug, name, specialty, start_date, end_date, city, country, currency, source)
           VALUES ('c', 'SAMPLE Cardiology Meeting 2027', 'Cardiology', '2027-03-10', '2027-03-12', 'Melbourne', 'Australia', 'AUD', 'sample')`,
        )
        .run().lastInsertRowid,
    );
    tripId = createTrip({ orgId, userId: doc.id, conferenceId: confId, estFlightsCents: 50_000 }, db).id;
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const flight = (): Booking =>
    createBooking(
      { tripId, kind: "flight", provider: "mock", reference: "K7Q2ZD", details: flightDetails, totalCents: 41_250 },
      db,
    );

  it("stores bookings with their details as JSON", () => {
    const b = flight();
    expect(b).toMatchObject({ trip_id: tripId, kind: "flight", reference: "K7Q2ZD", total_cents: 41_250, currency: "AUD" });
    expect(JSON.parse(b.details_json)).toEqual(flightDetails);
    expect(listBookings(tripId, db).map((x) => x.id)).toEqual([b.id]);
    expect(() => createBooking({ tripId, kind: "car" as never, provider: "x", reference: "r", totalCents: 1 }, db)).toThrow();
    expect(() => createBooking({ tripId, kind: "hotel", provider: "x", reference: "r", totalCents: -1 }, db)).toThrow();
  });

  it("writes a valid one-page PDF into the uploads folder and inserts a receipt row", async () => {
    const b = flight();
    const r = await generateBookingReceipt(b, { db, dir, now: new Date("2026-11-09T00:00:00Z") });
    expect(r).toMatchObject({
      trip_id: tripId,
      kind: "flight",
      amount_cents: 41_250,
      currency: "AUD",
      source: "generated",
      mime_type: "application/pdf",
      booking_id: b.id,
      file_path: `${tripId}/booking-${b.id}.pdf`,
    });
    expect(r.description).toContain("K7Q2ZD");
    const bytes = fs.readFileSync(resolveUploadPath(r.file_path!, dir));
    expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toContain("K7Q2ZD");
    expect(listReceipts(tripId, db)).toHaveLength(1);
  });

  it("is idempotent per booking", async () => {
    const b = flight();
    const a = await generateBookingReceipt(b, { db, dir });
    const again = await generateBookingReceipt(b, { db, dir });
    expect(again.id).toBe(a.id);
    expect(listReceipts(tripId, db)).toHaveLength(1);
  });

  it("generated receipts count towards spent once the trip is claimed", async () => {
    await generateBookingReceipt(flight(), { db, dir });
    for (const s of ["pending_approval", "approved", "booked", "claimed"] as const) transitionTrip(tripId, s, {}, db);
    expect(getBudget(doc, 2027, db).spentCents).toBe(41_250);
  });

  it("builds a one-page PDF even for hotels and text the standard fonts can't encode", async () => {
    const hotel = createBooking(
      {
        tripId,
        kind: "hotel",
        provider: "mock",
        reference: "HTL-1",
        details: { hotel: { name: "SAMPLE Hotel 東京 → Plaza" }, checkIn: "2027-03-09", checkOut: "2027-03-12", nights: 3 },
        totalCents: 66_000,
      },
      db,
    );
    expect(describeBooking(hotel)).toEqual(["Hotel: SAMPLE Hotel 東京 → Plaza", "Stay: 2027-03-09 to 2027-03-12", "Nights: 3"]);
    const pdf = await PDFDocument.load(await buildBookingReceiptPdf({ booking: hotel, travellerName: "Dr Zoë Ng" }));
    expect(pdf.getPageCount()).toBe(1);
  });

  it("describes flights in plain lines and tolerates bad JSON", () => {
    const b = flight();
    expect(describeBooking(b)).toEqual([
      "Airline: SAMPLE Air",
      "Outbound: SA123 SYD 2027-03-09 06:30 to MEL 2027-03-09 08:00",
      "Return: SA124 MEL 2027-03-12 17:45 to SYD 2027-03-12 19:15",
      "Traveller: Dr Zoë Ng",
    ]);
    expect(describeBooking({ kind: "flight", details_json: "not json" })).toEqual([]);
  });

  it("refuses file paths outside the uploads folder", () => {
    expect(resolveUploadPath("3/a.pdf", dir)).toBe(path.join(dir, "3", "a.pdf"));
    expect(() => resolveUploadPath("../etc/passwd", dir)).toThrow();
    expect(() => resolveUploadPath("/etc/passwd", dir)).toThrow();
  });
});
