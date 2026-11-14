"use client";
import { useActionState } from "react";
import { changePassword, type PwState } from "./actions";
import { useTr } from "@/i18n/client";
import { adminShellText } from "@/i18n/dict/admin-shell";

export default function PasswordForm() {
  const t = useTr(adminShellText);
  const [state, action, pending] = useActionState<PwState, FormData>(changePassword, {});
  const input = "mt-1 w-full rounded border bg-transparent px-3 py-2";
  return (
    <form action={action} className="mt-6 space-y-4">
      <label className="block">{t.pwNew}
        <input name="password" type="password" required minLength={12} autoComplete="new-password" className={input} /></label>
      <label className="block">{t.pwRepeat}
        <input name="confirm" type="password" required minLength={12} autoComplete="new-password" className={input} /></label>
      <button disabled={pending} className="btn-primary">{t.save}</button>
      {state.error && <p role="alert" className="text-red-700 dark:text-red-400">{state.error}</p>}
      {state.ok && <p className="text-green-700 dark:text-green-400">{state.ok}</p>}
    </form>
  );
}
