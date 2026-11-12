/**
 * Ranking di una lega, «metodo A»: scambio di punti partita per partita
 * (più punti se vince lo sfavorito), con:
 * - classifica di partenza dai podi dei tornei passati (+ correzioni manuali);
 * - doppio: forza della coppia = media dei due giocatori, stessi punti a entrambi
 *   (ciascuno con la propria velocità di movimento);
 * - calo per ogni torneo saltato (percentuale della parte sopra la soglia);
 * - assenze giustificate (nessun calo) e rientro veloce dopo un'assenza.
 *
 * Il ricalcolo riparte sempre da zero: stesso input → stessa classifica.
 */
import { expectedScore } from "./elo";

export interface RankingSettings {
  /** Nome dei punti mostrato sul sito. */
  label: string;
  /** Punteggio di partenza di un nuovo giocatore. */
  initial: number;
  /** Velocità di movimento: punti massimi a partita per nuovi / intermedi / esperti. */
  k: { new: number; mid: number; exp: number };
  /** Soglie di partite giocate: sotto `newUntil` = nuovo, sotto `midUntil` = intermedio. */
  newUntil: number;
  midUntil: number;
  decay: { enabled: boolean; /** % della parte sopra la soglia persa per ogni torneo saltato */ pct: number; floor: number };
  comeback: { enabled: boolean; /** tornei saltati di fila che attivano il rientro veloce */ afterMissed: number; /** partite con velocità «nuovo» */ matches: number };
  /** Bonus dei podi dei tornei passati, per posizione (1..4). */
  podium: Record<1 | 2 | 3 | 4, number>;
}

export const DEFAULT_RANKING: RankingSettings = {
  label: "Punti",
  initial: 1000,
  k: { new: 40, mid: 24, exp: 16 },
  newUntil: 20,
  midUntil: 60,
  decay: { enabled: true, pct: 3, floor: 1000 },
  comeback: { enabled: true, afterMissed: 2, matches: 5 },
  podium: { 1: 60, 2: 40, 3: 25, 4: 25 },
};

/** Legge le impostazioni da dati non fidati, completando con i valori di default. */
export function parseRankingSettings(raw: unknown): { settings: RankingSettings } | { errors: string[] } {
  const o = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const obj = (v: unknown) => (typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {});
  const num = (v: unknown, d: number) => (v === undefined || v === null ? d : typeof v === "number" ? v : NaN);
  const bool = (v: unknown, d: boolean) => (typeof v === "boolean" ? v : d);
  const D = DEFAULT_RANKING;
  const k = obj(o.k), decay = obj(o.decay), comeback = obj(o.comeback), podium = obj(o.podium);
  const s: RankingSettings = {
    label: typeof o.label === "string" && o.label.trim() ? o.label.trim().slice(0, 30) : D.label,
    initial: num(o.initial, D.initial),
    k: { new: num(k.new, D.k.new), mid: num(k.mid, D.k.mid), exp: num(k.exp, D.k.exp) },
    newUntil: num(o.newUntil, D.newUntil),
    midUntil: num(o.midUntil, D.midUntil),
    decay: { enabled: bool(decay.enabled, D.decay.enabled), pct: num(decay.pct, D.decay.pct), floor: num(decay.floor, D.decay.floor) },
    comeback: { enabled: bool(comeback.enabled, D.comeback.enabled), afterMissed: num(comeback.afterMissed, D.comeback.afterMissed), matches: num(comeback.matches, D.comeback.matches) },
    podium: { 1: num(podium[1], D.podium[1]), 2: num(podium[2], D.podium[2]), 3: num(podium[3], D.podium[3]), 4: num(podium[4], D.podium[4]) },
  };
  const errors: string[] = [];
  const int = (v: number, min: number, max: number, what: string) => {
    if (!Number.isInteger(v) || v < min || v > max) errors.push(`${what}: valore tra ${min} e ${max}.`);
  };
  int(s.initial, 0, 5000, "Punteggio iniziale");
  int(s.k.new, 1, 100, "Velocità nuovi"); int(s.k.mid, 1, 100, "Velocità intermedi"); int(s.k.exp, 1, 100, "Velocità esperti");
  int(s.newUntil, 0, 1000, "Partite da nuovo"); int(s.midUntil, 0, 5000, "Partite da intermedio");
  if (s.midUntil < s.newUntil) errors.push("Le partite da intermedio devono essere almeno quelle da nuovo.");
  if (!(s.decay.pct >= 0 && s.decay.pct <= 50)) errors.push("Calo per torneo saltato: tra 0% e 50%.");
  int(s.decay.floor, 0, 5000, "Soglia del calo");
  int(s.comeback.afterMissed, 1, 50, "Tornei saltati per il rientro veloce");
  int(s.comeback.matches, 1, 50, "Partite di rientro veloce");
  for (const p of [1, 2, 3, 4] as const) int(s.podium[p], 0, 1000, `Bonus ${p}° posto`);
  return errors.length ? { errors } : { settings: s };
}

