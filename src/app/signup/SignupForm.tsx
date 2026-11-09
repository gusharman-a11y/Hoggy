"use client";

import { useActionState, useState } from "react";
import { signupAction } from "../auth-actions";

export default function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, undefined);
  const [mode, setMode] = useState<"join" | "create">("join");
  const v = state?.values ?? {};

  return (
    <form action={action} className="form">
      <label>
        Your name
        <input name="name" autoComplete="name" defaultValue={v.name} required />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" defaultValue={v.email} required />
      </label>
      <label>
        Password (8+ characters)
        <input name="password" type="password" autoComplete="new-password" minLength={8} required />
      </label>

      <fieldset>
        <legend>Your hospital</legend>
        <label className="inline">
          <input type="radio" name="mode" value="join" checked={mode === "join"} onChange={() => setMode("join")} />
          Join my hospital with its code
        </label>
        <label className="inline">
          <input
            type="radio"
            name="mode"
            value="create"
            checked={mode === "create"}
            onChange={() => setMode("create")}
          />
          Create a new hospital
        </label>

        {mode === "join" ? (
          <label>
            Hospital join code
            <input name="joinCode" autoCapitalize="characters" defaultValue={v.joinCode} required />
          </label>
        ) : (
          <>
            <label>
              Hospital name
              <input name="orgName" defaultValue={v.orgName} required />
            </label>
            <label>
              Finance email (where claims are sent)
              <input name="financeEmail" type="email" defaultValue={v.financeEmail} required />
            </label>
          </>
        )}
      </fieldset>

      {state?.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
