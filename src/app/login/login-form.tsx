"use client";
import Link from "next/link";
import { useActionState } from "react";
import { ClubPicker } from "@/components/club-picker";
import type { Club } from "@/lib/clubs";
import { useTr } from "@/i18n/client";
import { accountLoginText } from "@/i18n/dict/account-login";
import { forgotPassword, login, setNewPassword, signup, type LoginState } from "./actions";

const field = "mt-1 w-full rounded border bg-transparent px-3 py-2";
const btn = "btn-primary w-full";
const Msg = ({ s }: { s: LoginState }) => <>
  {s.error && <p role="alert" className="text-red-700 dark:text-red-400">{s.error}</p>}
  {s.ok && <p className="text-green-700 dark:text-green-400">{s.ok}</p>}
</>;

export default function LoginForm({ next }: { next?: string }) {
  const t = useTr(accountLoginText);
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="block">{t.email}<input name="email" type="email" required autoComplete="username" className={field} /></label>
      <label className="block">{t.password}<input name="password" type="password" required autoComplete="current-password" className={field} /></label>
      <Msg s={state} />
      <button disabled={pending} className={btn}>{pending ? t.loggingIn : t.enter}</button>
      <p className="text-sm"><Link href="/password-dimenticata" className="underline">{t.forgotLink}</Link></p>
      <p className="text-sm">{t.noAccount} <Link href={next ? `/registrati?next=${encodeURIComponent(next)}` : "/registrati"} className="underline">{t.signupLink}</Link></p>
    </form>
  );
}

export function SignupForm({ next, clubs = [] }: { next?: string; clubs?: Club[] }) {
  const t = useTr(accountLoginText);
  const [state, action, pending] = useActionState<LoginState, FormData>(signup, {});
  if (state.ok) return <p className="mt-6 rounded border border-green-600 p-4">{state.ok}</p>;
  return (
    <form action={action} className="mt-6 space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <label className="block">{t.fullName}<input name="full_name" required maxLength={80} autoComplete="name" className={field} /></label>
      <div><span className="block">{t.clubOptional}</span><ClubPicker clubs={clubs} allowRequest className={field} /></div>
      <label className="block">{t.email}<input name="email" type="email" required autoComplete="email" className={field} /></label>
      <label className="block">{t.passwordMin}<input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} /></label>
      <Msg s={state} />
      <button disabled={pending} className={btn}>{pending ? t.signingUp : t.signupButton}</button>
      <p className="text-xs text-muted">
        {t.termsBefore}<Link href="/termini" className="underline">{t.termsLink}</Link>{t.termsMiddle}<Link href="/privacy" className="underline">{t.privacyLink}</Link>{t.termsAfter}
      </p>
      <p className="text-sm">{t.haveAccount} <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="underline">{t.loginLink}</Link></p>
    </form>
  );
}

export function ForgotForm() {
  const t = useTr(accountLoginText);
  const [state, action, pending] = useActionState<LoginState, FormData>(forgotPassword, {});
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">{t.email}<input name="email" type="email" required autoComplete="email" className={field} /></label>
      <Msg s={state} />
      <button disabled={pending} className={btn}>{t.sendLink}</button>
    </form>
  );
}

export function NewPasswordForm() {
  const t = useTr(accountLoginText);
  const [state, action, pending] = useActionState<LoginState, FormData>(setNewPassword, {});
  if (state.ok) return <p className="mt-6">{state.ok} <Link href="/profilo" className="underline">{t.goToProfile}</Link></p>;
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">{t.newPassword}<input name="password" type="password" required minLength={8} autoComplete="new-password" className={field} /></label>
      <label className="block">{t.repeatPassword}<input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={field} /></label>
      <Msg s={state} />
      <button disabled={pending} className={btn}>{t.save}</button>
    </form>
  );
}
