"use client";

import { useActionState } from "react";
import { sendClaimAction, type SendClaimState } from "../../claim-actions";

export default function SendClaimForm({ tripId, financeEmail }: { tripId: number; financeEmail: string | null }) {
  const [state, action, pending] = useActionState<SendClaimState | undefined, FormData>(
    () => sendClaimAction(tripId),
    undefined,
  );
  return (
    <form action={action} className="form send-claim" data-testid="send-claim">
      <p className="muted">
        {financeEmail ? (
          <>
            Emails one PDF (cover sheet, claim form and every receipt) to <strong>{financeEmail}</strong>, with a
            copy to you. Add any last receipts first: you can&apos;t change them after sending.
          </>
        ) : (
          <>Your hospital hasn&apos;t set a finance email address yet. Ask your admin to add one in Settings.</>
        )}
      </p>
      {state?.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={pending || !financeEmail}>
        {pending ? "Sending…" : "Send claim"}
      </button>
    </form>
  );
}
