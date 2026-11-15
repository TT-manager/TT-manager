/**
 * Premio di piazzamento per i primi 4 di un torneo valido per la classifica, in proporzione
 * al numero di partecipanti: quasi nullo nei tornei piccoli, pieno con 32 partecipanti,
 * al massimo il doppio da 48 in su.
 */
import { groupViews, isPlayed, type MatchRow } from "./tournament";

/** Partecipanti per cui si assegna il premio pieno. */
export const PLACEMENT_REFERENCE = 32;
/** Moltiplicatore massimo, da 48 partecipanti in su. */
export const PLACEMENT_MAX_FACTOR = 2;
export const PLACEMENT_MAX_FROM = 48;

/**
 * Quanto del premio pieno si assegna con `n` partecipanti (voci: giocatori, o coppie nel doppio).
 * Conta quanti partecipanti si lasciano dietro oltre ai primi 4, e cresce più che in proporzione.
 */
export function placementFactor(n: number) {
  if (n <= 4) return 0;
  if (n >= PLACEMENT_MAX_FROM) return PLACEMENT_MAX_FACTOR;
  return Math.min(PLACEMENT_MAX_FACTOR, ((n - 4) / (PLACEMENT_REFERENCE - 4)) ** 1.5);
}

export type Podium = Record<1 | 2 | 3 | 4, number>;

/** Punti del premio per un piazzamento; `shared3` = semifinalista sconfitto (media tra 3° e 4°). */
export function placementPoints(full: Podium, place: 1 | 2 | 3 | 4, n: number, shared3 = false) {
  const base = shared3 ? (full[3] + full[4]) / 2 : full[place];
  return Math.round(base * placementFactor(n));
}

/**
 * Primi 4 di un torneo concluso (voci del torneo, non giocatori).
 * - Con tabellone: 1° e 2° dalla finale; i due sconfitti in semifinale sono 3° a pari merito.
 * - Girone unico: le prime 4 posizioni della classifica del girone.
 */
export function tournamentPlacements(
  matches: MatchRow[],
  members: { playerId: string; group: number; seed?: number | null }[],
): { entryId: string; place: 1 | 2 | 3 | 4; shared3: boolean }[] {
  const ko = matches.filter((m) => m.phase === "knockout");
  const loser = (m: MatchRow) => ((m.sets_a as number) > (m.sets_b as number) ? m.player_b : m.player_a);
  const winner = (m: MatchRow) => ((m.sets_a as number) > (m.sets_b as number) ? m.player_a : m.player_b);
  if (ko.length) {
    const final = ko.find((m) => m.stage === 0);
    if (!final || !isPlayed(final) || !final.player_a || !final.player_b) return [];
    const out: { entryId: string; place: 1 | 2 | 3 | 4; shared3: boolean }[] = [
      { entryId: winner(final)!, place: 1, shared3: false },
      { entryId: loser(final)!, place: 2, shared3: false },
    ];
    for (const s of ko.filter((m) => m.stage === 1 && isPlayed(m) && m.player_a && m.player_b))
      out.push({ entryId: loser(s)!, place: 3, shared3: true });
    return out;
  }
  const groups = groupViews(members, matches);
  if (groups.length !== 1 || !groups[0].complete) return [];
  return groups[0].standings.slice(0, 4).map((s, i) => ({ entryId: s.playerId, place: (i + 1) as 1 | 2 | 3 | 4, shared3: false }));
}
