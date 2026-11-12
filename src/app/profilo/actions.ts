"use server";
import { refresh } from "next/cache";
import { attachToChampionship, requireAccount } from "@/lib/account";
import { createServiceClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/components/action-form";

const UUID = /^[0-9a-f-]{36}$/i;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireAccount("/profilo");
  const fullName = str(formData, "full_name"), club = str(formData, "club");
  if (fullName.length < 2 || fullName.length > 80 || club.length > 80) return { error: "Nome (2-80 caratteri) o circolo non validi." };
  const { error } = await createServiceClient().from("players").update({ full_name: fullName, club: club || null }).eq("id", account.player.id);
  if (error) return { error: "Non sono riuscito a salvare." };
  refresh();
  return { ok: "Salvato." };
}

/**
 * Richiesta di partecipazione. Con un invito valido e senza «sono già in classifica»
 * si entra subito; altrimenti la richiesta aspetta l'approvazione di un gestore.
 */
export async function requestJoin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = str(formData, "slug");
  const account = await requireAccount(`/partecipa/${slug}`);
  const svc = createServiceClient();
  const { data: c } = await svc.from("championships").select("id, name").eq("slug", slug).maybeSingle();
  if (!c) return { error: "Campionato non trovato." };
  const claim = str(formData, "claim_player_id");
  let claimId: string | null = null;
  if (claim) {
    if (!UUID.test(claim)) return { error: "Scelta non valida." };
    const { data: p } = await svc.from("championship_players").select("player_id, players!inner(user_id)")
      .eq("championship_id", c.id).eq("player_id", claim).is("players.user_id", null).maybeSingle();
    if (!p) return { error: "Quel giocatore non è disponibile: scegli di nuovo." };
    claimId = claim;
  }
  const { data: already } = await svc.from("championship_players").select("player_id")
    .eq("championship_id", c.id).eq("player_id", account.player.id).maybeSingle();
  if (already) return { ok: "Fai già parte del campionato." };

  const token = str(formData, "invito");
  let viaInvite = false;
  if (token) {
    const { data: inv } = await svc.from("championship_invites").select("token").eq("championship_id", c.id).maybeSingle();
    if (!inv || inv.token !== token) return { error: "Il link d'invito non è più valido: chiedine uno nuovo, oppure invia una richiesta normale." };
    viaInvite = true;
  }
  if (viaInvite && !claimId) {
    const r = await attachToChampionship(c.id, account.userId, null);
    if (r.error) return { error: r.error };
    await svc.from("championship_requests").insert({ championship_id: c.id, user_id: account.userId, via_invite: true, status: "approved", decided_at: new Date().toISOString() });
    refresh();
    return { ok: `Benvenuto in ${c.name}!` };
  }
  const { error } = await svc.from("championship_requests").insert({ championship_id: c.id, user_id: account.userId, claim_player_id: claimId, via_invite: viaInvite });
  if (error?.code === "23505") return { ok: "Hai già una richiesta in attesa per questo campionato." };
  if (error) return { error: "Non sono riuscito a inviare la richiesta." };
  refresh();
  return { ok: "Richiesta inviata: un amministratore del campionato la approverà a breve." };
}

export async function cancelRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireAccount("/profilo");
  const { error } = await createServiceClient().from("championship_requests").delete()
    .eq("id", Number(str(formData, "request_id"))).eq("user_id", account.userId).eq("status", "pending");
  if (error) return { error: "Non sono riuscito ad annullarla." };
  refresh();
  return { ok: "Richiesta annullata." };
}
