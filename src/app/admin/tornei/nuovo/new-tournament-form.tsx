"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { describeFormat, STAGE_NAMES, validateFormat, VALID_BEST_OF, type BestOf, type TournamentFormat } from "@/lib/domain/format";
import { createTournament, type CreateState } from "../actions";

const input = "rounded border bg-transparent px-3 py-2";
const STAGES = [4, 3, 2, 1, 0];
type Rule = { positions: string; stage: number };

function toFormat(groupCount: number, groupBestOf: BestOf, rules: Rule[], ko: Record<number, BestOf>, def: BestOf): TournamentFormat {
  return {
    groupCount, groupBestOf, defaultKnockoutBestOf: def, knockoutBestOf: ko,
    qualification: rules.map((r) => ({
      stage: r.stage,
      positions: r.positions.split(/[\s,;]+/).filter(Boolean).map(Number),
    })),
  };
}

function BestOfSelect({ value, onChange, label }: { value: BestOf; onChange: (b: BestOf) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value) as BestOf)} className={input}>
      {VALID_BEST_OF.map((b) => <option key={b} value={b}>{b === 1 ? "Set unico" : `Al meglio dei ${b}`}</option>)}
    </select>
  );
}

export default function NewTournamentForm() {
  const [state, action, pending] = useActionState<CreateState, FormData>(createTournament, {});
  const [groupCount, setGroupCount] = useState(4);
  const [groupBestOf, setGroupBestOf] = useState<BestOf>(3);
  const [def, setDef] = useState<BestOf>(3);
  const [ko, setKo] = useState<Record<number, BestOf>>({ 0: 5, 1: 5 });
  const [rules, setRules] = useState<Rule[]>([{ positions: "1, 2", stage: 2 }]);

  if (state.created) return <Created c={state.created} />;

  const format = toFormat(groupCount, groupBestOf, rules, ko, def);
  const problems = validateFormat(format);
  const usedStages = problems.length ? [] : STAGES.filter((s) => s <= Math.max(...format.qualification.map((q) => q.stage)));
  const setRule = (i: number, patch: Partial<Rule>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <form action={action} className="mt-6 space-y-8">
      <input type="hidden" name="format" value={JSON.stringify(format)} />
      <section className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <label className="grid gap-1">Nome<input name="name" required maxLength={100} className={input} /></label>
        <label className="grid gap-1">Data<input name="starts_on" type="date" className={input} /></label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Gironi</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">Numero di gironi
            <input type="number" min={1} max={64} value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value))} className={`${input} w-20`} /></label>
          <label className="flex items-center gap-2">Partite
            <BestOfSelect label="Set dei gironi" value={groupBestOf} onChange={setGroupBestOf} /></label>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Chi passa e dove entra nel tabellone</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Per ogni regola scrivi le posizioni di girone (es. «1» oppure «2, 3») e il turno in cui iniziano.</p>
        {rules.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input aria-label="Posizioni" value={r.positions} onChange={(e) => setRule(i, { positions: e.target.value })} className={`${input} w-28`} />
            <span>di ogni girone entrano a</span>
            <select aria-label="Turno di ingresso" value={r.stage} onChange={(e) => setRule(i, { stage: Number(e.target.value) })} className={input}>
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_NAMES[s]}</option>)}
            </select>
            {rules.length > 1 && <button type="button" onClick={() => setRules(rules.filter((_, j) => j !== i))} className="text-sm underline">Togli</button>}
          </div>
        ))}
        <button type="button" onClick={() => setRules([...rules, { positions: "", stage: 3 }])} className="rounded border px-3 py-1 text-sm">+ Aggiungi regola</button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Set nel tabellone</h2>
        <div className="flex flex-wrap gap-4">
          {usedStages.map((s) => (
            <label key={s} className="flex items-center gap-2">{STAGE_NAMES[s]}
              <BestOfSelect label={`Set ${STAGE_NAMES[s]}`} value={ko[s] ?? def} onChange={(b) => setKo({ ...ko, [s]: b })} /></label>
          ))}
          {usedStages.length === 0 && <label className="flex items-center gap-2">Tutti i turni <BestOfSelect label="Set tabellone" value={def} onChange={setDef} /></label>}
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold">Riepilogo</h2>
        {problems.length ? (
          <ul className="mt-2 list-disc pl-5 text-red-700 dark:text-red-400">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        ) : (
          <ul className="mt-2 list-disc pl-5">{describeFormat(format).map((l) => <li key={l}>{l}</li>)}</ul>
        )}
      </section>

      {state.errors && <ul role="alert" className="list-disc pl-5 text-red-700 dark:text-red-400">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      <button disabled={pending || problems.length > 0} className="rounded bg-black px-5 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
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
