"use client";
import Link from "next/link";
import { useActionState } from "react";
import { createTournament, type CreateState } from "../actions";

const input = "rounded border bg-transparent px-3 py-2";

export default function NewTournamentForm() {
  const [state, action, pending] = useActionState<CreateState, FormData>(createTournament, {});
  if (state.created) return <Created c={state.created} />;
  return (
    <form action={action} className="mt-6 space-y-6">
      <section className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="grid gap-1">Nome<input name="name" required maxLength={100} className={input} /></label>
        <label className="grid gap-1">Data<input name="starts_on" type="date" className={input} /></label>
      </section>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Il formato (gironi, set, chi passa) lo imposti dopo, dalla pagina del torneo: anche quando conosci il numero di iscritti.</p>
      {state.errors && <ul role="alert" className="list-disc pl-5 text-red-700 dark:text-red-400">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <button disabled={pending} className="rounded bg-black px-5 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
        {pending ? "Creazione…" : "Crea torneo"}</button>
    </form>
  );
}

function Created({ c }: { c: NonNullable<CreateState["created"]> }) {
  return (
    <div className="mt-6 space-y-4">
      <p>Torneo <strong>{c.name}</strong> creato.</p>
      <div className="rounded-lg border-2 border-amber-500 p-4">
        <p className="font-semibold">Codice organizzatore (serve per inserire i risultati)</p>
        <p className="mt-2 font-mono text-3xl tracking-widest">{c.organizerCode}</p>
        <p className="mt-2 text-sm">Copialo adesso e dallo solo a chi segna i risultati: <strong>non verrà più mostrato</strong>.
          Se lo perdi, potrai generarne uno nuovo dalla pagina del torneo.</p>
      </div>
      <p>Codice pubblico per seguire il torneo: <span className="font-mono text-xl">{c.publicCode}</span></p>
      <Link href={`/admin/tornei/${c.id}`} className="inline-block rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black">Vai al torneo e iscrivi i giocatori</Link>
    </div>
  );
}
