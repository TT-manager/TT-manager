import "server-only";
import { cookies } from "next/headers";
import { createServerSupabase } from "./supabase/server";

/**
 * Inviti ai circuiti «ricordati»: chi apre un link d'invito e poi si registra o chiede di entrare
 * da un'altra pagina (o conferma l'email più tardi) non perde l'invito.
 * Si ricorda in un cookie del browser (all'apertura del link) e nei dati dell'account (alla registrazione).
 * Il codice va sempre ricontrollato con quello attuale del circuito: un link rigenerato non vale più.
 */
export const INVITE_COOKIE = "pf_invito";
export type Invite = { slug: string; token: string };

const SLUG = /^[a-z0-9-]{1,60}$/;
const TOKEN = /^[A-Za-z0-9_-]{8,64}$/;
const isInvite = (x: unknown): x is Invite =>
  Boolean(x && typeof x === "object" && SLUG.test(String((x as Invite).slug)) && TOKEN.test(String((x as Invite).token)));

/** Invito contenuto in un indirizzo di ritorno come «/partecipa/slug?invito=…». */
export function inviteFromPath(path: string | null | undefined): Invite | null {
  const m = /^\/partecipa\/([a-z0-9-]{1,60})\?(?:.*&)?invito=([A-Za-z0-9_-]{8,64})/.exec(path ?? "");
  return m ? { slug: m[1], token: m[2] } : null;
}

/** Invito ricordato nel cookie di questo browser. */
export async function cookieInvite(): Promise<Invite | null> {
  try {
    const v = JSON.parse((await cookies()).get(INVITE_COOKIE)?.value ?? "null");
    return isInvite(v) ? v : null;
  } catch { return null; }
}

/** Invito ricordato: prima il cookie, poi i dati dell'account collegato (registrazione su un altro dispositivo). */
export async function rememberedInvite(): Promise<Invite | null> {
  const fromCookie = await cookieInvite();
  if (fromCookie) return fromCookie;
  const { data } = await (await createServerSupabase()).auth.getUser();
  const v = data.user?.user_metadata?.invite;
  return isInvite(v) ? v : null;
}
