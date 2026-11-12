"use client";
import { useActionState } from "react";
import { createFriendlyTournament, type CreateState } from "@/app/gestione/actions";
import { Created } from "@/app/admin/tornei/nuovo/new-tournament-form";

const input = "rounded border bg-transparent px-3 py-2";

export default function FriendlyForm() {
  const [state, action, pending] = useActionState<CreateState, FormData>(createFriendlyTournament, {});
  if (state.created) return <Created c={state.created} />;
  return (
    <form action={action} className="mt-6 space-y-6">
      <section className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="grid gap-1">Nome<input name="name" required maxLength={100} className={input} placeholder="es. Sfida del giovedì" /></label>
        <label className="grid gap-1">Data<input name="starts_on" type="date" className={input} /></label>
      </section>
      <fieldset className="space-y-1">
        <legend>Tipo</legend>
        <label className="flex items-center gap-2"><input type="radio" name="kind" value="singles" defaultChecked /> Singolare</label>
        <label className="flex items-center gap-2"><input type="radio" name="kind" value="doubles" /> Doppio</label>
      </fieldset>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">Potrai iscrivere te stesso, i tuoi amici e degli ospiti senza account. Il formato lo scegli dopo: bastano anche due giocatori per una sfida secca (girone unico).</p>
      {state.errors && <ul role="alert" className="list-disc pl-5 text-red-700 dark:text-red-400">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <button disabled={pending} className="btn-primary">
        {pending ? "Creazione…" : "Crea il torneo amichevole"}</button>
    </form>
  );
}
