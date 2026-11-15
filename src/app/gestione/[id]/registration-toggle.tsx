"use client";
import { startTransition, useActionState, useRef, useState } from "react";
import { setRegistration, type EnrollState } from "../actions";
import { useTr } from "@/i18n/client";
import { adminManageText } from "@/i18n/dict/admin-manage";

/** Interruttore delle iscrizioni: si salva appena lo tocchi. La data di chiusura ha il suo «Salva». */
export function RegistrationToggle({ tournamentId, open, deadline }: { tournamentId: string; open: boolean; deadline: string }) {
  const tx = useTr(adminManageText);
  const [state, action, pending] = useActionState<EnrollState, FormData>(setRegistration, {});
  const [on, setOn] = useState(open);
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} className="mt-4 space-y-4">
      <input type="hidden" name="tournament_id" value={tournamentId} />
      {on && <input type="hidden" name="open" value="on" />}
      <button type="button" role="switch" aria-checked={on} disabled={pending}
        onClick={() => {
          const fd = new FormData(form.current!);
          fd.delete("open");
          if (!on) fd.set("open", "on");
          setOn(!on);
          startTransition(() => action(fd));
        }}
        className={`flex w-full items-center justify-between gap-4 rounded-xl border-2 px-4 py-3 text-left transition ${on ? "border-green-600 bg-green-600/10" : "border-line"}`}>
        <span>
          <span className="block font-bold">{tx.regOpenCheckbox}</span>
          <span className={`text-sm ${on ? "text-green-700 dark:text-green-400" : "text-muted"}`}>{on ? tx.regSwitchOn : tx.regSwitchOff}</span>
        </span>
        <span aria-hidden="true" className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${on ? "bg-green-600" : "bg-neutral-400 dark:bg-neutral-600"}`}>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${on ? "left-7" : "left-1"}`} />
        </span>
      </button>
      {on && (
        <label className="grid gap-1 text-sm">{tx.regDeadline}
          <span className="flex flex-wrap gap-2">
            <input type="datetime-local" name="deadline" defaultValue={deadline}
              className="min-w-0 flex-1 rounded-lg border border-line bg-transparent px-3 py-2" />
            <button disabled={pending} className="btn-outline py-2">{tx.save}</button>
          </span>
        </label>)}
      {!on && deadline && <input type="hidden" name="deadline" value={deadline} />}
      {state.error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-700 dark:text-green-400">{state.ok}</p>}
    </form>
  );
}
