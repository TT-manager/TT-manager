import "server-only";
import { createServiceClient } from "./supabase/admin";
import { rateMatches } from "./domain/elo";
import { isPlayed } from "./domain/tournament";

const DB_ERRORS: Record<string, string> = {
  TORNEO_NON_CHIUDIBILE: "Il torneo è già chiuso oppure non è ancora iniziato.",
  PARTITE_CAMBIATE: "Nel frattempo un risultato è cambiato: ricarica la pagina e riprova.",
  RATING_CAMBIATO: "Nel frattempo il rating di un giocatore è cambiato (altro torneo chiuso?): riprova.",
  TORNEO_NON_CHIUSO: "Il torneo non è chiuso.",
  TORNEI_SUCCESSIVI: "Alcuni giocatori hanno già giocato tornei chiusi dopo questo: riapri prima quelli, dal più recente.",
};
const dbError = (msg: string | undefined) =>
  Object.entries(DB_ERRORS).find(([k]) => msg?.includes(k))?.[1] ?? "Operazione non riuscita, riprova.";

/** Stato della chiusura: partite giocate da conteggiare e partite ancora da giocare. */
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

/** Applica l'Elo a tutte le partite giocate e non ancora conteggiate, e chiude il torneo. */
export async function closeTournament(tournamentId: string): Promise<{ error?: string; ok?: string }> {
  const svc = createServiceClient();
  const { data: matches, error } = await svc.from("matches")
    .select("id, phase, stage, round, position, player_a, player_b, sets_a, sets_b, played_at, rated")
    .eq("tournament_id", tournamentId).eq("rated", false).not("sets_a", "is", null);
  if (error) return { error: "Non riesco a leggere le partite." };
  const played = (matches ?? []).filter((m) => isPlayed(m) && m.player_a && m.player_b);
  // Ordine cronologico; a parità, gironi prima del tabellone e turni dal primo alla finale.
  played.sort((x, y) =>
    (x.played_at ?? "").localeCompare(y.played_at ?? "") ||
    (x.phase === y.phase ? 0 : x.phase === "group" ? -1 : 1) ||
    (y.stage ?? 99) - (x.stage ?? 99) || x.round - y.round || x.position - y.position);

  const ids = [...new Set(played.flatMap((m) => [m.player_a as string, m.player_b as string]))];
  const { data: players } = ids.length
    ? await svc.from("players").select("id, rating, games_played").in("id", ids)
    : { data: [] as { id: string; rating: number; games_played: number }[] };
  const start = new Map((players ?? []).map((p) => [p.id, { rating: p.rating, gamesPlayed: p.games_played }]));
  let result;
  try {
    result = rateMatches(played.map((m) => ({
      id: m.id,
      winner: (m.sets_a! > m.sets_b! ? m.player_a : m.player_b) as string,
      loser: (m.sets_a! > m.sets_b! ? m.player_b : m.player_a) as string,
    })), start);
  } catch { return { error: "Un giocatore di una partita non esiste più." }; }

  const { error: rpcError } = await svc.rpc("apply_tournament_ratings", {
    p_tournament: tournamentId,
    p_payload: { matches: played.map((m) => m.id), players: result.players, history: result.history },
  });
  if (rpcError) return { error: dbError(rpcError.message) };
  return { ok: `Torneo chiuso: ${played.length} partite conteggiate nella classifica generale.` };
}

export async function reopenTournament(tournamentId: string): Promise<{ error?: string; ok?: string }> {
  const { error } = await createServiceClient().rpc("reopen_tournament", { p_tournament: tournamentId });
  if (error) return { error: dbError(error.message) };
  return { ok: "Torneo riaperto: le variazioni di rating di questo torneo sono state annullate." };
}
