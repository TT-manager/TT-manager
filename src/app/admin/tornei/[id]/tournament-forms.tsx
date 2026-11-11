"use client";
import { useActionState, useState } from "react";
import { regenerateOrganizerCode, setEnrollment, type EnrollState, type RegenState } from "../actions";

type P = { id: string; full_name: string; club: string | null; rating: number };

export function EnrollmentForm({ tournamentId, players, enrolledIds, locked }:
  { tournamentId: string; players: P[]; enrolledIds: string[]; locked: boolean }) {
  const [state, action, pending] = useActionState<EnrollState, FormData>(setEnrollment, {});
  const [filter, setFilter] = useState("");
  const [checked, setChecked] = useState(() => new Set(enrolledIds));
  const shown = players.filter((p) => p.full_name.toLowerCase().includes(filter.toLowerCase()));
  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setChecked(next);
  };
  if (players.length === 0) return <p className="mt-2">Nessun giocatore attivo: aggiungili prima nella pagina Giocatori.</p>;
  return (
    <form action={action} className="mt-2 space-y-3">
      <input type="hidden" name="tournament_id" value={tournamentId} />
      {/* Gli iscritti nascosti dal filtro restano nel modulo. */}
      {[...checked].filter((id) => !shown.some((p) => p.id === id)).map((id) => <input key={id} type="hidden" name="player_id" value={id} />)}
      {locked && <p className="text-amber-700 dark:text-amber-400">I gironi sono già stati generati: iscrizioni chiuse.</p>}
      <input placeholder="Cerca…" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full rounded border bg-transparent px-3 py-2 sm:w-64" aria-label="Cerca giocatore" />
      <ul className="grid max-h-96 gap-1 overflow-y-auto sm:grid-cols-2">
        {shown.map((p) => (
          <li key={p.id}>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="player_id" value={p.id} checked={checked.has(p.id)} onChange={() => toggle(p.id)} disabled={locked} />
              {p.full_name} <span className="text-sm text-neutral-600 dark:text-neutral-400">{p.rating}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-4">
        <button disabled={pending || locked} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
          Salva iscrizioni ({checked.size})</button>
        {state.error && <p role="alert" className="text-red-700 dark:text-red-400">{state.error}</p>}
        {state.ok && <p className="text-green-700 dark:text-green-400">{state.ok}</p>}
      </div>
    </form>
  );
}

export function RegenerateCode({ tournamentId }: { tournamentId: string }) {
  const [state, action, pending] = useActionState<RegenState, FormData>(regenerateOrganizerCode, {});
  if (state.organizerCode) return (
    <div className="mt-2 rounded-lg border-2 border-amber-500 p-4">
      <p className="font-mono text-3xl tracking-widest">{state.organizerCode}</p>
      <p className="mt-2 text-sm">Nuovo codice: copialo ora, <strong>non verrà più mostrato</strong>. Il codice precedente non funziona più.</p>
    </div>
  );
  return (
    <form action={action} className="mt-2 space-y-2"
      onSubmit={(e) => { if (!confirm("Il codice attuale smetterà di funzionare. Continuare?")) e.preventDefault(); }}>
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">Il codice non è salvato in chiaro, quindi non si può rivedere. Se è andato perso, generane uno nuovo.</p>
      <button disabled={pending} className="rounded border px-4 py-2">Genera un nuovo codice</button>
      {state.error && <p role="alert" className="text-red-700 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
