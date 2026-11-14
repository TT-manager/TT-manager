/**
 * Dati del gestore del sito, usati nel footer e nelle pagine legali.
 * Si impostano dalle variabili d'ambiente (Vercel → Environment Variables);
 * quelle mancanti vengono semplicemente omesse dalle pagine.
 */
const clean = (v: string | undefined) => v?.trim() || null;

/** Indirizzo a cui scrivere per assistenza e richieste privacy. */
export const SUPPORT_EMAIL = clean(process.env.NEXT_PUBLIC_SUPPORT_EMAIL);
/** Chi gestisce il sito (persona, associazione o società): titolare del trattamento. */
export const LEGAL_OWNER = clean(process.env.NEXT_PUBLIC_LEGAL_OWNER);
/** Sede o indirizzo del titolare (facoltativo). */
export const LEGAL_ADDRESS = clean(process.env.NEXT_PUBLIC_LEGAL_ADDRESS);

/** Da aggiornare a ogni modifica sostanziale dei testi legali (AAAA-MM-GG). */
export const LEGAL_UPDATED = "2026-11-12";

/** Data di aggiornamento leggibile nella lingua indicata (Intl), es. «12 novembre 2026» / «12 November 2026». */
export function legalUpdatedLabel(intlTag: string): string {
  return new Date(`${LEGAL_UPDATED}T12:00:00Z`).toLocaleDateString(intlTag, {
    day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Rome",
  });
}
