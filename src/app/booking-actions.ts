"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { BookingError, bookFlightForTrip, toFlightQuery } from "@/lib/flight-booking";
import { getFlightProvider } from "@/providers/flights";
import { getPaymentProvider } from "@/providers/payment";

export interface BookingFormState {
  error?: string;
}

export async function bookFlightAction(
  tripId: number,
  _prev: BookingFormState | undefined,
  form: FormData,
): Promise<BookingFormState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again." };
  const get = (k: string) => String(form.get(k) ?? "");
  const query = toFlightQuery({ from: get("from"), to: get("to"), departDate: get("departDate"), returnDate: get("returnDate") });
  try {
    await bookFlightForTrip(tripId, query, get("offerId"), user, {
      flights: getFlightProvider(),
      payment: getPaymentProvider(),
    });
  } catch (err) {
    if (err instanceof BookingError) return { error: err.message };
    console.error(err);
    return { error: "Something went wrong. Please try again." };
  }
  revalidatePath(`/trips/${tripId}`);
  redirect(`/trips/${tripId}?booked=flight`);
}
