"use client";
import { startTransition, useActionState, useState } from "react";
import { addGuest, closeTournamentAction, deleteTournamentAction, generateGroups, regenerateOrganizerCode, reopenTournamentAction, resetGroups, setEnrollment, type CloseState, type EnrollState, type GenState, type RegenState } from "@/app/gestione/actions";

import { useTr } from "@/i18n/client";
import { adminManageText } from "@/i18n/dict/admin-manage";

type P = { id: string; full_name: string; club: string | null; rating: number };

export function EnrollmentForm({ tournamentId, players, enrolledIds, locked, closed = false, saveAction = setEnrollment }:
  { tournamentId: string; players: P[]; enrolledIds: string[]; locked: boolean; closed?: boolean;
    saveAction?: (prev: EnrollState, formData: FormData) => Promise<EnrollState> }) {
  const tx = useTr(adminManageText);
  const [state, action, pending] = useActionState<EnrollState, FormData>(saveAction, {});
  const [filter, setFilter] = useState("");
  const [checked, setChecked] = useState(() => new Set(enrolledIds));
  // Iscritti al momento dell'ultimo salvataggio: il server applica solo le differenze,
  // così chi si è iscritto da solo nel frattempo non viene cancellato.
  const [baseline, setBaseline] = useState(() => [...enrolledIds]);
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
  if (players.length === 0) return <p className="mt-2">{tx.noPlayersToEnter}</p>;
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
      for (const id of baseline) data.append("before", id);
      data.set("diff", "1");
      setBaseline([...checked]);
      startTransition(() => action(data));
    }}>
      <input type="hidden" name="tournament_id" value={tournamentId} />
      {/* Gli iscritti nascosti dal filtro restano nel modulo. */}
      {[...checked].filter((id) => !shown.some((p) => p.id === id)).map((id) => <input key={id} type="hidden" name="player_id" value={id} />)}
      {locked && <p className="text-amber-700 dark:text-amber-400">
        {closed ? tx.closedEntries : tx.lockedEntries}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <input placeholder={tx.search} value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full rounded border bg-transparent px-3 py-2 sm:w-64" aria-label={tx.searchPlayer} />
        {!locked && <>
          <button type="button" onClick={() => selectShown(true)} className="rounded border px-3 py-1 text-sm">
            {filter ? tx.selectVisible : tx.selectAll}</button>
          <button type="button" onClick={() => selectShown(false)} className="rounded border px-3 py-1 text-sm">{tx.selectNone}</button>
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
      {!locked && (
        <div className="flex items-center gap-4">
          <button disabled={pending} className="btn-primary">
            {tx.saveEntries(checked.size)}</button>
          {!changedSinceSave && state.error && <p role="alert" className="text-red-700 dark:text-red-400">{state.error}</p>}
          {!changedSinceSave && state.ok && <p className="text-green-700 dark:text-green-400">{state.ok}</p>}
          {changedSinceSave && <p className="text-sm text-amber-700 dark:text-amber-400">{tx.unsaved}</p>}
        </div>
      )}
    </form>
  );
}

export function RegenerateCode({ tournamentId }: { tournamentId: string }) {
  const tx = useTr(adminManageText);
  const [state, action, pending] = useActionState<RegenState, FormData>(regenerateOrganizerCode, {});
  if (state.organizerCode) return (
    <div className="mt-2 rounded-lg border-2 border-amber-500 p-4">
      <p className="font-mono text-3xl tracking-widest">{state.organizerCode}</p>
      <p className="mt-2 text-sm">{tx.newCodeA} <strong>{tx.notShownAgain}</strong>{tx.newCodeB}</p>
    </div>
  );
  return (
    <form action={action} className="mt-2 space-y-2"
      onSubmit={(e) => { if (!confirm(tx.confirmNewCode)) e.preventDefault(); }}>
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{tx.codeNote}</p>
      <button disabled={pending} className="rounded border px-4 py-2">{tx.generateCode}</button>
      {state.error && <p role="alert" className="text-red-700 dark:text-red-400">{state.error}</p>}
    </form>
  );
}

