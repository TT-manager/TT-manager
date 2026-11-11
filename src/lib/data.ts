import { createPublicClient } from "./supabase/public";

export type RankingRow = {
  id: string; full_name: string; club: string | null;
  rating: number; games_played: number; position: number;
};
export type HistoryRow = {
  id: number; rating_before: number; rating_after: number; created_at: string;
  tournament: { name: string } | null;
};

// Lettura a ogni richiesta (nessuna cache): i risultati devono comparire subito.
export async function getRanking(): Promise<RankingRow[]> {
  const { data, error } = await createPublicClient()
    .from("ranking").select("*").order("position").order("full_name");
  if (error) throw new Error("Impossibile leggere la classifica");
  return data as RankingRow[];
}

export async function getPlayer(id: string) {
  const supabase = createPublicClient();
  const { data: player } = await supabase
    .from("players").select("id, full_name, club, rating, games_played, active")
    .eq("id", id).maybeSingle();
  if (!player) return null;
  const { data: history } = await supabase
    .from("rating_history")
    .select("id, rating_before, rating_after, created_at, tournament:tournaments_public!inner(name)")
    .eq("player_id", id).order("id", { ascending: true });
  return { player, history: (history ?? []) as unknown as HistoryRow[] };
}

export type PublicTournament = {
  id: string; name: string; starts_on: string | null; status: string; public_code: string; format: unknown;
};

/** Torneo pubblico con iscritti e partite (nessun dato riservato). */
export async function getPublicTournament(publicCode: string) {
  const supabase = createPublicClient();
  const { data: t, error } = await supabase.from("tournaments_public")
    .select("id, name, starts_on, status, public_code, format").eq("public_code", publicCode).maybeSingle();
  if (error) throw new Error("Impossibile leggere il torneo");
  if (!t) return null;
  const [{ data: tp, error: e1 }, { data: matches, error: e2 }] = await Promise.all([
    supabase.from("tournament_players").select("player_id, group_no, seed, players(full_name, rating)").eq("tournament_id", t.id),
    supabase.from("matches")
      .select("id, phase, group_no, stage, round, position, player_a, player_b, sets_a, sets_b, set_scores, best_of, set_points, golden_point, source_a, source_b")
      .eq("tournament_id", t.id),
  ]);
  if (e1 || e2) throw new Error("Impossibile leggere il torneo");
  const names = new Map<string, string>();
  for (const r of tp ?? []) names.set(r.player_id as string, (r.players as unknown as { full_name: string } | null)?.full_name ?? "?");
  return {
    tournament: t as PublicTournament,
    members: (tp ?? []).filter((r) => r.group_no !== null).map((r) => ({ playerId: r.player_id as string, group: r.group_no as number })),
    enrolledCount: (tp ?? []).length,
    names,
    matches: (matches ?? []) as unknown as (import("./domain/tournament").MatchRow & { best_of: number; round: number; set_points: number; golden_point: number | null; rated?: boolean })[],
  };
}
