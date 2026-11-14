import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { clientKey, verifyCode } from "./codes";
import { createServiceClient } from "./supabase/admin";
import { tr } from "../i18n/server";
import { publicOrganizerText } from "../i18n/dict/public-tournament";

export const hasServiceKey = () => Boolean(process.env.SUPABASE_SECRET_KEY);

const SESSION_HOURS = 24;
const WINDOW_MIN = 15;
const MAX_ATTEMPTS_PER_IP = 5;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const cookieName = (publicCode: string) => `tt_org_${publicCode}`;

async function clientIpHash(tournamentId: string) {
  const h = await headers();
  const ip = clientKey(h.get("x-vercel-forwarded-for") ?? h.get("x-real-ip"));
  return sha256(`${tournamentId}:${ip}`);
}

export type LoginResult = { ok: true } | { ok: false; error: string };

/** Verifica il codice organizzatore con limite ai tentativi; se giusto apre una sessione (cookie). */
export async function organizerLogin(publicCode: string, code: string): Promise<LoginResult> {
  const tx = await tr(publicOrganizerText);
  const svc = createServiceClient();
  const { data: t } = await svc.from("tournaments")
    .select("id, status, organizer_code_hash").eq("public_code", publicCode).maybeSingle();
  if (!t) return { ok: false, error: tx.notFound };
  if (t.status === "closed") return { ok: false, error: tx.closedNoResults };

  // Il tentativo viene registrato PRIMA della verifica, in modo atomico nel database:
  // richieste parallele non possono superare il limite. Se la registrazione fallisce, si nega.
  const ipHash = await clientIpHash(t.id);
  const { data: attemptId, error: attemptError } = await svc.rpc("organizer_attempt_begin", {
    p_tournament: t.id, p_ip: ipHash, p_max: MAX_ATTEMPTS_PER_IP, p_window_min: WINDOW_MIN,
  });
  if (attemptError) return { ok: false, error: tx.checkUnavailable };
  if (attemptId === null) return { ok: false, error: tx.tooManyAttempts(WINDOW_MIN) };

  if (!(await verifyCode(code, t.organizer_code_hash)))
    return { ok: false, error: tx.invalidCode };
  // Codice giusto: il tentativo non conta come errore.
  await svc.from("organizer_attempts").delete().eq("id", attemptId);

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);
  const { error } = await svc.from("organizer_sessions")
    .insert({ token_hash: sha256(token), tournament_id: t.id, expires_at: expires.toISOString() });
  if (error) return { ok: false, error: tx.loginFailed };
  (await cookies()).set(cookieName(publicCode), token, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: `/t/${publicCode}`, expires,
  });
  return { ok: true };
}

/** Id del torneo se chi chiama ha una sessione organizzatore valida per questo codice pubblico. */
export async function organizerTournamentId(publicCode: string): Promise<string | null> {
  if (!hasServiceKey()) return null;
  const token = (await cookies()).get(cookieName(publicCode))?.value;
  if (!token) return null;
  const svc = createServiceClient();
  const { data } = await svc.from("organizer_sessions").select("tournament_id, expires_at, tournaments!inner(public_code)")
    .eq("token_hash", sha256(token)).maybeSingle();
  if (!data || new Date(data.expires_at) < new Date()) return null;
  const pc = (data.tournaments as unknown as { public_code: string }).public_code;
  return pc === publicCode ? (data.tournament_id as string) : null;
}

export async function organizerLogout(publicCode: string) {
  const store = await cookies();
  const token = store.get(cookieName(publicCode))?.value;
  if (token && hasServiceKey()) await createServiceClient().from("organizer_sessions").delete().eq("token_hash", sha256(token));
  store.delete({ name: cookieName(publicCode), path: `/t/${publicCode}` });
}

/** Chiude tutte le sessioni organizzatore di un torneo (es. dopo aver rigenerato il codice). */
export async function revokeOrganizerSessions(tournamentId: string) {
  if (!hasServiceKey()) return;
  await createServiceClient().from("organizer_sessions").delete().eq("tournament_id", tournamentId);
}
