"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { describeFormat, STAGE_NAMES, validateFormat, VALID_BEST_OF, type BestOf, type TournamentFormat } from "@/lib/domain/format";
import { DEFAULT_SET_RULES, type SetRules } from "@/lib/domain/score";
import { createTournament, type CreateState } from "../actions";

const input = "rounded border bg-transparent px-3 py-2";
// Spazio a destra per la freccetta delle tendine.
const select = "select-arrow rounded border bg-transparent py-2 pl-3";
const STAGES = [4, 3, 2, 1, 0];
type Rule = { positions: string; stage: number };

function toFormat(groupCount: number, groupBestOf: BestOf, rules: Rule[], ko: Record<number, BestOf>, def: BestOf,
  groupLegs: 1 | 2, groupSet: SetRules, koSet: Record<number, SetRules>): TournamentFormat {
  return {
    groupCount, groupBestOf, defaultKnockoutBestOf: def, knockoutBestOf: ko, groupLegs, groupSet, knockoutSet: koSet,
    qualification: rules.map((r) => ({
      stage: r.stage,
      positions: r.positions.split(/[\s,;]+/).filter(Boolean).map(Number),
    })),
  };
}

function BestOfSelect({ value, onChange, label }: { value: BestOf; onChange: (b: BestOf) => void; label: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(Number(e.target.value) as BestOf)} className={select}>
      {VALID_BEST_OF.map((b) => <option key={b} value={b}>{b === 1 ? "Set unico" : `Al meglio dei ${b}`}</option>)}
    </select>
  );
}

/** Una riga per fase: set della partita, punti del set, golden point facoltativo. */
function PhaseRow({ label, bestOf, onBestOf, rules, onRules }:
  { label: string; bestOf: BestOf; onBestOf: (b: BestOf) => void; rules: SetRules; onRules: (r: SetRules) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t py-3 first:border-t-0">
      <span className="w-40 font-medium">{label}</span>
      <BestOfSelect label={`Set ${label}`} value={bestOf} onChange={onBestOf} />
      <label className="flex items-center gap-2">Set a
        <input type="number" min={3} max={50} value={rules.points} aria-label={`Punti per set ${label}`}
          onChange={(e) => onRules({ ...rules, points: Number(e.target.value) })} className={`${input} w-20`} /> punti</label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={rules.golden !== null}
          onChange={(e) => onRules({ ...rules, golden: e.target.checked ? rules.points + 4 : null })} />
        Golden point
        {rules.golden !== null && <>{" "}sul <input type="number" min={rules.points - 1} max={60} value={rules.golden} aria-label={`Golden point ${label}`}
          onChange={(e) => onRules({ ...rules, golden: Number(e.target.value) })} className={`${input} w-20`} /> pari</>}
      </label>
    </div>
  );
}

export default function NewTournamentForm() {
  const [state, action, pending] = useActionState<CreateState, FormData>(createTournament, {});
  const [groupCount, setGroupCount] = useState(4);
  const [groupBestOf, setGroupBestOf] = useState<BestOf>(3);
  const def: BestOf = 3; // set dei turni non ancora impostati
  const [ko, setKo] = useState<Record<number, BestOf>>({ 0: 5, 1: 5 });
  const [rules, setRules] = useState<Rule[]>([{ positions: "1, 2", stage: 2 }]);
  const [groupLegs, setGroupLegs] = useState<1 | 2>(1);
  const [groupSet, setGroupSet] = useState<SetRules>(DEFAULT_SET_RULES);
  const [koSet, setKoSet] = useState<Record<number, SetRules>>({});

  if (state.created) return <Created c={state.created} />;

  const format = toFormat(groupCount, groupBestOf, rules, ko, def, groupLegs, groupSet, koSet);
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
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">Numero di gironi
            <input type="number" min={1} max={64} value={groupCount} onChange={(e) => setGroupCount(Number(e.target.value))} className={`${input} w-20`} /></label>
          <select aria-label="Andata e ritorno" value={groupLegs} onChange={(e) => setGroupLegs(Number(e.target.value) as 1 | 2)} className={select}>
            <option value={1}>Solo andata</option>
            <option value={2}>Andata e ritorno</option>
          </select>
        </div>
        <PhaseRow label="Partite dei gironi" bestOf={groupBestOf} onBestOf={setGroupBestOf} rules={groupSet} onRules={setGroupSet} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Chi passa e dove entra nel tabellone</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Per ogni regola scrivi le posizioni di girone (es. «1» oppure «2, 3») e il turno in cui iniziano.</p>
        {rules.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input aria-label="Posizioni" value={r.positions} onChange={(e) => setRule(i, { positions: e.target.value })} className={`${input} w-28`} />
            <span>di ogni girone entrano a</span>
            <select aria-label="Turno di ingresso" value={r.stage} onChange={(e) => setRule(i, { stage: Number(e.target.value) })} className={select}>
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_NAMES[s]}</option>)}
            </select>
            {rules.length > 1 && <button type="button" onClick={() => setRules(rules.filter((_, j) => j !== i))} className="text-sm underline">Togli</button>}
          </div>
        ))}
        <button type="button" onClick={() => setRules([...rules, { positions: "", stage: 3 }])} className="rounded border px-3 py-1 text-sm">+ Aggiungi regola</button>
      </section>

      <section className="space-y-1">
        <h2 className="text-lg font-semibold">Partite del tabellone</h2>
        {usedStages.length === 0
          ? <p className="text-sm text-neutral-600 dark:text-neutral-400">Completa le regole di qualificazione per impostare i turni.</p>
          : <div>{usedStages.map((s) => (
              <PhaseRow key={s} label={STAGE_NAMES[s]} bestOf={ko[s] ?? def} onBestOf={(b) => setKo({ ...ko, [s]: b })}
                rules={koSet[s] ?? DEFAULT_SET_RULES} onRules={(r) => setKoSet({ ...koSet, [s]: r })} />
            ))}</div>}
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
