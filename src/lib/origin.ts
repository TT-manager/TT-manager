import "server-only";
import { headers } from "next/headers";

/** Indirizzo del sito da cui arriva la richiesta (per i link da condividere o nelle email). */
export async function siteOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
