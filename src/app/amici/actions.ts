"use server";
import { refresh } from "next/cache";
import { requireAccount } from "@/lib/account";
import { createServiceClient } from "@/lib/supabase/admin";
import type { ActionState } from "@/components/action-form";
import { tr } from "@/i18n/server";
import { accountFriendsText } from "@/i18n/dict/account-friends";

const UUID = /^[0-9a-f-]{36}$/i;
const pair = (x: string, y: string) => (x < y ? { user_a: x, user_b: y } : { user_a: y, user_b: x });

/** Richiesta d'amicizia a un giocatore che ha un account. Se lui l'aveva già chiesta a te, diventate amici. */
export async function sendFriendRequest(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireAccount("/amici");
  const t = await tr(accountFriendsText);
  const playerId = String(formData.get("player_id") ?? "");
  if (!UUID.test(playerId)) return { error: t.invalidPlayer };
  const svc = createServiceClient();
  const { data: target } = await svc.from("players").select("user_id, full_name").eq("id", playerId).maybeSingle();
  if (!target?.user_id) return { error: t.noAccount };
  if (target.user_id === me.userId) return { error: t.itsYou };
  const key = pair(me.userId, target.user_id as string);
  const { data: existing } = await svc.from("friendships").select("status, requested_by").match(key).maybeSingle();
  if (existing?.status === "accepted") return { ok: t.alreadyFriendsWith(target.full_name) };
  if (existing && existing.requested_by !== me.userId) {
    await svc.from("friendships").update({ status: "accepted" }).match(key);
    refresh();
    return { ok: t.nowFriends(target.full_name) };
  }
  if (existing) return { ok: t.alreadySent };
  const { count } = await svc.from("friendships").select("user_a", { count: "exact", head: true })
    .eq("requested_by", me.userId).eq("status", "pending");
  if ((count ?? 0) >= 50) return { error: t.tooManyPending };
  const { error } = await svc.from("friendships").insert({ ...key, requested_by: me.userId });
  if (error) return { error: t.sendFailed };
  refresh();
  return { ok: t.sentTo(target.full_name) };
}

/** Accetta, rifiuta, annulla o rimuove un'amicizia con l'utente `other`. */
export async function answerFriend(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const me = await requireAccount("/amici");
  const t = await tr(accountFriendsText);
  const other = String(formData.get("user_id") ?? "");
  if (!UUID.test(other)) return { error: t.invalidChoice };
  const key = pair(me.userId, other);
  const svc = createServiceClient();
  const { data: f } = await svc.from("friendships").select("status, requested_by").match(key).maybeSingle();
  if (!f) return { error: t.notFound };
  if (formData.get("decision") === "accept") {
    if (f.requested_by === me.userId) return { error: t.otherMustAccept };
    await svc.from("friendships").update({ status: "accepted" }).match(key);
    refresh();
    return { ok: t.accepted };
  }
  await svc.from("friendships").delete().match(key);
  refresh();
  return { ok: f.status === "accepted" ? t.removed : t.deleted };
}
