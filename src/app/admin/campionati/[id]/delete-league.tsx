"use client";
import { useActionState, useState } from "react";
import type { ActionState } from "@/components/action-form";
import { deleteChampionshipAction } from "../actions";
import { useTr } from "@/i18n/client";
import { adminLeaguesText } from "@/i18n/dict/admin-leagues";

/** «Elimina lega»: il pulsante si sblocca solo scrivendo il nome esatto della lega. */
export function DeleteLeague({ id, name, lost }: { id: string; name: string; lost: string }) {
  const t = useTr(adminLeaguesText);
  const [typed, setTyped] = useState("");
  const [state, action, pending] = useActionState<ActionState, FormData>(deleteChampionshipAction, {});
  const ok = typed.trim() === name.trim();
  return (
    <section className="rounded-lg border-2 border-red-600 p-4">
      <h2 className="text-lg font-semibold text-red-700 dark:text-red-400">{t.deleteLeague}</h2>
      <p className="mt-1 text-sm">{t.deleteLeagueNote(lost)}</p>
      <form action={action} className="mt-3 space-y-2">
        <input type="hidden" name="championship_id" value={id} />
        <label className="grid gap-1 text-sm">{t.typeLeagueName(name)}
          <input name="confirm_name" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off"
            className="rounded border bg-transparent px-3 py-2 sm:w-96" /></label>
        <button disabled={!ok || pending}
          className="rounded border border-red-600 px-4 py-2 text-red-700 hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 dark:text-red-400">
          {pending ? t.deletingLeague : t.deleteLeagueForever}</button>
        {state.error && <p role="alert" className="text-red-700 dark:text-red-400">{state.error}</p>}
      </form>
    </section>
  );
}
