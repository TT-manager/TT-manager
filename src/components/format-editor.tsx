"use client";
import { startTransition, useActionState, useState } from "react";
import {
  CROSS_CRITERIA, DEFAULT_CROSS_CRITERIA, describeFormat, groupSizes, knockoutFirstStage, MODE_LABELS, STAGE_NAMES, suggestGroupCounts,
  validateFormat, VALID_BEST_OF, type BestOf, type CrossCriterion, type TournamentFormat, type TournamentMode,
} from "@/lib/domain/format";
import { DEFAULT_SET_RULES, type SetRules } from "@/lib/domain/score";

export type FormatState = { errors?: string[]; ok?: string };

const input = "rounded border bg-transparent px-3 py-2";
// Spazio a destra per la freccetta delle tendine.
const select = "select-arrow rounded border bg-transparent py-2 pl-3";
const STAGES = [4, 3, 2, 1, 0];
/** best = null: tutti i classificati indicati; best = N: i migliori N tra i classificati (ripescaggio). */
type Rule = { positions: string; stage: number; best: number | null };

function toFormat(mode: TournamentMode, groupCount: number, groupBestOf: BestOf, rules: Rule[], ko: Record<number, BestOf>, def: BestOf,
  groupLegs: 1 | 2, groupSet: SetRules, koSet: Record<number, SetRules>, crossCriteria: CrossCriterion[]): TournamentFormat {
  if (mode === "league")
    return { mode, groupCount: 1, groupBestOf, groupLegs, groupSet, defaultKnockoutBestOf: def, knockoutBestOf: {}, qualification: [] };
  if (mode === "knockout")
    return { mode, groupCount: 0, groupBestOf, defaultKnockoutBestOf: def, knockoutBestOf: ko, knockoutSet: koSet, qualification: [] };
  return {
    mode, groupCount, groupBestOf, defaultKnockoutBestOf: def, knockoutBestOf: ko, groupLegs, groupSet, knockoutSet: koSet, crossCriteria,
    qualification: rules.map((r) => ({
      stage: r.stage,
      positions: r.positions.split(/[\s,;]+/).filter(Boolean).map(Number),
      ...(r.best !== null ? { best: r.best } : {}),
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


/**
 * Editor del formato di un torneo. `enrolled` = iscritti attuali (0 se non noti):
 * con gli iscritti il formato viene controllato sui gironi reali.
 */
export default function FormatEditor({ action: submit, hidden, initial, enrolled }: {
  action: (prev: FormatState, formData: FormData) => Promise<FormatState>;
  hidden: Record<string, string>; initial: TournamentFormat | null; enrolled: number;
}) {
  const [state, action, pending] = useActionState<FormatState, FormData>(submit, {});
  const i0 = initial;
  const [mode, setMode] = useState<TournamentMode>(i0?.mode ?? "groups");
  const [groupCount, setGroupCount] = useState(i0 && i0.groupCount > 0 ? i0.groupCount : (suggestGroupCounts(enrolled)[0]?.groups ?? 4));
  const [groupBestOf, setGroupBestOf] = useState<BestOf>(i0?.groupBestOf ?? 3);
  const def: BestOf = i0?.defaultKnockoutBestOf ?? 3; // set dei turni non ancora impostati
  const [ko, setKo] = useState<Record<number, BestOf>>(i0?.knockoutBestOf ?? { 0: 5, 1: 5 });
  const [rules, setRules] = useState<Rule[]>(i0?.qualification.length
    ? i0.qualification.map((q) => ({ positions: q.positions.join(", "), stage: q.stage, best: q.best ?? null }))
    : [{ positions: "1, 2", stage: 2, best: null }]);
  const [criteria, setCriteria] = useState<CrossCriterion[]>(i0?.crossCriteria?.length ? i0.crossCriteria : DEFAULT_CROSS_CRITERIA);
  const [groupLegs, setGroupLegs] = useState<1 | 2>(i0?.groupLegs ?? 1);
  const [groupSet, setGroupSet] = useState<SetRules>(i0?.groupSet ?? DEFAULT_SET_RULES);
  const [koSet, setKoSet] = useState<Record<number, SetRules>>(i0?.knockoutSet ?? {});

  const format = toFormat(mode, groupCount, groupBestOf, rules, ko, def, groupLegs, groupSet, koSet, criteria);
  const hasBest = mode === "groups" && rules.some((r) => r.best !== null);
  const moveCriterion = (i: number, d: -1 | 1) => {
    const next = [...criteria];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setCriteria(next);
  };
  const sizes = enrolled > 0 && mode === "groups" ? groupSizes(enrolled, groupCount)
    : enrolled > 0 && mode === "league" ? [enrolled] : undefined;
  const problems = [
    ...validateFormat(format, sizes),
    ...(sizes && sizes.some((n) => n < 2) ? [`Con ${enrolled} iscritti non si possono fare ${groupCount} gironi.`] : []),
  ];
  const usedStages = mode === "league" ? []
    : mode === "knockout"
    ? STAGES.filter((s) => s <= (enrolled >= 2 ? knockoutFirstStage(enrolled) : 3))
    : problems.length ? [] : STAGES.filter((s) => s <= Math.max(...format.qualification.map((q) => q.stage)));
  const setRule = (i: number, patch: Partial<Rule>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const suggestions = suggestGroupCounts(enrolled);

  return (
    // Invio manuale: evita che React svuoti i campi dopo il salvataggio (le caselle apparirebbero vuote).
    <form className="mt-6 space-y-8" onSubmit={(e) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      startTransition(() => action(data));
    }}>
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="format" value={JSON.stringify(format)} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tipo di torneo</h2>
        <select aria-label="Tipo di torneo" value={mode} onChange={(e) => setMode(e.target.value as TournamentMode)} className={select}>
          {(Object.keys(MODE_LABELS) as TournamentMode[]).map((m) => <option key={m} value={m}>{MODE_LABELS[m]}</option>)}
        </select>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {enrolled > 0 ? `Iscritti adesso: ${enrolled}.` : "Nessun iscritto per ora: potrai modificare il formato finché non generi i gironi."}
          {mode === "league" && enrolled >= 2 && ` Tutti contro tutti: ${(enrolled * (enrolled - 1)) / 2 * (groupLegs === 2 ? 2 : 1)} partite.`}
          {mode === "knockout" && enrolled >= 2 && ` Tabellone da ${2 ** (knockoutFirstStage(enrolled) + 1)}: ${2 ** (knockoutFirstStage(enrolled) + 1) - enrolled} teste di serie saltano il primo turno.`}
        </p>
      </section>

      {mode === "league" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Girone unico</h2>
          <select aria-label="Andata e ritorno" value={groupLegs} onChange={(e) => setGroupLegs(Number(e.target.value) as 1 | 2)} className={select}>
            <option value={1}>Solo andata</option>
            <option value={2}>Andata e ritorno</option>
          </select>
          <PhaseRow label="Partite" bestOf={groupBestOf} onBestOf={setGroupBestOf} rules={groupSet} onRules={setGroupSet} />
        </section>
      )}

      {mode === "groups" && <>
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
        {suggestions.length > 0 && (
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Con {enrolled} iscritti:{" "}
            {suggestions.map((s, i) => (
              <span key={s.groups}>{i > 0 && " · "}
                <button type="button" onClick={() => setGroupCount(s.groups)} className="underline">{s.groups} {s.groups === 1 ? "girone" : "gironi"} da {s.sizes}</button>
              </span>
            ))}</p>
        )}
        <PhaseRow label="Partite dei gironi" bestOf={groupBestOf} onBestOf={setGroupBestOf} rules={groupSet} onRules={setGroupSet} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Chi passa e dove entra nel tabellone</h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">Per ogni regola scrivi le posizioni di girone (es. «1» oppure «2, 3») e il turno in cui iniziano.</p>
        {rules.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <select aria-label="Tipo di regola" value={r.best === null ? "all" : "best"} className={select}
              onChange={(e) => setRule(i, e.target.value === "best"
                ? { best: 1, positions: r.positions.split(/[\s,;]+/).filter(Boolean)[0] ?? "2" }
                : { best: null })}>
              <option value="all">Tutti i</option>
              <option value="best">I migliori</option>
            </select>
            {r.best !== null && <>
              <input type="number" min={1} max={64} aria-label="Quanti ripescati" value={r.best}
                onChange={(e) => setRule(i, { best: Number(e.target.value) })} className={`${input} w-20`} />
              <span>tra i</span>
            </>}
            <input aria-label="Posizioni" value={r.positions} onChange={(e) => setRule(i, { positions: e.target.value })} className={`${input} w-24`} />
            <span>{r.best === null ? "classificati di ogni girone entrano a" : "classificati (ripescaggio) entrano a"}</span>
            <select aria-label="Turno di ingresso" value={r.stage} onChange={(e) => setRule(i, { stage: Number(e.target.value) })} className={select}>
              {STAGES.map((s) => <option key={s} value={s}>{STAGE_NAMES[s]}</option>)}
            </select>
            {rules.length > 1 && <button type="button" onClick={() => setRules(rules.filter((_, j) => j !== i))} className="text-sm underline">Togli</button>}
          </div>
        ))}
        <button type="button" onClick={() => setRules([...rules, { positions: "", stage: 3, best: null }])} className="rounded border px-3 py-1 text-sm">+ Aggiungi regola</button>
      </section>

      {hasBest && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Criteri per i ripescaggi</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Si confrontano giocatori di gironi diversi, quindi niente scontro diretto. Si usano medie per partita,
            perché i gironi possono avere un numero diverso di giocatori. Ordine di applicazione; a parità, la testa di serie.</p>
          <ol className="space-y-1">
            {criteria.map((c, i) => (
              <li key={c} className="flex items-center gap-2">
                <span className="w-6 tabular-nums">{i + 1}.</span>
                <span className="flex-1">{CROSS_CRITERIA[c]}</span>
                <button type="button" aria-label="Su" disabled={i === 0} onClick={() => moveCriterion(i, -1)} className="rounded border px-2 disabled:opacity-30">↑</button>
                <button type="button" aria-label="Giù" disabled={i === criteria.length - 1} onClick={() => moveCriterion(i, 1)} className="rounded border px-2 disabled:opacity-30">↓</button>
                <button type="button" onClick={() => setCriteria(criteria.filter((x) => x !== c))} disabled={criteria.length === 1} className="text-sm underline disabled:opacity-30">Togli</button>
              </li>
            ))}
          </ol>
          {criteria.length < Object.keys(CROSS_CRITERIA).length && (
            <select aria-label="Aggiungi criterio" value="" className={select}
              onChange={(e) => e.target.value && setCriteria([...criteria, e.target.value as CrossCriterion])}>
              <option value="">+ Aggiungi criterio…</option>
              {(Object.keys(CROSS_CRITERIA) as CrossCriterion[]).filter((c) => !criteria.includes(c))
                .map((c) => <option key={c} value={c}>{CROSS_CRITERIA[c]}</option>)}
            </select>
          )}
        </section>
      )}

      </>}

      {mode !== "league" && <section className="space-y-1">
        <h2 className="text-lg font-semibold">Partite del tabellone</h2>
        {usedStages.length === 0
          ? <p className="text-sm text-neutral-600 dark:text-neutral-400">Completa le regole di qualificazione per impostare i turni.</p>
          : <div>{usedStages.map((s) => (
              <PhaseRow key={s} label={STAGE_NAMES[s]} bestOf={ko[s] ?? def} onBestOf={(b) => setKo({ ...ko, [s]: b })}
                rules={koSet[s] ?? DEFAULT_SET_RULES} onRules={(r) => setKoSet({ ...koSet, [s]: r })} />
            ))}</div>}
      </section>}

      <section className="rounded-lg border p-4">
        <h2 className="font-semibold">Riepilogo</h2>
        {problems.length ? (
          <ul className="mt-2 list-disc pl-5 text-red-700 dark:text-red-400">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
        ) : (
          <ul className="mt-2 list-disc pl-5">{describeFormat(format, enrolled || undefined).map((l) => <li key={l}>{l}</li>)}</ul>
        )}
      </section>

      {state.errors && <ul role="alert" className="list-disc pl-5 text-red-700 dark:text-red-400">{state.errors.map((e) => <li key={e}>{e}</li>)}</ul>}
      {state.ok && <p className="text-green-700 dark:text-green-400">{state.ok}</p>}
      <button disabled={pending || problems.length > 0} className="btn-primary">
        {pending ? "Salvataggio…" : "Salva formato"}</button>
    </form>
  );
}

