import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { centsToInput, formatDateRange, formatMoney } from "@/lib/format";
import { canEditTrip, getTripForViewer, TRIP_STATUS_LABELS, tripEstimateTotal } from "@/lib/trips";
import TripForm from "./TripForm";

export const metadata = { title: "Trip · StudyLeave" };

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireRole([], `/trips/${id}`);
  const tripId = Number(id);
  // Not found and not allowed look the same, so trip ids from other orgs/doctors don't leak.
  const trip = Number.isInteger(tripId) && tripId > 0 ? getTripForViewer(tripId, user) : undefined;
  if (!trip) notFound();

  const editable = canEditTrip(trip, user);
  const total = tripEstimateTotal(trip);
  const foreignFee = trip.conference_fee_cents != null && trip.conference_currency !== trip.currency;

  return (
    <main className="narrow">
      <p>
        <Link href="/trips">← My trips</Link>
      </p>
      <h1>Trip to {trip.conference_name}</h1>
      <p>
        <span className={`badge badge-${trip.status}`} data-testid="trip-status">
          {TRIP_STATUS_LABELS[trip.status]}
        </span>
        {trip.user_id !== user.id && <span className="muted"> · {trip.owner_name}</span>}
      </p>

      <dl className="facts" data-testid="trip-conference">
        <dt>Conference</dt>
        <dd>
          <Link href={`/conferences/${trip.conference_slug}`}>{trip.conference_name}</Link>
        </dd>
        <dt>Dates</dt>
        <dd>{formatDateRange(trip.conference_start, trip.conference_end)}</dd>
        <dt>Where</dt>
        <dd>{[trip.conference_city, trip.conference_country].filter(Boolean).join(", ") || "TBC"}</dd>
        <dt>Conference fee</dt>
        <dd>{formatMoney(trip.conference_fee_cents, trip.conference_currency)}</dd>
      </dl>
      {foreignFee && editable && (
        <p className="muted">
          The registration estimate was converted to {trip.currency} at an indicative rate. Please check it.
        </p>
      )}

      <h2>Plan</h2>
      {editable ? (
        <TripForm
          tripId={trip.id}
          defaults={{
            departCity: trip.depart_city ?? "",
            notes: trip.notes ?? "",
            registration: centsToInput(trip.est_registration_cents),
            flights: centsToInput(trip.est_flights_cents),
            hotel: centsToInput(trip.est_hotel_cents),
            other: centsToInput(trip.est_other_cents),
          }}
        />
      ) : (
        <dl className="facts">
          <dt>Departure city</dt>
          <dd>{trip.depart_city || "—"}</dd>
          <dt>Registration</dt>
          <dd>{formatMoney(trip.est_registration_cents, trip.currency)}</dd>
          <dt>Flights</dt>
          <dd>{formatMoney(trip.est_flights_cents, trip.currency)}</dd>
          <dt>Hotel</dt>
          <dd>{formatMoney(trip.est_hotel_cents, trip.currency)}</dd>
          <dt>Other costs</dt>
          <dd>{formatMoney(trip.est_other_cents, trip.currency)}</dd>
          <dt>Notes</dt>
          <dd>{trip.notes || "—"}</dd>
        </dl>
      )}
      <p className="total" data-testid="trip-total">
        Estimated total: <strong>{formatMoney(total, trip.currency)}</strong>
      </p>
      {trip.manager_comment && (
        <p className="notice">
          <strong>Manager&apos;s comment:</strong> {trip.manager_comment}
        </p>
      )}
    </main>
  );
}
