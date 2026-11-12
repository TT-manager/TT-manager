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

/** Da aggiornare a ogni modifica sostanziale dei testi legali. */
export const LEGAL_UPDATED = "12 novembre 2026";
