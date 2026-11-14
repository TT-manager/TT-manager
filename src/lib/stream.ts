import type { Locale } from "../i18n/locale";
import { publicStreamText } from "../i18n/dict/public-tournament";

/** Link della diretta: solo https, senza spazi, al massimo 300 caratteri. Vuoto = nessuna diretta. Errori nella lingua indicata. */
export function parseStreamUrl(raw: string, l: Locale = "it"): { url: string | null } | { error: string } {
  const tx = publicStreamText[l];
  const s = raw.trim();
  if (!s) return { url: null };
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return { error: tx.invalid }; }
  if (u.protocol === "http:") u.protocol = "https:";
  if (u.protocol !== "https:" || !u.hostname.includes(".")) return { error: tx.invalid };
  const url = u.toString();
  if (url.length > 300 || /[\s<>"]/.test(url)) return { error: tx.tooLong };
  return { url };
}

/** Nome della piattaforma per il pulsante («Guarda su YouTube»), o null se sconosciuta. */
export function streamPlatform(url: string): string | null {
  let host: string;
  try { host = new URL(url).hostname.replace(/^www\.|^m\./, ""); } catch { return null; }
  if (host === "youtu.be" || host.endsWith("youtube.com")) return "YouTube";
  if (host.endsWith("twitch.tv")) return "Twitch";
  if (host === "fb.watch" || host.endsWith("facebook.com")) return "Facebook";
  if (host.endsWith("instagram.com")) return "Instagram";
  if (host.endsWith("tiktok.com")) return "TikTok";
  return null;
}
