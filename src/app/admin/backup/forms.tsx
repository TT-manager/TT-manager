"use client";
import { useActionState } from "react";
import { backupNowAction, sendDigestNowAction, type BackupState } from "./actions";
import { useTr } from "@/i18n/client";
import { adminShellText } from "@/i18n/dict/admin-shell";

export function BackupNowButton() {
  const t = useTr(adminShellText);
  const [state, action, pending] = useActionState<BackupState>(backupNowAction, {});
  return (
    <form action={action} className="space-y-2">
      <button disabled={pending} className="btn-primary">{t.backupNow}</button>
      {state.error && <p role="alert" className="text-red-700 dark:text-red-400">{state.error}</p>}
      {state.ok && <p className="text-green-700 dark:text-green-400">{state.ok}</p>}
    </form>
  );
}

export function SendDigestButton() {
  const t = useTr(adminShellText);
  const [state, action, pending] = useActionState<BackupState>(sendDigestNowAction, {});
  return (
    <form action={action} className="space-y-2">
      <button disabled={pending} className="btn-outline">{t.digestNow}</button>
      {state.error && <p role="alert" className="text-red-700 dark:text-red-400">{state.error}</p>}
      {state.ok && <p className="text-green-700 dark:text-green-400">{state.ok}</p>}
    </form>
  );
}
