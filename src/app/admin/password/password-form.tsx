"use client";
import { useActionState } from "react";
import { changePassword, type PwState } from "./actions";

export default function PasswordForm() {
  const [state, action, pending] = useActionState<PwState, FormData>(changePassword, {});
  const input = "mt-1 w-full rounded border bg-transparent px-3 py-2";
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">Nuova password (almeno 12 caratteri)
        <input name="password" type="password" required minLength={12} autoComplete="new-password" className={input} /></label>
      <label className="block">Ripeti la nuova password
        <input name="confirm" type="password" required minLength={12} autoComplete="new-password" className={input} /></label>
      <button disabled={pending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">Salva</button>
      {state.error && <p role="alert" className="text-red-700 dark:text-red-400">{state.error}</p>}
      {state.ok && <p className="text-green-700 dark:text-green-400">{state.ok}</p>}
    </form>
  );
}
