/**
 * Premio di piazzamento per i primi 4 di un torneo valido per la classifica, in proporzione
 * al numero di partecipanti: quasi nullo nei tornei piccoli, pieno con 32 partecipanti,
 * al massimo il doppio da 48 in su.
 */
import { groupViews, isPlayed, type MatchRow } from "./tournament";
import { isThirdPlaceMatch, type ThirdPlace } from "./format";

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
 * - Con tabellone: 1° e 2° dalla finale. 3° e 4° dalla finale per il 3° posto se giocata;
 *   altrimenti secondo la regola del formato: pari merito (`shared`), oppure 3° chi ha perso
 *   in semifinale con il vincitore e 4° chi ha perso con il finalista (`byFinalist`).
 * - Girone unico: le prime 4 posizioni della classifica del girone.
 */
export function tournamentPlacements(
  matches: MatchRow[],
  members: { playerId: string; group: number; seed?: number | null }[],
  third: { mode?: ThirdPlace; fallback?: Exclude<ThirdPlace, "match"> } = {},
): { entryId: string; place: 1 | 2 | 3 | 4; shared3: boolean }[] {
  const ko = matches.filter((m) => m.phase === "knockout");
  const ok = (m: MatchRow | undefined): m is MatchRow => Boolean(m && isPlayed(m) && m.player_a && m.player_b);
  const winner = (m: MatchRow) => ((m.sets_a as number) > (m.sets_b as number) ? m.player_a! : m.player_b!);
  const loser = (m: MatchRow) => ((m.sets_a as number) > (m.sets_b as number) ? m.player_b! : m.player_a!);
  if (ko.length) {
    const final = ko.find((m) => m.stage === 0 && m.position === 0);
    if (!ok(final)) return [];
    const out: { entryId: string; place: 1 | 2 | 3 | 4; shared3: boolean }[] = [
      { entryId: winner(final), place: 1, shared3: false },
      { entryId: loser(final), place: 2, shared3: false },
    ];
    const thirdMatch = ko.find((m) => isThirdPlaceMatch(m));
    if (ok(thirdMatch)) {
      out.push({ entryId: winner(thirdMatch), place: 3, shared3: false }, { entryId: loser(thirdMatch), place: 4, shared3: false });
      return out;
    }
    const semis = ko.filter((m) => m.stage === 1 && ok(m));
    const rule = third.mode === "byFinalist" ? "byFinalist" : third.mode === "match" ? third.fallback ?? "shared" : "shared";
    if (rule === "byFinalist" && semis.length === 2) {
      const champion = winner(final);
      for (const sf of semis)
        out.push({ entryId: loser(sf), place: winner(sf) === champion ? 3 : 4, shared3: false });
      return out.sort((x, y) => x.place - y.place);
    }
    for (const sf of semis) out.push({ entryId: loser(sf), place: 3, shared3: true });
    return out;
  }
  const groups = groupViews(members, matches);
  if (groups.length !== 1 || !groups[0].complete) return [];
  return groups[0].standings.slice(0, 4).map((st, i) => ({ entryId: st.playerId, place: (i + 1) as 1 | 2 | 3 | 4, shared3: false }));
}
