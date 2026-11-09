/**
 * Hotels behind one interface. Dev/test: MockHotelProvider (deterministic,
 * no network). Real: ExpediaRapidHotelProvider skeleton, only when
 * EXPEDIA_RAPID_KEY is set. Money is integer cents; the mock always quotes AUD.
 */

export interface HotelSearch {
  /** City the conference is in, e.g. "Brisbane". */
  city: string;
  /** Conference venue, used to describe the distance. Optional. */
  venue?: string;
  /** YYYY-MM-DD */
  checkIn: string;
  /** YYYY-MM-DD, after checkIn. */
  checkOut: string;
}

export interface HotelOffer {
  id: string;
  name: string;
  address: string;
  /** Straight-line distance to the venue, in km (one decimal). */
  distanceKm: number;
  nightlyCents: number;
  nights: number;
  checkIn: string;
  checkOut: string;
  totalCents: number;
  currency: string;
}

export interface Guest {
  name: string;
  email: string;
}

export interface HotelBooking {
  /** Confirmation number, e.g. "H-4K7Q2Z". */
  reference: string;
  offerId: string;
  hotel: HotelOffer;
  guest: Guest;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalCents: number;
  currency: string;
}

export interface HotelProvider {
  readonly name: string;
  search(query: HotelSearch): Promise<HotelOffer[]>;
  book(offerId: string, guest: Guest): Promise<HotelBooking>;
}

/** Bad input from the user (shown on screen as-is). */
export class HotelSearchError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Whole nights between two YYYY-MM-DD dates. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / 86_400_000);
}

export const MAX_NIGHTS = 30;

/** Trims the query and throws HotelSearchError when it can't be searched. */
export function normaliseHotelSearch(q: HotelSearch): HotelSearch {
  const city = (q.city ?? "").trim().replace(/\s+/g, " ");
  const venue = q.venue?.trim() || undefined;
  const checkIn = (q.checkIn ?? "").trim();
  const checkOut = (q.checkOut ?? "").trim();
  if (!city) throw new HotelSearchError("Enter the city you're staying in");
  if (!isRealDate(checkIn)) throw new HotelSearchError("Enter a check-in date");
  if (!isRealDate(checkOut)) throw new HotelSearchError("Enter a check-out date");
  const nights = nightsBetween(checkIn, checkOut);
  if (nights < 1) throw new HotelSearchError("Check-out must be after check-in");
  if (nights > MAX_NIGHTS) throw new HotelSearchError(`Stays are limited to ${MAX_NIGHTS} nights`);
  return { city, venue, checkIn, checkOut };
}

/** Small stable string hash (FNV-1a, 32-bit). */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The 3 mock hotels: name pattern, street, distance band and price factor. Closest is dearest. */
const MOCK_HOTELS = [
  { name: (c: string) => `SAMPLE ${c} Conference Hotel`, street: "Convention Way", baseKm: 0.2, priceFactor: 1.35 },
  { name: (c: string) => `Test Suites ${c} Central`, street: "Station Street", baseKm: 1.1, priceFactor: 1.0 },
  { name: (c: string) => `Demo Budget Inn ${c}`, street: "Park Road", baseKm: 3.4, priceFactor: 0.7 },
] as const;

const MOCK_PREFIX = "mockhotel";

function mockOffers(q: HotelSearch): HotelOffer[] {
  const cityKey = q.city.toLowerCase();
  const baseNightlyCents = 15000 + (hash(cityKey) % 15) * 1000; // AUD 150 – 290
  const nights = nightsBetween(q.checkIn, q.checkOut);
  return MOCK_HOTELS.map((h, i) => {
    const nightlyCents = Math.round((baseNightlyCents * h.priceFactor) / 100) * 100;
    const distanceKm = Math.round((h.baseKm + (hash(`${cityKey}#${i}`) % 5) / 10) * 10) / 10;
    return {
      id: [MOCK_PREFIX, encodeURIComponent(q.city), q.checkIn, q.checkOut, i].join("_"),
      name: h.name(q.city),
      address: `${10 + (hash(`${cityKey}@${i}`) % 190)} ${h.street}, ${q.city}`,
      distanceKm,
      nightlyCents,
      nights,
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      totalCents: nightlyCents * nights,
      currency: "AUD",
    };
  }).sort((a, b) => a.distanceKm - b.distanceKm);
}

const REF_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function mockReference(seed: string): string {
  let out = "H-";
  for (let i = 0; i < 6; i++) out += REF_CHARS[hash(`${seed}#${i}`) % REF_CHARS.length];
  return out;
}

/**
 * Test provider: the same query always gives the same 3 hotels (closest to
 * the venue first), and booking always succeeds with a deterministic
 * reference. Offer ids encode the search, so book() needs no stored state.
 */
export class MockHotelProvider implements HotelProvider {
  readonly name = "mock";

  async search(query: HotelSearch): Promise<HotelOffer[]> {
    return mockOffers(normaliseHotelSearch(query));
  }

  async book(offerId: string, guest: Guest): Promise<HotelBooking> {
    const name = guest.name?.trim();
    const email = guest.email?.trim().toLowerCase();
    if (!name) throw new HotelSearchError("Guest name is required");
    if (!email || !email.includes("@")) throw new HotelSearchError("Guest email is required");
    const parts = offerId.split("_");
    if (parts.length !== 5 || parts[0] !== MOCK_PREFIX) throw new HotelSearchError("That hotel offer has expired");
    let offers: HotelOffer[];
    try {
      const [, city, checkIn, checkOut] = parts;
      offers = mockOffers(normaliseHotelSearch({ city: decodeURIComponent(city), checkIn, checkOut }));
    } catch {
      throw new HotelSearchError("That hotel offer has expired");
    }
    const hotel = offers.find((o) => o.id === offerId);
    if (!hotel) throw new HotelSearchError("That hotel offer has expired");
    return {
      reference: mockReference(`${offerId}|${email}`),
      offerId,
      hotel,
      guest: { name, email },
      checkIn: hotel.checkIn,
      checkOut: hotel.checkOut,
      nights: hotel.nights,
      totalCents: hotel.totalCents,
      currency: hotel.currency,
    };
  }
}

/**
 * Placeholder for a real provider (Expedia Rapid / Hotelbeds). Only chosen
 * when EXPEDIA_RAPID_KEY is set; never used in tests. Not wired up yet.
 */
export class ExpediaRapidHotelProvider implements HotelProvider {
  readonly name = "expedia-rapid";

  constructor(private readonly apiKey: string) {}

  async search(): Promise<HotelOffer[]> {
    void this.apiKey;
    throw new Error("Real hotel search is not implemented yet: unset EXPEDIA_RAPID_KEY to use test hotels");
  }

  async book(): Promise<HotelBooking> {
    throw new Error("Real hotel booking is not implemented yet: unset EXPEDIA_RAPID_KEY to use test hotels");
  }
}

/** The app's hotel provider: the real one when EXPEDIA_RAPID_KEY is set, otherwise the mock. */
export function getHotelProvider(env: Record<string, string | undefined> = process.env): HotelProvider {
  if (env.EXPEDIA_RAPID_KEY) return new ExpediaRapidHotelProvider(env.EXPEDIA_RAPID_KEY);
  return new MockHotelProvider();
}
