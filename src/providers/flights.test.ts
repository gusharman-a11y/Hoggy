import { describe, expect, it } from "vitest";
import { SAMPLE_CONFERENCES } from "@/db/sample-conferences";
import { CITY_TO_IATA, cityToIata, isKnownAirport } from "./airports";
import {
  DuffelFlightProvider,
  FlightSearchError,
  getFlightProvider,
  MockFlightProvider,
  normaliseFlightSearch,
} from "./flights";

const trip = { from: "SYD", to: "MEL", departDate: "2027-03-03", returnDate: "2027-03-07" };
const passenger = { name: "Dr Test Person", email: "doc@example.test" };

describe("MockFlightProvider.search", () => {
  it("returns 3 offers with airline, times and an AUD price", async () => {
    const offers = await new MockFlightProvider().search(trip);
    expect(offers).toHaveLength(3);
    for (const o of offers) {
      expect(o.airline).toBeTruthy();
      expect(o.currency).toBe("AUD");
      expect(Number.isInteger(o.totalCents)).toBe(true);
      expect(o.totalCents).toBeGreaterThan(0);
      expect(o.outbound).toMatchObject({ from: "SYD", to: "MEL" });
      expect(o.outbound.departAt.startsWith("2027-03-03T")).toBe(true);
      expect(o.outbound.arriveAt > o.outbound.departAt).toBe(true);
      expect(o.inbound).toMatchObject({ from: "MEL", to: "SYD" });
      expect(o.inbound!.departAt.startsWith("2027-03-07T")).toBe(true);
    }
    expect(new Set(offers.map((o) => o.id)).size).toBe(3);
    const prices = offers.map((o) => o.totalCents);
    expect([...prices].sort((a, b) => a - b)).toEqual(prices);
  });

  it("is deterministic", async () => {
    const a = await new MockFlightProvider().search(trip);
    const b = await new MockFlightProvider().search({ ...trip, from: " syd ", to: "mel" });
    expect(b).toEqual(a);
  });

  it("one way has no inbound leg and costs less than the return", async () => {
    const p = new MockFlightProvider();
    const oneWay = await p.search({ from: "SYD", to: "MEL", departDate: "2027-03-03" });
    const ret = await p.search(trip);
    expect(oneWay.every((o) => o.inbound === undefined)).toBe(true);
    expect(oneWay[0].totalCents).toBeLessThan(ret[0].totalCents);
  });

  it("rejects bad searches with a readable message", async () => {
    const p = new MockFlightProvider();
    await expect(p.search({ ...trip, from: "" })).rejects.toThrow(FlightSearchError);
    await expect(p.search({ ...trip, to: "SYD" })).rejects.toThrow("different airports");
    await expect(p.search({ ...trip, departDate: "2027-02-30" })).rejects.toThrow("departure date");
    await expect(p.search({ ...trip, returnDate: "2027-03-01" })).rejects.toThrow("before the departure");
  });
});

describe("MockFlightProvider.book", () => {
  it("returns a booking reference and the offer total", async () => {
    const p = new MockFlightProvider();
    const [, offer] = await p.search(trip);
    const booking = await p.book(offer.id, passenger);
    expect(booking.reference).toMatch(/^[A-Z0-9]{6}$/);
    expect(booking.totalCents).toBe(offer.totalCents);
    expect(booking.currency).toBe("AUD");
    expect(booking.offer).toEqual(offer);
    expect(booking.passenger).toEqual(passenger);
    expect((await p.book(offer.id, passenger)).reference).toBe(booking.reference);
  });

  it("rejects unknown offers and missing passenger details", async () => {
    const p = new MockFlightProvider();
    const [offer] = await p.search(trip);
    await expect(p.book("nope", passenger)).rejects.toThrow("expired");
    await expect(p.book(offer.id.replace(/_0$/, "_7"), passenger)).rejects.toThrow("expired");
    await expect(p.book(offer.id, { ...passenger, name: " " })).rejects.toThrow("name");
    await expect(p.book(offer.id, { ...passenger, email: "x" })).rejects.toThrow("email");
  });
});

describe("normaliseFlightSearch", () => {
  it("treats a blank return date as one way", () => {
    expect(normaliseFlightSearch({ ...trip, returnDate: "" }).returnDate).toBeUndefined();
  });
});

describe("cityToIata", () => {
  it("maps every sample conference city", () => {
    for (const c of SAMPLE_CONFERENCES) expect(cityToIata(c.city), c.city).toMatch(/^[A-Z]{3}$/);
  });

  it("is case/space insensitive and passes through IATA codes", () => {
    expect(cityToIata(" sydney ")).toBe("SYD");
    expect(cityToIata("Gold  Coast")).toBe("OOL");
    expect(cityToIata("mel")).toBe("MEL");
    expect(cityToIata("Atlantis City")).toBeUndefined();
    expect(cityToIata("")).toBeUndefined();
    expect(cityToIata(null)).toBeUndefined();
    expect(isKnownAirport("syd")).toBe(true);
    expect(isKnownAirport("XXX")).toBe(false);
    expect(Object.keys(CITY_TO_IATA).length).toBeGreaterThan(20);
  });
});

describe("getFlightProvider", () => {
  it("uses the mock unless DUFFEL_TOKEN is set (no network call is made)", () => {
    expect(getFlightProvider({})).toBeInstanceOf(MockFlightProvider);
    expect(getFlightProvider({ DUFFEL_TOKEN: "duffel_test_x" })).toBeInstanceOf(DuffelFlightProvider);
  });
});
