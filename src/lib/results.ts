import "server-only";
import { createServiceClient } from "./supabase/admin";
import { validateMatch, type SetScore } from "./domain/score";
import { applyResult, type MatchRow } from "./domain/tournament";

const MATCH_COLUMNS = "id, phase, group_no, stage, position, player_a, player_b, sets_a, sets_b, set_scores, best_of, source_a, source_b, rated";

/**
 * Salva (o cancella, con sets = null) il risultato di una partita e aggiorna il tabellone.
 * Da chiamare SOLO dopo aver verificato chi scrive (organizzatore del torneo o admin).
 */
export async function saveResult(tournamentId: string, matchId: string, sets: SetScore[] | null): Promise<{ error?: string; ok?: string }> {
  const svc = createServiceClient();
  const { data: t } = await svc.from("tournaments").select("status").eq("id", tournamentId).maybeSingle();
  if (!t) return { error: "Torneo non trovato." };
  if (t.status !== "groups" && t.status !== "knockout") return { error: "In questa fase del torneo non si inseriscono risultati." };

  const [{ data: matches }, { data: tp }] = await Promise.all([
    svc.from("matches").select(MATCH_COLUMNS).eq("tournament_id", tournamentId),
    svc.from("tournament_players").select("player_id, group_no").eq("tournament_id", tournamentId),
  ]);
  const all = (matches ?? []) as unknown as (MatchRow & { best_of: number; rated: boolean })[];
  const match = all.find((m) => m.id === matchId); // solo partite di QUESTO torneo
  if (!match) return { error: "Partita non trovata." };
  const members = (tp ?? []).filter((r) => r.group_no !== null).map((r) => ({ playerId: r.player_id as string, group: r.group_no as number }));

  let change;
  if (sets === null) change = { sets_a: null, sets_b: null, set_scores: null };
  else {
    const v = validateMatch(sets, match.best_of);
    if ("error" in v) return { error: v.error };
    change = { sets_a: v.result.setsA, sets_b: v.result.setsB, set_scores: v.result.sets };
  }
  const outcome = applyResult(all, members, matchId, change);
  if ("error" in outcome) return { error: outcome.error };

  // Scrittura condizionata: non si tocca una partita già conteggiata in classifica.
  const { data: written, error } = await svc.from("matches")
    .update({ ...change, played_at: sets ? new Date().toISOString() : null })
    .eq("id", matchId).eq("tournament_id", tournamentId).eq("rated", false).select("id");
  if (error || !written?.length) return { error: "Salvataggio non riuscito, riprova." };
  for (const u of outcome.knockoutUpdates)
    await svc.from("matches").update({ player_a: u.player_a, player_b: u.player_b })
      .eq("id", u.id).eq("tournament_id", tournamentId).is("sets_a", null);
  const status = outcome.allGroupsComplete ? "knockout" : "groups";
  if (status !== t.status) await svc.from("tournaments").update({ status }).eq("id", tournamentId).in("status", ["groups", "knockout"]);
  return { ok: sets ? "Risultato salvato." : "Risultato cancellato." };
}

/** Legge i set dal modulo: campi a1/b1 ... a7/b7; le righe vuote finali sono ignorate. */
export function setsFromForm(formData: FormData): SetScore[] | { error: string } {
  const sets: SetScore[] = [];
  for (let i = 1; i <= 7; i++) {
    const a = String(formData.get(`a${i}`) ?? "").trim();
    const b = String(formData.get(`b${i}`) ?? "").trim();
    if (a === "" && b === "") continue;
    if (a === "" || b === "") return { error: `Set ${i}: inserisci entrambi i punteggi.` };
    sets.push([Number(a), Number(b)]);
  }
  return sets;
}
