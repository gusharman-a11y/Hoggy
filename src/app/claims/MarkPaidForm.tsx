"use client";

import { useActionState } from "react";
import { markPaidAction, type MarkPaidState } from "../finance-actions";

export default function MarkPaidForm({ tripId, label }: { tripId: number; label: string }) {
  const [state, action, pending] = useActionState<MarkPaidState | undefined, FormData>(
    () => markPaidAction(tripId),
    undefined,
  );
  return (
    <form action={action} className="mark-paid">
      {state?.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={pending} aria-label={`Mark paid: ${label}`}>
        {pending ? "Saving…" : "Mark paid"}
      </button>
    </form>
  );
}
