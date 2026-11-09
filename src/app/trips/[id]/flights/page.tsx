import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { canBookTravel, defaultFlightSearch, toFlightQuery } from "@/lib/flight-booking";
import { formatMoney } from "@/lib/format";
import { getTripForViewer } from "@/lib/trips";
import { FlightSearchError, getFlightProvider, type FlightLeg, type FlightOffer } from "@/providers/flights";
import BookFlightButton from "./BookFlightButton";

export const metadata = { title: "Find flights · StudyLeave" };

type Params = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function legText(leg: FlightLeg) {
  const t = (s: string) => s.replace("T", " ");
  return `${leg.flightNumber} · ${leg.from} ${t(leg.departAt)} → ${leg.to} ${t(leg.arriveAt)}`;
}

export default async function FlightsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Params }) {
  const { id } = await params;
  const user = await requireRole([], `/trips/${id}/flights`);
  const tripId = Number(id);
  const trip = Number.isInteger(tripId) && tripId > 0 ? getTripForViewer(tripId, user) : undefined;
  if (!trip) notFound();

  if (!canBookTravel(trip, user)) {
    return (
      <main className="narrow">
        <p>
          <Link href={`/trips/${trip.id}`}>← Back to the trip</Link>
        </p>
        <h1>Find flights</h1>
        <p className="error">You can book flights once your manager has approved this trip.</p>
      </main>
    );
  }

  const sp = await searchParams;
  const search = defaultFlightSearch(trip, {
    from: one(sp.from),
    to: one(sp.to),
    departDate: one(sp.departDate),
    returnDate: one(sp.returnDate),
  });
  // Searching is read-only (no database writes), so it's fine on a GET.
  let offers: FlightOffer[] = [];
  let error: string | undefined;
  try {
    offers = await getFlightProvider().search(toFlightQuery(search));
  } catch (err) {
    if (err instanceof FlightSearchError) error = err.message;
    else {
      console.error(err);
      error = "Flight search isn't working right now. Please try again.";
    }
  }

  return (
    <main className="narrow">
      <p>
        <Link href={`/trips/${trip.id}`}>← Back to the trip</Link>
      </p>
      <h1>Find flights</h1>
      <p className="muted">
        For {trip.conference_name}, {trip.conference_city}. Test mode: no real tickets are bought.
      </p>
      <form method="get" className="form flight-search">
        <label>
          From (city or airport code)
          <input name="from" defaultValue={search.from} placeholder="e.g. SYD" />
        </label>
        <label>
          To (city or airport code)
          <input name="to" defaultValue={search.to} />
        </label>
        <label>
          Depart
          <input type="date" name="departDate" defaultValue={search.departDate} />
        </label>
        <label>
          Return (leave blank for one way)
          <input type="date" name="returnDate" defaultValue={search.returnDate} />
        </label>
        <button type="submit">Search flights</button>
      </form>

      {error && <p className="error">{error}</p>}
      {!error && offers.length === 0 && <p>No flights found for those dates.</p>}
      <ul className="offers" data-testid="flight-offers">
        {offers.map((o, i) => (
          <li key={o.id} className="offer" data-testid="flight-offer">
            <p>
              <strong>{o.airline}</strong> · <strong data-testid="offer-price">{formatMoney(o.totalCents, o.currency)}</strong>
            </p>
            <p className="muted">Out: {legText(o.outbound)}</p>
            {o.inbound && <p className="muted">Back: {legText(o.inbound)}</p>}
            <BookFlightButton
              tripId={trip.id}
              offerId={o.id}
              search={search}
              label={`Book flight ${i + 1}: ${o.airline} ${formatMoney(o.totalCents, o.currency)}`}
            />
          </li>
        ))}
      </ul>
    </main>
  );
}
