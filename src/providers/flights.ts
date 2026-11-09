/**
 * Flights behind one interface. Dev/test: MockFlightProvider (deterministic,
 * no network). Real: DuffelFlightProvider, only when DUFFEL_TOKEN is set.
 * Money is integer cents; the mock always quotes AUD.
 */

export interface FlightSearch {
  /** IATA codes, e.g. "SYD". Use cityToIata() from ./airports to get one. */
  from: string;
  to: string;
  /** YYYY-MM-DD */
  departDate: string;
  /** YYYY-MM-DD; omit for one way. */
  returnDate?: string;
}

export interface FlightLeg {
  from: string;
  to: string;
  flightNumber: string;
  /** Local time at the airport, YYYY-MM-DDTHH:MM (no zone). */
  departAt: string;
  arriveAt: string;
}

export interface FlightOffer {
  id: string;
  airline: string;
  outbound: FlightLeg;
  inbound?: FlightLeg;
  totalCents: number;
  currency: string;
}

export interface Passenger {
  name: string;
  email: string;
}

export interface FlightBooking {
  /** Airline-style booking reference (PNR), e.g. "K7Q2ZD". */
  reference: string;
  offerId: string;
  offer: FlightOffer;
  passenger: Passenger;
  totalCents: number;
  currency: string;
}

export interface FlightProvider {
  readonly name: string;
  search(query: FlightSearch): Promise<FlightOffer[]>;
  book(offerId: string, passenger: Passenger): Promise<FlightBooking>;
}

/** Bad input from the user (shown on screen as-is). */
export class FlightSearchError extends Error {}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Trims/upper-cases the query and throws FlightSearchError when it can't be searched. */
export function normaliseFlightSearch(q: FlightSearch): FlightSearch {
  const from = (q.from ?? "").trim().toUpperCase();
  const to = (q.to ?? "").trim().toUpperCase();
  const departDate = (q.departDate ?? "").trim();
  const returnDate = q.returnDate?.trim() || undefined;
  if (!/^[A-Z]{3}$/.test(from)) throw new FlightSearchError("Choose where you're flying from");
  if (!/^[A-Z]{3}$/.test(to)) throw new FlightSearchError("Choose where you're flying to");
  if (from === to) throw new FlightSearchError("From and to must be different airports");
  if (!isRealDate(departDate)) throw new FlightSearchError("Enter a departure date");
  if (returnDate !== undefined) {
    if (!isRealDate(returnDate)) throw new FlightSearchError("Enter a valid return date");
    if (returnDate < departDate) throw new FlightSearchError("Return date can't be before the departure date");
  }
  return { from, to, departDate, returnDate };
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

function addMinutes(date: string, minutes: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutes);
  return d.toISOString().slice(0, 16);
}

const MOCK_AIRLINES = [
  { name: "SAMPLE Air", code: "SA" },
  { name: "Test Pacific Airways", code: "TP" },
  { name: "Demo Jet", code: "DJ" },
] as const;

/** Departure times (minutes after midnight) and price factors for the 3 offers. */
const MOCK_SLOTS = [
  { departMin: 6 * 60 + 30, priceFactor: 0.9 },
  { departMin: 11 * 60 + 15, priceFactor: 1.0 },
  { departMin: 17 * 60 + 45, priceFactor: 1.25 },
] as const;

const MOCK_PREFIX = "mock";

function mockLeg(from: string, to: string, date: string, slot: number, airline: string): FlightLeg {
  const route = [from, to].sort().join("-");
  const durationMin = 60 + (hash(route) % 14) * 45; // 1h to ~10h45, same both ways
  const departMin = MOCK_SLOTS[slot].departMin;
  return {
    from,
    to,
    flightNumber: `${airline}${100 + (hash(`${from}${to}${slot}`) % 900)}`,
    departAt: addMinutes(date, departMin),
    arriveAt: addMinutes(date, departMin + durationMin),
  };
}

function mockOffers(q: FlightSearch): FlightOffer[] {
  const route = [q.from, q.to].sort().join("-");
  const baseOneWayCents = 12000 + (hash(route) % 90) * 1000; // AUD 120 – 1,010
  return MOCK_SLOTS.map((slot, i) => {
    const airline = MOCK_AIRLINES[i];
    const legs = q.returnDate ? 2 : 1;
    return {
      id: [MOCK_PREFIX, q.from, q.to, q.departDate, q.returnDate ?? "", i].join("_"),
      airline: airline.name,
      outbound: mockLeg(q.from, q.to, q.departDate, i, airline.code),
      inbound: q.returnDate ? mockLeg(q.to, q.from, q.returnDate, i, airline.code) : undefined,
      totalCents: Math.round((baseOneWayCents * slot.priceFactor * legs) / 100) * 100,
      currency: "AUD",
    };
  });
}

const PNR_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function mockReference(seed: string): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += PNR_CHARS[hash(`${seed}#${i}`) % PNR_CHARS.length];
  return out;
}