export function GroupsControl({ tournamentId, status, mode, hasFormat }:
  { tournamentId: string; status: string; mode: "groups" | "knockout" | "league"; hasFormat: boolean }) {
  const tx = useTr(adminManageText);
  const knockoutOnly = mode === "knockout";
  const what = knockoutOnly ? "knockout" : mode === "league" ? "league" : "groups";
  const [gen, genAction, genPending] = useActionState<GenState, FormData>(generateGroups, {});
  const [res, resAction, resPending] = useActionState<GenState, FormData>(resetGroups, {});
  if (status === "draft" && !hasFormat) return <p className="mt-2 text-neutral-600 dark:text-neutral-400">{tx.setFormatFirst}</p>;
  if (status === "draft") return (
    <form action={genAction} className="mt-2 space-y-2"
      onSubmit={(e) => { if (!confirm(tx.confirmGenerate(what))) e.preventDefault(); }}>
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {knockoutOnly
          ? tx.genKnockoutNote
          : mode === "league" ? tx.genLeagueNote
          : tx.genGroupsNote}</p>
      <button disabled={genPending} className="btn-primary">
        {genPending ? tx.generating : knockoutOnly ? tx.genKnockout : mode === "league" ? tx.genLeague : tx.genGroups}</button>
      {gen.error && <p role="alert" className="text-red-700 dark:text-red-400">{gen.error}</p>}
    </form>
  );
  if (status === "closed") return null;
  return (
    <form action={resAction} className="mt-2 space-y-2"
      onSubmit={(e) => { if (!confirm(tx.confirmReset)) e.preventDefault(); }}>
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <button disabled={resPending} className="rounded border px-4 py-2">{tx.resetButton(what)}</button>
      {res.error && <p role="alert" className="text-red-700 dark:text-red-400">{res.error}</p>}
    </form>
  );
}

export function ClosingControl({ tournamentId, status, summary, ranked = true }:
  { tournamentId: string; status: string; summary: { toRate: number; unplayed: number; finished: boolean } | null; ranked?: boolean }) {
  const tx = useTr(adminManageText);
  const [closeState, closeAction, closing] = useActionState<CloseState, FormData>(closeTournamentAction, {});
  const [reopenState, reopenAction, reopening] = useActionState<CloseState, FormData>(reopenTournamentAction, {});
  const msg = (s: CloseState) => s.error ? <p role="alert" className="text-red-700 dark:text-red-400">{s.error}</p>
    : s.ok ? <p className="text-green-700 dark:text-green-400">{s.ok}</p> : null;
  if (status === "closed") return (
    <form action={reopenAction} className="mt-2 space-y-2"
      onSubmit={(e) => { if (!confirm(ranked ? tx.confirmReopenRanked : tx.confirmReopen)) e.preventDefault(); }}>
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <p>{ranked ? tx.closedRanked : tx.closed}</p>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{tx.reopenHint}</p>
      <button disabled={reopening} className="rounded border px-4 py-2">{tx.reopen}</button>
      {msg(reopenState)}{msg(closeState)}
    </form>
  );
  if (status === "draft" || !summary) return <p className="mt-2 text-neutral-600 dark:text-neutral-400">{tx.closeLater}</p>;
  return (
    <form action={closeAction} className="mt-2 space-y-2"
      onSubmit={(e) => {
        const warn = summary.unplayed ? tx.unplayedWarn(summary.unplayed) : "";
        if (!confirm(ranked ? tx.confirmCloseRanked(summary.toRate, warn) : tx.confirmClose(warn))) e.preventDefault();
      }}>
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <p>{tx.closeSummary(summary.toRate, ranked, summary.unplayed)}
        {!summary.finished && <span className="text-amber-700 dark:text-amber-400">{tx.finalNotPlayed}</span>}</p>
      <button disabled={closing || summary.toRate === 0} className="btn-primary">
        {closing ? tx.closingNow : ranked ? tx.closeRanked : tx.close}</button>
      {msg(closeState)}{msg(reopenState)}
    </form>
  );
}

