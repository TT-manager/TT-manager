import type { Locale } from "./locale";

/**
 * I controlli della logica dei tornei (punteggi, formato, regole della classifica) scrivono i messaggi
 * in italiano. Per l'inglese si traducono qui, al momento di mostrarli. Un messaggio non riconosciuto
 * resta com'è (meglio in italiano che vuoto).
 */
const EN: [RegExp, string | ((...m: string[]) => string)][] = [
  // punteggi dei set
  [/^punteggi non validi$/, "invalid scores"],
  [/^nessuno è arrivato a (\d+)$/, (_, p) => `nobody reached ${p}`],
  [/^sul (\d+) pari decide il golden point: il set finisce (\d+)-(\d+)$/, (_, g, a, b) => `at ${g}-all the golden point decides: the set ends ${a}-${b}`],
  [/^serve uno scarto di almeno 2 punti$/, "a lead of at least 2 points is needed"],
  [/^ai vantaggi lo scarto deve essere esattamente 2$/, "after deuce the lead must be exactly 2"],
  [/^con il golden point sul (\d+) pari il set non può superare (\d+)$/, (_, g, m) => `with the golden point at ${g}-all the set can't go beyond ${m}`],
  [/^Set (\d+): (.+)$/, (_, n, rest) => `Set ${n}: ${translateDomainError(rest, "en")}`],
  [/^Inserisci almeno un set\.$/, "Enter at least one set."],
  [/^Al massimo (\d+) set\.$/, (_, n) => `At most ${n} sets.`],
  [/^La partita era già finita dopo il set (\d+): togli i set in più\.$/, (_, n) => `The match was already over after set ${n}: remove the extra sets.`],
  [/^Partita non finita: servono (\d+) set vinti \(al meglio dei (\d+)\)\.$/, (_, w, b) => `Match not finished: ${w} sets are needed to win (best of ${b}).`],
  [/^è vuoto ma il set (\d+) è compilato\.$/, (_, n) => `it's empty but set ${n} is filled in.`],
  [/^inserisci entrambi i punteggi\.$/, "enter both scores."],
  // formato del torneo
  [/^I punti del set devono essere tra 3 e 50\.$/, "Set points must be between 3 and 50."],
  [/^Il golden point deve essere almeno sul (\d+) pari\.$/, (_, n) => `The golden point must be at ${n}-all or higher.`],
  [/^Modalità del torneo non valida\.$/, "Invalid tournament mode."],
  [/^Set delle partite non valido \(1, 3, 5 o 7\)\.$/, "Invalid number of sets per match (1, 3, 5 or 7)."],
  [/^Solo andata oppure andata e ritorno\.$/, "Single leg or home and away only."],
  [/^Servono almeno (\d+) iscritti\.$/, (_, n) => `At least ${n} entries are needed.`],
  [/^Set del tabellone non valido \(1, 3, 5 o 7\)\.$/, "Invalid number of sets in the knockout (1, 3, 5 or 7)."],
  [/^Set non validi per il turno (\d+)\.$/, (_, n) => `Invalid number of sets for round ${n}.`],
  [/^Serve almeno un girone\.$/, "At least one group is needed."],
  [/^Set dei gironi non valido \(1, 3, 5 o 7\)\.$/, "Invalid number of sets in the groups (1, 3, 5 or 7)."],
  [/^Indica almeno una regola di qualificazione\.$/, "Add at least one qualification rule."],
  [/^Gironi: solo andata oppure andata e ritorno\.$/, "Groups: single leg or home and away only."],
  [/^Criterio di ripescaggio non valido\.$/, "Invalid lucky-loser criterion."],
  [/^Turno di ingresso non valido\.$/, "Invalid entry round."],
  [/^Una regola di qualificazione non ha posizioni\.$/, "A qualification rule has no positions."],
  [/^Un ripescaggio riguarda una sola posizione \(es\. «2»\)\.$/, "A lucky-loser rule covers a single position (e.g. «2»)."],
  [/^Ripescaggio: i migliori devono essere tra 1 e (\d+) \(uno per girone al massimo\)\.$/, (_, n) => `Lucky losers: the best must be between 1 and ${n} (at most one per group).`],
  [/^Non ci sono abbastanza gironi con un (\d+)° classificato per ripescarne (\d+)\.$/, (_, p, n) => `There aren't enough groups with a player in position ${p} to pick ${n} lucky losers.`],
  [/^Posizione di girone non valida: (.+)\.$/, (_, p) => `Invalid group position: ${p}.`],
  [/^La posizione (\d+) compare in più regole\.$/, (_, p) => `Position ${p} appears in more than one rule.`],
  [/^C'è un girone con meno di (\d+) giocatori: la posizione \d+ non esiste\.$/, (_, p) => `One group has fewer than ${p} players: position ${p} doesn't exist.`],
  [/^Al turno "(.+)" ci sono meno di 2 giocatori\.$/, (_, r) => `The round "${r}" has fewer than 2 players.`],
  [/^Al turno "(.+)" i giocatori sono (\d+) \(dispari\): modifica le regole di qualificazione\.$/, (_, r, n) => `The round "${r}" has ${n} players (an odd number): change the qualification rules.`],
  [/^La finale ha (\d+) giocatori invece di 2: le regole di qualificazione non tornano\.$/, (_, n) => `The final has ${n} players instead of 2: the qualification rules don't add up.`],
  [/^Le regole di qualificazione non portano a una sola finale\.$/, "The qualification rules don't lead to a single final."],
  [/^Formato del torneo non valido\.$/, "Invalid tournament format."],
  [/^Troppi gironi \(massimo 64\)\.$/, "Too many groups (64 at most)."],
  // generazione e risultati
  [/^Con (\d+) gironi servono almeno (\d+) iscritti \(ora sono (\d+)\)\.$/, (_, g, n, now) => `With ${g} groups at least ${n} entries are needed (there are ${now}).`],
  [/^Servono almeno 2 giocatori$/, "At least 2 players are needed"],
  [/^Partita non trovata\.$/, "Match not found."],
  [/^Questa partita è già stata conteggiata nella classifica generale: può correggerla solo un amministratore\.$/, "This match has already been counted in the ranking: only an administrator can correct it."],
  [/^I giocatori di questa partita non sono ancora definiti\.$/, "The players of this match aren't decided yet."],
  [/^Questa modifica cambierebbe i giocatori di una partita del tabellone già giocata: cancella prima quel risultato\.$/, "This change would alter the players of a knockout match that has already been played: delete that result first."],
  // regole della classifica
  [/^(.+): valore tra (\d+) e (\d+)\.$/, (_, what, a, b) => `${RANKING_FIELDS[what] ?? what}: value between ${a} and ${b}.`],
  [/^Le partite da intermedio devono essere almeno quelle da nuovo\.$/, "Intermediate matches must be at least as many as newcomer matches."],
  [/^Calo per torneo saltato: tra 0% e 50%\.$/, "Drop for a missed tournament: between 0% and 50%."],
  [/^Peso delle sfide: intero, metà o un quarto\.$/, "Challenge weight: full, half or a quarter."],
];

const RANKING_FIELDS: Record<string, string> = {
  "Punteggio iniziale": "Starting points",
  "Velocità nuovi": "Speed for newcomers",
  "Velocità intermedi": "Speed for intermediates",
  "Velocità esperti": "Speed for experienced players",
  "Partite da nuovo": "Newcomer matches",
  "Partite da intermedio": "Intermediate matches",
  "Soglia del calo": "Drop threshold",
  "Tornei saltati per il rientro veloce": "Missed tournaments for the fast comeback",
  "Partite di rientro veloce": "Fast comeback matches",
  "Bonus 1° posto": "1st place bonus", "Bonus 2° posto": "2nd place bonus",
  "Bonus 3° posto": "3rd place bonus", "Bonus 4° posto": "4th place bonus",
  "Sfide valide a settimana": "Ranked challenges per week",
};

export function translateDomainError(msg: string, l: Locale): string {
  if (l === "it") return msg;
  for (const [re, out] of EN) {
    const m = msg.match(re);
    if (m) return typeof out === "string" ? out : out(...(m as unknown as string[]));
  }
  return msg;
}
