"use client";

import { useActionState, useRef } from "react";
import { snapReceiptAction, type SnapFormState } from "../../receipt-actions";

/** Primary receipt action: take a photo (or pick a PDF); it uploads as soon as one is chosen. */
export default function SnapReceiptForm({ tripId }: { tripId: number }) {
  const [state, action, pending] = useActionState<SnapFormState | undefined, FormData>(
    snapReceiptAction.bind(null, tripId),
    undefined,
  );
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={action} className="snap-receipt" data-testid="snap-receipt">
      <label className={`button snap-button${pending ? " is-pending" : ""}`}>
        {pending ? "Reading receipt…" : "Snap receipt"}
        <input
          type="file"
          name="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="visually-hidden"
          disabled={pending}
          onChange={(e) => {
            if (e.currentTarget.files?.length) formRef.current?.requestSubmit();
          }}
        />
      </label>
      <span className="muted">Take a photo or choose a PDF. We’ll read the details for you to check.</span>
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  );
}
