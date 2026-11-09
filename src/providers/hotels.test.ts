import { describe, expect, it } from "vitest";
import {
  ExpediaRapidHotelProvider,
  getHotelProvider,
  HotelSearchError,
  MockHotelProvider,
  nightsBetween,
  normaliseHotelSearch,
} from "./hotels";

const stay = { city: "Brisbane", venue: "SAMPLE Hall", checkIn: "2027-04-11", checkOut: "2027-04-15" };
const guest = { name: "Dr Test Person", email: "Doc@Example.test" };

describe("MockHotelProvider.search", () => {
  it("returns 3 hotels with distance to venue, nightly price and total for the stay", async () => {
    const offers = await new MockHotelProvider().search(stay);
    expect(offers).toHaveLength(3);
    for (const o of offers) {
      expect(o.name).toBeTruthy();
      expect(o.address).toContain("Brisbane");
      expect(o.distanceKm).toBeGreaterThan(0);
      expect(o.currency).toBe("AUD");
      expect(Number.isInteger(o.nightlyCents)).toBe(true);
      expect(o.nightlyCents).toBeGreaterThan(0);
      expect(o.nights).toBe(4);
      expect(o.totalCents).toBe(o.nightlyCents * 4);
      expect(o).toMatchObject({ checkIn: stay.checkIn, checkOut: stay.checkOut });
    }
    expect(new Set(offers.map((o) => o.id)).size).toBe(3);
    const km = offers.map((o) => o.distanceKm);
    expect([...km].sort((a, b) => a - b)).toEqual(km); // closest first
  });

  it("is deterministic and varies by city and dates", async () => {
    const p = new MockHotelProvider();
    expect(await p.search(stay)).toEqual(await new MockHotelProvider().search(stay));
    const other = await p.search({ ...stay, city: "Perth" });
    expect(other[0].id).not.toBe((await p.search(stay))[0].id);
    const short = await p.search({ ...stay, checkOut: "2027-04-12" });
    expect(short[0].nights).toBe(1);
    expect(short[0].nightlyCents).toBe((await p.search(stay))[0].nightlyCents);
  });

  it("rejects bad searches with a user-facing message", async () => {
    const p = new MockHotelProvider();
    await expect(p.search({ ...stay, city: "  " })).rejects.toThrow(HotelSearchError);
    await expect(p.search({ ...stay, checkIn: "2027-02-30" })).rejects.toThrow("Enter a check-in date");
    await expect(p.search({ ...stay, checkOut: stay.checkIn })).rejects.toThrow("Check-out must be after check-in");
    await expect(p.search({ ...stay, checkOut: "2027-06-30" })).rejects.toThrow(/30 nights/);
  });
});

describe("MockHotelProvider.book", () => {
  it("books an offer from its id alone with a stable reference", async () => {
    const p = new MockHotelProvider();
    const [first] = await p.search({ ...stay, city: "Gold Coast" });
    const a = await p.book(first.id, guest);
    expect(a.reference).toMatch(/^H-[A-Z0-9]{6}$/);
    expect(a).toMatchObject({ offerId: first.id, hotel: first, nights: 4, totalCents: first.totalCents, currency: "AUD" });
    expect(a.guest).toEqual({ name: "Dr Test Person", email: "doc@example.test" });
    expect((await new MockHotelProvider().book(first.id, guest)).reference).toBe(a.reference);
  });

  it("rejects unknown offers and missing guest details", async () => {
    const p = new MockHotelProvider();
    const [first] = await p.search(stay);
    await expect(p.book("nope", guest)).rejects.toThrow("That hotel offer has expired");
    await expect(p.book("mockhotel_Brisbane_2027-04-11_2027-04-15_7", guest)).rejects.toThrow(/expired/);
    await expect(p.book(first.id, { name: "", email: "a@b.c" })).rejects.toThrow("Guest name is required");
    await expect(p.book(first.id, { name: "X", email: "nope" })).rejects.toThrow("Guest email is required");
  });
});

describe("helpers", () => {
  it("nightsBetween and normaliseHotelSearch", () => {
    expect(nightsBetween("2027-03-30", "2027-04-02")).toBe(3);
    expect(normaliseHotelSearch({ city: "  Gold   Coast ", checkIn: "2027-01-01", checkOut: "2027-01-02", venue: " " })).toEqual({
      city: "Gold Coast",
      venue: undefined,
      checkIn: "2027-01-01",
      checkOut: "2027-01-02",
    });
  });

  it("getHotelProvider uses the mock unless EXPEDIA_RAPID_KEY is set", async () => {
    expect(getHotelProvider({})).toBeInstanceOf(MockHotelProvider);
    const real = getHotelProvider({ EXPEDIA_RAPID_KEY: "k" });
    expect(real).toBeInstanceOf(ExpediaRapidHotelProvider);
    await expect(real.search(stay)).rejects.toThrow(/not implemented/);
  });
});
