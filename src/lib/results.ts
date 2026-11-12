import "server-only";
import { createServiceClient } from "./supabase/admin";
import { validateMatch, type SetScore } from "./domain/score";
export { setsFromForm } from "./domain/score";
import { applyResult, groupViews, resolveKnockout, isPlayed, type MatchRow } from "./domain/tournament";

const MATCH_COLUMNS = "id, phase, group_no, stage, position, player_a, player_b, sets_a, sets_b, set_scores, best_of, set_points, golden_point, source_a, source_b, rated, reported_by, disputed_at";

type DbMatch = MatchRow & { best_of: number; set_points: number; golden_point: number | null; rated: boolean; reported_by: string | null; disputed_at: string | null };
/** Righe del database → partite del dominio (contestata = con disputed_at). */
const toRows = (rows: unknown[] | null) =>
  ((rows ?? []) as DbMatch[]).map((m) => ({ ...m, disputed: m.disputed_at !== null }));

/**
 * Salva (o cancella, con sets = null) il risultato di una partita e aggiorna il tabellone.
 * Da chiamare SOLO dopo aver verificato chi scrive (organizzatore del torneo o admin).
 */
export async function saveResult(tournamentId: string, matchId: string, sets: SetScore[] | null, reporterPlayerId: string | null = null): Promise<{ error?: string; ok?: string; set?: number }> {
  const svc = createServiceClient();
  const { data: t } = await svc.from("tournaments").select("status").eq("id", tournamentId).maybeSingle();
  if (!t) return { error: "Torneo non trovato." };
  if (t.status !== "groups" && t.status !== "knockout") return { error: "In questa fase del torneo non si inseriscono risultati." };

  const [{ data: matches }, { data: tp }] = await Promise.all([
    svc.from("matches").select(MATCH_COLUMNS).eq("tournament_id", tournamentId),
    svc.from("tournament_entries").select("id, group_no, seed").eq("tournament_id", tournamentId),
  ]);
  const all = toRows(matches);
  const match = all.find((m) => m.id === matchId); // solo partite di QUESTO torneo
  if (!match) return { error: "Partita non trovata." };
  const members = (tp ?? []).filter((r) => r.group_no !== null).map((r) => ({ playerId: r.id as string, group: r.group_no as number, seed: r.seed as number | null }));

  // Chi salva risolve anche un'eventuale contestazione (l'organizzatore decide; un giocatore
  // non può salvare una partita contestata: lo controlla playerSaveResult).
  let change;
  if (sets === null) change = { sets_a: null, sets_b: null, set_scores: null, disputed: false };
  else {
    const v = validateMatch(sets, match.best_of, { points: match.set_points, golden: match.golden_point });
    if ("error" in v) return { error: v.error, set: v.set };
    change = { sets_a: v.result.setsA, sets_b: v.result.setsB, set_scores: v.result.sets, disputed: false };
  }
  const outcome = applyResult(all, members, matchId, change);
  if ("error" in outcome) return { error: outcome.error };

  // Scrittura condizionata: non si tocca una partita già conteggiata in classifica
  // (il database lo impedisce comunque anche per i tornei chiusi).
  const { data: written, error } = await svc.from("matches")
    .update({ sets_a: change.sets_a, sets_b: change.sets_b, set_scores: change.set_scores, played_at: sets ? new Date().toISOString() : null,
      reported_by: sets ? reporterPlayerId : null, disputed_at: null, disputed_by: null })
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
  let all: MatchRow[] = toRows(matches);
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
  const before = new Map(toRows(matches).map((m) => [m.id, m]));
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

type Who = { error: string } | { side: string; match: DbMatch & { disputed: boolean }; all: (DbMatch & { disputed: boolean })[]; status: string };

/** Verifica che il giocatore giochi questa partita (anche in coppia) e ne restituisce il lato. */
async function playerSide(tournamentId: string, matchId: string, playerId: string): Promise<Who> {
  const svc = createServiceClient();
  const [{ data: t }, { data: matches }, { data: mine }] = await Promise.all([
    svc.from("tournaments").select("status, player_results").eq("id", tournamentId).maybeSingle(),
    svc.from("matches").select(MATCH_COLUMNS).eq("tournament_id", tournamentId),
    svc.from("entry_members").select("entry_id").eq("tournament_id", tournamentId).eq("player_id", playerId),
  ]);
  if (!t) return { error: "Torneo non trovato." };
  if (t.status !== "groups" && t.status !== "knockout") return { error: "In questa fase del torneo non si inseriscono risultati." };
  const all = toRows(matches);
  const match = all.find((m) => m.id === matchId);
  if (!match || !match.player_a || !match.player_b) return { error: "Partita non trovata." };
  const entries = new Set((mine ?? []).map((e) => e.entry_id as string));
  const side = entries.has(match.player_a) ? match.player_a : entries.has(match.player_b) ? match.player_b : null;
  if (!side) return { error: "Puoi inserire solo i risultati delle partite che giochi." };
  return { side, match, all, status: t.status as string };
}

/** Giocatori della stessa coppia (o il giocatore stesso nel singolare). */
async function sideMembers(tournamentId: string, entryId: string) {
  const { data } = await createServiceClient().from("entry_members").select("player_id").eq("tournament_id", tournamentId).eq("entry_id", entryId);
  return new Set((data ?? []).map((r) => r.player_id as string));
}

/**
 * Un giocatore inserisce (o corregge/cancella) il risultato della sua partita. Vale subito.
 * Non può toccare un risultato contestato, né uno inserito dall'organizzatore o dagli avversari.
 */
export async function playerSaveResult(tournamentId: string, matchId: string, sets: SetScore[] | null, playerId: string): Promise<{ error?: string; ok?: string; set?: number }> {
  const { data: t } = await createServiceClient().from("tournaments").select("player_results").eq("id", tournamentId).maybeSingle();
  if (!t?.player_results) return { error: "In questo torneo i risultati li inserisce l'organizzatore." };
  const who = await playerSide(tournamentId, matchId, playerId);
  if ("error" in who) return who;
  const { match, side } = who;
  if (match.disputed) return { error: "Il risultato è contestato: decide l'organizzatore." };
  if (isPlayed(match)) {
    if (!match.reported_by) return { error: "Il risultato l'ha inserito l'organizzatore: per correggerlo rivolgiti a lui." };
    if (!(await sideMembers(tournamentId, side)).has(match.reported_by))
      return { error: "Il risultato l'hanno già inserito i tuoi avversari: se non è giusto, contestalo." };
  } else if (sets === null) return { ok: "Nessun risultato da cancellare." };
  return saveResult(tournamentId, matchId, sets, playerId);
}

/**
 * L'avversario di chi ha inserito il risultato lo contesta: il risultato resta visibile,
 * ma il girone non si chiude e il vincitore non avanza finché l'organizzatore non decide.
 */
export async function contestResult(tournamentId: string, matchId: string, playerId: string): Promise<{ error?: string; ok?: string }> {
  const who = await playerSide(tournamentId, matchId, playerId);
  if ("error" in who) return who;
  const { match, side, all, status } = who;
  if (!isPlayed(match)) return { error: "Questa partita non ha ancora un risultato." };
  if (match.disputed) return { ok: "Il risultato è già contestato: l'organizzatore lo controllerà." };
  if (!match.reported_by) return { error: "Il risultato l'ha inserito l'organizzatore: per correggerlo rivolgiti a lui." };
  if ((await sideMembers(tournamentId, side)).has(match.reported_by))
    return { error: "Il risultato l'avete inserito voi: potete correggerlo direttamente." };
  if (match.phase === "group" && status !== "groups")
    return { error: "La fase a gironi è già finita: per correggere questo risultato rivolgiti all'organizzatore." };
  if (match.phase === "knockout") {
    const nextPlayed = all.some((m) => isPlayed(m) && [m.source_a, m.source_b].some((src) =>
      src?.kind === "winner" && src.stage === match.stage && src.match === match.position));
    if (nextPlayed) return { error: "Il turno successivo è già stato giocato: per correggere questo risultato rivolgiti all'organizzatore." };
  }
  const { data, error } = await createServiceClient().from("matches")
    .update({ disputed_at: new Date().toISOString(), disputed_by: playerId })
    .eq("id", matchId).eq("tournament_id", tournamentId).is("disputed_at", null).eq("rated", false).select("id");
  if (error || !data?.length) return { error: "Non sono riuscito a registrare la contestazione, riprova." };
  await reconcileBracket(tournamentId);
  return { ok: "Risultato contestato: l'organizzatore deciderà. Intanto il turno successivo resta in attesa." };
}

/** L'organizzatore conferma un risultato contestato così com'è. Solo dopo i controlli di chi gestisce. */
export async function confirmDisputed(tournamentId: string, matchId: string): Promise<{ error?: string; ok?: string }> {
  const { data, error } = await createServiceClient().from("matches")
    .update({ disputed_at: null, disputed_by: null })
    .eq("id", matchId).eq("tournament_id", tournamentId).not("disputed_at", "is", null).select("id");
  if (error || !data?.length) return { error: "La partita non è più contestata." };
  await reconcileBracket(tournamentId);
  return { ok: "Risultato confermato." };
}

/** Numero di partite contestate ancora da decidere. */
export async function disputedCount(tournamentId: string) {
  const { count } = await createServiceClient().from("matches").select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId).not("disputed_at", "is", null);
  return count ?? 0;
}
