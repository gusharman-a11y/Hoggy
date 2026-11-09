import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { seedConferences } from "@/db/seed";
import { MockHotelProvider } from "@/providers/hotels";
import { MockPayment, PaymentError, type PaymentProvider } from "@/providers/payment";
import { BookingError } from "./flight-booking";
import { bookHotelForTrip, defaultHotelSearch, toHotelQuery } from "./hotel-booking";
import { describeBooking, listBookings, listReceipts, resolveUploadPath } from "./receipts";
import { createTrip, getTrip, transitionTrip, type Trip } from "./trips";
import { createOrg, createUser, type User } from "./users";

describe("hotel booking", () => {
  let db: DatabaseSync;
  let dir: string;
  let doc: User, doc2: User;
  let trip: Trip;
  const query = { city: "Melbourne", checkIn: "2027-03-01", checkOut: "2027-03-04" };
  let offerId: string;
  let price: number;

  const approve = (id: number) => {
    transitionTrip(id, "pending_approval", {}, db);
    transitionTrip(id, "approved", {}, db);
  };
  const deps = (payment: PaymentProvider = new MockPayment()) => ({ hotels: new MockHotelProvider(), payment, db, dir });

  beforeEach(async () => {
    db = getDb(":memory:");
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "sl-hotel-"));
    seedConferences(db);
    const orgId = createOrg(db, { name: "A Hospital", financeEmail: "fin@a.example" }).id;
    const mk = (email: string) => createUser(db, { orgId, email, name: `Dr ${email}`, password: "pw123456", role: "doctor" });
    doc = mk("doc@a.example");
    doc2 = mk("doc2@a.example");
    const confId = (db.prepare("SELECT id FROM conferences ORDER BY id LIMIT 1").get() as { id: number }).id;
    trip = createTrip({ orgId, userId: doc.id, conferenceId: confId }, db);
    const offers = await new MockHotelProvider().search(query);
    offerId = offers[1].id;
    price = offers[1].totalCents;
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("refuses unapproved trips and other doctors", async () => {
    await expect(bookHotelForTrip(trip.id, query, offerId, doc, deps())).rejects.toThrow(BookingError);
    approve(trip.id);
    await expect(bookHotelForTrip(trip.id, query, offerId, doc2, deps())).rejects.toThrow(/own approved trip/);
    await expect(bookHotelForTrip(trip.id, { ...query, city: "Perth" }, offerId, doc, deps())).rejects.toThrow(/expired/);
    expect(listBookings(trip.id, db)).toHaveLength(0);
  });

  it("pays, books, stores booking + generated receipt with nights, and marks the trip booked", async () => {
    approve(trip.id);
    const res = await bookHotelForTrip(trip.id, query, offerId, doc, deps());
    expect(res.trip.status).toBe("booked");
    expect(res.booking).toMatchObject({ kind: "hotel", provider: "mock", total_cents: price });
    const lines = describeBooking(res.booking);
    expect(lines).toContain("Nights: 3");
    expect(lines).toContain("Stay: 2027-03-01 to 2027-03-04");
    expect(lines.some((l) => l.startsWith("Hotel: Test Suites Melbourne"))).toBe(true);
    expect(lines.some((l) => /^Distance to venue: [\d.]+ km$/.test(l))).toBe(true);
    const receipts = listReceipts(trip.id, db);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ source: "generated", amount_cents: price, booking_id: res.booking.id });
    expect(receipts[0].description).toMatch(/^Hotel · Test Suites Melbourne/);
    expect(fs.existsSync(resolveUploadPath(receipts[0].file_path!, dir))).toBe(true);
  });

  it("a failed payment books nothing", async () => {
    approve(trip.id);
    const fail: PaymentProvider = {
      name: "fail",
      charge: async () => {
        throw new PaymentError("Card declined");
      },
    };
    await expect(bookHotelForTrip(trip.id, query, offerId, doc, deps(fail))).rejects.toThrow("Payment failed: Card declined");
    expect(listBookings(trip.id, db)).toHaveLength(0);
    expect(getTrip(trip.id, db)!.status).toBe("approved");
  });

  it("default search: conference city, the day before to the day after", () => {
    const t = { conference_city: "Hobart", conference_start: "2027-03-02", conference_end: "2027-03-04" };
    expect(defaultHotelSearch(t)).toEqual({ city: "Hobart", checkIn: "2027-03-01", checkOut: "2027-03-05" });
    expect(defaultHotelSearch(t, { city: " Launceston " }).city).toBe("Launceston");
    expect(toHotelQuery({ city: "Hobart", checkIn: "a", checkOut: "b" }, null).venue).toBeUndefined();
  });
});
