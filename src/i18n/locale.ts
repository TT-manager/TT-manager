/** Lingue del sito. L'italiano è la lingua di partenza; l'inglese per chi ha il browser in un'altra lingua. */
export type Locale = "it" | "en";
export const LOCALES: Locale[] = ["it", "en"];
export const DEFAULT_LOCALE: Locale = "it";
export const LOCALE_COOKIE = "lang";

export const isLocale = (v: unknown): v is Locale => v === "it" || v === "en";

/** Lingua dalla preferenza del browser (Accept-Language): italiano se è la prima scelta, altrimenti inglese. */
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const first = header.split(",").map((part) => {
    const [tag, q] = part.trim().split(";q=");
    return { tag: tag.toLowerCase(), q: q ? Number(q) : 1 };
  }).filter((x) => x.tag && x.tag !== "*" && !Number.isNaN(x.q)).sort((a, b) => b.q - a.q)[0];
  if (!first) return DEFAULT_LOCALE;
  return first.tag.startsWith("it") ? "it" : "en";
}

/** Codice per date e numeri (Intl). */
export const intlTag = (l: Locale) => (l === "en" ? "en-GB" : "it-IT");

type Msg = string | ((...args: never[]) => string);
type Shape<T> = { [K in keyof T]: T[K] extends string ? string : T[K] };

/**
 * Testi di una parte del sito nelle due lingue. L'inglese deve avere esattamente le stesse chiavi
 * (e le stesse funzioni, per i testi con numeri o nomi) dell'italiano: lo controlla TypeScript.
 */
export function dict<T extends Record<string, Msg>>(it: T, en: Shape<T>): Record<Locale, Shape<T>> {
  return { it: it as Shape<T>, en };
}
