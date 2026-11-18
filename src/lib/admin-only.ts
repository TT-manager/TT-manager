import "server-only";
import { createServiceClient } from "./supabase/admin";

/**
 * Modalità «solo amministratore»: la scheda giocatore dell'account viene resa non attiva
 * (sparisce da classifiche, iscrizioni e sfide, lo storico resta) oppure torna attiva.
 * Da chiamare solo dopo i controlli: l'amministratore per sé, o il proprietario per chiunque.
 */
export async function setAdminOnly(userId: string, on: boolean): Promise<boolean> {
  const svc = createServiceClient();
  const { data, error } = await svc.from("admins").update({ admin_only: on }).eq("user_id", userId).select("user_id");
  if (error || !data?.length) return false;
  const { error: e2 } = await svc.from("players").update({ active: !on }).eq("user_id", userId);
  return !e2;
}
