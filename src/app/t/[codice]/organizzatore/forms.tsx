"use client";
import { useActionState, useState } from "react";
import { login, submitResult, type OrgState } from "./actions";

const btn = "rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black";
const Msg = ({ s }: { s: OrgState }) =>
  s.error ? <p role="alert" className="text-red-700 dark:text-red-400">{s.error}</p>
  : s.ok ? <p className="text-green-700 dark:text-green-400">{s.ok}</p> : null;

export function OrganizerLogin({ publicCode }: { publicCode: string }) {
  const [state, action, pending] = useActionState<OrgState, FormData>(login, {});
  return (
    <form action={action} className="mt-6 max-w-sm space-y-3">
      <input type="hidden" name="public_code" value={publicCode} />
      <label className="block">Codice organizzatore
        <input name="code" required autoComplete="off" autoCapitalize="characters" placeholder="ABCDE-FGHJK"
          className="mt-1 w-full rounded border bg-transparent px-3 py-2 font-mono text-xl uppercase tracking-widest" /></label>
      <button disabled={pending} className={btn}>{pending ? "Verifica…" : "Entra"}</button>
      <Msg s={state} />
    </form>
  );
}

export function MatchForm({ publicCode, matchId, bestOf, a, b, initial }:
  { publicCode: string; matchId: string; bestOf: number; a: string; b: string; initial: [number, number][] | null }) {
  const [state, action, pending] = useActionState<OrgState, FormData>(submitResult, {});
  const [open, setOpen] = useState(false);
  const toWin = Math.ceil(bestOf / 2);
  const num = "w-14 rounded border bg-transparent px-2 py-1 text-center tabular-nums";
  if (!open) return (
    <button type="button" onClick={() => setOpen(true)} className="rounded border px-3 py-1 text-sm">
      {initial ? "Correggi" : "Inserisci risultato"}</button>
  );
  return (
    <form action={action} className="mt-2 space-y-2 rounded border p-3">
      <input type="hidden" name="public_code" value={publicCode} />
      <input type="hidden" name="match_id" value={matchId} />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {bestOf === 1 ? "Set unico." : `Al meglio dei ${bestOf}: vince chi arriva a ${toWin} set.`} Lascia vuoti i set non giocati.</p>
      <table className="text-sm"><thead><tr><th></th><th className="px-1 text-left">{a}</th><th className="px-1 text-left">{b}</th></tr></thead>
        <tbody>
          {Array.from({ length: bestOf }, (_, i) => (
            <tr key={i}>
              <td className="pr-2">Set {i + 1}</td>
              <td className="px-1"><input name={`a${i + 1}`} inputMode="numeric" pattern="[0-9]*" defaultValue={initial?.[i]?.[0] ?? ""} className={num} aria-label={`Set ${i + 1} ${a}`} /></td>
              <td className="px-1"><input name={`b${i + 1}`} inputMode="numeric" pattern="[0-9]*" defaultValue={initial?.[i]?.[1] ?? ""} className={num} aria-label={`Set ${i + 1} ${b}`} /></td>
            </tr>
          ))}
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
