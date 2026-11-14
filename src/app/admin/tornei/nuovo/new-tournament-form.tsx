"use client";
import Link from "next/link";
import { useActionState } from "react";
import { createTournament, type CreateState } from "@/app/gestione/actions";
import { useTr } from "@/i18n/client";
import { adminShellText } from "@/i18n/dict/admin-shell";

const input = "rounded border bg-transparent px-3 py-2";

export default function NewTournamentForm({ championships, preselected }:
  { championships: { id: string; name: string }[]; preselected?: string }) {
  const t = useTr(adminShellText);
  const [state, action, pending] = useActionState<CreateState, FormData>(createTournament, {});
  if (state.created) return <Created c={state.created} />;
  return (
    <form action={action} className="mt-6 space-y-6">
      <label className="grid gap-1 sm:w-96">{t.league}
        <select name="championship_id" defaultValue={preselected} required className="select-arrow rounded border bg-transparent py-2 pl-3">
          {championships.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
      <fieldset className="space-y-1">
        <legend>{t.tournamentType}</legend>
        <label className="flex items-center gap-2"><input type="radio" name="ranked" value="ranked" defaultChecked /> {t.rankedOption}</label>
        <label className="flex items-center gap-2"><input type="radio" name="ranked" value="friendly" /> {t.friendlyOption}</label>
      </fieldset>
      <section className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="grid gap-1">{t.name}<input name="name" required maxLength={100} className={input} /></label>
        <label className="grid gap-1">{t.date}<input name="starts_on" type="date" className={input} /></label>
      </section>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {t.formatLater}</p>
      {state.errors && <ul role="alert" className="list-disc pl-5 text-red-700 dark:text-red-400">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <button disabled={pending} className="btn-primary">
        {pending ? t.creating : t.createTournament}</button>
    </form>
  );
}

export function Created({ c }: { c: NonNullable<CreateState["created"]> }) {
  const t = useTr(adminShellText);
  return (
    <div className="mt-6 space-y-4">
      <p>{t.tournamentWord} <strong>{c.name}</strong> {t.createdSuffix}</p>
      <div className="rounded-lg border-2 border-amber-500 p-4">
        <p className="font-semibold">{t.organizerCodeTitle}</p>
        <p className="mt-2 font-mono text-3xl tracking-widest">{c.organizerCode}</p>
        <p className="mt-2 text-sm">{t.copyNow} <strong>{t.notShownAgainM}</strong>.
          {" "}{t.ifLost}</p>
      </div>
      <p>{t.publicCodeToFollow} <span className="font-mono text-xl">{c.publicCode}</span></p>
      <Link href={`/gestione/${c.id}`} className="btn-primary">{t.goToTournament}</Link>
    </div>
  );
}
