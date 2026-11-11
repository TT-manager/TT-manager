/** Rating Elo per il ranking generale. */

export const INITIAL_RATING = 1000;

/** Probabilità attesa di vittoria del giocatore A contro B. */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** K più alto per chi ha poche partite: il rating si assesta più in fretta. */
export function kFactor(gamesPlayed: number): number {
  if (gamesPlayed < 20) return 40;
  if (gamesPlayed < 60) return 24;
  return 16;
}

export interface EloPlayer {
  rating: number;
  gamesPlayed: number;
}

export interface EloResult {
  winner: number;
  loser: number;
  /** Punti scambiati dal perdente al vincitore (somma zero se K uguali). */
  delta: { winner: number; loser: number };
}

/** Calcola i nuovi rating dopo una partita. */
export function applyMatch(winner: EloPlayer, loser: EloPlayer): EloResult {
  const expW = expectedScore(winner.rating, loser.rating);
  const expL = 1 - expW;
  const dW = Math.round(kFactor(winner.gamesPlayed) * (1 - expW));
  const dL = Math.round(kFactor(loser.gamesPlayed) * (0 - expL));
  return {
    winner: winner.rating + dW,
    loser: loser.rating + dL,
    delta: { winner: dW, loser: dL },
  };
}

export interface RateableMatch { id: string; winner: string; loser: string }
export interface RatingChange { playerId: string; matchId: string; before: number; after: number }

/**
 * Applica l'Elo a una sequenza di partite (già in ordine cronologico).
 * Restituisce lo storico partita per partita e lo stato finale di ogni giocatore coinvolto.
 */
export function rateMatches(matches: RateableMatch[], start: Map<string, EloPlayer>) {
  const current = new Map([...start].map(([id, p]) => [id, { ...p }]));
  const history: RatingChange[] = [];
  for (const m of matches) {
    const w = current.get(m.winner), l = current.get(m.loser);
    if (!w || !l) throw new Error(`Giocatore mancante nella partita ${m.id}`);
    const r = applyMatch(w, l);
    history.push({ playerId: m.winner, matchId: m.id, before: w.rating, after: r.winner });
    history.push({ playerId: m.loser, matchId: m.id, before: l.rating, after: r.loser });
    w.rating = r.winner; w.gamesPlayed++;
    l.rating = r.loser; l.gamesPlayed++;
  }
  const players = [...current].filter(([id]) => history.some((h) => h.playerId === id)).map(([id, p]) => ({
    id, ratingBefore: start.get(id)!.rating, gamesBefore: start.get(id)!.gamesPlayed,
    ratingAfter: p.rating, gamesAfter: p.gamesPlayed,
  }));
  return { history, players };
}
