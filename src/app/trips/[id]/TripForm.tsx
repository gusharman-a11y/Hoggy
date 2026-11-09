"use client";

import { useActionState } from "react";
import { saveTripAction, type TripFormState } from "../../trip-actions";

export interface TripFormDefaults {
  departCity: string;
  notes: string;
  registration: string;
  flights: string;
  hotel: string;
  other: string;
}

export default function TripForm({ tripId, defaults }: { tripId: number; defaults: TripFormDefaults }) {
  const [state, action, pending] = useActionState<TripFormState | undefined, FormData>(
    saveTripAction.bind(null, tripId),
    undefined,
  );
  const v = (k: keyof TripFormDefaults) => state?.values?.[k] ?? defaults[k];

  return (
    <form action={action} className="form">
      <label>
        Departure city
        <input name="departCity" defaultValue={v("departCity")} placeholder="e.g. Sydney" maxLength={100} />
      </label>
      <fieldset>
        <legend>Estimated costs (AUD)</legend>
        <label>
          Registration
          <input name="registration" inputMode="decimal" defaultValue={v("registration")} />
        </label>
        <label>
          Flights
          <input name="flights" inputMode="decimal" defaultValue={v("flights")} />
        </label>
        <label>
          Hotel
          <input name="hotel" inputMode="decimal" defaultValue={v("hotel")} />
        </label>
        <label>
          Other costs
          <input name="other" inputMode="decimal" defaultValue={v("other")} />
        </label>
      </fieldset>
      <label>
        Notes
        <textarea name="notes" rows={3} defaultValue={v("notes")} />
      </label>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.saved && !pending && (
        <p className="notice" role="status">
          Saved.
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save plan"}
      </button>
    </form>
  );
}
