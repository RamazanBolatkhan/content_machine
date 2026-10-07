"use client";

import { CircleAlert, LogIn } from "lucide-react";
import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [error, action, pending] = useActionState(login, null);
  return (
    <form action={action} className="card w-full max-w-sm space-y-4 p-6">
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input id="password" name="password" type="password" className="input" autoFocus required autoComplete="current-password" />
      </div>
      <button className="btn btn-primary w-full" disabled={pending}>
        <LogIn size={16} aria-hidden /> Sign in
      </button>
      {error && (
        <p className="t-small flex items-center gap-2 font-semibold" role="alert">
          <CircleAlert size={16} aria-hidden /> {error}
        </p>
      )}
    </form>
  );
}
