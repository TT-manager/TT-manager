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
  if (!admin) redirect("/login");
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

/** Come sopra, partendo da un torneo. Restituisce anche il campionato del torneo. */
export async function requireTournamentManager(tournamentId: string): Promise<AdminInfo & { championshipId: string }> {
  const admin = await requireAdmin();
  const supabase = await createServerSupabase();
  const { data: t } = await supabase.from("tournaments").select("championship_id").eq("id", tournamentId).maybeSingle();
  // Con le regole del database la riga è leggibile solo da chi può gestire il campionato.
  if (!t) redirect("/admin");
  await requireChampionshipManager(t.championship_id as string);
  return { ...admin, championshipId: t.championship_id as string };
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