/** Iscrizione a coppie (doppio): le coppie possono cambiare da un torneo all'altro. */
export function PairsForm({ tournamentId, players, initialPairs, locked, closed = false }:
  { tournamentId: string; players: P[]; initialPairs: string[][]; locked: boolean; closed?: boolean }) {
  const tx = useTr(adminManageText);
  const [state, action, pending] = useActionState<EnrollState, FormData>(setEnrollment, {});
  const [pairs, setPairs] = useState<[string, string][]>(() => initialPairs.map((p) => [p[0] ?? "", p[1] ?? ""]));
  const [changed, setChanged] = useState(false);
  const byId = new Map(players.map((p) => [p.id, p]));
  const used = new Set(pairs.flat().filter(Boolean));
  const update = (next: [string, string][]) => { setPairs(next); setChanged(true); };
  const setSlot = (i: number, side: 0 | 1, id: string) =>
    update(pairs.map((p, j) => (j === i ? (side === 0 ? [id, p[1]] : [p[0], id]) : p)));
  const complete = pairs.filter(([a, b]) => a && b);
  const filled = pairs.filter(([a, b]) => a || b);
  const solos = filled.length - complete.length;
  const sel = "select-arrow rounded border bg-transparent py-2 pl-3";

  if (players.length < 2) return <p className="mt-2">{tx.needTwoPlayers}</p>;
  return (
    <form className="mt-2 space-y-3" onSubmit={(e) => {
      e.preventDefault();
      setChanged(false);
      const data = new FormData();
      data.set("tournament_id", tournamentId);
      for (const [a, b] of filled) data.append("pair", [a, b].filter(Boolean).join(","));
      startTransition(() => action(data));
    }}>
      {locked && <p className="text-amber-700 dark:text-amber-400">
        {closed ? tx.closedPairs : tx.lockedPairs}</p>}
      <ul className="space-y-2">
        {pairs.map(([a, b], i) => {
          const avg = a && b ? Math.round(((byId.get(a)?.rating ?? 0) + (byId.get(b)?.rating ?? 0)) / 2) : null;
          return (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <span className="w-8 text-sm tabular-nums text-neutral-600 dark:text-neutral-400">{i + 1}.</span>
              {[0, 1].map((side) => (
                <select key={side} aria-label={tx.pairSlot(i + 1, side + 1)} disabled={locked} className={sel}
                  value={side === 0 ? a : b} onChange={(e) => setSlot(i, side as 0 | 1, e.target.value)}>
                  <option value="">{tx.choose}</option>
                  {players.filter((p) => p.id === (side === 0 ? a : b) || !used.has(p.id))
                    .map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.rating})</option>)}
                </select>
              ))}
              {avg !== null && <span className="text-sm text-neutral-600 dark:text-neutral-400">{tx.average(avg)}</span>}
              {(a ? 1 : 0) + (b ? 1 : 0) === 1 && <span className="text-sm text-amber-700 dark:text-amber-400">{tx.findPartner}</span>}
              {!locked && <button type="button" onClick={() => update(pairs.filter((_, j) => j !== i))} className="text-sm underline">{tx.remove}</button>}
            </li>
          );
        })}
      </ul>
      {!locked && (
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => update([...pairs, ["", ""]])} className="rounded border px-3 py-1 text-sm">{tx.addPair}</button>
          <button disabled={pending} className="btn-primary">
            {tx.savePairs(complete.length, solos)}</button>
          {!changed && state.error && <p role="alert" className="text-red-700 dark:text-red-400">{state.error}</p>}
          {!changed && state.ok && <p className="text-green-700 dark:text-green-400">{state.ok}</p>}
          {changed && <p className="text-sm text-amber-700 dark:text-amber-400">{tx.unsaved}</p>}
        </div>
      )}
    </form>
  );
}

/** Aggiunge un ospite (senza account) agli amichevoli. */
export function GuestForm({ tournamentId }: { tournamentId: string }) {
  const tx = useTr(adminManageText);
  const [state, action, pending] = useActionState<EnrollState, FormData>(addGuest, {});
  const [name, setName] = useState("");
  return (
    <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => {
      e.preventDefault();
      const data = new FormData();
      data.set("tournament_id", tournamentId); data.set("guest_name", name);
      startTransition(() => action(data));
      setName("");
    }}>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder={tx.guestName} maxLength={80} required
        className="rounded border bg-transparent px-3 py-1.5" aria-label={tx.guestName} />
      <button disabled={pending} className="rounded border px-3 py-1.5">{tx.addGuest}</button>
      {state.error && <span role="alert" className="text-red-700 dark:text-red-400">{state.error}</span>}
      {state.ok && <span className="text-green-700 dark:text-green-400">{state.ok}</span>}
    </form>
  );
}

/** «Elimina torneo», con conferma che dice quanti risultati si perdono. */
export function DeleteTournament({ tournamentId, name, played, blocked }: { tournamentId: string; name: string; played: number; blocked: boolean }) {
  const tx = useTr(adminManageText);
  const [state, action, pending] = useActionState<CloseState, FormData>(deleteTournamentAction, {});
  if (blocked) return <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{tx.deleteBlocked}</p>;
  return (
    <form action={action} className="mt-2 space-y-2"
      onSubmit={(e) => {
        const lost = played ? tx.lostResults(played) : "";
        if (!confirm(tx.confirmDelete(name, lost))) e.preventDefault();
      }}>
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <p className="text-sm text-neutral-600 dark:text-neutral-400">{tx.deleteNote}</p>
      <button disabled={pending} className="rounded border border-red-600 px-4 py-2 text-red-700 hover:bg-red-600 hover:text-white dark:text-red-400">{pending ? tx.deleting : tx.deleteTournament}</button>
      {state.error && <p role="alert" className="text-red-700 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
