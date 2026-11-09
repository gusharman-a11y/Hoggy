/**
 * Booking a hotel for a trip. Mirrors flight-booking.ts: payment ->
 * provider.book() -> booking row + generated receipt -> trip approved -> booked.
 */
import type { DatabaseSync } from "node:sqlite";
import { getDb } from "@/db";
import { HotelSearchError, type HotelProvider, type HotelSearch } from "@/providers/hotels";
import { PaymentError, type PaymentProvider } from "@/providers/payment";
import { addDays, BookingError, canBookTravel } from "./flight-booking";
import { createBooking, generateBookingReceipt, type Booking, type Receipt } from "./receipts";
import { getTrip, getTripForViewer, transitionTrip, type Trip, type TripViewer } from "./trips";

export interface HotelSearchForm {
  city: string;
  checkIn: string;
  checkOut: string;
}

/**
 * The search form's values: URL params when given, else the conference city,
 * checking in the day before it starts and out the day after it ends
 * (matching the default flights).
 */
export function defaultHotelSearch(
  trip: { conference_city: string; conference_start: string; conference_end: string },
  params: Partial<Record<keyof HotelSearchForm, string | undefined>> = {},
): HotelSearchForm {
  const pick = (v: string | undefined, fallback: string) => (v !== undefined ? v.trim() : fallback);
  return {
    city: pick(params.city, trip.conference_city),
    checkIn: pick(params.checkIn, addDays(trip.conference_start, -1)),
    checkOut: pick(params.checkOut, addDays(trip.conference_end, 1)),
  };
}

export function toHotelQuery(form: HotelSearchForm, venue?: string | null): HotelSearch {
  return { city: form.city, checkIn: form.checkIn, checkOut: form.checkOut, venue: venue ?? undefined };
}

export interface BookHotelDeps {
  hotels: HotelProvider;
  payment: PaymentProvider;
  db?: DatabaseSync;
  dir?: string;
  now?: Date;
}

export interface BookHotelResult {
  booking: Booking;
  receipt: Receipt;
  trip: Trip;
}

/** Pays for and books one hotel offer (found by re-running `query`) on the viewer's approved trip. Throws BookingError with a user-facing message. */
export async function bookHotelForTrip(
  tripId: number,
  query: HotelSearch,
  offerId: string,
  viewer: TripViewer & { email: string; name: string },
  deps: BookHotelDeps,
): Promise<BookHotelResult> {
  const db = deps.db ?? getDb();
  const trip = getTripForViewer(tripId, viewer, db);
  if (!trip || !canBookTravel(trip, viewer)) throw new BookingError("You can only book hotels on your own approved trip.");

  // Search again and find the offer: never trust a price from the form.
  let offer;
  try {
    offer = (await deps.hotels.search(query)).find((o) => o.id === offerId);
  } catch {
    offer = undefined;
  }
  if (!offer) throw new BookingError("That hotel offer has expired. Please search again.");

  let charge;
  try {
    charge = await deps.payment.charge({
      amountCents: offer.totalCents,
      currency: offer.currency,
      description: `Hotel for ${trip.conference_name}`,
      customerEmail: viewer.email,
    });
  } catch (err) {
    if (err instanceof PaymentError) throw new BookingError(`Payment failed: ${err.message}`);
    throw err;
  }

  let booked;
  try {
    booked = await deps.hotels.book(offerId, { name: viewer.name, email: viewer.email });
  } catch (err) {
    if (err instanceof HotelSearchError) throw new BookingError(err.message);
    throw err;
  }

  const booking = createBooking(
    {
      tripId: trip.id,
      kind: "hotel",
      provider: deps.hotels.name,
      reference: booked.reference,
      details: {
        hotel: booked.hotel,
        checkIn: booked.checkIn,
        checkOut: booked.checkOut,
        nights: booked.nights,
        guest: booked.guest,
        payment: { provider: deps.payment.name, id: charge.id },
      },
      totalCents: booked.totalCents,
      currency: booked.currency,
    },
    db,
  );
  const receipt = await generateBookingReceipt(booking, { db, dir: deps.dir, now: deps.now });
  if (trip.status === "approved") transitionTrip(trip.id, "booked", { orgId: trip.org_id }, db);
  return { booking, receipt, trip: getTrip(trip.id, db)! };
}
