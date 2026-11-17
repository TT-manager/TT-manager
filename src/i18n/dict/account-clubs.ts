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
  joinFailed: "Non sono riuscito a inserirti nel circuito.",
  pickTwoCards: "Scegli due schede diverse.",
  playerNotFound: "Giocatore non trovato: ricarica la pagina.",
  alreadyLinked: (name: string) => `${name} è già collegato a un account.`,
  guestCannotLink: "Non si può collegare un account a un ospite degli amichevoli.",
  noAccountToLink: (name: string) => `${name} non ha un account da collegare.`,
  alreadyPlayed: (name: string) => `${name} ha già giocato con la scheda nuova: non posso unirle senza perdere quelle partite.`,
  moveLeaguesFailed: "Non sono riuscito a spostare i circuiti.",
  merged: (name: string) => `Fatto: le due schede ora sono una sola, quella di ${name}, con tutto lo storico. Le classifiche sono ricalcolate.`,
  bothHaveAccounts: (a: string, b: string) => `${a} e ${b} hanno ciascuno un account: sono due persone diverse, non si possono unire.`,
  sameTournament: "Le due schede hanno giocato nello stesso torneo: sono due persone diverse, non si possono unire.",
  sameChallenge: "Le due schede compaiono nella stessa sfida: sono due persone diverse, non si possono unire.",
  mergeFailed: "Non sono riuscito a unire le schede: riprova.",
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
  merged: (name: string) => `Done: the two player pages are now one, ${name}'s, with all their history. Rankings have been recalculated.`,
  bothHaveAccounts: (a: string, b: string) => `${a} and ${b} each have an account: they are two different people and can't be merged.`,
  sameTournament: "The two player pages played in the same tournament: they are two different people and can't be merged.",
  sameChallenge: "The two player pages appear in the same challenge: they are two different people and can't be merged.",
  mergeFailed: "Couldn't merge the player pages: please try again.",
});
