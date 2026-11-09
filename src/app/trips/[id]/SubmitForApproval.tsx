"use client";

import { useActionState } from "react";
import { submitTripAction, type ApprovalFormState } from "../../approval-actions";

export default function SubmitForApproval({ tripId, resubmit }: { tripId: number; resubmit: boolean }) {
  const [state, action, pending] = useActionState<ApprovalFormState | undefined, FormData>(
    () => submitTripAction(tripId),
    undefined,
  );
  return (
    <form action={action} className="form submit-approval">
      <p className="muted">Save your plan first. Your manager gets an email and can approve or reject it.</p>
      {state?.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Submitting…" : resubmit ? "Resubmit for approval" : "Submit for approval"}
      </button>
    </form>
  );
}
