"use client";

import { useActionState } from "react";
import { setAllowanceAction, type AllowanceFormState } from "../team-actions";

export default function AllowanceForm({
  userId,
  year,
  name,
  defaultValue,
}: {
  userId: number;
  year: number;
  name: string;
  defaultValue: string;
}) {
  const [state, action, pending] = useActionState<AllowanceFormState | undefined, FormData>(
    setAllowanceAction.bind(null, userId, year),
    undefined,
  );
  return (
    <form action={action} className="allowance-form">
      <input
        name="allowance"
        inputMode="decimal"
        aria-label={`Allowance for ${name} (AUD)`}
        defaultValue={state?.value ?? defaultValue}
      />
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Set"}
      </button>
      {state?.error && <p className="error">{state.error}</p>}
      {state?.saved && !pending && (
        <span className="saved" role="status">
          Saved
        </span>
      )}
    </form>
  );
}
