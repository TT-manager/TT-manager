import "server-only";
import { createServiceClient } from "./supabase/admin";
import { validateMatch, type SetScore } from "./domain/score";
import { parseRankingSettings, DEFAULT_RANKING } from "./domain/ranking";
import { CHALLENGE_BEST_OF, countsForRanking, isExpired, type ChallengeStatus } from "./domain/challenges";
import { recomputeChampionship } from "./closing";
import { getLocale, tr } from "@/i18n/server";
import { challengesText } from "@/i18n/dict/challenges";
import { translateDomainError } from "@/i18n/domain-errors";

type Result = { error?: string; ok?: string; set?: number };

export const CHALLENGE_COLUMNS =
  "id, championship_id, challenger_id, opponent_id, best_of, status, sets_a, sets_b, set_scores, reported_by, played_at, confirmed_at, ranked, created_at";
export type Challenge = {
  id: string; championship_id: string; challenger_id: string; opponent_id: string; best_of: number; status: ChallengeStatus;
  sets_a: number | null; sets_b: number | null; set_scores: SetScore[] | null; reported_by: string | null;
  played_at: string | null; confirmed_at: string | null; ranked: boolean; created_at: string;
};

async function leagueOf(championshipId: string) {
  const { data } = await createServiceClient().from("championships").select("id, kind, settings").eq("id", championshipId).maybeSingle();
  if (!data) return null;
  const parsed = parseRankingSettings(data.settings);
  return { id: data.id as string, kind: data.kind as string, settings: "settings" in parsed ? parsed.settings : DEFAULT_RANKING };
}

async function load(id: string) {
  const { data } = await createServiceClient().from("challenges").select(CHALLENGE_COLUMNS).eq("id", id).maybeSingle();
  return (data as Challenge | null) ?? null;
}

/** Cambio di stato condizionato: riesce solo se la sfida è ancora nello stato atteso. */
async function move(id: string, from: ChallengeStatus[], change: Record<string, unknown>) {
  const { data, error } = await createServiceClient().from("challenges")
    .update({ ...change, updated_at: new Date().toISOString() }).eq("id", id).in("status", from).select("id");
  return !error && Boolean(data?.length);
}

/** Lancia una sfida. Da chiamare con il giocatore dell'account collegato. */
export async function createChallenge(championshipId: string, challengerId: string, opponentId: string, bestOf: number): Promise<Result> {
  const t = await tr(challengesText);
  const league = await leagueOf(championshipId);
  if (!league) return { error: t.notFound };
  if (league.kind !== "singles") return { error: t.singlesOnly };
  if (!league.settings.challenges.enabled) return { error: t.disabled };
  if (challengerId === opponentId) return { error: t.selfChallenge };
  if (!(CHALLENGE_BEST_OF as readonly number[]).includes(bestOf)) return { error: t.badBestOf };
  const svc = createServiceClient();
  const [{ data: members }, { data: opp }, { data: open }] = await Promise.all([
    svc.from("championship_players").select("player_id").eq("championship_id", championshipId).in("player_id", [challengerId, opponentId]),
    svc.from("players").select("user_id").eq("id", opponentId).maybeSingle(),
    svc.from("challenges").select("status, created_at").eq("championship_id", championshipId)
      .in("status", ["pending", "accepted", "reported", "disputed"])
      .or(`and(challenger_id.eq.${challengerId},opponent_id.eq.${opponentId}),and(challenger_id.eq.${opponentId},opponent_id.eq.${challengerId})`),
  ]);
  const ids = new Set((members ?? []).map((m) => m.player_id as string));
  if (!ids.has(challengerId)) return { error: t.notMember };
  if (!ids.has(opponentId)) return { error: t.opponentNotMember };
  if (!opp?.user_id) return { error: t.opponentNoAccount };
  if ((open ?? []).some((c) => !isExpired(c as { status: string; created_at: string }))) return { error: t.alreadyOpen };
  const { error } = await svc.from("challenges").insert({ championship_id: championshipId, challenger_id: challengerId, opponent_id: opponentId, best_of: bestOf });
  return error ? { error: t.saveFailed } : { ok: t.sent };
}

