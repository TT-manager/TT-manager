"use server";
import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { isLocale, LOCALE_COOKIE } from "./locale";

/** Selettore della lingua nel footer: la scelta resta ricordata per un anno. */
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  // Chi ha un account se la ritrova salvata: le email (registrazione, password, nuovi tornei) arrivano in quella lingua.
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims && data.claims.user_metadata?.locale !== locale) await supabase.auth.updateUser({ data: { locale } });
  refresh();
}
