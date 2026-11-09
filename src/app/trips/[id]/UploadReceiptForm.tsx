"use client";

import { useActionState } from "react";
import { uploadReceiptAction, type UploadFormState } from "../../receipt-actions";
import { UPLOAD_KIND_LABELS, UPLOAD_KINDS } from "@/lib/receipt-upload-kinds";

export default function UploadReceiptForm({ tripId }: { tripId: number }) {
  const [state, action, pending] = useActionState<UploadFormState | undefined, FormData>(
    uploadReceiptAction.bind(null, tripId),
    undefined,
  );
  const v = state?.values;
  return (
    <form action={action} className="form" data-testid="upload-receipt">
      <label>
        Receipt file (PDF, JPG or PNG, up to 10 MB)
        <input type="file" name="file" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" required />
      </label>
      <div className="field">
        <label htmlFor={`receipt-kind-${tripId}`}>What is it?</label>
        <select id={`receipt-kind-${tripId}`} name="kind" defaultValue={v?.kind || "taxi"} key={`kind-${v?.kind ?? ""}`}>
          {UPLOAD_KINDS.map((k) => (
            <option key={k} value={k}>
              {UPLOAD_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      <label>
        Description
        <input name="description" defaultValue={v?.description ?? ""} placeholder="e.g. Taxi to venue" maxLength={200} required />
      </label>
      <label>
        Amount (AUD)
        <input name="amount" inputMode="decimal" defaultValue={v?.amount ?? ""} placeholder="e.g. 42.50" required />
      </label>
      {state?.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Uploading…" : "Upload receipt"}
      </button>
    </form>
  );
}
