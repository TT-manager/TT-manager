import { createPublicClient } from "./supabase/public";
import { entryName, loadEntries } from "./entries";
import { DEFAULT_RANKING, parseRankingSettings, type RankingSettings } from "./domain/ranking";
import type { MatchRow } from "./domain/tournament";

// Lettura a ogni richiesta (nessuna cache): i risultati devono comparire subito.

export type Championship = { id: string; name: string; slug: string; kind: "singles" | "doubles"; settings: RankingSettings; isPublic: boolean };
export type RankingRow = {
  player_id: string; full_name: string; club: string | null;
  rating: number; games_played: number; position: number; avatar_path: string | null;
};

const toChampionship = (c: Record<string, unknown>): Championship => {
  const p = parseRankingSettings(c.settings);
  return { id: c.id as string, name: c.name as string, slug: c.slug as string, kind: c.kind as "singles" | "doubles", isPublic: Boolean(c.is_public),
    settings: "settings" in p ? p.settings : DEFAULT_RANKING };
};

export async function getChampionships(): Promise<Championship[]> {
  const { data, error } = await createPublicClient().from("championships").select("id, name, slug, kind, settings, is_public").order("name");
  if (error) throw new Error("Impossibile leggere le leghe");
  return (data ?? []).map(toChampionship);
}

export async function getChampionshipBySlug(slug: string): Promise<Championship | null> {
  const { data } = await createPublicClient().from("championships").select("id, name, slug, kind, settings, is_public").eq("slug", slug).maybeSingle();
  return data ? toChampionship(data) : null;
}

export async function getRanking(championshipId: string): Promise<RankingRow[]> {
  const { data, error } = await createPublicClient()
    .from("championship_ranking").select("player_id, full_name, club, rating, games_played, position, avatar_path")
    .eq("championship_id", championshipId).order("position").order("full_name");
  if (error) throw new Error("Impossibile leggere la classifica");
  return data as RankingRow[];
}

/** Tornei della lega (pubblici) e albo d'oro dei tornei passati. */
export async function getChampionshipTournaments(championshipId: string) {
  const supabase = createPublicClient();
  const [{ data: tournaments }, { data: past }] = await Promise.all([
    supabase.from("tournaments_public").select("id, name, starts_on, status, public_code, closed_at, ranked, championship_id, registration_open, registration_deadline").eq("championship_id", championshipId)
      // Storico: solo i tornei validi per i punti; gli amichevoli si vedono finché non sono chiusi.
      .or("ranked.eq.true,status.neq.closed")
      .order("starts_on", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }),
    supabase.from("past_tournaments").select("id, name, held_on, past_results(position, players(full_name))")
      .eq("championship_id", championshipId).order("held_on", { ascending: false, nullsFirst: false }),
  ]);
  return {
    tournaments: tournaments ?? [],
    past: (past ?? []).map((p) => ({
      id: p.id as string, name: p.name as string, held_on: p.held_on as string | null,
      podium: ((p.past_results ?? []) as unknown as { position: number; players: { full_name: string } | null }[])
        .map((r) => ({ position: r.position, name: r.players?.full_name ?? "?" })).sort((a, b) => a.position - b.position),
    })),
  };
}

export type HistoryRow = {
  id: number; kind: "start" | "match" | "decay"; rating_before: number; rating_after: number; created_at: string;
  tournament: { name: string } | null;
};

