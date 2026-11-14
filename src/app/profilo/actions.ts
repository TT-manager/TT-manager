"use server";
import { refresh } from "next/cache";
import { attachToChampionship, requireAccount } from "@/lib/account";
import { randomBytes } from "node:crypto";
import { clearAvatar } from "@/lib/avatar-server";
import { imageKind } from "@/lib/avatar";
import { createServiceClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/components/action-form";
import { parseClubChoice } from "@/lib/clubs";
import { sameNameMatch } from "@/lib/names";
import { createClubRequest } from "@/lib/clubs-server";
import { getLocale, tr } from "@/i18n/server";
import { accountProfileText } from "@/i18n/dict/account-profile";
import { clubErrorText } from "@/i18n/dict/account-clubs";

const UUID = /^[0-9a-f-]{36}$/i;
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireAccount("/profilo");
  const t = await tr(accountProfileText);
  const fullName = str(formData, "full_name");
  if (fullName.length < 2 || fullName.length > 80) return { error: t.nameLength };
  const club = parseClubChoice((k) => formData.get(k));
  if ("error" in club) return { error: clubErrorText(club.error, await getLocale()) };
  const svc = createServiceClient();
  const update: { full_name: string; club_id?: string | null } = { full_name: fullName };
  if (club.kind !== "request") update.club_id = club.kind === "existing" ? club.clubId : null;
  const { error } = await svc.from("players").update(update).eq("id", account.player.id);
  if (error?.code === "23503") return { error: t.clubGone };
  if (error) return { error: t.saveFailed };
  if (club.kind === "request") {
    const r = await createClubRequest(account.userId, club.name, club.city);
    if (r.existingId) await svc.from("players").update({ club_id: r.existingId }).eq("id", account.player.id);
    refresh();
    if (r.existingId) return { ok: t.clubAlreadyListedAdded };
    if (r.error) return { error: r.error };
    return { ok: t.savedClubRequested };
  }
  refresh();
  return { ok: t.saved };
}

export async function cancelClubRequest(): Promise<ActionState> {
  const account = await requireAccount("/profilo");
  await createServiceClient().from("club_requests").delete().eq("user_id", account.userId).eq("status", "pending");
  refresh();
  return { ok: (await tr(accountProfileText)).requestCancelled };
}

/**
 * Richiesta di partecipazione. Con un invito valido e senza «sono già in classifica»
 * si entra subito; altrimenti la richiesta aspetta l'approvazione di un gestore.
 */
export async function requestJoin(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const slug = str(formData, "slug");
  const account = await requireAccount(`/partecipa/${slug}`);
  const t = await tr(accountProfileText);
  const svc = createServiceClient();
  const { data: c } = await svc.from("championships").select("id, name").eq("slug", slug).maybeSingle();
  if (!c) return { error: t.leagueNotFound };
  const claim = str(formData, "claim_player_id");
  let claimId: string | null = null;
  if (claim) {
    if (!UUID.test(claim)) return { error: t.invalidChoice };
    const { data: p } = await svc.from("championship_players").select("player_id, players!inner(user_id)")
      .eq("championship_id", c.id).eq("player_id", claim).is("players.user_id", null).maybeSingle();
    if (!p) return { error: t.playerUnavailable };
    claimId = claim;
  }
  const { data: already } = await svc.from("championship_players").select("player_id")
    .eq("championship_id", c.id).eq("player_id", account.player.id).maybeSingle();
  if (already) return { ok: t.alreadyMember };

  const token = str(formData, "invito");
  let viaInvite = false;
  if (token) {
    const { data: inv } = await svc.from("championship_invites").select("token").eq("championship_id", c.id).maybeSingle();
    if (!inv || inv.token !== token) return { error: t.inviteInvalid };
    viaInvite = true;
  }
  // Invito senza «sono già in classifica», ma c'è un omonimo senza account: deve averlo visto e scartato.
  if (viaInvite && !claimId && !str(formData, "seen_match")) {
    const { data: free } = await svc.from("championship_players").select("player_id, players!inner(full_name, user_id)")
      .eq("championship_id", c.id).is("players.user_id", null);
    const match = sameNameMatch(account.player.full_name,
      (free ?? []).map((f) => ({ id: f.player_id as string, name: (f.players as unknown as { full_name: string }).full_name })));
    if (match) return { error: t.sameNameExists(match.name) };
  }
  if (viaInvite && !claimId) {
    const r = await attachToChampionship(c.id, account.userId, null);
    if (r.error) return { error: r.error };
    await svc.from("championship_requests").insert({ championship_id: c.id, user_id: account.userId, via_invite: true, status: "approved", decided_at: new Date().toISOString() });
    refresh();
    return { ok: t.welcome(c.name) };
  }
  const { error } = await svc.from("championship_requests").insert({ championship_id: c.id, user_id: account.userId, claim_player_id: claimId, via_invite: viaInvite });
  if (error?.code === "23505") return { ok: t.alreadyRequested };
  if (error) return { error: t.requestFailed };
  refresh();
  return { ok: t.requestSent };
}

export async function cancelRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireAccount("/profilo");
  const t = await tr(accountProfileText);
  const { error } = await createServiceClient().from("championship_requests").delete()
    .eq("id", Number(str(formData, "request_id"))).eq("user_id", account.userId).eq("status", "pending");
  if (error) return { error: t.cancelFailed };
  refresh();
  return { ok: t.requestCancelled };
}

// ── Foto profilo ──────────────────────────────────────────────────────────
const MAX_PHOTO = 512 * 1024;

/** Carica la foto (già ritagliata e rimpicciolita dal browser). Solo per la propria scheda. */
export async function uploadAvatar(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireAccount("/profilo");
  const t = await tr(accountProfileText);
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { error: t.choosePhoto };
  if (file.size > MAX_PHOTO) return { error: t.photoTooBig };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = imageKind(bytes);
  if (!kind) return { error: t.photoFormat };
  const svc = createServiceClient();
  const path = `${account.player.id}/${randomBytes(12).toString("base64url")}.${kind}`;
  const { error } = await svc.storage.from("avatars").upload(path, bytes, { contentType: kind === "webp" ? "image/webp" : "image/jpeg", upsert: false });
  if (error) return { error: t.photoUploadFailed };
  const { data: old } = await svc.from("players").select("avatar_path").eq("id", account.player.id).maybeSingle();
  const { error: e2 } = await svc.from("players").update({ avatar_path: path }).eq("id", account.player.id);
  if (e2) { await svc.storage.from("avatars").remove([path]); return { error: t.photoSaveFailed }; }
  if (old?.avatar_path) await svc.storage.from("avatars").remove([old.avatar_path as string]);
  refresh();
  return { ok: t.photoUpdated };
}

export async function removeAvatar(): Promise<ActionState> {
  const account = await requireAccount("/profilo");
  await clearAvatar(account.player.id);
  refresh();
  return { ok: (await tr(accountProfileText)).photoRemoved };
}
