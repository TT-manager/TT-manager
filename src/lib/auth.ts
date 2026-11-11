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
