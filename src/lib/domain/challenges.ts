/**
 * Sfide singole fuori torneo tra due giocatori della stessa lega.
 *
 * pending → (l'avversario accetta) accepted → (uno dei due inserisce il risultato) reported
 *   → (l'altro conferma) confirmed  |  (l'altro contesta) disputed → decide un amministratore.
 * Una sfida pending o accepted che resta ferma troppo a lungo scade.
 */
export type ChallengeStatus = "pending" | "accepted" | "declined" | "cancelled" | "reported" | "confirmed" | "disputed";

/** Giorni dopo i quali una sfida non accettata scade. */
export const PENDING_DAYS = 7;
/** Giorni dopo i quali una sfida accettata ma senza risultato scade. */
export const ACCEPTED_DAYS = 21;
export const CHALLENGE_BEST_OF = [1, 3, 5, 7] as const;

const DAY = 24 * 60 * 60 * 1000;

/** Vero se la sfida è scaduta (calcolato al momento: nel database resta pending/accepted). */
export function isExpired(c: { status: string; created_at: string }, now = Date.now()) {
  const age = now - new Date(c.created_at).getTime();
  return (c.status === "pending" && age > PENDING_DAYS * DAY) || (c.status === "accepted" && age > ACCEPTED_DAYS * DAY);
}

/** Giorno (YYYY-MM-DD) in ora italiana. */
export const romeDay = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });

/** Lunedì (YYYY-MM-DD, ora italiana) della settimana in cui cade `iso`. */
export function romeWeek(iso: string) {
  const d = new Date(`${romeDay(iso)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/**
 * Una sfida appena confermata vale per la classifica? Solo se le sfide sono attive e,
 * con un limite settimanale, se tra gli stessi due giocatori non se ne contano già abbastanza
 * nella stessa settimana (le altre restano amichevoli).
 */
export function countsForRanking(
  settings: { enabled: boolean; perWeek: number },
  playedAt: string,
  rankedSameWeekPair: { played_at: string }[],
) {
  if (!settings.enabled) return false;
  if (settings.perWeek === 0) return true;
  const week = romeWeek(playedAt);
  return rankedSameWeekPair.filter((c) => romeWeek(c.played_at) === week).length < settings.perWeek;
}

/** Giorni che restano prima che una sfida pending/accepted scada (almeno 1). */
export function daysLeft(c: { status: string; created_at: string }, now = Date.now()) {
  const limit = (c.status === "pending" ? PENDING_DAYS : ACCEPTED_DAYS) * DAY;
  return Math.max(1, Math.ceil((new Date(c.created_at).getTime() + limit - now) / DAY));
}
