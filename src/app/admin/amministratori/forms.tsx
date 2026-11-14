"use client";
import { useActionState } from "react";
import { addAdmin, removeAdmin, type AdminState } from "./actions";
import { useTr } from "@/i18n/client";
import { adminShellText } from "@/i18n/dict/admin-shell";

const Msg = ({ s }: { s: AdminState }) =>
  s.error ? <p role="alert" className="text-red-700 dark:text-red-400">{s.error}</p>
  : s.ok ? <p className="text-green-700 dark:text-green-400">{s.ok}</p> : null;

export function AddAdminForm() {
  const t = useTr(adminShellText);
  const [state, action, pending] = useActionState<AdminState, FormData>(addAdmin, {});
  return (
    <div className="mt-6 space-y-3">
      <form action={action} className="flex flex-wrap gap-2">
        <input name="email" type="email" required placeholder={t.emailPlaceholder} aria-label={t.newAdminEmailAria}
          className="min-w-0 flex-1 rounded border bg-transparent px-3 py-2" />
        <button disabled={pending} className="btn-primary">{t.add}</button>
      </form>
      <Msg s={state} />
      {state.tempPassword && (
        <div className="rounded-lg border-2 border-amber-500 p-4">
          <p>{t.accountCreatedFor} <strong>{state.email}</strong>. {t.tempPassword}</p>
          <p className="mt-2 font-mono text-2xl">{state.tempPassword}</p>
          <p className="mt-2 text-sm">{t.tempPasswordNote} <strong>{t.notShownAgainF}</strong>.
            {" "}{t.tempPasswordNote2}</p>
        </div>
      )}
    </div>
  );
}

export function RemoveAdminButton({ userId, email }: { userId: string; email: string }) {
  const t = useTr(adminShellText);
  const [state, action, pending] = useActionState<AdminState, FormData>(removeAdmin, {});
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(t.confirmRemoveAdmin(email))) e.preventDefault(); }}>
      <input type="hidden" name="user_id" value={userId} />
      <button disabled={pending} className="text-sm underline">{t.remove}</button>
      <Msg s={state} />
    </form>
  );
}
