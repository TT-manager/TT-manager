import "server-only";
import type { Account } from "./account";
import { stageName } from "./domain/format";
import { groupLabel } from "./domain/tournament";
import { friendUserIds } from "./friends";
import { registrationIsOpen } from "./registration";
import { createServiceClient } from "./supabase/admin";
import { getLocale, tr } from "../i18n/server";
import { compDashboard } from "../i18n/dict/comp-dashboard";

type Svc = ReturnType<typeof createServiceClient>;

/** Nomi delle voci (giocatore o coppia «A / B»). */
async function entryNames(svc: Svc, entryIds: string[]) {
  const out = new Map<string, string>();
  if (!entryIds.length) return out;
  const { data } = await svc.from("entry_members").select("entry_id, players(full_name)").in("entry_id", entryIds);
  const by = new Map<string, string[]>();
  for (const r of data ?? []) by.set(r.entry_id as string, [...(by.get(r.entry_id as string) ?? []), (r.players as unknown as { full_name: string } | null)?.full_name ?? "?"]);
  for (const [id, names] of by) out.set(id, names.sort((a, b) => a.localeCompare(b, "it")).join(" / "));
  return out;
}

export type Side = { id: string; name: string; avatar: string | null }[];

/** Componenti delle voci (1 nel singolare, 2 nel doppio), con la foto. */
async function entrySides(svc: Svc, entryIds: string[]) {
  const out = new Map<string, Side>();
  if (!entryIds.length) return out;
  const { data } = await svc.from("entry_members").select("entry_id, players(id, full_name, avatar_path)").in("entry_id", entryIds);
  for (const r of data ?? []) {
    const p = r.players as unknown as { id: string; full_name: string; avatar_path: string | null } | null;
    if (!p) continue;
    out.set(r.entry_id as string, [...(out.get(r.entry_id as string) ?? []), { id: p.id, name: p.full_name, avatar: p.avatar_path }]);
  }
  for (const side of out.values()) side.sort((a, b) => a.name.localeCompare(b.name, "it"));
  return out;
}

const won = (m: { player_a: string; sets_a: number; sets_b: number }, entry: string) =>
  (m.player_a === entry) === (m.sets_a > m.sets_b);

export type LiveTournament = {
  name: string; code: string; ranked: boolean; league: string | null; phase: string;
  played: number; total: number; playing: boolean;
};
export type NextMatch = { tournament: string; code: string; phase: string; me: Side; opponent: Side; ranked: boolean };
export type Activity = { at: string; text: string; detail: string; href: string; who: string };