export function kFor(s: RankingSettings, gamesPlayed: number, comebackLeft: number): number {
  if (comebackLeft > 0) return s.k.new;
  if (gamesPlayed < s.newUntil) return s.k.new;
  if (gamesPlayed < s.midUntil) return s.k.mid;
  return s.k.exp;
}

/** Punti di partenza: iniziale + bonus dei podi passati, salvo correzione manuale. */
export function startPoints(
  s: RankingSettings,
  members: { playerId: string; override: number | null }[],
  pastResults: { playerId: string; position: number }[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const m of members) {
    const bonus = pastResults.filter((r) => r.playerId === m.playerId)
      .reduce((sum, r) => sum + (s.podium[r.position as 1 | 2 | 3 | 4] ?? 0), 0);
    out.set(m.playerId, m.override ?? s.initial + bonus);
  }
  return out;
}

export interface RankingInput {
  settings: RankingSettings;
  members: { playerId: string; override: number | null; joinedOn: string | null }[];
  pastResults: { playerId: string; position: number }[];
  absences: { playerId: string; from: string; to: string | null }[];
  /** Tornei chiusi, in ordine cronologico. `date` = giorno del torneo (YYYY-MM-DD). */
  tournaments: {
    id: string; date: string;
    /** Giocatori che hanno partecipato. */
    participants: string[];
    /** Partite giocate, in ordine; winners/losers = giocatori (1 nel singolare, 2 nel doppio). */
    matches: { id: string; winners: string[]; losers: string[] }[];
  }[];
}

export type HistoryKind = "start" | "match" | "decay";
export interface HistoryRow {
  playerId: string; kind: HistoryKind; tournamentId: string | null; matchId: string | null;
  before: number; after: number;
}

export function isJustified(absences: RankingInput["absences"], playerId: string, date: string) {
  return absences.some((a) => a.playerId === playerId && a.from <= date && (a.to === null || date <= a.to));
}

/** Ricalcolo completo della classifica della lega. */
export function computeRanking(input: RankingInput) {
  const { settings: s } = input;
  const start = startPoints(s, input.members, input.pastResults);
  const rating = new Map(start);
  const games = new Map(input.members.map((m) => [m.playerId, 0]));
  const missed = new Map(input.members.map((m) => [m.playerId, 0]));
  const comeback = new Map(input.members.map((m) => [m.playerId, 0]));
  const joined = new Map(input.members.map((m) => [m.playerId, m.joinedOn]));
  const history: HistoryRow[] = input.members.map((m) => ({
    playerId: m.playerId, kind: "start", tournamentId: null, matchId: null, before: s.initial, after: start.get(m.playerId)!,
  }));

  for (const t of input.tournaments) {
    const present = new Set(t.participants);
    if (s.comeback.enabled)
      for (const p of present) if ((missed.get(p) ?? 0) >= s.comeback.afterMissed) comeback.set(p, s.comeback.matches);

    for (const m of t.matches) {
      const avg = (ids: string[]) => ids.reduce((x, id) => x + (rating.get(id) ?? s.initial), 0) / ids.length;
      const rw = avg(m.winners), rl = avg(m.losers);
      const expW = expectedScore(rw, rl);
      const apply = (id: string, score: 0 | 1, expected: number) => {
        const before = rating.get(id) ?? s.initial;
        const left = comeback.get(id) ?? 0;
        const delta = Math.round(kFor(s, games.get(id) ?? 0, left) * (score - expected));
        rating.set(id, before + delta);
        games.set(id, (games.get(id) ?? 0) + 1);
        if (left > 0) comeback.set(id, left - 1);
        history.push({ playerId: id, kind: "match", tournamentId: t.id, matchId: m.id, before, after: before + delta });
      };
      // Prima si calcolano tutte le attese, poi si applicano (nel doppio i compagni non si influenzano).
      for (const id of m.winners) apply(id, 1, expW);
      for (const id of m.losers) apply(id, 0, 1 - expW);
    }

    for (const mem of input.members) {
      const id = mem.playerId;
      if (present.has(id)) { missed.set(id, 0); continue; }
      const j = joined.get(id);
      if (j && j > t.date) continue; // non era ancora nella lega
      missed.set(id, (missed.get(id) ?? 0) + 1);
      if (!s.decay.enabled || isJustified(input.absences, id, t.date)) continue;
      const before = rating.get(id)!;
      if (before <= s.decay.floor) continue;
      const after = Math.max(s.decay.floor, before - Math.round((s.decay.pct / 100) * (before - s.decay.floor)));
      if (after === before) continue;
      rating.set(id, after);
      history.push({ playerId: id, kind: "decay", tournamentId: t.id, matchId: null, before, after });
    }
  }

  return {
    players: input.members.map((m) => ({ id: m.playerId, rating: rating.get(m.playerId)!, games: games.get(m.playerId)! })),
    history,
  };
}
