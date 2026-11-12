import "server-only";
import { redirect } from "next/navigation";
import { createServerSupabase } from "./supabase/server";

export type AdminInfo = { userId: string; email: string; role: "owner" | "admin" };

/** Restituisce l'admin loggato, oppure null. Verifica sempre sul database, non solo sul cookie. */
export async function getAdmin(): Promise<AdminInfo | null> {
  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;
  const { data } = await supabase.from("admins").select("role").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  return { userId, email: String(claims?.claims.email ?? ""), role: data.role as "owner" | "admin" };
}

export async function requireAdmin(): Promise<AdminInfo> {
  const admin = await getAdmin();
  if (!admin) {
    // Chi ha un account da giocatore ma non è amministratore va al suo profilo.
    const { data } = await (await createServerSupabase()).auth.getClaims();
    redirect(data?.claims?.sub ? "/profilo" : "/login?next=/admin");
  }
  return admin;
}

export async function requireOwner(): Promise<AdminInfo> {
  const admin = await requireAdmin();
  if (admin.role !== "owner") redirect("/admin");
  return admin;
}

/**
 * Verifica che l'admin loggato possa gestire il campionato (proprietario o admin del campionato).
 * Usa la sessione dell'utente: la riga è visibile solo se le regole del database lo consentono.
 * Da chiamare SEMPRE prima di scritture con la chiave segreta.
 */
export async function requireChampionshipManager(championshipId: string): Promise<AdminInfo> {
  const admin = await requireAdmin();
  if (admin.role === "owner") return admin;
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("championship_admins").select("user_id")
    .eq("championship_id", championshipId).eq("user_id", admin.userId).maybeSingle();
  if (!data) redirect("/admin");
  return admin;
}

export type TournamentAccess = {
  userId: string; isAdmin: boolean;
  championshipId: string | null; ownerUserId: string | null; ranked: boolean; kind: "singles" | "doubles";
};

/**
 * Verifica che chi è collegato possa gestire il torneo: proprietario, admin del campionato
 * o, per gli amichevoli degli utenti, chi lo ha creato. La riga del torneo è leggibile
 * solo se le regole del database lo consentono, quindi la lettura stessa è il controllo.
 * Da chiamare SEMPRE prima di scritture con la chiave segreta.
 */
export async function requireTournamentManager(tournamentId: string): Promise<TournamentAccess> {
  const supabase = await createServerSupabase();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) redirect(`/login?next=${encodeURIComponent(`/gestione/${tournamentId}`)}`);
  const [{ data: t }, { data: admin }] = await Promise.all([
    supabase.from("tournaments").select("championship_id, owner_user_id, ranked, kind").eq("id", tournamentId).maybeSingle(),
    supabase.from("admins").select("role").eq("user_id", userId).maybeSingle(),
  ]);
  if (!t) redirect(admin ? "/admin" : "/profilo");
  return {
    userId, isAdmin: Boolean(admin),
    championshipId: t.championship_id as string | null, ownerUserId: t.owner_user_id as string | null,
    ranked: t.ranked as boolean, kind: t.kind as "singles" | "doubles",
  };
}

/** Campionati che l'admin loggato può gestire. */
export async function managedChampionships() {
  const admin = await requireAdmin();
  const supabase = await createServerSupabase();
  const { data: all } = await supabase.from("championships").select("id, name, slug, kind, settings").order("name");
  if (admin.role === "owner") return all ?? [];
  const { data: mine } = await supabase.from("championship_admins").select("championship_id").eq("user_id", admin.userId);
  const ids = new Set((mine ?? []).map((r) => r.championship_id as string));
  return (all ?? []).filter((c) => ids.has(c.id as string));
}
