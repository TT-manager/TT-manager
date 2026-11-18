import "server-only";
import { createServiceClient } from "./supabase/admin";

/**
 * Modalità «solo amministratore»: la scheda giocatore dell'account viene resa non attiva
 * (sparisce da classifiche, iscrizioni e sfide, lo storico resta) oppure torna attiva.
 * Da chiamare solo dopo i controlli: l'amministratore per sé, o il proprietario per chiunque.
 * Prima la scheda, poi la scelta: se la scheda non si aggiorna non resta niente a metà.
 */
export async function setAdminOnly(userId: string, on: boolean): Promise<boolean> {
  const svc = createServiceClient();
  const { data: admin } = await svc.from("admins").select("user_id").eq("user_id", userId).maybeSingle();
  if (!admin) return false;
  const { error: e1 } = await svc.from("players").update({ active: !on }).eq("user_id", userId);
  if (e1) { console.error("Modalità solo amministratore: scheda non aggiornata:", e1.message); return false; }
  const { error: e2 } = await svc.from("admins").update({ admin_only: on }).eq("user_id", userId);
  if (e2) {
    await svc.from("players").update({ active: on }).eq("user_id", userId); // si torna com'era
    console.error("Modalità solo amministratore: scelta non salvata:", e2.message);
    return false;
  }
  return true;
}
