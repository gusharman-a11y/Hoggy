"use client";

import { useActionState } from "react";
import { loginAction } from "../auth-actions";

export default function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);

  return (
    <form action={action} className="form">
      {next && <input type="hidden" name="next" value={next} />}
      <label>
        Email
        <input name="email" type="email" autoComplete="email" defaultValue={state?.values?.email} required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending}>
        {pending ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}
