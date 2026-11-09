import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canBookTravel } from "@/lib/flight-booking";
import { formatMoney } from "@/lib/format";
import { defaultHotelSearch, toHotelQuery } from "@/lib/hotel-booking";
import { getTripForViewer } from "@/lib/trips";
import { getHotelProvider, HotelSearchError, type HotelOffer } from "@/providers/hotels";
import BookHotelButton from "./BookHotelButton";

export const metadata = { title: "Find hotels · StudyLeave" };

type Params = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function HotelsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Params }) {
  const { id } = await params;
  const user = await requireRole([], `/trips/${id}/hotels`);
  const tripId = Number(id);
  const trip = Number.isInteger(tripId) && tripId > 0 ? getTripForViewer(tripId, user) : undefined;
  if (!trip) notFound();

  if (!canBookTravel(trip, user)) {
    return (
      <main className="narrow">
        <p>
          <Link href={`/trips/${trip.id}`}>← Back to the trip</Link>
        </p>
        <h1>Find hotels</h1>
        <p className="error">You can book a hotel once your manager has approved this trip.</p>
      </main>
    );
  }

  const sp = await searchParams;
  const search = defaultHotelSearch(trip, { city: one(sp.city), checkIn: one(sp.checkIn), checkOut: one(sp.checkOut) });
  const venue = trip.conference_venue || "the venue";
  // Searching is read-only (no database writes), so it's fine on a GET.
  let offers: HotelOffer[] = [];
  let error: string | undefined;
  try {
    offers = await getHotelProvider().search(toHotelQuery(search, trip.conference_venue));
  } catch (err) {
    if (err instanceof HotelSearchError) error = err.message;
    else {
      console.error(err);
      error = "Hotel search isn't working right now. Please try again.";
    }
  }

  return (
    <main className="narrow">
      <p>
        <Link href={`/trips/${trip.id}`}>← Back to the trip</Link>
      </p>
      <h1>Find hotels</h1>
      <p className="muted">
        Near {venue}, {trip.conference_city}. Test mode: no real rooms are booked.
      </p>
      <form method="get" className="form flight-search">
        <label>
          City
          <input name="city" defaultValue={search.city} />
        </label>
        <label>
          Check in
          <input type="date" name="checkIn" defaultValue={search.checkIn} />
        </label>
        <label>
          Check out
          <input type="date" name="checkOut" defaultValue={search.checkOut} />
        </label>
        <button type="submit">Search hotels</button>
      </form>

      {error && <p className="error">{error}</p>}
      {!error && offers.length === 0 && <p>No hotels found for those dates.</p>}
      <ul className="offers" data-testid="hotel-offers">
        {offers.map((o, i) => (
          <li key={o.id} className="offer" data-testid="hotel-offer">
            <p>
              <strong>{o.name}</strong> · <strong data-testid="offer-price">{formatMoney(o.totalCents, o.currency)}</strong>
            </p>
            <p className="muted">
              {o.address} · <span data-testid="offer-distance">{o.distanceKm} km</span> to {venue}
            </p>
            <p className="muted">
              {formatMoney(o.nightlyCents, o.currency)} a night × {o.nights} {o.nights === 1 ? "night" : "nights"}
            </p>
            <BookHotelButton
              tripId={trip.id}
              offerId={o.id}
              search={search}
              label={`Book hotel ${i + 1}: ${o.name} ${formatMoney(o.totalCents, o.currency)}`}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
