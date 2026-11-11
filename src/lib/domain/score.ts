/**
 * Validazione dei punteggi di una partita di tennis tavolo, set per set.
 * Regole: un set si vince a 11 con almeno 2 punti di scarto; dal 10-10 si va
 * ai vantaggi (scarto esattamente 2). La partita finisce appena un giocatore
 * vince la maggioranza dei set previsti (best of).
 */

export type SetScore = [number, number];

export interface ValidResult { setsA: number; setsB: number; sets: SetScore[] }

/** Errore del singolo set, o null se valido. */
export function setError([a, b]: SetScore): string | null {
  if (![a, b].every((x) => Number.isInteger(x) && x >= 0 && x <= 99)) return "punteggi non validi";
  const hi = Math.max(a, b), lo = Math.min(a, b);
  if (hi < 11) return "nessuno è arrivato a 11";
  if (hi - lo < 2) return "serve uno scarto di almeno 2 punti";
  if (hi > 11 && hi - lo !== 2) return "ai vantaggi lo scarto deve essere esattamente 2";
  return null;
}

/** `set` (da 1) indica la riga da evidenziare, quando l'errore riguarda un set preciso. */
export function validateMatch(sets: SetScore[], bestOf: number): { result: ValidResult } | { error: string; set?: number } {
  const toWin = Math.ceil(bestOf / 2);
  if (sets.length === 0) return { error: "Inserisci almeno un set." };
  if (sets.length > bestOf) return { error: `Al massimo ${bestOf} set.` };
  let setsA = 0, setsB = 0;
  for (let i = 0; i < sets.length; i++) {
    if (setsA === toWin || setsB === toWin)
      return { error: `La partita era già finita dopo il set ${i}: togli i set in più.`, set: i + 1 };
    const err = setError(sets[i]);
    if (err) return { error: `Set ${i + 1}: ${err}.`, set: i + 1 };
    if (sets[i][0] > sets[i][1]) setsA++; else setsB++;
  }
  if (setsA !== toWin && setsB !== toWin)
    return { error: `Partita non finita: servono ${toWin} set vinti (al meglio dei ${bestOf}).` };
  return { result: { setsA, setsB, sets } };
}

/** Legge i set dal modulo: campi a1/b1 ... a7/b7; le righe vuote finali sono ignorate. */
export function setsFromForm(formData: FormData): SetScore[] | { error: string; set: number } {
  const sets: SetScore[] = [];
  let emptyRow = 0; // prima riga vuota incontrata
  for (let i = 1; i <= 7; i++) {
    const a = String(formData.get(`a${i}`) ?? "").trim();
    const b = String(formData.get(`b${i}`) ?? "").trim();
    if (a === "" && b === "") { emptyRow ||= i; continue; }
    if (emptyRow) return { error: `Set ${emptyRow}: è vuoto ma il set ${i} è compilato.`, set: emptyRow };
    if (a === "" || b === "") return { error: `Set ${i}: inserisci entrambi i punteggi.`, set: i };
    sets.push([Number(a), Number(b)]);
  }
  return sets;
}
