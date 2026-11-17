import { ActionForm } from "@/components/action-form";
import { PlayersTable } from "@/app/admin/giocatori/player-forms";
import { hasServiceKey } from "@/lib/organizer";
import { createServiceClient } from "@/lib/supabase/admin";
import { clubLabel } from "@/lib/clubs";
import { listClubs } from "@/lib/clubs-server";
import { normName } from "@/lib/names";
import { tr } from "@/i18n/server";
import { adminLeaguesText } from "@/i18n/dict/admin-leagues";
import { addMembers, mergeDuplicateAction } from "../../actions";
import { ChampionshipHeader, input, loadManagedChampionship, muted } from "../shared";

export async function generateMetadata() {
  return { title: (await tr(adminLeaguesText)).tabPlayers };
}

/**
 * Giocatori del circuito: elenco con ricerca, aggiunta a mano e unione dei doppioni.
 * L'amministratore di circuito vede solo i membri del suo circuito; scegliere tra tutti
 * i giocatori della piattaforma resta al proprietario.
 */
export default async function LeaguePlayersPage({ params }: PageProps<"/admin/campionati/[id]/giocatori">) {
  const { id } = await params;
  const { admin, supabase, championship: c } = await loadManagedChampionship(id);
  const tx = await tr(adminLeaguesText);
  const owner = admin.role === "owner";
  // user_id non è leggibile con il login normale: dopo il controllo del gestore si legge con la chiave del server.
  const db = hasServiceKey() ? createServiceClient() : supabase;
  const [clubs, { data: rows }, { data: everyone }] = await Promise.all([
    listClubs(),
    db.from("championship_players")
      .select("players!inner(id, full_name, club_id, active, avatar_path, user_id, championship_players(championships(name)))").eq("championship_id", id),
    owner ? db.from("players").select("id, full_name, club, active").is("guest_of", null).order("full_name") : Promise.resolve({ data: [] }),
  ]);
  type P = { id: string; full_name: string; club_id: string | null; active: boolean; avatar_path: string | null; user_id: string | null;
    championship_players: { championships: { name: string } | null }[] };
  const members = ((rows ?? []) as unknown as { players: P }[]).map((r) => r.players)
    .sort((a, b) => Number(b.active) - Number(a.active) || a.full_name.localeCompare(b.full_name, "it"));
  const memberIds = new Set(members.map((m) => m.id));
  const others = ((everyone ?? []) as { id: string; full_name: string; club: string | null; active: boolean }[])
    .filter((p) => p.active && !memberIds.has(p.id));
  const hidden = <input type="hidden" name="championship_id" value={id} />;
  // Possibili doppioni: stesso nome scritto in due schede.
  const byName = new Map<string, P[]>();
  for (const m of members) byName.set(normName(m.full_name), [...(byName.get(normName(m.full_name)) ?? []), m]);
  const suggested = [...byName.values()].filter((g) => g.length === 2 && !(g[0].user_id && g[1].user_id))
    // Si tiene la scheda senza account (di solito quella con l'albo d'oro); l'account arriva con l'altra.
    .map((g) => (g[0].user_id ? { keep: g[1], merge: g[0] } : { keep: g[0], merge: g[1] }));

  return (
    <main className="space-y-10">
      <ChampionshipHeader c={c} current="/giocatori" />

      <section>
        <p className={muted}>{tx.membersIntro(members.length)}</p>
        <div className="mt-3">
          <PlayersTable clubs={clubs} players={members.map((p) => ({
            id: p.id, full_name: p.full_name, club_id: p.club_id, active: p.active, avatar_path: p.avatar_path, hasAccount: Boolean(p.user_id),
            // Gli altri circuiti del giocatore li vede solo il proprietario.
            championships: owner ? (p.championship_players ?? []).map((x) => x.championships?.name ?? "?") : [c.name],
          }))} />
        </div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">{tx.addByHand}</h2>
        <p className={`mt-1 ${muted}`}>{tx.addByHandNote}</p>
        <ActionForm action={addMembers} submitLabel={tx.add} className="mt-3">
          {hidden}
          {others.length > 0 && (
            <fieldset>
              <legend className={muted}>{tx.existingPlayers}</legend>
              <div className="mt-2 grid max-h-72 gap-1 overflow-y-auto sm:grid-cols-2">
                {others.map((p) => (
                  <label key={p.id} className="flex items-center gap-2">
                    <input type="checkbox" name="player_id" value={p.id} /> {p.full_name}{p.club && <span className={muted}>· {p.club}</span>}
                  </label>))}
              </div>
            </fieldset>)}
          <p className={`mt-4 ${muted}`}>{others.length > 0 ? tx.orCreateNew : tx.createNew}</p>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <input name="new_name" placeholder={tx.fullName} maxLength={80} className={input} aria-label={tx.fullName} />
            <select name="club_id" defaultValue="" className={`select-arrow ${input}`} aria-label={tx.club}>
              <option value="">{tx.noClub}</option>
              {clubs.map((cl) => <option key={cl.id} value={cl.id}>{clubLabel(cl)}</option>)}
            </select>
          </div>
        </ActionForm>
      </section>

      {members.length > 1 && hasServiceKey() && (
        <section className="card">
          <h2 className="text-lg font-semibold">{tx.linkAccount}</h2>
          <p className={`mt-1 ${muted}`}>{tx.linkAccountNote}</p>
          {suggested.map((p) => (
            <ActionForm key={p.keep.id + p.merge.id} action={mergeDuplicateAction} submitLabel={tx.merge} primary={false} inline className="mt-3 block"
              confirmText={tx.confirmMergeNamed(p.keep.full_name)}>
              {hidden}<input type="hidden" name="to_player_id" value={p.keep.id} /><input type="hidden" name="from_player_id" value={p.merge.id} />
              <span className="mr-2"><span className="badge-contested mr-2">{tx.sameName}</span>{p.keep.full_name}</span>
            </ActionForm>))}
          <ActionForm action={mergeDuplicateAction} submitLabel={tx.mergeRecords} primary={false} className="mt-4" confirmText={tx.confirmMerge}>
            {hidden}
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">{tx.recordWithHistory}
                <select name="to_player_id" required defaultValue="" className={`select-arrow ${input}`}>
                  <option value="" disabled>{tx.choose}</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.user_id ? ` ${tx.registered}` : ""}</option>)}
                </select></label>
              <label className="grid gap-1 text-sm">{tx.accountToLink}
                <select name="from_player_id" required defaultValue="" className={`select-arrow ${input}`}>
                  <option value="" disabled>{tx.choose}</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.user_id ? ` ${tx.registered}` : ""}</option>)}
                </select></label>
            </div>
          </ActionForm>
        </section>)}
    </main>
  );
}
