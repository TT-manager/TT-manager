"use client";
import { useActionState, useState } from "react";
import { setError, type SetRules } from "@/lib/domain/score";

const btn = "rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black";
const Msg = ({ s }: { s: ResultState }) =>
  s.error ? <p role="alert" className="text-red-700 dark:text-red-400">{s.error}</p>
  : s.ok ? <p className="text-green-700 dark:text-green-400">{s.ok}</p> : null;

export type ResultState = { error?: string; ok?: string; set?: number };

/** Modulo di inserimento/correzione risultato, usato da organizzatore e admin. */
export function MatchForm({ action: submit, hidden, matchId, bestOf, rules, a, b, initial }: {
  action: (prev: ResultState, formData: FormData) => Promise<ResultState>;
  hidden: Record<string, string>; matchId: string; bestOf: number; rules: SetRules; a: string; b: string; initial: [number, number][] | null;
}) {
  const [state, action, pending] = useActionState<ResultState, FormData>(submit, {});
  const [open, setOpen] = useState(false);
  // Valori controllati: restano nel modulo anche dopo un errore (React svuota solo i campi non controllati).
  const [values, setValues] = useState<[string, string][]>(() =>
    Array.from({ length: bestOf }, (_, i) => [String(initial?.[i]?.[0] ?? ""), String(initial?.[i]?.[1] ?? "")]));
  // Righe da controllare: si attivano uscendo dal campo (TAB/clic altrove), si azzerano modificandole.
  const [checked, setChecked] = useState<Set<number>>(() => new Set());
  const check = (i: number) => setChecked((c) => new Set(c).add(i));
  const setValue = (i: number, side: 0 | 1, v: string) => {
    setChecked((c) => { const n = new Set(c); n.delete(i); return n; });
    setValues(values.map((row, j) => (j === i ? (side === 0 ? [v.replace(/\D/g, ""), row[1]] : [row[0], v.replace(/\D/g, "")]) : row)));
  };
  const toWin = Math.ceil(bestOf / 2);
  const num = "w-14 rounded border bg-transparent px-2 py-1 text-center tabular-nums";
  const bad = "border-2 border-red-600 dark:border-red-400";
  /** Errore del set, mostrato solo dopo essere usciti dal campo e con entrambi i punteggi compilati. */
  const liveError = (i: number) => {
    const [x, y] = values[i];
    return checked.has(i) && x !== "" && y !== "" ? setError([Number(x), Number(y)], rules) : null;
  };
  // Dopo un errore del server la riga resta evidenziata finché non si salva di nuovo.
  const serverRow = state.error ? state.set : undefined;
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="rounded border px-3 py-1 text-sm">
      {initial ? "Correggi" : "Inserisci risultato"}</button>
  );
  return (
    <form action={action} className="mt-2 space-y-2 rounded border p-3">
      {Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <input type="hidden" name="match_id" value={matchId} />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {bestOf === 1 ? "Set unico" : `Al meglio dei ${bestOf}: vince chi arriva a ${toWin} set`}, set a {rules.points}
        {rules.golden !== null ? `, golden point sul ${rules.golden} pari` : ""}. Lascia vuoti i set non giocati.</p>
      <table className="text-sm"><thead><tr><th></th><th className="px-1 text-left">{a}</th><th className="px-1 text-left">{b}</th></tr></thead>
        <tbody>
          {Array.from({ length: bestOf }, (_, i) => {
            const live = liveError(i);
            const wrong = Boolean(live) || serverRow === i + 1;
            return (
            <tr key={i} className={wrong ? "text-red-700 dark:text-red-400" : ""}>
              <td className="pr-2">Set {i + 1}</td>
              <td className="px-1"><input name={`a${i + 1}`} inputMode="numeric" pattern="[0-9]*" value={values[i][0]} onChange={(e) => setValue(i, 0, e.target.value)} onBlur={() => check(i)} autoComplete="off" className={`${num} ${wrong ? bad : ""}`} aria-invalid={wrong} aria-label={`Set ${i + 1} ${a}`} /></td>
              <td className="px-1"><input name={`b${i + 1}`} inputMode="numeric" pattern="[0-9]*" value={values[i][1]} onChange={(e) => setValue(i, 1, e.target.value)} onBlur={() => check(i)} autoComplete="off" className={`${num} ${wrong ? bad : ""}`} aria-invalid={wrong} aria-label={`Set ${i + 1} ${b}`} /></td>
              <td className="pl-2 text-xs">{live}</td>
            </tr>
            );
          })}
        </tbody></table>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className={btn}>{pending ? "Salvataggio…" : "Salva"}</button>
        {initial && <button name="intent" value="clear" disabled={pending} className="text-sm underline"
          onClick={(e) => { if (!confirm("Cancellare questo risultato?")) e.preventDefault(); }}>Cancella risultato</button>}
        <button type="button" onClick={() => setOpen(false)} className="text-sm underline">Chiudi</button>
      </div>
      <Msg s={state} />
    </form>
  );
}
