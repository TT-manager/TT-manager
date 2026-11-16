import "server-only";
import { createServiceClient } from "./supabase/admin";
import { validateMatch, type SetRules, type SetScore } from "./domain/score";
import { setRulesError } from "./domain/format";
import { parseRankingSettings, DEFAULT_RANKING } from "./domain/ranking";
import {
  ACCEPTED_DAYS, CHALLENGE_BEST_OF, NOTICE_DAYS, countsForRanking, isExpired, recentlyClosed, recentlyExpired, type ChallengeStatus,
} from "./domain/challenges";
import { recomputeChampionship } from "./closing";
import { getLocale, tr } from "@/i18n/server";
import { challengesText } from "@/i18n/dict/challenges";
import { translateDomainError } from "@/i18n/domain-errors";

type Result = { error?: string; ok?: string; set?: number };

export const CHALLENGE_COLUMNS =
  "id, championship_id, challenger_id, opponent_id, challenger_partner_id, opponent_partner_id, best_of, set_points, status, sets_a, sets_b, set_scores, reported_by, played_at, confirmed_at, ranked, friendly, cancelled_by, created_at, updated_at";
export type Challenge = {
  id: string; championship_id: string; challenger_id: string; opponent_id: string;
  /** Solo nel doppio: compagno di chi lancia la sfida e compagno dello sfidato. */
  challenger_partner_id: string | null; opponent_partner_id: string | null;
  best_of: number;
  /** Punti per vincere un set (11, 21 o un valore scelto da chi lancia la sfida). */
  set_points: number; status: ChallengeStatus;
  sets_a: number | null; sets_b: number | null; set_scores: SetScore[] | null; reported_by: string | null;
  played_at: string | null; confirmed_at: string | null; ranked: boolean;
  /** Scelta come amichevole da chi l'ha lanciata: non vale mai per la classifica. */
  friendly: boolean; cancelled_by: string | null; created_at: string; updated_at: string;
};

/** Giocatori di un lato: «a» chi ha lanciato la sfida (e il compagno), «b» chi è stato sfidato. */
export const sideOf = (c: Pick<Challenge, "challenger_id" | "opponent_id" | "challenger_partner_id" | "opponent_partner_id">, side: "a" | "b") =>
  (side === "a" ? [c.challenger_id, c.challenger_partner_id] : [c.opponent_id, c.opponent_partner_id]).filter((x): x is string => Boolean(x));
/** Lato del giocatore nella sfida, o null se non ne fa parte. */
export const sideOfPlayer = (c: Parameters<typeof sideOf>[0], playerId: string): "a" | "b" | null =>
  sideOf(c, "a").includes(playerId) ? "a" : sideOf(c, "b").includes(playerId) ? "b" : null;
/** Chiave della sfida indipendente da chi l'ha lanciata: stessi due lati, in qualsiasi ordine. */
export const matchupKey = (c: Parameters<typeof sideOf>[0]) =>
  [sideOf(c, "a").sort().join("+"), sideOf(c, "b").sort().join("+")].sort().join(" vs ");
const ALL_SIDES = "challenger_id, opponent_id, challenger_partner_id, opponent_partner_id";
/** Filtro: sfide in cui compare il giocatore, in qualsiasi ruolo. */
const involving = (playerId: string) =>
  `challenger_id.eq.${playerId},opponent_id.eq.${playerId},challenger_partner_id.eq.${playerId},opponent_partner_id.eq.${playerId}`;

/** Regole del set della sfida (senza golden point). */
export const rulesOf = (c: Pick<Challenge, "set_points">): SetRules => ({ points: c.set_points ?? 11, golden: null });

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

/**
 * Lancia una sfida (vale sempre per la classifica). Da chiamare con il giocatore dell'account collegato.
 * Nel doppio servono anche il proprio compagno e il compagno dello sfidato.
 * Si può solo se la lega ha attivato le sfide e le stesse persone non hanno già raggiunto il limite della settimana.
 */
