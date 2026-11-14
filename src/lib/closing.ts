import "server-only";
import { createServiceClient } from "./supabase/admin";
import { computeRanking, parseRankingSettings, DEFAULT_RANKING, type RankingInput } from "./domain/ranking";
import { isPlayed } from "./domain/tournament";
import { tr } from "@/i18n/server";
import { adminManageText } from "@/i18n/dict/admin-manage";

type T = (typeof adminManageText)["it"];
const DB_ERRORS: Record<string, keyof T> = {
  TORNEO_NON_CHIUDIBILE: "dbNotClosable",
  PARTITE_CAMBIATE: "dbMatchesChanged",
  TORNEO_NON_CHIUSO: "dbNotClosed",
  CAMPIONATO_NON_TROVATO: "dbLeagueNotFound",
};
const dbError = (t: T, msg: string | undefined) =>
  t[Object.entries(DB_ERRORS).find(([k]) => msg?.includes(k))?.[1] ?? "dbGeneric"] as string;

/** Stato della chiusura: partite giocate e partite ancora da giocare. */
export async function closingSummary(tournamentId: string) {
  const svc = createServiceClient();
  const { data } = await svc.from("matches").select("sets_a, sets_b, player_a, player_b, rated, phase, stage").eq("tournament_id", tournamentId);
  const rows = data ?? [];
  const finalPlayed = rows.some((m) => m.phase === "knockout" && m.stage === 0 && isPlayed(m));
  const hasKnockout = rows.some((m) => m.phase === "knockout");
  return {
    toRate: rows.filter((m) => isPlayed(m) && !m.rated).length,
    unplayed: rows.filter((m) => !isPlayed(m)).length,
    finished: hasKnockout ? finalPlayed : rows.length > 0 && rows.every(isPlayed),
  };
}

/**
 * Ricalcola da zero la classifica della lega e la scrive in un'unica transazione.
 * Opzionalmente chiude (`close`) o riapre (`reopen`) un torneo nella stessa operazione.
 * Da chiamare SOLO dopo aver verificato che chi chiama gestisce la lega.
 */
export async function recomputeChampionship(championshipId: string, opts: { close?: string; reopen?: string } = {}):
  Promise<{ error?: string; ok?: string; rated?: number }> {
  const t = await tr(adminManageText);
  const svc = createServiceClient();
  const { data: ch } = await svc.from("championships").select("id, settings").eq("id", championshipId).maybeSingle();
  if (!ch) return { error: t.dbLeagueNotFound };
  const parsed = parseRankingSettings(ch.settings);
  const settings = "settings" in parsed ? parsed.settings : DEFAULT_RANKING;

  const [{ data: members }, { data: past }, { data: absences }, { data: tournaments }] = await Promise.all([
    svc.from("championship_players").select("player_id, start_override, joined_on").eq("championship_id", championshipId),
    svc.from("past_results").select("player_id, position, past_tournaments!inner(championship_id)").eq("past_tournaments.championship_id", championshipId),
    svc.from("player_absences").select("player_id, from_date, to_date").eq("championship_id", championshipId),
    svc.from("tournaments").select("id, status, starts_on, closed_at, created_at").eq("championship_id", championshipId).eq("ranked", true),
  ]);
  // Tornei conteggiati dopo questa operazione, in ordine cronologico.
  const counted = (tournaments ?? [])
    .filter((t) => (t.status === "closed" && t.id !== opts.reopen) || t.id === opts.close)
    .map((t) => ({ ...t, date: (t.starts_on as string | null) ?? String(t.closed_at ?? new Date().toISOString()).slice(0, 10) }))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.created_at).localeCompare(String(b.created_at)));
  const ids = counted.map((t) => t.id as string);

  const [{ data: matches }, { data: entryMembers }] = ids.length ? await Promise.all([
    svc.from("matches").select("id, tournament_id, phase, stage, round, position, player_a, player_b, sets_a, sets_b, played_at").in("tournament_id", ids),
    svc.from("entry_members").select("entry_id, tournament_id, player_id").in("tournament_id", ids),
  ]) : [{ data: [] }, { data: [] }];
  const playersOf = new Map<string, string[]>();
  for (const m of entryMembers ?? []) playersOf.set(m.entry_id as string, [...(playersOf.get(m.entry_id as string) ?? []), m.player_id as string]);

  const memberIds = new Set((members ?? []).map((m) => m.player_id as string));
  const played = (matches ?? []).filter((m) => isPlayed(m) && m.player_a && m.player_b);
  const input: RankingInput = {
    settings,
    members: (members ?? []).map((m) => ({ playerId: m.player_id as string, override: m.start_override as number | null, joinedOn: m.joined_on as string | null })),
    pastResults: (past ?? []).filter((r) => memberIds.has(r.player_id as string)).map((r) => ({ playerId: r.player_id as string, position: r.position as number })),
    absences: (absences ?? []).map((a) => ({ playerId: a.player_id as string, from: a.from_date as string, to: a.to_date as string | null })),
    tournaments: counted.map((t) => ({
      id: t.id as string, date: t.date,
      participants: [...new Set((entryMembers ?? []).filter((m) => m.tournament_id === t.id).map((m) => m.player_id as string))]
        .filter((p) => memberIds.has(p)),
      matches: played.filter((m) => m.tournament_id === t.id)
        .sort((x, y) => String(x.played_at ?? "").localeCompare(String(y.played_at ?? "")) ||
          (x.phase === y.phase ? 0 : x.phase === "group" ? -1 : 1) || (y.stage ?? 99) - (x.stage ?? 99) || x.round - y.round || x.position - y.position)
        .map((m) => {
          const aWins = (m.sets_a as number) > (m.sets_b as number);
          const a = (playersOf.get(m.player_a as string) ?? []).filter((p) => memberIds.has(p));
          const b = (playersOf.get(m.player_b as string) ?? []).filter((p) => memberIds.has(p));
          return { id: m.id as string, winners: aWins ? a : b, losers: aWins ? b : a };
        })
        .filter((m) => m.winners.length > 0 && m.losers.length > 0),
    })),
  };
  const result = computeRanking(input);

  const { error } = await svc.rpc("replace_championship_ratings", {
    p_championship: championshipId,
    p_payload: {
      close: opts.close ?? null, reopen: opts.reopen ?? null,
      // Con i risultati usati: il database verifica che non siano cambiati nel frattempo.
      matches: played.map((m) => ({ id: m.id, sets_a: m.sets_a, sets_b: m.sets_b, player_a: m.player_a, player_b: m.player_b })),
      players: result.players,
      history: result.history,
    },
  });
  if (error) return { error: dbError(t, error.message) };
  return { ok: t.rankingUpdated, rated: played.length };
}

export async function closeTournament(championshipId: string, tournamentId: string) {
  const r = await recomputeChampionship(championshipId, { close: tournamentId });
  if (r.error) return r;
  return { ok: (await tr(adminManageText)).closedRankingUpdated };
}

export async function reopenTournament(championshipId: string, tournamentId: string) {
  const r = await recomputeChampionship(championshipId, { reopen: tournamentId });
  if (r.error) return r;
  return { ok: (await tr(adminManageText)).reopenedRecomputed };
}
