"use client";
import { useActionState, useMemo, useState } from "react";
import { addPlayer, deletePlayer, removePlayerAvatar, updatePlayer, type FormState } from "./actions";
import { Avatar } from "@/components/avatar";
import { ClubPicker } from "@/components/club-picker";
import { clubLabel, type Club } from "@/lib/clubs";
import { normName } from "@/lib/names";
import { useTr } from "@/i18n/client";
import { adminShellText } from "@/i18n/dict/admin-shell";

const input = "rounded border bg-transparent px-3 py-2";
const cell = "rounded border border-line bg-transparent px-2 py-1.5 text-sm";
const msg = (s: FormState) =>
  s.error ? <span role="alert" className="text-xs text-red-700 dark:text-red-400">{s.error}</span>
  : s.ok ? <span className="text-xs text-green-700 dark:text-green-400">{s.ok}</span> : null;

export type AdminPlayer = {
  id: string; full_name: string; club_id: string | null; active: boolean; championships: string[]; avatar_path: string | null; hasAccount: boolean;
};

/** «+ Nuovo giocatore»: modulo che si apre a richiesta. */
export function AddPlayerForm({ clubs }: { clubs: Club[] }) {
  const t = useTr(adminShellText);
  const [state, action, pending] = useActionState<FormState, FormData>(addPlayer, {});
  return (
    <details className="group mt-4 rounded-lg border border-dashed" open={Boolean(state.error)}>
      <summary className="cursor-pointer list-none px-4 py-3 font-semibold hover:text-brand">＋ {t.newPlayer}</summary>
      <form action={action} className="grid gap-3 px-4 pb-4 sm:grid-cols-[1fr_1fr_auto]">
        <input name="full_name" placeholder={t.fullName} required className={input} aria-label={t.fullName} />
        <ClubPicker clubs={clubs} className={`${input} w-full`} />
        <button disabled={pending} className="btn-primary">{t.add}</button>
        <div className="sm:col-span-3">{msg(state)}</div>
      </form>
    </details>
  );
}

/** Tabella dei giocatori: una riga per giocatore, ricerca e filtro; su telefono scorre di lato. */
export function PlayersTable({ players, clubs }: { players: AdminPlayer[]; clubs: Club[] }) {
  const t = useTr(adminShellText);
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "active" | "inactive">("all");
  const clubName = useMemo(() => new Map(clubs.map((c) => [c.id, clubLabel(c)])), [clubs]);
  const shown = players.filter((p) => {
    if (show === "active" && !p.active) return false;
    if (show === "inactive" && p.active) return false;
    if (!q.trim()) return true;
    const hay = normName([p.full_name, clubName.get(p.club_id ?? "") ?? "", ...p.championships].join(" "));
    return normName(q).split(" ").every((w) => hay.includes(w));
  });
  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPlayers} aria-label={t.searchPlayers}
          className={`${input} min-w-0 flex-1`} />
        <select value={show} onChange={(e) => setShow(e.target.value as typeof show)} aria-label={t.filter} className={`select-arrow ${input}`}>
          <option value="all">{t.filterAll}</option>
          <option value="active">{t.filterActive}</option>
          <option value="inactive">{t.filterInactive}</option>
        </select>
      </div>
      <p className="mt-2 text-sm text-muted">{t.playersShown(shown.length, players.length)} {t.playersHint}
        <span className="ml-1 inline-flex items-center gap-1 whitespace-nowrap"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {t.hasAccount}</span></p>
      <div className="mt-3 overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="sticky left-0 z-10 bg-surface px-2 py-2 shadow-[1px_0_0_var(--line)] sm:px-3">{t.name}</th>
              <th className="px-2 py-2">{t.club}</th>
              <th className="px-2 py-2">{t.leagues}</th>
              <th className="px-2 py-2 text-center">{t.active}</th>
              <th className="px-2 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((p) => <PlayerRow key={p.id} player={p} clubs={clubs} />)}
            {shown.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">{t.noPlayersFound}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PlayerRow({ player: p, clubs }: { player: AdminPlayer; clubs: Club[] }) {
  const t = useTr(adminShellText);
  const [state, action, pending] = useActionState<FormState, FormData>(updatePlayer, {});
  const [delState, delAction, delPending] = useActionState<FormState, FormData>(deletePlayer, {});
  const [photoState, photoAction, photoPending] = useActionState<FormState, FormData>(removePlayerAvatar, {});
  const form = `player-${p.id}`;
  return (
    <tr className={p.active ? "" : "opacity-60"}>
      {/* Colonna fissa: su telefono solo il nome (stretto), così resta spazio per il resto della riga. */}
      <td className="sticky left-0 z-10 bg-surface px-2 py-2 shadow-[1px_0_0_var(--line)] sm:px-3">
        <div className="flex items-center gap-2">
          <span className="hidden sm:block"><Avatar name={p.full_name} path={p.avatar_path} size="h-8 w-8" /></span>
          <span className="relative">
            <input form={form} name="full_name" defaultValue={p.full_name} required aria-label={t.name} className={`${cell} w-32 sm:w-44`} />
            {p.hasAccount && <span title={t.hasAccount} aria-label={t.hasAccount} className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-surface" />}
          </span>
        </div>
      </td>
      <td className="px-2 py-2">
        <select form={form} name="club_id" defaultValue={p.club_id ?? ""} aria-label={t.club} className={`select-arrow ${cell} w-40`}>
          <option value="">{t.noClub}</option>
          {clubs.map((c) => <option key={c.id} value={c.id}>{clubLabel(c)}</option>)}
        </select>
      </td>
      <td className="whitespace-nowrap px-2 py-2 text-muted">{p.championships.length ? p.championships.join(", ") : "—"}</td>
      <td className="px-2 py-2 text-center"><input form={form} type="checkbox" name="active" defaultChecked={p.active} aria-label={t.active} className="h-4 w-4" /></td>
      <td className="whitespace-nowrap px-2 py-2">
        <div className="flex items-center gap-3">
          <form id={form} action={action}>
            <input type="hidden" name="id" value={p.id} />
            <button disabled={pending} className="btn-outline px-3 py-1 text-sm">{pending ? "…" : t.save}</button>
          </form>
          {p.avatar_path && (
            <form action={photoAction} onSubmit={(e) => { if (!confirm(t.confirmRemovePhoto)) e.preventDefault(); }}>
              <input type="hidden" name="id" value={p.id} />
              <button disabled={photoPending} className="text-xs underline">{t.removePhoto}</button>
            </form>)}
          <form action={delAction} onSubmit={(e) => { if (!confirm(t.confirmDeletePlayer(p.full_name))) e.preventDefault(); }}>
            <input type="hidden" name="id" value={p.id} />
            <button disabled={delPending} className="text-xs text-red-700 underline dark:text-red-400">{t.delete}</button>
          </form>
          {msg(state)}{msg(delState)}{msg(photoState)}
        </div>
      </td>
    </tr>
  );
}
