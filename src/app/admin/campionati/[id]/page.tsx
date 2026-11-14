import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { CopyField } from "@/components/copy-field";
import { siteOrigin } from "@/lib/origin";
import { hasServiceKey } from "@/lib/organizer";
import { createServiceClient } from "@/lib/supabase/admin";
import { listAdminUsers } from "@/lib/admins";
import { statusLabel } from "@/lib/labels";
import { getLocale, tr } from "@/i18n/server";
import { intlTag } from "@/i18n/locale";
import { adminLeaguesText } from "@/i18n/dict/admin-leagues";
import { clubLabel } from "@/lib/clubs";
import { listClubs } from "@/lib/clubs-server";
import { normName } from "@/lib/names";
import { addChampionshipAdmin, addMembers, mergeDuplicateAction, decideRequest, disableInvite, regenerateInvite, recomputeAction, removeChampionshipAdmin, removeMember, renameChampionship, setVisibility } from "../actions";
import { pointsLabel } from "@/lib/labels";
import { ChampionshipHeader, input, loadManagedChampionship, muted } from "./shared";

export async function generateMetadata() {
  return { title: (await tr(adminLeaguesText)).leagueTitle };
}

export default async function ChampionshipPage({ params }: PageProps<"/admin/campionati/[id]">) {
  const { id } = await params;
  const { admin, supabase, championship: c } = await loadManagedChampionship(id);
  const tx = await tr(adminLeaguesText);
  const l = await getLocale();
  const [{ data: ranking }, { data: allPlayers }, { data: tournaments }, { data: admins }, clubs] = await Promise.all([
    supabase.from("championship_ranking").select("player_id, full_name, club, rating, games_played, position").eq("championship_id", id).order("position").order("full_name"),
    (hasServiceKey() ? createServiceClient() : supabase).from("players").select("id, full_name, club, active").is("guest_of", null).order("full_name"),
    supabase.from("tournaments").select("id, name, starts_on, status, ranked").eq("championship_id", id).order("starts_on", { ascending: false, nullsFirst: false }),
    supabase.from("championship_admins").select("user_id").eq("championship_id", id),
    listClubs(),
  ]);
  const members = new Set((ranking ?? []).map((r) => r.player_id as string));
  const others = (allPlayers ?? []).filter((p) => p.active && !members.has(p.id as string));
  const adminUsers = admin.role === "owner" ? await listAdminUsers() : [];
  const assigned = new Set((admins ?? []).map((a) => a.user_id as string));
  const hidden = <input type="hidden" name="championship_id" value={id} />;
  const { requests, unclaimed, invite } = await loadJoinData(id);
  // Possibili doppioni: schede senza account (create a mano) e giocatori registrati della lega.
  const { data: withAccount } = hasServiceKey()
    ? await createServiceClient().from("championship_players").select("player_id, players!inner(full_name, user_id)").eq("championship_id", id).not("players.user_id", "is", null)
    : { data: [] };
  const registered = (withAccount ?? []).map((r) => ({ id: r.player_id as string, name: (r.players as unknown as { full_name: string }).full_name }))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
  const suggested = unclaimed.flatMap((u) => registered.filter((r) => normName(r.name) === normName(u.name)).map((r) => ({ to: u, from: r })));
  const inviteUrl = invite ? `${await siteOrigin()}/partecipa/${c.slug}?invito=${invite}` : null;

  return (
    <main className="space-y-10">
      <ChampionshipHeader c={c} current="" />

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{tx.tournaments}</h2>
          <Link href={`/admin/tornei/nuovo?campionato=${id}`} className="btn-primary">{tx.newTournament}</Link>
        </div>
        {(tournaments ?? []).length === 0 ? <p className={`mt-2 ${muted}`}>{tx.noTournamentsYet}</p> : (
          <ul className="mt-2 divide-y">
            {tournaments!.map((t) => (
              <li key={t.id} className="flex flex-wrap items-baseline gap-x-4 py-2">
                <Link href={`/gestione/${t.id}`} className="font-medium hover:underline">{t.name}</Link>{!t.ranked && <span className="text-sm text-sky-700 dark:text-sky-300">{tx.friendly}</span>}
                <span className={muted}>{t.starts_on ? new Date(t.starts_on).toLocaleDateString(intlTag(l)) : tx.noDate} · {statusLabel(t.status, l)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold">{tx.ranking(pointsLabel(c.settings.label, l).toLowerCase())}</h2>
        {(ranking ?? []).length === 0 ? <p className={`mt-2 ${muted}`}>{tx.addPlayersBelow}</p> : (
          <table className="mt-2 w-full text-left text-sm">
            <thead><tr className="border-b"><th className="py-1">#</th><th>{tx.player}</th><th className="text-right">{c.settings.label}</th><th className="text-right">{tx.matches}</th><th /></tr></thead>
            <tbody>
              {ranking!.map((r) => (
                <tr key={r.player_id} className="border-b last:border-0">
                  <td className="py-1.5">{r.position}</td>
                  <td>{r.full_name}{r.club && <span className={muted}> · {r.club}</span>}</td>
                  <td className="text-right font-mono">{r.rating}</td>
                  <td className="text-right">{r.games_played}</td>
                  <td className="text-right">
                    {r.games_played === 0 && (
                      <ActionForm action={removeMember} submitLabel={tx.remove} primary={false} inline confirmText={tx.confirmRemoveMember(r.full_name)}>
                        {hidden}<input type="hidden" name="player_id" value={r.player_id} />
                      </ActionForm>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <ActionForm action={recomputeAction} submitLabel={tx.recompute} primary={false} className="mt-3">{hidden}</ActionForm>
        <p className={`mt-1 ${muted}`}>{tx.recomputeNote}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">{tx.joinRequests}{requests.length > 0 && ` (${requests.length})`}</h2>
        {requests.length === 0 ? <p className={`mt-2 ${muted}`}>{tx.noPendingRequests}</p> : (
          <ul className="mt-2 divide-y">
            {requests.map((r) => (
              <li key={r.id} className="py-3">
                <p><strong>{r.name}</strong> <span className={muted}>{r.email}{r.viaInvite && tx.viaInvite}</span></p>
                <ActionForm action={decideRequest} submitLabel={tx.confirm} primary={false} className="mt-2 flex flex-wrap items-center gap-3">
                  {hidden}<input type="hidden" name="request_id" value={r.id} />
                  <select name="decision" defaultValue="approve" className={`select-arrow ${input}`} aria-label={tx.decision}>
                    <option value="approve">{tx.approve}</option><option value="reject">{tx.reject}</option>
                  </select>
                  {unclaimed.length > 0 && (
                    <select name="link_player_id" defaultValue={r.claimId ?? ""} className={`select-arrow ${input}`} aria-label={tx.linkTo}>
                      <option value="">{tx.asNewPlayer}</option>
                      {unclaimed.map((u) => <option key={u.id} value={u.id}>{tx.linkToName(u.name)}{u.id === r.claimId ? tx.saysItsHim : ""}</option>)}
                    </select>)}
                </ActionForm>
              </li>))}
          </ul>)}
      </section>

      <section>
        <h2 className="text-lg font-semibold">{tx.inviteLink}</h2>
        <p className={`mt-1 ${muted}`}>{tx.inviteIntro}
          {" "}{tx.inviteIntro2}</p>
        {inviteUrl ? <div className="mt-2"><CopyField value={inviteUrl} label={tx.inviteLink} /></div> : <p className="mt-2">{tx.noActiveLink}</p>}
        <div className="mt-2 flex flex-wrap gap-4">
          <ActionForm action={regenerateInvite} submitLabel={inviteUrl ? tx.createNewLink : tx.createLink} primary={false}
            confirmText={inviteUrl ? tx.confirmNewLink : undefined}>{hidden}</ActionForm>
          {inviteUrl && <ActionForm action={disableInvite} submitLabel={tx.disableLink} primary={false} confirmText={tx.confirmDisableLink}>{hidden}</ActionForm>}
        </div>
      </section>

      <section className="rounded-lg border p-4">
        <h2 className="text-lg font-semibold">{tx.addByHand}</h2>
        <p className={`mt-1 ${muted}`}>{tx.addByHandNote}</p>
        <ActionForm action={addMembers} submitLabel={tx.add} className="mt-3">
          {hidden}
          {others.length > 0 && (
            <fieldset>
              <legend className={muted}>{tx.existingPlayers}</legend>
              <div className="mt-2 grid gap-1 sm:grid-cols-2">
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

      {unclaimed.length > 0 && registered.length > 0 && (
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">{tx.linkAccount}</h2>
          <p className={`mt-1 ${muted}`}>{tx.linkAccountNote}</p>
          {suggested.map((p) => (
            <ActionForm key={p.to.id + p.from.id} action={mergeDuplicateAction} submitLabel={tx.merge} primary={false} inline className="mt-3 block"
              confirmText={tx.confirmMergeNamed(p.to.name)}>
              {hidden}<input type="hidden" name="to_player_id" value={p.to.id} /><input type="hidden" name="from_player_id" value={p.from.id} />
              <span className="mr-2"><span className="badge-contested mr-2">{tx.sameName}</span>{p.to.name} {tx.noAccount} {tx.and} {p.from.name} {tx.registered}</span>
            </ActionForm>))}
          <ActionForm action={mergeDuplicateAction} submitLabel={tx.mergeRecords} primary={false} className="mt-4"
            confirmText={tx.confirmMerge}>
            {hidden}
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">{tx.recordWithHistory}
                <select name="to_player_id" required defaultValue="" className={`select-arrow ${input}`}>
                  <option value="" disabled>{tx.choose}</option>
                  {unclaimed.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select></label>
              <label className="grid gap-1 text-sm">{tx.accountToLink}
                <select name="from_player_id" required defaultValue="" className={`select-arrow ${input}`}>
                  <option value="" disabled>{tx.choose}</option>
                  {registered.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select></label>
            </div>
          </ActionForm>
        </section>)}

      <section>
        <h2 className="text-lg font-semibold">{tx.visibility}</h2>
        <ActionForm action={setVisibility} submitLabel={tx.save} primary={false} className="mt-2 flex flex-wrap items-center gap-3">
          {hidden}
          <label className="flex items-center gap-2"><input type="checkbox" name="is_public" defaultChecked={c.isPublic} /> {tx.publicLeague}</label>
        </ActionForm>
        <p className={`mt-1 ${muted}`}>{tx.visibilityNote}</p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">{tx.leagueName}</h2>
        <ActionForm action={renameChampionship} submitLabel={tx.saveName} primary={false} className="mt-2 flex flex-wrap items-center gap-3">
          {hidden}<input name="name" defaultValue={c.name} required maxLength={100} className={`${input} sm:w-96`} aria-label={tx.name} />
        </ActionForm>
      </section>

      {admin.role === "owner" && (
        <section>
          <h2 className="text-lg font-semibold">{tx.whoManages}</h2>
          <p className={`mt-1 ${muted}`}>{tx.whoManagesNote}</p>
          <ul className="mt-2 space-y-1">
            {adminUsers.filter((u) => assigned.has(u.userId)).map((u) => (
              <li key={u.userId} className="flex items-center gap-3">{u.email}
                <ActionForm action={removeChampionshipAdmin} submitLabel={tx.remove} primary={false} inline confirmText={tx.confirmRemoveAdmin(u.email)}>
                  {hidden}<input type="hidden" name="user_id" value={u.userId} />
                </ActionForm>
              </li>))}
          </ul>
          {adminUsers.some((u) => !assigned.has(u.userId)) ? (
            <ActionForm action={addChampionshipAdmin} submitLabel={tx.add} primary={false} className="mt-3 flex flex-wrap items-center gap-3">
              {hidden}
              <select name="user_id" className={`select-arrow ${input}`} aria-label={tx.administrator}>
                {adminUsers.filter((u) => !assigned.has(u.userId)).map((u) => <option key={u.userId} value={u.userId}>{u.email}</option>)}
              </select>
            </ActionForm>
          ) : <p className={`mt-2 ${muted}`}>{tx.toAddFirstCreate} <Link href="/admin/amministratori" className="underline">{tx.administrators}</Link>.</p>}
        </section>
      )}
    </main>
  );
}

async function loadJoinData(cid: string) {
  if (!hasServiceKey()) return { requests: [], unclaimed: [], invite: null };
  const svc = createServiceClient();
  const [{ data: reqs }, { data: free }, { data: inv }] = await Promise.all([
    svc.from("championship_requests").select("id, user_id, claim_player_id, via_invite").eq("championship_id", cid).eq("status", "pending").order("created_at"),
    svc.from("championship_players").select("player_id, players!inner(full_name, user_id)").eq("championship_id", cid).is("players.user_id", null),
    svc.from("championship_invites").select("token").eq("championship_id", cid).maybeSingle(),
  ]);
  const userIds = (reqs ?? []).map((r) => r.user_id as string);
  const { data: owners } = userIds.length ? await svc.from("players").select("user_id, full_name").in("user_id", userIds) : { data: [] };
  const nameOf = new Map((owners ?? []).map((o) => [o.user_id as string, o.full_name as string]));
  const requests = await Promise.all((reqs ?? []).map(async (r) => {
    const { data } = await svc.auth.admin.getUserById(r.user_id as string);
    return { id: r.id as number, name: nameOf.get(r.user_id as string) ?? "?", email: data.user?.email ?? "", claimId: r.claim_player_id as string | null, viaInvite: r.via_invite as boolean };
  }));
  const unclaimed = (free ?? []).map((f) => ({ id: f.player_id as string, name: (f.players as unknown as { full_name: string }).full_name }))
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
  return { requests, unclaimed, invite: (inv?.token as string | undefined) ?? null };
}