/** Accetta, rifiuta o annulla una sfida non ancora giocata. */
export async function answerChallenge(id: string, playerId: string, answer: "accept" | "decline" | "cancel"): Promise<Result & { championshipId?: string }> {
  const t = await tr(challengesText);
  const c = await load(id);
  if (!c) return { error: t.notFound };
  if (c.challenger_id !== playerId && c.opponent_id !== playerId) return { error: t.notYours };
  if (answer !== "cancel" && isExpired(c)) return { error: t.expired };
  if (answer === "accept" || answer === "decline") {
    if (c.opponent_id !== playerId) return { error: t.notYours };
    const ok = await move(id, ["pending"], { status: answer === "accept" ? "accepted" : "declined" });
    return ok ? { ok: answer === "accept" ? t.accepted : t.declined, championshipId: c.championship_id } : { error: t.wrongState };
  }
  const ok = await move(id, ["pending", "accepted"], { status: "cancelled" });
  return ok ? { ok: t.cancelled, championshipId: c.championship_id } : { error: t.wrongState };
}

/** Uno dei due giocatori inserisce (o, finché l'altro non ha confermato, corregge) il risultato. */
export async function reportChallenge(id: string, playerId: string, sets: SetScore[]): Promise<Result & { championshipId?: string }> {
  const t = await tr(challengesText);
  const c = await load(id);
  if (!c) return { error: t.notFound };
  if (c.challenger_id !== playerId && c.opponent_id !== playerId) return { error: t.notYours };
  if (c.status === "accepted" && isExpired(c)) return { error: t.expired };
  // Chi ha già inserito può correggere; l'altro conferma o contesta.
  if (c.status === "reported" && c.reported_by !== playerId) return { error: t.onlyOpponentConfirms };
  if (c.status !== "accepted" && c.status !== "reported") return { error: t.wrongState };
  const v = validateMatch(sets, c.best_of);
  if ("error" in v) return { error: translateDomainError(v.error, await getLocale()), set: v.set };
  const ok = await move(id, [c.status], {
    status: "reported", sets_a: v.result.setsA, sets_b: v.result.setsB, set_scores: v.result.sets,
    reported_by: playerId, played_at: c.played_at ?? new Date().toISOString(),
  });
  return ok ? { ok: t.reported, championshipId: c.championship_id } : { error: t.wrongState };
}

/** Rende definitivo un risultato: decide se vale per la classifica e ricalcola. */
async function finalize(c: Challenge, change: Record<string, unknown>, from: ChallengeStatus[]): Promise<Result> {
  const t = await tr(challengesText);
  const league = await leagueOf(c.championship_id);
  if (!league) return { error: t.notFound };
  const playedAt = c.played_at ?? new Date().toISOString();
  const { data: pair } = await createServiceClient().from("challenges").select("played_at")
    .eq("championship_id", c.championship_id).eq("status", "confirmed").eq("ranked", true).neq("id", c.id)
    .or(`and(challenger_id.eq.${c.challenger_id},opponent_id.eq.${c.opponent_id}),and(challenger_id.eq.${c.opponent_id},opponent_id.eq.${c.challenger_id})`);
  const ranked = countsForRanking(league.settings.challenges, playedAt, (pair ?? []) as { played_at: string }[]);
  const ok = await move(c.id, from, { ...change, status: "confirmed", ranked, played_at: playedAt, confirmed_at: new Date().toISOString() });
  if (!ok) return { error: t.wrongState };
  if (ranked) {
    const r = await recomputeChampionship(c.championship_id);
    if (r.error) return { error: t.recomputeFailed };
  }
  return { ok: ranked ? t.confirmedRanked : t.confirmedFriendly };
}

/** L'avversario di chi ha inserito il risultato lo conferma o lo contesta. */
export async function answerResult(id: string, playerId: string, answer: "confirm" | "dispute"): Promise<Result & { championshipId?: string }> {
  const t = await tr(challengesText);
  const c = await load(id);
  if (!c) return { error: t.notFound };
  if (c.challenger_id !== playerId && c.opponent_id !== playerId) return { error: t.notYours };
  if (c.status !== "reported") return { error: t.wrongState };
  if (c.reported_by === playerId) return { error: t.onlyOpponentConfirms };
  if (answer === "dispute") {
    const ok = await move(id, ["reported"], { status: "disputed" });
    return ok ? { ok: t.disputed, championshipId: c.championship_id } : { error: t.wrongState };
  }
  return { ...(await finalize(c, {}, ["reported"])), championshipId: c.championship_id };
}

/**
 * Decisione di un amministratore della lega su una sfida contestata (o ancora da confermare):
 * conferma con il risultato indicato, oppure annulla. Da chiamare SOLO dopo aver verificato chi gestisce la lega.
 */
