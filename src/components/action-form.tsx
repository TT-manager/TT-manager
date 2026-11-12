"use client";
import { startTransition, useActionState, type ReactNode } from "react";

export type ActionState = { error?: string; ok?: string };

/**
 * Modulo con invio manuale: i campi non vengono svuotati dopo il salvataggio
 * (React lo farebbe con `action`), e sotto compare l'esito.
 */
export function ActionForm({ action: submit, children, submitLabel, confirmText, className = "", primary = true, inline = false }: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children?: ReactNode; submitLabel: string; confirmText?: string; className?: string; primary?: boolean; inline?: boolean;
}) {
  const [state, action, pending] = useActionState<ActionState, FormData>(submit, {});
  const btn = primary
    ? "btn-primary"
    : inline ? "text-sm underline decoration-brand/40 hover:text-brand disabled:opacity-50" : "btn-outline px-3 py-1.5 text-sm";
  return (
    <form className={className} onSubmit={(e) => {
      e.preventDefault();
      if (confirmText && !confirm(confirmText)) return;
      const data = new FormData(e.currentTarget);
      startTransition(() => action(data));
    }}>
      {children}
      <span className={inline ? "inline-flex items-center gap-2" : "mt-2 flex flex-wrap items-center gap-3"}>
        <button disabled={pending} className={btn}>{pending ? "…" : submitLabel}</button>
        {state.error && <span role="alert" className="text-sm text-red-700 dark:text-red-400">{state.error}</span>}
        {state.ok && <span className="text-sm text-green-700 dark:text-green-400">{state.ok}</span>}
      </span>
    </form>
  );
}
