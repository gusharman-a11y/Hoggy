"use client";

import { useActionState } from "react";
import { bookFlightAction, type BookingFormState } from "../../../booking-actions";
import type { FlightSearchForm } from "@/lib/flight-booking";

export default function BookFlightButton({
  tripId,
  offerId,
  search,
  label,
}: {
  tripId: number;
  offerId: string;
  search: FlightSearchForm;
  label: string;
}) {
  const [state, action, pending] = useActionState<BookingFormState | undefined, FormData>(
    bookFlightAction.bind(null, tripId),
    undefined,
  );
  return (
    <form action={action} className="form book-offer">
      <input type="hidden" name="offerId" value={offerId} />
      <input type="hidden" name="from" value={search.from} />
      <input type="hidden" name="to" value={search.to} />
      <input type="hidden" name="departDate" value={search.departDate} />
      <input type="hidden" name="returnDate" value={search.returnDate} />
      {state?.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={pending} aria-label={label}>
        {pending ? "Booking…" : "Book and pay"}
      </button>
    </form>
  );
}
