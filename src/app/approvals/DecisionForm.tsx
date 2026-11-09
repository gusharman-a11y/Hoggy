"use client";

import { useActionState } from "react";
import { decideTripAction, type ApprovalFormState } from "../approval-actions";

export default function DecisionForm({
  tripId,
  label,
  from = "approvals",
}: {
  tripId: number;
  label: string;
  from?: "approvals" | "trip";
}) {
  const [state, action, pending] = useActionState<ApprovalFormState | undefined, FormData>(
    decideTripAction.bind(null, tripId),
    undefined,
  );
  return (
    <form action={action} className="form decision-form">
      <input type="hidden" name="from" value={from} />
      <label>
        Comment for {label}
        <textarea name="comment" rows={2} maxLength={1000} defaultValue={state?.comment ?? ""} />
      </label>
      <p className="muted small">Optional when approving; needed when rejecting.</p>
      {state?.error && <p className="error">{state.error}</p>}
      <div className="decision-buttons">
        <button type="submit" name="decision" value="approved" disabled={pending}>
          Approve
        </button>
        <button type="submit" name="decision" value="rejected" disabled={pending} className="danger">
          Reject
        </button>
      </div>
    </form>
  );
}
