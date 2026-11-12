"use client";
import { startTransition, useActionState, useState } from "react";
import { closeTournamentAction, generateGroups, regenerateOrganizerCode, reopenTournamentAction, resetGroups, setEnrollment, type CloseState, type EnrollState, type GenState, type RegenState } from "../actions";

type P = { id: string; full_name: string; club: string | null; rating: number };

export function EnrollmentForm({ tournamentId, players, enrolledIds, locked, saveAction = setEnrollment }:
  { tournamentId: string; players: P[]; enrolledIds: string[]; locked: boolean;
    saveAction?: (prev: EnrollState, formData: FormData) => Promise<EnrollState> }) {
  const [state, action, pending] = useActionState<EnrollState, FormData>(saveAction, {});
  const [filter, setFilter] = useState("");
  const [checked, setChecked] = useState(() => new Set(enrolledIds));
  // Il messaggio dell'ultimo salvataggio vale solo finché la selezione non cambia.
  const [changedSinceSave, setChangedSinceSave] = useState(false);
  const shown = players.filter((p) => p.full_name.toLowerCase().includes(filter.toLowerCase()));
  const update = (next: Set<string>) => { setChecked(next); setChangedSinceSave(true); };
  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    update(next);
  };
  const selectShown = (on: boolean) => {
    const next = new Set(checked);
    for (const p of shown) { if (on) next.add(p.id); else next.delete(p.id); }
    update(next);
  };
  if (players.length === 0) return <p className="mt-2">Nessun giocatore attivo: aggiungili prima nella pagina Giocatori.</p>;
  return (
    // Invio manuale: l'invio con `action` farebbe svuotare a React le caselle (restano selezionate in memoria
    // ma appaiono vuote). Così il modulo resta com'è e mostra la selezione salvata.
    <form className="mt-2 space-y-3" onSubmit={(e) => {
      e.preventDefault();
      setChangedSinceSave(false);
      // Gli iscritti si prendono dalla selezione in memoria, non dalle caselle a schermo.
      const data = new FormData();
      data.set("tournament_id", tournamentId);
      for (const id of checked) data.append("player_id", id);
      startTransition(() => action(data));
    }}>
      <input type="hidden" name="tournament_id" value={tournamentId} />
      {/* Gli iscritti nascosti dal filtro restano nel modulo. */}
      {[...checked].filter((id) => !shown.some((p) => p.id === id)).map((id) => <input key={id} type="hidden" name="player_id" value={id} />)}
      {locked && <p className="text-amber-700 dark:text-amber-400">I gironi sono già stati generati: iscrizioni chiuse.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <input placeholder="Cerca…" value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full rounded border bg-transparent px-3 py-2 sm:w-64" aria-label="Cerca giocatore" />
        {!locked && <>
          <button type="button" onClick={() => selectShown(true)} className="rounded border px-3 py-1 text-sm">
            Seleziona tutti{filter ? " i visibili" : ""}</button>
          <button type="button" onClick={() => selectShown(false)} className="rounded border px-3 py-1 text-sm">Nessuno</button>
        </>}
      </div>
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
        {!changedSinceSave && state.error && <p role="alert" className="text-red-700 dark:text-red-400">{state.error}</p>}
        {!changedSinceSave && state.ok && <p className="text-green-700 dark:text-green-400">{state.ok}</p>}
        {changedSinceSave && <p className="text-sm text-amber-700 dark:text-amber-400">Modifiche non ancora salvate.</p>}
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

export function GroupsControl({ tournamentId, status, mode, hasFormat }:
  { tournamentId: string; status: string; mode: "groups" | "knockout" | "league"; hasFormat: boolean }) {
  const knockoutOnly = mode === "knockout";
  const what = knockoutOnly ? "il tabellone" : mode === "league" ? "il calendario" : "i gironi";
  const [gen, genAction, genPending] = useActionState<GenState, FormData>(generateGroups, {});
  const [res, resAction, resPending] = useActionState<GenState, FormData>(resetGroups, {});
  if (status === "draft" && !hasFormat) return <p className="mt-2 text-neutral-600 dark:text-neutral-400">Imposta prima il formato del torneo.</p>;
  if (status === "draft") return (
    <form action={genAction} className="mt-2 space-y-2"
      onSubmit={(e) => { if (!confirm(`Generare ${what}? Le iscrizioni verranno chiuse.`)) e.preventDefault(); }}>
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {knockoutOnly
          ? "Le teste di serie sono posizionate in base alla classifica generale (la 1 e la 2 in metà opposte). Prima salva le iscrizioni."
          : mode === "league" ? "Tutti contro tutti. Prima salva le iscrizioni."
          : "Le teste di serie (classifica generale) sono distribuite a serpentina nei gironi. Prima salva le iscrizioni."}</p>
      <button disabled={genPending} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
        {genPending ? "Generazione…" : knockoutOnly ? "Genera tabellone" : mode === "league" ? "Genera calendario" : "Genera gironi e calendario"}</button>
      {gen.error && <p role="alert" className="text-red-700 dark:text-red-400">{gen.error}</p>}
    </form>
  );
  if (status === "closed") return null;
  return (
    <form action={resAction} className="mt-2 space-y-2"
      onSubmit={(e) => { if (!confirm("Annullare i gironi e tornare alle iscrizioni?")) e.preventDefault(); }}>
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <button disabled={resPending} className="rounded border px-4 py-2">Annulla {what} (solo se non ci sono risultati)</button>
      {res.error && <p role="alert" className="text-red-700 dark:text-red-400">{res.error}</p>}
    </form>
  );
}

export function ClosingControl({ tournamentId, status, summary }:
  { tournamentId: string; status: string; summary: { toRate: number; unplayed: number; finished: boolean } | null }) {
  const [closeState, closeAction, closing] = useActionState<CloseState, FormData>(closeTournamentAction, {});
  const [reopenState, reopenAction, reopening] = useActionState<CloseState, FormData>(reopenTournamentAction, {});
  const msg = (s: CloseState) => s.error ? <p role="alert" className="text-red-700 dark:text-red-400">{s.error}</p>
    : s.ok ? <p className="text-green-700 dark:text-green-400">{s.ok}</p> : null;
  if (status === "closed") return (
    <form action={reopenAction} className="mt-2 space-y-2"
      onSubmit={(e) => { if (!confirm("Riaprire il torneo? Le variazioni di rating di questo torneo saranno annullate finché non lo richiudi.")) e.preventDefault(); }}>
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <p>Torneo chiuso: i risultati sono conteggiati nella classifica generale.</p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">Per correggere un risultato riapri il torneo, correggi e poi richiudilo.</p>
      <button disabled={reopening} className="rounded border px-4 py-2">Riapri torneo</button>
      {msg(reopenState)}{msg(closeState)}
    </form>
  );
  if (status === "draft" || !summary) return <p className="mt-2 text-neutral-600 dark:text-neutral-400">Si potrà chiudere dopo aver generato i gironi e inserito i risultati.</p>;
  return (
    <form action={closeAction} className="mt-2 space-y-2"
      onSubmit={(e) => {
        const warn = summary.unplayed ? `\n\nAttenzione: ${summary.unplayed} partite non sono state giocate e verranno ignorate.` : "";
        if (!confirm(`Chiudere il torneo e aggiornare la classifica generale con ${summary.toRate} partite?${warn}`)) e.preventDefault();
      }}>
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <p>{summary.toRate} partite giocate da conteggiare · {summary.unplayed} ancora da giocare.
        {!summary.finished && <span className="text-amber-700 dark:text-amber-400"> La finale non è ancora stata giocata.</span>}</p>
      <button disabled={closing || summary.toRate === 0} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 dark:bg-white dark:text-black">
        {closing ? "Chiusura…" : "Chiudi torneo e aggiorna la classifica"}</button>
      {msg(closeState)}{msg(reopenState)}
    </form>
  );
}