export async function loadDashboard(account: Account) {
  const svc = createServiceClient();
  const [l, tx] = await Promise.all([getLocale(), tr(compDashboard)]);
  const me = account.player.id;
  const [{ data: memberships }, { data: myEntries }, friends, { count: friendRequests }] = await Promise.all([
    svc.from("championship_players").select("championship_id").eq("player_id", me),
    svc.from("entry_members").select("entry_id, tournament_id").eq("player_id", me),
    friendUserIds(account.userId),
    svc.from("friendships").select("user_a", { count: "exact", head: true })
      .or(`user_a.eq.${account.userId},user_b.eq.${account.userId}`).eq("status", "pending").neq("requested_by", account.userId),
  ]);
  const entryIds = (myEntries ?? []).map((e) => e.entry_id as string);
  const championshipIds = (memberships ?? []).map((m) => m.championship_id as string);

  // Partite giocate e vittorie (tutte, amichevoli comprese).
  const { data: played } = entryIds.length ? await svc.from("matches").select("player_a, player_b, sets_a, sets_b")
    .or(`player_a.in.(${entryIds.join(",")}),player_b.in.(${entryIds.join(",")})`).not("sets_a", "is", null) : { data: [] };
  const mine = new Set(entryIds);
  const games = (played ?? []).length;
  const wins = (played ?? []).filter((m) => won(m as never, mine.has(m.player_a as string) ? m.player_a as string : m.player_b as string)).length;

  // Prossima partita: la prima da giocare nei tornei in corso, con l'avversario già noto.
  const tids = [...new Set((myEntries ?? []).map((e) => e.tournament_id as string))];
  const { data: live } = tids.length ? await svc.from("tournaments").select("id, name, public_code, ranked")
    .in("id", tids).in("status", ["groups", "knockout"]) : { data: [] };
  let next: NextMatch | null = null;
  if (live?.length) {
    const liveIds = live.map((t) => t.id as string);
    const { data: todo } = await svc.from("matches").select("tournament_id, phase, group_no, stage, round, position, player_a, player_b")
      .in("tournament_id", liveIds).is("sets_a", null).not("player_a", "is", null).not("player_b", "is", null)
      .or(`player_a.in.(${entryIds.join(",")}),player_b.in.(${entryIds.join(",")})`)
      .order("phase", { ascending: true }).order("stage", { ascending: false }).order("round").order("position").limit(1);
    const m = todo?.[0];
    if (m) {
      const t = live.find((x) => x.id === m.tournament_id)!;
      const myEntry = mine.has(m.player_a as string) ? m.player_a as string : m.player_b as string;
      const opp = myEntry === m.player_a ? m.player_b as string : m.player_a as string;
      const sides = await entrySides(svc, [myEntry, opp]);
      // Tu per primo; il compagno (nel doppio) dopo.
      const meSide = [...(sides.get(myEntry) ?? [])].sort((a, b) => Number(b.id === me) - Number(a.id === me));
      next = {
        tournament: t.name as string, code: t.public_code as string, ranked: t.ranked as boolean,
        me: meSide, opponent: sides.get(opp) ?? [{ id: opp, name: "?", avatar: null }],
        phase: m.phase === "group" ? tx.groupRound(groupLabel(m.group_no as number), m.round as number) : stageName(m.stage as number, l),
      };
    }
  }

  // Tornei in corso: quelli a cui partecipi e quelli delle tue leghe.
  const { data: liveRows } = await svc.from("tournaments").select("id, name, public_code, ranked, status, championships(name)")
    .in("status", ["groups", "knockout"])
    .or([tids.length && `id.in.(${tids.join(",")})`, championshipIds.length && `championship_id.in.(${championshipIds.join(",")})`].filter(Boolean).join(",") || "id.is.null")
    .order("created_at", { ascending: false }).limit(10);
  const liveIds = (liveRows ?? []).map((t) => t.id as string);
  const { data: liveMatches } = liveIds.length
    ? await svc.from("matches").select("tournament_id, sets_a, player_a, player_b").in("tournament_id", liveIds) : { data: [] };
  const liveTournaments: LiveTournament[] = (liveRows ?? []).map((t) => {
    const ms = (liveMatches ?? []).filter((m) => m.tournament_id === t.id && m.player_a && m.player_b);
    return {
      name: t.name as string, code: t.public_code as string, ranked: t.ranked as boolean,
      league: (t.championships as unknown as { name: string } | null)?.name ?? null,
      phase: t.status === "groups" ? tx.qualification : tx.knockoutStage,
      played: ms.filter((m) => m.sets_a !== null).length, total: ms.length, playing: tids.includes(t.id as string),
    };
  });

  // Iscrizioni aperte a cui non sei ancora iscritto.
  const { data: openRows } = championshipIds.length ? await svc.from("tournaments")
    .select("id, status, championship_id, registration_open, registration_deadline")
    .in("championship_id", championshipIds).eq("status", "draft").eq("registration_open", true) : { data: [] };
  const openToJoin = (openRows ?? []).filter((t) => registrationIsOpen(t) && !tids.includes(t.id as string)).length;

  // Attività degli amici: ultimi risultati e tornei amichevoli creati.
  const activity: Activity[] = [];
  if (friends.length) {
    const [{ data: fp }, { data: created }] = await Promise.all([
      svc.from("players").select("id, full_name, user_id").in("user_id", friends),
      svc.from("tournaments").select("name, public_code, created_at, owner_user_id").in("owner_user_id", friends)
        .order("created_at", { ascending: false }).limit(5),
    ]);
    const friendPlayer = new Map((fp ?? []).map((p) => [p.id as string, p.full_name as string]));
    const byUser = new Map((fp ?? []).map((p) => [p.user_id as string, p.full_name as string]));
    for (const t of created ?? []) activity.push({ at: t.created_at as string, who: byUser.get(t.owner_user_id as string) ?? "?",
      text: tx.createdFriendly, detail: t.name as string, href: `/t/${t.public_code}` });
    const { data: fe } = fp?.length ? await svc.from("entry_members").select("entry_id, player_id").in("player_id", [...friendPlayer.keys()]) : { data: [] };
    const friendEntry = new Map((fe ?? []).map((e) => [e.entry_id as string, e.player_id as string]));
    if (friendEntry.size) {
      const ids = [...friendEntry.keys()].join(",");
      const { data: res } = await svc.from("matches").select("player_a, player_b, sets_a, sets_b, played_at, tournaments(name, public_code)")
        .or(`player_a.in.(${ids}),player_b.in.(${ids})`).not("sets_a", "is", null).not("played_at", "is", null)
        .order("played_at", { ascending: false }).limit(8);
      const names = await entryNames(svc, [...new Set((res ?? []).flatMap((m) => [m.player_a as string, m.player_b as string]))]);
      for (const m of res ?? []) {
        const side = friendEntry.has(m.player_a as string) ? m.player_a as string : m.player_b as string;
        const other = side === m.player_a ? m.player_b as string : m.player_a as string;
        const t = m.tournaments as unknown as { name: string; public_code: string } | null;
        const w = won(m as never, side);
        const score = side === m.player_a ? `${m.sets_a}\u2011${m.sets_b}` : `${m.sets_b}\u2011${m.sets_a}`; // trattino che non va a capo
        activity.push({ at: m.played_at as string, who: friendPlayer.get(friendEntry.get(side)!) ?? "?",
          text: tx.result(w, names.get(other) ?? "?", score), detail: t?.name ?? "", href: t ? `/t/${t.public_code}` : "#" });
      }
    }
    activity.sort((a, b) => b.at.localeCompare(a.at));
  }

  return {
    kpi: { championships: championshipIds.length, games, wins, friendRequests: friendRequests ?? 0, openToJoin },
    next, live: liveTournaments, activity: activity.slice(0, 6), hasFriends: friends.length > 0,
  };
}

