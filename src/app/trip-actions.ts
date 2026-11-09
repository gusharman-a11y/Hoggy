"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { parseMoneyToCents } from "@/lib/format";
import { getTripForViewer, canEditTrip, updateTripPlan } from "@/lib/trips";

export interface TripFormState {
  error?: string;
  saved?: boolean;
  /** Submitted values so the form refills after React resets it. */
  values?: Record<string, string>;
}

const FIELDS = ["departCity", "notes", "registration", "flights", "hotel", "other"] as const;
const LABELS: Record<string, string> = {
  registration: "Registration",
  flights: "Flights",
  hotel: "Hotel",
  other: "Other costs",
};

export async function saveTripAction(tripId: number, _prev: TripFormState | undefined, form: FormData): Promise<TripFormState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? "").trim()]));
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again.", values };
  const trip = getTripForViewer(tripId, user);
  if (!trip || !canEditTrip(trip, user)) return { error: "You can't edit this trip.", values };

  const cents: Record<string, number> = {};
  for (const k of ["registration", "flights", "hotel", "other"]) {
    const v = parseMoneyToCents(values[k]);
    if (v === undefined) return { error: `${LABELS[k]}: please enter an amount like 950 or 950.00.`, values };
    cents[k] = v;
  }
  if (values.departCity.length > 100) return { error: "Departure city is too long.", values };

  updateTripPlan(tripId, user, {
    departCity: values.departCity || null,
    notes: values.notes || null,
    estRegistrationCents: cents.registration,
    estFlightsCents: cents.flights,
    estHotelCents: cents.hotel,
    estOtherCents: cents.other,
  });
  revalidatePath(`/trips/${tripId}`);
  return { saved: true, values };
}
