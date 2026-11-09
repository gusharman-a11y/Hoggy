"use client";

import { useActionState } from "react";
import { saveSettingsAction, type SettingsFormState } from "../settings-actions";

export default function SettingsForm({ financeEmail }: { financeEmail: string }) {
  const [state, action, pending] = useActionState<SettingsFormState | undefined, FormData>(
    saveSettingsAction,
    undefined,
  );
  return (
    <form action={action} className="form" data-testid="settings-form">
      <label>
        Finance email
        <input
          name="financeEmail"
          type="email"
          required
          autoComplete="off"
          defaultValue={state?.financeEmail ?? financeEmail}
        />
      </label>
      <p className="muted small">Claims are sent here, with the doctor copied in.</p>
      {state?.error && <p className="error">{state.error}</p>}
      <button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save settings"}
      </button>
      {state?.saved && !pending && (
        <p className="saved" role="status">
          Saved.
        </p>
      )}
    </form>
  );
}