export async function adminDecideChallenge(championshipId: string, id: string, decision: { sets: SetScore[] } | "annul" | "confirm"): Promise<Result> {
  const t = await tr(challengesText);
  const c = await load(id);
  if (!c || c.championship_id !== championshipId) return { error: t.notFound };
  if (decision === "annul") {
    const wasRanked = c.status === "confirmed" && c.ranked;
    const ok = await move(id, ["reported", "disputed", "confirmed"], { status: "cancelled", ranked: false });
    if (!ok) return { error: t.wrongState };
    if (wasRanked && (await recomputeChampionship(championshipId)).error) return { error: t.recomputeFailed };
    return { ok: t.adminAnnulled };
  }
  if (c.status !== "reported" && c.status !== "disputed") return { error: t.wrongState };
  const v = validateMatch(decision === "confirm" ? c.set_scores ?? [] : decision.sets, c.best_of);
  if ("error" in v) return { error: translateDomainError(v.error, await getLocale()), set: v.set };
  const r = await finalize(c, { sets_a: v.result.setsA, sets_b: v.result.setsB, set_scores: v.result.sets }, [c.status]);
  return r.ok ? { ok: t.adminConfirmed } : r;
}

/** Sfide ancora aperte di un giocatore (tutte le leghe), scadute escluse. */
export async function openChallengesOf(playerId: string): Promise<Challenge[]> {
  const { data } = await createServiceClient().from("challenges").select(CHALLENGE_COLUMNS)
    .or(`challenger_id.eq.${playerId},opponent_id.eq.${playerId}`)
    .in("status", ["pending", "accepted", "reported", "disputed"]).order("created_at", { ascending: false }).limit(30);
  return ((data ?? []) as Challenge[]).filter((c) => !isExpired(c));
}

/** Ultime sfide confermate della lega, con i punti scambiati (null = amichevole). */
export async function latestChallenges(championshipId: string, limit = 10) {
  const svc = createServiceClient();
  const { data } = await svc.from("challenges").select(CHALLENGE_COLUMNS)
    .eq("championship_id", championshipId).eq("status", "confirmed").order("played_at", { ascending: false }).limit(limit);
  const rows = (data ?? []) as Challenge[];
  const ids = rows.filter((c) => c.ranked).map((c) => c.id);
  const { data: hist } = ids.length
    ? await svc.from("rating_history").select("challenge_id, player_id, rating_before, rating_after").in("challenge_id", ids)
    : { data: [] };
  const delta = new Map((hist ?? []).map((h) => [`${h.challenge_id}:${h.player_id}`, (h.rating_after as number) - (h.rating_before as number)]));
  return rows.map((c) => ({
    ...c,
    deltaChallenger: c.ranked ? delta.get(`${c.id}:${c.challenger_id}`) ?? null : null,
    deltaOpponent: c.ranked ? delta.get(`${c.id}:${c.opponent_id}`) ?? null : null,
  }));
}

/** Sfide contestate della lega, per gli amministratori. */
export async function disputedChallenges(championshipId: string): Promise<Challenge[]> {
  const { data } = await createServiceClient().from("challenges").select(CHALLENGE_COLUMNS)
    .eq("championship_id", championshipId).eq("status", "disputed").order("played_at");
  return (data ?? []) as Challenge[];
}

/** Nomi dei giocatori, per id. */
export async function playerNames(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data } = await createServiceClient().from("players").select("id, full_name").in("id", unique);
  return new Map((data ?? []).map((p) => [p.id as string, p.full_name as string]));
}

/** Membri della lega che hanno un account (si possono sfidare), in ordine alfabetico. */
export async function challengeableMembers(championshipId: string): Promise<{ id: string; name: string }[]> {
  const { data } = await createServiceClient().from("championship_players")
    .select("players!inner(id, full_name, user_id)").eq("championship_id", championshipId).not("players.user_id", "is", null);
  return ((data ?? []) as unknown as { players: { id: string; full_name: string } }[])
    .map((r) => ({ id: r.players.id, name: r.players.full_name })).sort((a, b) => a.name.localeCompare(b.name));
}

/** Nome e indirizzo delle leghe, per id. */
export async function leagueNames(ids: string[]): Promise<Map<string, { name: string; slug: string }>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data } = await createServiceClient().from("championships").select("id, name, slug").in("id", unique);
  return new Map((data ?? []).map((c) => [c.id as string, { name: c.name as string, slug: c.slug as string }]));
}
