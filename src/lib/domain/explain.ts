import { expectedScore } from "./elo";

/**
 * Punti che si guadagnano (vittoria) o si perdono (sconfitta) contro un avversario
 * che ha `diff` punti più di te, con velocità `k`. Stessa formula del ricalcolo.
 */
export function pointsSwing(k: number, diff: number) {
  const e = expectedScore(0, diff);
  return { win: Math.round(k * (1 - e)), loss: Math.round(k * (0 - e)) };
}
