/**
 * Booking a flight for a trip: who may, what to search for by default, and
 * the book step (MockPayment/real payment -> provider.book() -> booking row
 * + generated receipt -> trip approved -> booked).
 */
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import { cityToIata } from "@/providers/airports";
import { FlightSearchError, type FlightProvider, type FlightSearch } from "@/providers/flights";
import { PaymentError, type PaymentProvider } from "@/providers/payment";
import { createBooking, generateBookingReceipt, type Booking, type Receipt } from "./receipts";
import { getTrip, getTripForViewer, transitionTrip, type Trip, type TripStatus, type TripViewer } from "./trips";

/** Trip statuses in which the doctor can book travel. */
export const BOOKABLE_STATUSES: readonly TripStatus[] = ["approved", "booked"];

export class BookingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingError";
  }
}

/** Only the trip's owner, and only once the trip is approved (or already booked). */
export function canBookTravel(trip: Pick<Trip, "org_id" | "user_id" | "status">, viewer: TripViewer): boolean {
  return viewer.id === trip.user_id && viewer.org_id === trip.org_id && BOOKABLE_STATUSES.includes(trip.status);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface FlightSearchForm {
  from: string;
  to: string;
  departDate: string;
  returnDate: string;
}

/**
 * The search form's values: URL params when given, else the trip's departure
 * city -> conference city, flying in the day before and home the day after.
 */
export function defaultFlightSearch(
  trip: { depart_city: string | null; conference_city: string; conference_start: string; conference_end: string },
  params: Partial<Record<keyof FlightSearchForm, string | undefined>> = {},
): FlightSearchForm {
  const pick = (v: string | undefined, fallback: string) => (v !== undefined ? v.trim() : fallback);
  return {
    from: pick(params.from, cityToIata(trip.depart_city) ?? ""),
    to: pick(params.to, cityToIata(trip.conference_city) ?? ""),
    departDate: pick(params.departDate, addDays(trip.conference_start, -1)),
    returnDate: pick(params.returnDate, addDays(trip.conference_end, 1)),
  };
}

/** Form values -> provider query (city names are turned into airport codes). */
export function toFlightQuery(form: FlightSearchForm): FlightSearch {
  return {
    from: cityToIata(form.from) ?? form.from,
    to: cityToIata(form.to) ?? form.to,
    departDate: form.departDate,
    returnDate: form.returnDate || undefined,
  };
}

export interface BookFlightDeps {
  flights: FlightProvider;
  payment: PaymentProvider;
  db?: DatabaseSync;
  /** Uploads folder for the generated receipt. */
  dir?: string;
  now?: Date;
}

export interface BookFlightResult {
  booking: Booking;
  receipt: Receipt;
  trip: Trip;
}

/** Pays for and books one flight offer (found by re-running `query`) on the viewer's approved trip. Throws BookingError with a user-facing message. */
export async function bookFlightForTrip(
  tripId: number,
  query: FlightSearch,
  offerId: string,
  viewer: TripViewer & { email: string; name: string },
  deps: BookFlightDeps,
): Promise<BookFlightResult> {
  const db = deps.db ?? getDb();
  const trip = getTripForViewer(tripId, viewer, db);
  if (!trip || !canBookTravel(trip, viewer)) throw new BookingError("You can only book flights on your own approved trip.");

  // Search again and find the offer: never trust a price from the form.
  let offer;
  try {
    offer = (await deps.flights.search(query)).find((o) => o.id === offerId);
  } catch {
    offer = undefined;
  }
  if (!offer) throw new BookingError("That flight offer has expired. Please search again.");

  let charge;
  try {
    charge = await deps.payment.charge({
      amountCents: offer.totalCents,
      currency: offer.currency,
      description: `Flight for ${trip.conference_name}`,
      customerEmail: viewer.email,
    });
  } catch (err) {
    if (err instanceof PaymentError) throw new BookingError(`Payment failed: ${err.message}`);
    throw err;
  }

  let booked;
  try {
    booked = await deps.flights.book(offerId, { name: viewer.name, email: viewer.email });
  } catch (err) {
    if (err instanceof FlightSearchError) throw new BookingError(err.message);
    throw err;
  }

  const booking = createBooking(
    {
      tripId: trip.id,
      kind: "flight",
      provider: deps.flights.name,
      reference: booked.reference,
      details: { offer: booked.offer, passenger: booked.passenger, payment: { provider: deps.payment.name, id: charge.id } },
      totalCents: booked.totalCents,
      currency: booked.currency,
    },
    db,
  );
  const receipt = await generateBookingReceipt(booking, { db, dir: deps.dir, now: deps.now });
  if (trip.status === "approved") transitionTrip(trip.id, "booked", { orgId: trip.org_id }, db);
  return { booking, receipt, trip: getTrip(trip.id, db)! };
}
