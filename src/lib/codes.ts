/**
 * Codici dei tornei.
 * - Codice pubblico (6 caratteri): serve solo ad aprire /t/CODICE, non è segreto.
 * - Codice organizzatore (10 caratteri, ~50 bit): permette di inserire risultati.
 *   Viene mostrato UNA volta e nel database se ne salva solo l'impronta (scrypt + sale).
 *
 * Alfabeto senza caratteri ambigui (niente 0/O, 1/I/L).
 */
import { randomInt, randomBytes, scrypt, timingSafeEqual } from "node:crypto";

export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function randomCode(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return out;
}

export const newPublicCode = () => randomCode(6);
export const newOrganizerCode = () => randomCode(10);

/** Toglie spazi e trattini, maiuscolo: "abcde-fghjk" -> "ABCDEFGHJK". */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[\s-]/g, "");
}

/** Per mostrarlo: "ABCDEFGHJK" -> "ABCDE-FGHJK". */
export function formatOrganizerCode(code: string): string {
  return code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

// Parametri scrypt: N=2^15, r=8, p=1 (~32 MB, qualche decina di ms).
const N = 2 ** 15, R = 8, P = 1, KEYLEN = 32;

function scryptAsync(secret: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(secret, salt, KEYLEN, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, key) =>
      err ? reject(err) : resolve(key)));
}

/** Formato salvato: scrypt$N$r$p$saleBase64$impronta Base64 */
export async function hashCode(code: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(normalizeCode(code), salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyCode(code: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [n, r, p] = parts.slice(1, 4).map(Number);
  if (![n, r, p].every(Number.isInteger) || n > 2 ** 17) return false;
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  const actual = await scryptAsync(normalizeCode(code), salt, n, r, p);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * Indirizzo del client. Su Vercel `x-real-ip` / `x-vercel-forwarded-for` sono impostati
 * dalla piattaforma (non dal client). Gli IPv6 sono raggruppati per rete /64, così
 * cambiare indirizzo all'interno della stessa rete non aggira il limite.
 */
export function clientKey(raw: string | null): string {
  const ip = (raw ?? "").split(",")[0].trim() || "sconosciuto";
  if (!ip.includes(":")) return ip;
  const parts = ip.split("::")[0].split(":");
  return `${parts.slice(0, 4).join(":")}::/64`;
}
