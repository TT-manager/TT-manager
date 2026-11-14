"use client";
import { createContext, useContext, useEffect, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "./locale";

const Ctx = createContext<Locale>(DEFAULT_LOCALE);

/** Rende disponibile la lingua ai componenti client e aggiorna l'attributo lang della pagina. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  useEffect(() => { document.documentElement.lang = locale; }, [locale]);
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

export const useLocale = () => useContext(Ctx);

/** Testi della lingua corrente nei componenti client: `const t = useTr(dizionario)`. */
export function useTr<T>(d: Record<Locale, T>): T {
  return d[useContext(Ctx)];
}
