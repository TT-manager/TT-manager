"use client";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { addPlayer, deletePlayer, removePlayerAvatar, setPlayerActive, updatePlayer, type FormState } from "./actions";
import { Avatar } from "@/components/avatar";
import { ClubPicker } from "@/components/club-picker";
import { clubLabel, type Club } from "@/lib/clubs";
import { normName } from "@/lib/names";
import { useTr } from "@/i18n/client";
import { adminShellText } from "@/i18n/dict/admin-shell";

const input = "rounded border bg-transparent px-3 py-2";
const msg = (s: FormState) =>
  s.error ? <p role="alert" className="text-sm text-red-700 dark:text-red-400">{s.error}</p>
  : s.ok ? <p className="text-sm text-green-700 dark:text-green-400">{s.ok}</p> : null;

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

/** Elenco dei giocatori in sola lettura, con ricerca e filtro: ogni riga apre la scheda del giocatore. */
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
      <p className="mt-2 text-sm text-muted">{t.playersShown(shown.length, players.length)} {t.playersTapHint}</p>
      <ul className="mt-3 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {shown.map((p) => {
          const club = clubName.get(p.club_id ?? "");
          return (
            <li key={p.id}>
              <Link href={`/admin/giocatori/${p.id}`} className={`flex items-center gap-3 px-3 py-2.5 transition hover:bg-brand/5 ${p.active ? "" : "opacity-60"}`}>
                <span className="relative">
                  <Avatar name={p.full_name} path={p.avatar_path} size="h-10 w-10 text-xs" />
                  {p.hasAccount && <span title={t.hasAccount} aria-label={t.hasAccount} className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-surface" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.full_name}</span>
                  <span className="block truncate text-xs text-muted">
                    {[club, p.championships.length ? p.championships.join(", ") : t.inNoLeague].filter(Boolean).join(" · ")}</span>
                </span>
                {!p.active && <span className="badge-muted shrink-0">{t.inactive}</span>}
                <span aria-hidden="true" className="text-xl text-muted">›</span>
              </Link>
            </li>);
        })}
        {shown.length === 0 && <li className="px-3 py-6 text-center text-muted">{t.noPlayersFound}</li>}
      </ul>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> {t.hasAccount}</p>
    </section>
  );
}

/** Scheda del giocatore: modifica di nome, circolo e stato. */
export function EditPlayerForm({ player, clubs }: { player: { id: string; full_name: string; club_id: string | null; active: boolean }; clubs: Club[] }) {
  const t = useTr(adminShellText);
  const [state, action, pending] = useActionState<FormState, FormData>(updatePlayer, {});
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={player.id} />
      <label className="grid gap-1 text-sm">{t.name}
        <input name="full_name" defaultValue={player.full_name} required className={input} /></label>
      <div className="grid gap-1 text-sm">{t.club}
        <ClubPicker clubs={clubs} defaultValue={player.club_id ?? ""} className={`${input} w-full`} /></div>
      {/* Lo stato si cambia con il pulsante in cima alla scheda: qui si conserva com'è. */}
      {player.active && <input type="hidden" name="active" value="on" />}
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "…" : t.save}</button>
        {msg(state)}
      </div>
    </form>
  );
}

export function RemovePhotoButton({ id }: { id: string }) {
  const t = useTr(adminShellText);
  const [state, action, pending] = useActionState<FormState, FormData>(removePlayerAvatar, {});
  return (
    <form action={action} onSubmit={(e) => { if (!confirm(t.confirmRemovePhoto)) e.preventDefault(); }} className="space-y-1">
      <input type="hidden" name="id" value={id} />
      <button disabled={pending} className="btn-outline px-3 py-1.5 text-sm">{pending ? "…" : t.removePhoto}</button>
      {msg(state)}
    </form>
  );
}

export function DeletePlayerBox({ id, name }: { id: string; name: string }) {
  const t = useTr(adminShellText);
  const [state, action, pending] = useActionState<FormState, FormData>(deletePlayer, {});
  return (
    <section className="rounded-lg border-2 border-red-600 p-4">
      <h2 className="font-semibold text-red-700 dark:text-red-400">{t.deletePlayerTitle}</h2>
      <p className="mt-1 text-sm text-muted">{t.deletePlayerNote}</p>
      <form action={action} className="mt-3" onSubmit={(e) => { if (!confirm(t.confirmDeletePlayer(name))) e.preventDefault(); }}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="back_to_list" value="1" />
        <button disabled={pending} className="rounded border border-red-600 px-4 py-2 text-red-700 hover:bg-red-600 hover:text-white dark:text-red-400">{pending ? "…" : t.delete}</button>
      </form>
      <div className="mt-2">{msg(state)}</div>
    </section>
  );
}

/** «Disattiva giocatore» / «Riattiva», con conferma che spiega cosa succede. */
export function ToggleActiveButton({ id, active }: { id: string; active: boolean }) {
  const t = useTr(adminShellText);
  const [state, action, pending] = useActionState<FormState, FormData>(setPlayerActive, {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => { if (!confirm(active ? t.confirmDeactivate : t.confirmReactivate)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="active" value={active ? "0" : "1"} />
      <button disabled={pending} className={active ? "btn-outline px-3 py-1.5 text-sm" : "btn-primary px-3 py-1.5 text-sm"}>
        {pending ? "…" : active ? t.deactivatePlayer : t.reactivatePlayer}</button>
      {msg(state)}
    </form>
  );
}