/**
 * Test provider: the same query always gives the same 3 offers (cheapest
 * first), and booking always succeeds with a deterministic reference.
 * Offer ids encode the search, so book() needs no stored state.
 */
export class MockFlightProvider implements FlightProvider {
  readonly name = "mock";

  async search(query: FlightSearch): Promise<FlightOffer[]> {
    return mockOffers(normaliseFlightSearch(query));
  }

  async book(offerId: string, passenger: Passenger): Promise<FlightBooking> {
    const name = passenger.name?.trim();
    const email = passenger.email?.trim().toLowerCase();
    if (!name) throw new FlightSearchError("Passenger name is required");
    if (!email || !email.includes("@")) throw new FlightSearchError("Passenger email is required");
    const parts = offerId.split("_");
    if (parts.length !== 6 || parts[0] !== MOCK_PREFIX) throw new FlightSearchError("That flight offer has expired");
    const [, from, to, departDate, returnDate] = parts;
    let offers: FlightOffer[];
    try {
      offers = mockOffers(normaliseFlightSearch({ from, to, departDate, returnDate: returnDate || undefined }));
    } catch {
      throw new FlightSearchError("That flight offer has expired");
    }
    const offer = offers.find((o) => o.id === offerId);
    if (!offer) throw new FlightSearchError("That flight offer has expired");
    return {
      reference: mockReference(`${offerId}|${email}`),
      offerId,
      offer,
      passenger: { name, email },
      totalCents: offer.totalCents,
      currency: offer.currency,
    };
  }
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

interface DuffelSegment {
  origin?: { iata_code?: string };
  destination?: { iata_code?: string };
  departing_at?: string;
  arriving_at?: string;
  marketing_carrier?: { iata_code?: string };
  marketing_carrier_flight_number?: string;
}

interface DuffelOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  owner?: { name?: string };
  slices?: { segments?: DuffelSegment[] }[];
}

/** Turns a Duffel slice (one or more segments) into one leg. */
function duffelLeg(segments: DuffelSegment[] | undefined): FlightLeg | undefined {
  if (!segments?.length) return undefined;
  const first = segments[0];
  const last = segments[segments.length - 1];
  return {
    from: first.origin?.iata_code ?? "",
    to: last.destination?.iata_code ?? "",
    flightNumber: `${first.marketing_carrier?.iata_code ?? ""}${first.marketing_carrier_flight_number ?? ""}`,
    departAt: (first.departing_at ?? "").slice(0, 16),
    arriveAt: (last.arriving_at ?? "").slice(0, 16),
  };
}

/**
 * Skeleton for the real provider (Duffel). Only chosen when DUFFEL_TOKEN is
 * set; never used in tests. search() maps Duffel offer requests; book() needs
 * the full passenger details Duffel requires and is not wired up yet.
 */
export class DuffelFlightProvider implements FlightProvider {
  readonly name = "duffel";

  constructor(
    private readonly token: string,
    private readonly fetchImpl: FetchLike = fetch as unknown as FetchLike,
    private readonly baseUrl = "https://api.duffel.com",
  ) {}

  async search(query: FlightSearch): Promise<FlightOffer[]> {
    const q = normaliseFlightSearch(query);
    const slices = [{ origin: q.from, destination: q.to, departure_date: q.departDate }];
    if (q.returnDate) slices.push({ origin: q.to, destination: q.from, departure_date: q.returnDate });
    const res = await this.fetchImpl(`${this.baseUrl}/air/offer_requests?return_offers=true`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ data: { slices, passengers: [{ type: "adult" }], cabin_class: "economy" } }),
    });
    if (!res.ok) throw new Error(`Duffel search failed (HTTP ${res.status})`);
    const body = (await res.json()) as { data?: { offers?: DuffelOffer[] } };
    return (body.data?.offers ?? [])
      .map((o): FlightOffer | undefined => {
        const outbound = duffelLeg(o.slices?.[0]?.segments);
        if (!outbound) return undefined;
        return {
          id: o.id,
          airline: o.owner?.name ?? "",
          outbound,
          inbound: duffelLeg(o.slices?.[1]?.segments),
          totalCents: Math.round(Number(o.total_amount) * 100),
          currency: o.total_currency,
        };
      })
      .filter((o): o is FlightOffer => o !== undefined)
      .sort((a, b) => a.totalCents - b.totalCents);
  }

  async book(): Promise<FlightBooking> {
    throw new Error("Duffel booking is not implemented yet: unset DUFFEL_TOKEN to use test flights");
  }
}

/** The app's flight provider: Duffel when DUFFEL_TOKEN is set, otherwise the mock. */
export function getFlightProvider(env: Record<string, string | undefined> = process.env): FlightProvider {
  if (env.DUFFEL_TOKEN) return new DuffelFlightProvider(env.DUFFEL_TOKEN);
  return new MockFlightProvider();
}
