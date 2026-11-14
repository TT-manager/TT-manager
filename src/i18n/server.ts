import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locale";

/** Lingua della richiesta (cookie impostato dal proxy o dal selettore nel footer). Va usata dentro <Suspense>. */
export const getLocale = cache(async (): Promise<Locale> => {
  const v = (await cookies()).get("lang")?.value;
  return isLocale(v) ? v : DEFAULT_LOCALE;
});

/** Testi della lingua corrente: `const t = await tr(dizionario)`. */
export async function tr<T>(d: Record<Locale, T>): Promise<T> {
  return d[await getLocale()];
}
