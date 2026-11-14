import { dict, type Locale } from "../locale";

/** Messaggi di `parseClubChoice` (src/lib/clubs.ts, restano in italiano) e loro traduzione. */
const CLUB_ERRORS_EN: Record<string, string> = {
  "Scegli un circolo dall'elenco.": "Choose a club from the list.",
  "Scrivi il nome del circolo (2-80 caratteri).": "Enter the club name (2-80 characters).",
  "Nome della città troppo lungo.": "City name too long.",
  "Circolo non valido.": "Invalid club.",
};

/** Errore della scelta del circolo nella lingua `l` (l'italiano resta com'è). */
export const clubErrorText = (msg: string, l: Locale) => (l === "en" ? CLUB_ERRORS_EN[msg] ?? msg : msg);

/** Messaggi di src/lib/clubs-server.ts e src/lib/account.ts mostrati all'utente. */
export const accountLibText = dict({
  clubAlreadyListed: (name: string) => `«${name}» è già nell'elenco: sceglilo dal menu.`,
  clubRequestPending: "Hai già una richiesta di circolo in attesa.",
  requestFailed: "Non sono riuscito a inviare la richiesta.",
  linkTargetGone: "Il giocatore da collegare non esiste più.",
  alreadyLinkedOther: (name: string) => `${name} è già collegato a un altro account.`,
  accountHasOtherCard: (name: string) => `Questo account gioca già con un'altra scheda: non si può collegare a ${name}.`,
  linkFailed: "Non sono riuscito a collegare l'account.",
  playerCardMissing: "Scheda giocatore mancante: riprova.",
  joinFailed: "Non sono riuscito a inserirti nella lega.",
  pickTwoCards: "Scegli due schede diverse.",
  playerNotFound: "Giocatore non trovato: ricarica la pagina.",
  alreadyLinked: (name: string) => `${name} è già collegato a un account.`,
  guestCannotLink: "Non si può collegare un account a un ospite degli amichevoli.",
  noAccountToLink: (name: string) => `${name} non ha un account da collegare.`,
  alreadyPlayed: (name: string) => `${name} ha già giocato con la scheda nuova: non posso unirle senza perdere quelle partite.`,
  moveLeaguesFailed: "Non sono riuscito a spostare le leghe.",
  merged: (name: string) => `Fatto: l'account ora usa la scheda di ${name}, con punti e storico.`,
}, {
  clubAlreadyListed: (name: string) => `«${name}» is already on the list: choose it from the menu.`,
  clubRequestPending: "You already have a club request waiting.",
  requestFailed: "I couldn't send the request.",
  linkTargetGone: "The player to link no longer exists.",
  alreadyLinkedOther: (name: string) => `${name} is already linked to another account.`,
  accountHasOtherCard: (name: string) => `This account already plays with another player page: it can't be linked to ${name}.`,
  linkFailed: "I couldn't link the account.",
  playerCardMissing: "Player page missing: please try again.",
  joinFailed: "I couldn't add you to the league.",
  pickTwoCards: "Choose two different player pages.",
  playerNotFound: "Player not found: reload the page.",
  alreadyLinked: (name: string) => `${name} is already linked to an account.`,
  guestCannotLink: "You can't link an account to a friendly guest.",
  noAccountToLink: (name: string) => `${name} has no account to link.`,
  alreadyPlayed: (name: string) => `${name} has already played with the new player page: I can't merge them without losing those matches.`,
  moveLeaguesFailed: "I couldn't move the leagues.",
  merged: (name: string) => `Done: the account now uses ${name}'s player page, with points and history.`,
});
