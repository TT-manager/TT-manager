import "server-only";
import { createServiceClient } from "./supabase/admin";
import { createServerSupabase } from "./supabase/server";
import type { Club } from "./clubs";

/** Elenco dei circoli approvati, in ordine alfabetico. */
export async function listClubs(): Promise<Club[]> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.from("clubs").select("id, name, city").order("name");
  return (data ?? []) as Club[];
}

/** Registra la richiesta di un circolo nuovo (una sola in attesa per utente). Solo dopo i controlli. */
export async function createClubRequest(userId: string, name: string, city: string | null): Promise<{ error?: string; existingId?: string }> {
  const svc = createServiceClient();
  const { data: existing } = await svc.from("clubs").select("id, name").ilike("name", name.replace(/[%_\\]/g, "\\$&")).maybeSingle();
  if (existing) return { error: `«${existing.name}» è già nell'elenco: sceglilo dal menu.`, existingId: existing.id as string };
  const { error } = await svc.from("club_requests").insert({ user_id: userId, name, city });
  if (error?.code === "23505") return { error: "Hai già una richiesta di circolo in attesa." };
  return error ? { error: "Non sono riuscito a inviare la richiesta." } : {};
}
