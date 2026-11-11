/** Tabellone a eliminazione diretta con bye per le teste di serie. */

export interface BracketSlot {
  /** id del giocatore, null = bye o ancora da definire. */
  playerId: string | null;
}

export interface BracketMatch {
  round: number; // 1 = primo turno
  position: number; // indice nel turno, da 0
  a: string | null;
  b: string | null;
  bye: boolean;
}

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

/** Ordine standard delle teste di serie (1 vs ultimo, 2 vs penultimo, ... ben distribuite). */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2 + 1;
    order = order.flatMap((s) => [s, next - s]);
  }
  return order;
}

/**
 * Genera il primo turno. `seeded` è ordinato per testa di serie (il migliore per primo).
 * Le teste di serie più alte ricevono i bye se i giocatori non sono una potenza di 2.
 */
export function firstRound(seeded: string[]): BracketMatch[] {
  if (seeded.length < 2) throw new Error("Servono almeno 2 giocatori");
  const size = nextPowerOfTwo(seeded.length);
  const order = seedOrder(size);
  const playerAt = (seed: number) => seeded[seed - 1] ?? null;
  const matches: BracketMatch[] = [];
  for (let i = 0; i < size; i += 2) {
    const a = playerAt(order[i]);
    const b = playerAt(order[i + 1]);
    matches.push({ round: 1, position: i / 2, a, b, bye: a === null || b === null });
  }
  return matches;
}

/** Numero di turni complessivi per un tabellone con n giocatori. */
export function totalRounds(n: number): number {
  return Math.log2(nextPowerOfTwo(n));
}

/**
 * Dato l'elenco dei vincitori del turno (in ordine di posizione),
 * produce il turno successivo.
 */
export function advance(winners: (string | null)[], round: number): BracketMatch[] {
  const matches: BracketMatch[] = [];
  for (let i = 0; i < winners.length; i += 2) {
    const a = winners[i] ?? null;
    const b = winners[i + 1] ?? null;
    matches.push({ round, position: i / 2, a, b, bye: false });
  }
  return matches;
}
