import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { closeDb, getDb } from "@/db";
import { seedConferences } from "@/db/seed";
import { MockFlightProvider, type FlightProvider } from "@/providers/flights";
import { MockPayment, PaymentError, type PaymentProvider } from "@/providers/payment";
import { addDays, bookFlightForTrip, BookingError, canBookTravel, defaultFlightSearch, toFlightQuery } from "./flight-booking";
import { listBookings, listReceipts, resolveUploadPath } from "./receipts";
import { createTrip, getTrip, transitionTrip, type Trip } from "./trips";
import { createOrg, createUser, type User } from "./users";

describe("flight booking", () => {
  let db: DatabaseSync;
  let dir: string;
  let doc: User, doc2: User, manager: User;
  let trip: Trip;
  const query = { from: "SYD", to: "MEL", departDate: "2027-03-01", returnDate: "2027-03-05" };
  let offerId: string;
  let price: number;

  const approve = (id: number) => {
    transitionTrip(id, "pending_approval", {}, db);
    transitionTrip(id, "approved", {}, db);
  };
  const deps = (over: Partial<{ flights: FlightProvider; payment: PaymentProvider }> = {}) => ({
    flights: new MockFlightProvider(),
    payment: new MockPayment(),
    db,
    dir,
    ...over,
  });

  beforeEach(async () => {
    db = getDb(":memory:");
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "sl-flight-"));
    seedConferences(db);
    const orgId = createOrg(db, { name: "A Hospital", financeEmail: "fin@a.example" }).id;
    const mk = (email: string, role: User["role"]) =>
      createUser(db, { orgId, email, name: `Dr ${email}`, password: "pw123456", role });
    doc = mk("doc@a.example", "doctor");
    doc2 = mk("doc2@a.example", "doctor");
    manager = mk("mgr@a.example", "manager");
    const confId = (db.prepare("SELECT id FROM conferences ORDER BY id LIMIT 1").get() as { id: number }).id;
    trip = createTrip({ orgId, userId: doc.id, conferenceId: confId, estFlightsCents: 50000 }, db);
    const offers = await new MockFlightProvider().search(query);
    offerId = offers[0].id;
    price = offers[0].totalCents;
  });
  afterEach(() => {
    closeDb();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("only the owner can book, and only on approved or booked trips", () => {
    expect(canBookTravel(trip, doc)).toBe(false); // draft
    approve(trip.id);
    const t = getTrip(trip.id, db)!;
    expect(canBookTravel(t, doc)).toBe(true);
    expect(canBookTravel(t, doc2)).toBe(false);
    expect(canBookTravel(t, manager)).toBe(false);
    expect(canBookTravel({ ...t, status: "booked" }, doc)).toBe(true);
    expect(canBookTravel({ ...t, status: "claimed" }, doc)).toBe(false);
  });

  it("refuses to book on an unapproved trip", async () => {
    await expect(bookFlightForTrip(trip.id, query, offerId, doc, deps())).rejects.toThrow(BookingError);
    transitionTrip(trip.id, "pending_approval", {}, db);
    await expect(bookFlightForTrip(trip.id, query, offerId, doc, deps())).rejects.toThrow(/approved/);
    expect(listBookings(trip.id, db)).toHaveLength(0);
  });

  it("pays, books, stores a booking + generated receipt, and marks the trip booked", async () => {
    approve(trip.id);
    const charges: number[] = [];
    const payment: PaymentProvider = {
      name: "spy",
      charge: async (req) => {
        charges.push(req.amountCents);
        return { id: "pay_1", status: "succeeded", amountCents: req.amountCents, currency: req.currency };
      },
    };
    const res = await bookFlightForTrip(trip.id, query, offerId, doc, deps({ payment }));
    expect(charges).toEqual([price]);
    expect(res.trip.status).toBe("booked");
    expect(res.booking).toMatchObject({ kind: "flight", provider: "mock", total_cents: price, trip_id: trip.id });
    expect(res.booking.reference).toMatch(/^[A-Z0-9]{6}$/);
    expect(JSON.parse(res.booking.details_json).payment).toEqual({ provider: "spy", id: "pay_1" });
    const receipts = listReceipts(trip.id, db);
    expect(receipts).toHaveLength(1);
    expect(receipts[0]).toMatchObject({ source: "generated", amount_cents: price, booking_id: res.booking.id });
    expect(fs.existsSync(resolveUploadPath(receipts[0].file_path!, dir))).toBe(true);

    // a second flight on the now-booked trip is allowed and keeps it booked
    const again = await bookFlightForTrip(trip.id, query, offerId, doc, deps());
    expect(again.trip.status).toBe("booked");
    expect(listBookings(trip.id, db)).toHaveLength(2);
  });

  it("rejects offers that don't match the search, and other doctors", async () => {
    approve(trip.id);
    await expect(bookFlightForTrip(trip.id, query, "mock_SYD_MEL_2027-03-01__9", doc, deps())).rejects.toThrow(/expired/);
    await expect(bookFlightForTrip(trip.id, { ...query, to: "BNE" }, offerId, doc, deps())).rejects.toThrow(/expired/);
    await expect(bookFlightForTrip(trip.id, query, offerId, doc2, deps())).rejects.toThrow(BookingError);
    expect(getTrip(trip.id, db)!.status).toBe("approved");
  });

  it("a failed payment books nothing", async () => {
    approve(trip.id);
    let booked = false;
    const flights = new MockFlightProvider();
    const spyFlights: FlightProvider = {
      name: "mock",
      search: (q) => flights.search(q),
      book: async (...a) => {
        booked = true;
        return flights.book(...a);
      },
    };
    const payment: PaymentProvider = {
      name: "fail",
      charge: async () => {
        throw new PaymentError("Card declined");
      },
    };
    await expect(bookFlightForTrip(trip.id, query, offerId, doc, deps({ flights: spyFlights, payment }))).rejects.toThrow(
      "Payment failed: Card declined",
    );
    expect(booked).toBe(false);
    expect(listBookings(trip.id, db)).toHaveLength(0);
    expect(getTrip(trip.id, db)!.status).toBe("approved");
  });

  it("default search: departure city -> conference city, the day before to the day after", () => {
    const t = { depart_city: "Sydney", conference_city: "Melbourne", conference_start: "2027-03-02", conference_end: "2027-03-04" };
    expect(defaultFlightSearch(t)).toEqual({ from: "SYD", to: "MEL", departDate: "2027-03-01", returnDate: "2027-03-05" });
    expect(defaultFlightSearch({ ...t, depart_city: null }, { to: "BNE" })).toMatchObject({ from: "", to: "BNE" });
    expect(toFlightQuery({ from: "perth", to: "MEL", departDate: "2027-03-01", returnDate: "" })).toEqual({
      from: "PER",
      to: "MEL",
      departDate: "2027-03-01",
      returnDate: undefined,
    });
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });
});
