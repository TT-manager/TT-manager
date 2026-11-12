"use client";
import Link from "next/link";
import { useActionState } from "react";
import { ClubPicker } from "@/components/club-picker";
import type { Club } from "@/lib/clubs";
import { forgotPassword, login, setNewPassword, signup, type LoginState } from "./actions";

const field = "mt-1 w-full rounded border bg-transparent px-3 py-2";
const btn = "btn-primary w-full";
const Msg = ({ s }: { s: LoginState }) => <>
  {s.error && <p role="alert" className="text-red-700 dark:text-red-400">{s.error}</p>}
  {s.ok && <p className="text-green-700 dark:text-green-400">{s.ok}</p>}
</>;

export default function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="block">Email<input name="email" type="email" required autoComplete="username" className={field} /></label>
      <label className="block">Password<input name="password" type="password" required autoComplete="current-password" className={field} /></label>
      <Msg s={state} />
      <button disabled={pending} className={btn}>{pending ? "Accesso…" : "Entra"}</button>
      <p className="text-sm"><Link href="/password-dimenticata" className="underline">Password dimenticata?</Link></p>
      <p className="text-sm">Non hai un account? <Link href={next ? `/registrati?next=${encodeURIComponent(next)}` : "/registrati"} className="underline">Registrati</Link></p>
    </form>
  );
}

export function SignupForm({ next, clubs = [] }: { next?: string; clubs?: Club[] }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(signup, {});
  if (state.ok) return <p className="mt-6 rounded border border-green-600 p-4">{state.ok}</p>;
  return (
    <form action={action} className="mt-6 space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="block">Nome e cognome<input name="full_name" required maxLength={80} autoComplete="name" className={field} /></label>
      <div><span className="block">Circolo (facoltativo)</span><ClubPicker clubs={clubs} allowRequest className={field} /></div>
      <label className="block">Email<input name="email" type="email" required autoComplete="email" className={field} /></label>
      <label className="block">Password (almeno 8 caratteri)<input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} /></label>
      <Msg s={state} />
      <button disabled={pending} className={btn}>{pending ? "Registrazione…" : "Registrati"}</button>
      <p className="text-sm">Hai già un account? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="underline">Accedi</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(forgotPassword, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">Email<input name="email" type="email" required autoComplete="email" className={field} /></label>
      <Msg s={state} />
      <button disabled={pending} className={btn}>Mandami il link</button>
    </form>
  );
}

export function NewPasswordForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(setNewPassword, {});
  if (state.ok) return <p className="mt-6">{state.ok} <Link href="/profilo" className="underline">Vai al tuo profilo</Link></p>;
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">Nuova password<input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} /></label>
      <label className="block">Ripetila<input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={field} /></label>
      <Msg s={state} />
      <button disabled={pending} className={btn}>Salva</button>
    </form>
  );
}
