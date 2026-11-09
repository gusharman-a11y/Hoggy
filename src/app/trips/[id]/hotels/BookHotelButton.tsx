"use client";

import { useActionState } from "react";
import { bookHotelAction, type BookingFormState } from "../../../booking-actions";
import type { HotelSearchForm } from "@/lib/hotel-booking";

export default function BookHotelButton({
  tripId,
  offerId,
  search,
  label,
}: {
  tripId: number;
  offerId: string;
  search: HotelSearchForm;
  label: string;
}) {
  const [state, action, pending] = useActionState<BookingFormState | undefined, FormData>(
    bookHotelAction.bind(null, tripId),
    undefined,
  );
  return (
    <form action={action} className="form book-offer">
      <input type="hidden" name="offerId" value={offerId} />
      <input type="hidden" name="city" value={search.city} />
      <input type="hidden" name="checkIn" value={search.checkIn} />
      <input type="hidden" name="checkOut" value={search.checkOut} />
      {state?.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={pending} aria-label={label}>
        {pending ? "Booking…" : "Book and pay"}
      </button>
    </form>
  );
}