/** Giocatore con punti e storico in ogni lega. */
export async function getPlayer(id: string) {
  const supabase = createPublicClient();
  const { data: player } = await supabase.from("players").select("id, full_name, club, active, avatar_path").eq("id", id).maybeSingle();
  if (!player) return null;
  const [{ data: memberships }, { data: history }] = await Promise.all([
    supabase.from("championship_players").select("championship_id, rating, games_played, championships(name, slug, settings)").eq("player_id", id),
    supabase.from("rating_history")
      .select("id, championship_id, kind, rating_before, rating_after, created_at, tournament:tournaments_public(name)")
      .eq("player_id", id).order("id", { ascending: true }),
  ]);
  const championships = (memberships ?? []).map((m) => {
    const c = m.championships as unknown as { name: string; slug: string; settings: unknown } | null;
    const p = parseRankingSettings(c?.settings);
    return {
      id: m.championship_id as string, name: c?.name ?? "?", slug: c?.slug ?? "",
      label: ("settings" in p ? p.settings : DEFAULT_RANKING).label,
      rating: m.rating as number, games: m.games_played as number,
      history: ((history ?? []) as unknown as (HistoryRow & { championship_id: string })[]).filter((h) => h.championship_id === m.championship_id),
    };
  });
  return { player, championships };
}

export type PublicTournament = {
  id: string; name: string; starts_on: string | null; status: string; public_code: string; format: unknown; championship_id: string | null;
  ranked: boolean; kind: "singles" | "doubles"; registration_open: boolean; registration_deadline: string | null;
  player_results: boolean; featured: boolean; stream_url: string | null;
};

/** Torneo pubblico con iscritti (giocatori o coppie) e partite (nessun dato riservato). */
export async function getPublicTournament(publicCode: string) {
  const supabase = createPublicClient();
  const { data: t, error } = await supabase.from("tournaments_public")
    .select("id, name, starts_on, status, public_code, format, championship_id, ranked, kind, registration_open, registration_deadline, player_results, featured, stream_url").eq("public_code", publicCode).maybeSingle();
  if (error) throw new Error("Impossibile leggere il torneo");
  if (!t) return null;
  const [entries, { data: matches, error: e2 }, { data: championship }] = await Promise.all([
    loadEntries(supabase, t.id),
    supabase.from("matches")
      .select("id, phase, group_no, stage, round, position, player_a, player_b, sets_a, sets_b, set_scores, best_of, set_points, golden_point, source_a, source_b, reported_by, disputed_at")
      .eq("tournament_id", t.id),
    t.championship_id
      ? supabase.from("championships").select("name, slug").eq("id", t.championship_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (e2) throw new Error("Impossibile leggere il torneo");
  const names = new Map(entries.map((e) => [e.id, entryName(e)]));
  return {
    tournament: t as PublicTournament,
    championship: championship as { name: string; slug: string } | null,
    members: entries.filter((e) => e.group !== null).map((e) => ({ playerId: e.id, group: e.group as number, seed: e.seed })),
    enrolledCount: entries.length,
    enrolled: entries.map((e) => ({ name: entryName(e), solo: t.kind === "doubles" && e.players.length === 1 })).sort((a, b) => a.name.localeCompare(b.name, "it")),
    names,
    /** Giocatori di ogni voce (1 nel singolare, 2 nel doppio) e nomi dei singoli giocatori. */
    entryPlayers: new Map(entries.map((e) => [e.id, e.players.map((p) => p.id)])),
    playerNames: new Map(entries.flatMap((e) => e.players.map((p) => [p.id, p.name] as const))),
    matches: ((matches ?? []) as unknown as (MatchRow & { best_of: number; round: number; set_points: number; golden_point: number | null; rated?: boolean; reported_by: string | null; disputed_at: string | null })[])
      .map((m) => ({ ...m, disputed: m.disputed_at !== null })),
  };
}

/** Tornei in corso segnalati dagli organizzatori per la home di tutti. */
export async function getFeaturedLive() {
  const { data } = await createPublicClient().from("tournaments_public")
    .select("id, name, public_code, status, kind, ranked, stream_url, starts_on").eq("featured", true).in("status", ["groups", "knockout"])
    .order("starts_on", { ascending: false, nullsFirst: false }).limit(6);
  return (data ?? []) as { id: string; name: string; public_code: string; status: string; kind: string; ranked: boolean; stream_url: string | null; starts_on: string | null }[];
}
