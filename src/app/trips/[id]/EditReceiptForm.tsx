"use client";

import { useActionState } from "react";
import { editReceiptAction, type EditReceiptState } from "../../receipt-actions";

/** Inline "Edit" for a receipt's description and amount (e.g. emailed receipts arrive at $0). */
export default function EditReceiptForm({
  tripId,
  receiptId,
  description,
  amount,
  currency,
}: {
  tripId: number;
  receiptId: number;
  description: string;
  amount: string;
  currency: string;
}) {
  const [state, action, pending] = useActionState<EditReceiptState | undefined, FormData>(
    editReceiptAction.bind(null, tripId, receiptId),
    undefined,
  );
  const v = state?.values;
  return (
    <details className="edit-receipt" open={state?.error ? true : undefined}>
      <summary>Edit</summary>
      <form action={action} className="form" data-testid="edit-receipt">
        <label>
          Description
          <input name="description" defaultValue={v?.description ?? description} maxLength={200} required />
        </label>
        <label>
          Amount ({currency})
          <input name="amount" inputMode="decimal" defaultValue={v?.amount ?? amount} required />
        </label>
        {state?.error && <p className="error">{state.error}</p>}
        <button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save receipt"}
        </button>
      </form>
    </details>
  );
}
