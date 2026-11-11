import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { verifyCode } from "./codes";
import { createServiceClient } from "./supabase/admin";

export const hasServiceKey = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const SESSION_HOURS = 24;
const WINDOW_MIN = 15;
const MAX_FAILS_PER_IP = 5;
const MAX_FAILS_PER_TOURNAMENT = 50;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const cookieName = (publicCode: string) => `tt_org_${publicCode}`;

async function clientIpHash(tournamentId: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "sconosciuto";
  return sha256(`${tournamentId}:${ip}`);
}

export type LoginResult = { ok: true } | { ok: false; error: string };

/** Verifica il codice organizzatore con limite ai tentativi; se giusto apre una sessione (cookie). */
export async function organizerLogin(publicCode: string, code: string): Promise<LoginResult> {
  const svc = createServiceClient();
  const { data: t } = await svc.from("tournaments")
    .select("id, status, organizer_code_hash").eq("public_code", publicCode).maybeSingle();
  if (!t) return { ok: false, error: "Torneo non trovato." };
  if (t.status === "closed") return { ok: false, error: "Il torneo è chiuso: i risultati non si possono più inserire." };

  const ipHash = await clientIpHash(t.id);
  const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();
  const [{ count: mine }, { count: all }] = await Promise.all([
    svc.from("organizer_attempts").select("id", { count: "exact", head: true })
      .eq("tournament_id", t.id).eq("ip_hash", ipHash).gte("created_at", since),
    svc.from("organizer_attempts").select("id", { count: "exact", head: true })
      .eq("tournament_id", t.id).gte("created_at", since),
  ]);
  if ((mine ?? 0) >= MAX_FAILS_PER_IP || (all ?? 0) >= MAX_FAILS_PER_TOURNAMENT)
    return { ok: false, error: `Troppi tentativi sbagliati. Riprova tra ${WINDOW_MIN} minuti.` };

  if (!(await verifyCode(code, t.organizer_code_hash))) {
    await svc.from("organizer_attempts").insert({ tournament_id: t.id, ip_hash: ipHash });
    const left = MAX_FAILS_PER_IP - (mine ?? 0) - 1;
    return { ok: false, error: left > 0 ? `Codice non valido. Tentativi rimasti: ${left}.` : `Codice non valido. Riprova tra ${WINDOW_MIN} minuti.` };
  }

  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_HOURS * 3600_000);
  const { error } = await svc.from("organizer_sessions")
    .insert({ token_hash: sha256(token), tournament_id: t.id, expires_at: expires.toISOString() });
  if (error) return { ok: false, error: "Accesso non riuscito, riprova." };
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
