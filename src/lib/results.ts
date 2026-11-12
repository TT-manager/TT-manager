import "server-only";
import { createServiceClient } from "./supabase/admin";
import { validateMatch, type SetScore } from "./domain/score";
export { setsFromForm } from "./domain/score";
import { applyResult, groupViews, resolveKnockout, isPlayed, type MatchRow } from "./domain/tournament";

const MATCH_COLUMNS = "id, phase, group_no, stage, position, player_a, player_b, sets_a, sets_b, set_scores, best_of, set_points, golden_point, source_a, source_b, rated";

/**
 * Salva (o cancella, con sets = null) il risultato di una partita e aggiorna il tabellone.
 * Da chiamare SOLO dopo aver verificato chi scrive (organizzatore del torneo o admin).
 */
export async function saveResult(tournamentId: string, matchId: string, sets: SetScore[] | null): Promise<{ error?: string; ok?: string; set?: number }> {
  const svc = createServiceClient();
  const { data: t } = await svc.from("tournaments").select("status").eq("id", tournamentId).maybeSingle();
  if (!t) return { error: "Torneo non trovato." };
  if (t.status !== "groups" && t.status !== "knockout") return { error: "In questa fase del torneo non si inseriscono risultati." };

  const [{ data: matches }, { data: tp }] = await Promise.all([
    svc.from("matches").select(MATCH_COLUMNS).eq("tournament_id", tournamentId),
    svc.from("tournament_entries").select("id, group_no, seed").eq("tournament_id", tournamentId),
  ]);
  const all = (matches ?? []) as unknown as (MatchRow & { best_of: number; set_points: number; golden_point: number | null; rated: boolean })[];
  const match = all.find((m) => m.id === matchId); // solo partite di QUESTO torneo
  if (!match) return { error: "Partita non trovata." };
  const members = (tp ?? []).filter((r) => r.group_no !== null).map((r) => ({ playerId: r.id as string, group: r.group_no as number, seed: r.seed as number | null }));

  let change;
  if (sets === null) change = { sets_a: null, sets_b: null, set_scores: null };
  else {
    const v = validateMatch(sets, match.best_of, { points: match.set_points, golden: match.golden_point });
    if ("error" in v) return { error: v.error, set: v.set };
    change = { sets_a: v.result.setsA, sets_b: v.result.setsB, set_scores: v.result.sets };
  }
  const outcome = applyResult(all, members, matchId, change);
  if ("error" in outcome) return { error: outcome.error };

  // Scrittura condizionata: non si tocca una partita già conteggiata in classifica
  // (il database lo impedisce comunque anche per i tornei chiusi).
  const { data: written, error } = await svc.from("matches")
    .update({ ...change, played_at: sets ? new Date().toISOString() : null })
    .eq("id", matchId).eq("tournament_id", tournamentId).eq("rated", false).select("id");
  if (error?.message?.includes("PARTITA_BLOCCATA")) return { error: "Il torneo è chiuso: questo risultato non si può più modificare." };
  if (error || !written?.length) return { error: "Salvataggio non riuscito, riprova." };
  await reconcileBracket(tournamentId);
  return { ok: sets ? "Risultato salvato." : "Risultato cancellato." };
}

/**
 * Ricalcola da zero chi occupa il tabellone e lo stato del torneo, leggendo i dati attuali.
 * Eseguito dopo ogni salvataggio: se due risultati arrivano insieme, l'ultimo ricalcolo
 * vede entrambi e il tabellone resta coerente. Non tocca le partite già giocate.
 */
export async function reconcileBracket(tournamentId: string) {
  const svc = createServiceClient();
  const [{ data: matches }, { data: tp }, { data: t }] = await Promise.all([
    svc.from("matches").select(MATCH_COLUMNS).eq("tournament_id", tournamentId),
    svc.from("tournament_entries").select("id, group_no, seed").eq("tournament_id", tournamentId),
    svc.from("tournaments").select("status").eq("id", tournamentId).maybeSingle(),
  ]);
  if (!t || (t.status !== "groups" && t.status !== "knockout")) return;
  let all = (matches ?? []) as unknown as MatchRow[];
  const members = (tp ?? []).filter((r) => r.group_no !== null).map((r) => ({ playerId: r.id as string, group: r.group_no as number, seed: r.seed as number | null }));
  const groups = groupViews(members, all);
  for (let i = 0; i < 10; i++) {
    const ko = all.filter((m) => m.phase === "knockout");
    const resolved = new Map(resolveKnockout(groups, ko).map((r) => [r.id, r]));
    let changed = false;
    all = all.map((m) => {
      const r = resolved.get(m.id);
      if (!r || isPlayed(m) || (r.player_a === m.player_a && r.player_b === m.player_b)) return m;
      changed = true;
      return { ...m, player_a: r.player_a, player_b: r.player_b };
    });
    if (!changed) break;
  }
  const before = new Map(((matches ?? []) as unknown as MatchRow[]).map((m) => [m.id, m]));
  for (const m of all) {
    const old = before.get(m.id)!;
    if (m.phase === "knockout" && (m.player_a !== old.player_a || m.player_b !== old.player_b))
      await svc.from("matches").update({ player_a: m.player_a, player_b: m.player_b })
        .eq("id", m.id).eq("tournament_id", tournamentId).is("sets_a", null);
  }
  // Senza gironi (sola eliminazione diretta) il torneo è sempre nella fase a tabellone;
  // senza tabellone (girone unico) resta nella fase a gironi fino alla chiusura.
  const hasKnockout = all.some((m) => m.phase === "knockout");
  const status = hasKnockout && groups.every((g) => g.complete) ? "knockout" : "groups";
  if (status !== t.status) await svc.from("tournaments").update({ status }).eq("id", tournamentId).in("status", ["groups", "knockout"]);
}
