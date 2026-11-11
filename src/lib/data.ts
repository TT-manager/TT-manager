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