export async function createChallenge(championshipId: string, challengerId: string, opponentId: string, bestOf: number,
  partners: { mine?: string; theirs?: string } = {}, setPoints = 11): Promise<Result> {
  const t = await tr(challengesText);
  const league = await leagueOf(championshipId);
  if (!league) return { error: t.notFound };
  if (!league.settings.challenges.enabled) return { error: t.disabled };
  const doubles = league.kind === "doubles";
  const mine = doubles ? partners.mine || "" : "", theirs = doubles ? partners.theirs || "" : "";
  if (doubles && (!mine || !theirs)) return { error: t.pairsRequired };
  const sideA = [challengerId, mine].filter(Boolean), sideB = [opponentId, theirs].filter(Boolean);
  const everyone = [...sideA, ...sideB];
  if (challengerId === opponentId) return { error: t.selfChallenge };
  if (new Set(everyone).size !== everyone.length) return { error: t.samePlayerTwice };
  if (!(CHALLENGE_BEST_OF as readonly number[]).includes(bestOf)) return { error: t.badBestOf };
  if (setRulesError({ points: setPoints, golden: null })) return { error: t.badSetPoints };
  const svc = createServiceClient();
  const [{ data: members }, { data: people }, { data: recent }] = await Promise.all([
    svc.from("championship_players").select("player_id").eq("championship_id", championshipId).in("player_id", everyone),
    svc.from("players").select("id, user_id, active").in("id", everyone),
    svc.from("challenges").select(`status, created_at, played_at, ranked, ${ALL_SIDES}`).eq("championship_id", championshipId)
      .in("status", ["pending", "accepted", "reported", "disputed", "confirmed"]).or(involving(challengerId))
      .gte("created_at", new Date(Date.now() - 60 * 86400000).toISOString()),
  ]);
  const ids = new Set((members ?? []).map((m) => m.player_id as string));
  if (!ids.has(challengerId)) return { error: t.notMember };
  if (!everyone.every((id) => ids.has(id))) return { error: doubles ? t.someoneNotMember : t.opponentNotMember };
  const person = new Map((people ?? []).map((p) => [p.id as string, p]));
  if (!everyone.every((id) => person.get(id)?.active)) return { error: t.someoneInactive };
  // Qualcuno della coppia sfidata deve poter accettare (cioè avere un account).
  if (!sideB.some((id) => person.get(id)?.user_id)) return { error: doubles ? t.opponentsNoAccount : t.opponentNoAccount };
  const key = matchupKey({ challenger_id: challengerId, opponent_id: opponentId, challenger_partner_id: mine || null, opponent_partner_id: theirs || null });
  const same = ((recent ?? []) as unknown as (Challenge & { status: string })[]).filter((c) => matchupKey(c) === key);
  if (same.some((c) => c.status !== "confirmed" && !isExpired(c))) return { error: t.alreadyOpen };
  // Limite settimanale già raggiunto con questi avversari: la prossima sfida dalla settimana dopo.
  const done = same.filter((c) => c.status === "confirmed" && c.ranked && c.played_at) as { played_at: string }[];
  if (!countsForRanking(league.settings.challenges, new Date().toISOString(), done))
    return { error: t.weeklyLimit(league.settings.challenges.perWeek) };
  const { error } = await svc.from("challenges").insert({
    championship_id: championshipId, challenger_id: challengerId, opponent_id: opponentId, best_of: bestOf, set_points: setPoints,
    challenger_partner_id: mine || null, opponent_partner_id: theirs || null,
  });
  return error ? { error: t.saveFailed } : { ok: t.sent };
}

/** Accetta, rifiuta o annulla una sfida non ancora giocata. */
export async function answerChallenge(id: string, playerId: string, answer: "accept" | "decline" | "cancel"): Promise<Result & { championshipId?: string }> {
  const t = await tr(challengesText);
  const c = await load(id);
  if (!c) return { error: t.notFound };
  const side = sideOfPlayer(c, playerId);
  if (!side) return { error: t.notYours };
  if (answer !== "cancel" && isExpired(c)) return { error: t.expired };
  if (answer === "accept" || answer === "decline") {
    // Accetta o rifiuta chiunque della coppia sfidata (nel singolo: lo sfidato).
    if (side !== "b") return { error: t.notYours };
    const ok = await move(id, ["pending"], { status: answer === "accept" ? "accepted" : "declined" });
    return ok ? { ok: answer === "accept" ? t.accepted : t.declined, championshipId: c.championship_id } : { error: t.wrongState };
  }
  const ok = await move(id, ["pending", "accepted"], { status: "cancelled", cancelled_by: playerId });
  return ok ? { ok: t.cancelled, championshipId: c.championship_id } : { error: t.wrongState };
}

/** Uno dei due giocatori inserisce (o, finché l'altro non ha confermato, corregge) il risultato. */
export async function reportChallenge(id: string, playerId: string, sets: SetScore[]): Promise<Result & { championshipId?: string }> {
  const t = await tr(challengesText);
  const c = await load(id);
  if (!c) return { error: t.notFound };
  const side = sideOfPlayer(c, playerId);
  if (!side) return { error: t.notYours };
  if (c.status === "accepted" && isExpired(c)) return { error: t.expired };
  // Chi ha inserito il risultato (o il suo compagno) può correggerlo; l'altro lato conferma o contesta.
  if (c.status === "reported" && sideOfPlayer(c, c.reported_by ?? "") !== side) return { error: t.onlyOpponentConfirms };
  if (c.status !== "accepted" && c.status !== "reported") return { error: t.wrongState };
  const v = validateMatch(sets, c.best_of, rulesOf(c));
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
  const { data: others } = await createServiceClient().from("challenges").select(`played_at, ${ALL_SIDES}`)
    .eq("championship_id", c.championship_id).eq("status", "confirmed").eq("ranked", true).neq("id", c.id)
    .or(involving(c.challenger_id));
  const pair = ((others ?? []) as unknown as (Challenge & { played_at: string })[]).filter((x) => matchupKey(x) === matchupKey(c));
  const ranked = countsForRanking(league.settings.challenges, playedAt, pair);
  const ok = await move(c.id, from, { ...change, status: "confirmed", ranked, played_at: playedAt, confirmed_at: new Date().toISOString() });
  if (!ok) return { error: t.wrongState };
  if (ranked) {
    const r = await recomputeChampionship(c.championship_id);
    if (r.error) return { error: t.recomputeFailed };
  }
  return { ok: ranked ? t.confirmedRanked : t.confirmedNotCounted };
}

