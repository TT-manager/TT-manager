import { dict } from "../locale";

/** Tabellone e modulo dei risultati. */
export const compTournament = dict({
  // bracket
  winner: "Vincitore del torneo",
  bye: "passa il turno",
  tbd: "da definire",
  disputed: "Contestato",
  // match-form
  correct: "Correggi",
  enterResult: "Inserisci risultato",
  rulesIntro: (bestOf: number, toWin: number, points: number, golden: number | null) =>
    `${bestOf === 1 ? "Set unico" : `Al meglio dei ${bestOf}: vince chi arriva a ${toWin} set`}, set a ${points}${golden !== null ? `, golden point sul ${golden} pari` : ""}. Lascia vuoti i set non giocati.`,
  saving: "Salvataggio…",
  save: "Salva",
  confirmClear: "Cancellare questo risultato?",
  clear: "Cancella risultato",
  close: "Chiudi",
}, {
  winner: "Tournament winner",
  bye: "bye",
  tbd: "to be decided",
  disputed: "Disputed",
  correct: "Correct",
  enterResult: "Enter result",
  rulesIntro: (bestOf: number, toWin: number, points: number, golden: number | null) =>
    `${bestOf === 1 ? "Single set" : `Best of ${bestOf}: first to ${toWin} sets wins`}, sets to ${points}${golden !== null ? `, golden point at ${golden}-all` : ""}. Leave unplayed sets empty.`,
  saving: "Saving…",
  save: "Save",
  confirmClear: "Delete this result?",
  clear: "Delete result",
  close: "Close",
});
