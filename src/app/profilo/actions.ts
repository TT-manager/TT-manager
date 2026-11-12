"use server";
import { refresh } from "next/cache";
import { attachToChampionship, requireAccount } from "@/lib/account";
import { randomBytes } from "node:crypto";
import { clearAvatar } from "@/lib/avatar-server";
import { imageKind } from "@/lib/avatar";
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

// ── Foto profilo ──────────────────────────────────────────────────────────
const MAX_PHOTO = 512 * 1024;

/** Carica la foto (già ritagliata e rimpicciolita dal browser). Solo per la propria scheda. */
export async function uploadAvatar(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireAccount("/profilo");
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: "Scegli una foto." };
  if (file.size > MAX_PHOTO) return { error: "Foto troppo pesante: riprova con un'altra." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = imageKind(bytes);
  if (!kind) return { error: "Formato non valido: usa una foto JPEG, PNG o simile." };
  const svc = createServiceClient();
  const path = `${account.player.id}/${randomBytes(12).toString("base64url")}.${kind}`;
  const { error } = await svc.storage.from("avatars").upload(path, bytes, { contentType: kind === "webp" ? "image/webp" : "image/jpeg", upsert: false });
  if (error) return { error: "Non sono riuscito a caricare la foto." };
  const { data: old } = await svc.from("players").select("avatar_path").eq("id", account.player.id).maybeSingle();
  const { error: e2 } = await svc.from("players").update({ avatar_path: path }).eq("id", account.player.id);
  if (e2) { await svc.storage.from("avatars").remove([path]); return { error: "Non sono riuscito a salvare la foto." }; }
  if (old?.avatar_path) await svc.storage.from("avatars").remove([old.avatar_path as string]);
  refresh();
  return { ok: "Foto aggiornata." };
}

export async function removeAvatar(): Promise<ActionState> {
  const account = await requireAccount("/profilo");
  await clearAvatar(account.player.id);
  refresh();
  return { ok: "Foto tolta." };
}