/** L'avversario di chi ha inserito il risultato lo conferma o lo contesta. */
export async function answerResult(id: string, playerId: string, answer: "confirm" | "dispute"): Promise<Result & { championshipId?: string }> {
  const t = await tr(challengesText);
  const c = await load(id);
  if (!c) return { error: t.notFound };
  const side = sideOfPlayer(c, playerId);
  if (!side) return { error: t.notYours };
  if (c.status !== "reported") return { error: t.wrongState };
  // Conferma o contesta qualcuno dell'altro lato rispetto a chi ha inserito il risultato.
  if (sideOfPlayer(c, c.reported_by ?? "") === side) return { error: t.onlyOpponentConfirms };
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
  const v = validateMatch(decision === "confirm" ? c.set_scores ?? [] : decision.sets, c.best_of, rulesOf(c));
  if ("error" in v) return { error: translateDomainError(v.error, await getLocale()), set: v.set };
  const r = await finalize(c, { sets_a: v.result.setsA, sets_b: v.result.setsB, set_scores: v.result.sets }, [c.status]);
  return r.ok ? { ok: t.adminConfirmed } : r;
}

/** Sfide ancora aperte di un giocatore (tutte le leghe), scadute escluse. */
export async function openChallengesOf(playerId: string): Promise<Challenge[]> {
  const { data } = await createServiceClient().from("challenges").select(CHALLENGE_COLUMNS)
    .or(involving(playerId))
    .in("status", ["pending", "accepted", "reported", "disputed"]).order("created_at", { ascending: false }).limit(30);
  return ((data ?? []) as Challenge[]).filter((c) => !isExpired(c));
}

/**
 * Sfide chiuse di recente senza essere giocate, da segnalare al giocatore: rifiutate (a chi le aveva lanciate),
 * annullate dall'altro giocatore e scadute (a chi le aveva lanciate; se già accettate, a entrambi).
 */
export async function closedNoticesOf(playerId: string): Promise<(Challenge & { reason: "declined" | "cancelled" | "expired" })[]> {
  const since = new Date(Date.now() - (ACCEPTED_DAYS + NOTICE_DAYS) * 86400000).toISOString();
  const { data } = await createServiceClient().from("challenges").select(CHALLENGE_COLUMNS)
    .or(involving(playerId))
    .in("status", ["declined", "cancelled", "pending", "accepted"]).gte("created_at", since)
    .order("updated_at", { ascending: false }).limit(30);
  const out: (Challenge & { reason: "declined" | "cancelled" | "expired" })[] = [];
  for (const c of (data ?? []) as Challenge[]) {
    const mine = sideOfPlayer(c, playerId);
    if (c.status === "declined" && mine === "a" && recentlyClosed(c)) out.push({ ...c, reason: "declined" });
    else if (c.status === "cancelled" && c.cancelled_by && c.cancelled_by !== playerId && recentlyClosed(c)) out.push({ ...c, reason: "cancelled" });
    else if (recentlyExpired(c) && (c.status === "accepted" || mine === "a")) out.push({ ...c, reason: "expired" });
  }
  return out;
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
  // Nel doppio i due compagni possono aver preso punti diversi: si mostra quello di ciascuno.
  return rows.map((c) => ({
    ...c,
    deltas: c.ranked ? new Map([...sideOf(c, "a"), ...sideOf(c, "b")].map((id) => [id, delta.get(`${c.id}:${id}`) ?? null])) : null,
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

/** Membri attivi della lega, in ordine alfabetico, con l'indicazione di chi ha un account (può accettare una sfida). */
export async function challengeableMembers(championshipId: string): Promise<{ id: string; name: string; hasAccount: boolean }[]> {
  const { data } = await createServiceClient().from("championship_players")
    .select("players!inner(id, full_name, user_id, active)").eq("championship_id", championshipId).eq("players.active", true);
  return ((data ?? []) as unknown as { players: { id: string; full_name: string; user_id: string | null } }[])
    .map((r) => ({ id: r.players.id, name: r.players.full_name, hasAccount: Boolean(r.players.user_id) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Nome e indirizzo delle leghe, per id. */
export async function leagueNames(ids: string[]): Promise<Map<string, { name: string; slug: string }>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const { data } = await createServiceClient().from("championships").select("id, name, slug").in("id", unique);
  return new Map((data ?? []).map((c) => [c.id as string, { name: c.name as string, slug: c.slug as string }]));
}
