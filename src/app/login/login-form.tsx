"use client";
import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">Email
        <input name="email" type="email" required autoComplete="username" className="mt-1 w-full rounded border px-3 py-2" /></label>
      <label className="block">Password
        <input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded border px-3 py-2" /></label>
      {state.error && <p role="alert" className="text-red-700">{state.error}</p>}
      <button disabled={pending} className="w-full rounded bg-black px-4 py-2 text-white disabled:opacity-60">
        {pending ? "Accesso…" : "Entra"}</button>
    </form>
  );
}
