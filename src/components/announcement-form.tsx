"use client";
import { useActionState, useState } from "react";
import { postAnnouncementAction } from "@/app/avvisi/actions";
import type { ActionState } from "@/components/action-form";
import { useTr } from "@/i18n/client";
import { announcementsText } from "@/i18n/dict/announcements";

export type TargetOption = { value: string; label: string };

/**
 * Modulo per scrivere un avviso: con un destinatario fisso (campo nascosto) oppure con la scelta «A chi»
 * (sezione Avvisi). Dopo l'invio riuscito il testo si svuota, così non si manda due volte per sbaglio.
 */
export function AnnouncementForm({ field, id, groups, initial }: {
  field?: "championship_id" | "tournament_id"; id?: string;
  groups?: { label: string; options: TargetOption[] }[]; initial?: string;
}) {
  const t = useTr(announcementsText);
  const [text, setText] = useState("");
  const shownGroups = (groups ?? []).filter((g) => g.options.length);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (prev, fd) => {
    const r = await postAnnouncementAction(prev, fd);
    if (r.ok) setText("");
    return r;
  }, {});
  return (
    <form action={action} className="mt-3 space-y-2">
      {field && id && <input type="hidden" name={field} value={id} />}
      {groups && (
        <label className="grid gap-1 text-sm font-semibold">{t.to}
          <select name="target" defaultValue={initial} required className="select-arrow w-full rounded border bg-transparent px-3 py-2 font-normal">
            {shownGroups.length === 1
              ? shownGroups[0].options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)
              : shownGroups.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </optgroup>))}
          </select>
        </label>)}
      <textarea name="body" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={3} required
        placeholder={t.placeholder} aria-label={t.placeholder} className="w-full rounded border bg-transparent px-3 py-2" />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending || !text.trim()} className="btn-primary">{pending ? t.sending : t.send}</button>
        <span className="text-xs text-muted tabular-nums">{text.length}/500</span>
        {state.error && <span role="alert" className="text-sm text-red-700 dark:text-red-400">{state.error}</span>}
        {state.ok && <span className="text-sm text-green-700 dark:text-green-400">{state.ok}</span>}
      </div>
    </form>
  );
}
