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
