"use server";
import { refresh, revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/account";
import { createServiceClient } from "@/lib/supabase/admin";
import { emailPrefs, markAllRead } from "@/lib/notifications";
import { getLocale, tr } from "@/i18n/server";
import { notificationsText } from "@/i18n/dict/notifications";
import type { ActionState } from "@/components/action-form";

const ID = /^\d{1,18}$/; // le notifiche hanno un numero come codice

/** Cancella una notifica (solo tra le proprie). */
export async function deleteNotificationAction(formData: FormData): Promise<void> {
  const account = await requireAccount("/notifiche");
  const id = String(formData.get("id") ?? "");
  if (!ID.test(id)) return;
  await createServiceClient().from("notifications").delete().eq("id", id).eq("user_id", account.userId);
  refresh();
}

/** Cancella tutte le proprie notifiche. */
export async function deleteAllNotificationsAction(): Promise<ActionState> {
  const account = await requireAccount("/notifiche");
  await createServiceClient().from("notifications").delete().eq("user_id", account.userId);
  revalidatePath("/", "layout");
  refresh();
  return {};
}

/** Aprendo la pagina delle notifiche si segnano come lette (la campanella si azzera). */
export async function markReadAction(): Promise<void> {
  const account = await requireAccount("/notifiche");
  await markAllRead(account.userId);
  revalidatePath("/", "layout");
}

export async function setEmailTournaments(on: boolean): Promise<void> {
  const account = await requireAccount("/notifiche");
  await emailPrefs(account.userId); // crea la riga se manca
  await createServiceClient().from("notification_prefs").update({ email_tournaments: Boolean(on) }).eq("user_id", account.userId);
}

/** Link «non ricevere più» delle email: funziona senza accesso, con il codice personale. */
export async function unsubscribeAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const t = await tr(notificationsText);
  const token = String(formData.get("t") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(token)) return { error: t.unsubInvalid };
  const { data } = await createServiceClient().from("notification_prefs").update({ email_tournaments: false })
    .eq("unsubscribe_token", token).select("user_id");
  return data?.length ? { ok: t.unsubDone } : { error: t.unsubInvalid };
}

/** Il dispositivo ha attivato le notifiche push: se ne salva l'indirizzo, legato all'account e alla lingua. */
export async function savePushSubscription(sub: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } }): Promise<boolean> {
  const account = await requireAccount("/notifiche");
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth : "";
  if (!/^https:\/\/\S{5,1000}$/.test(endpoint) || p256dh.length < 10 || p256dh.length > 200 || auth.length < 8 || auth.length > 100) return false;
  const locale = (await getLocale()) === "en" ? "en" : "it";
  // Lo stesso dispositivo può passare a un altro account: l'indirizzo resta uno solo.
  const { error } = await createServiceClient().from("push_subscriptions")
    .upsert({ user_id: account.userId, endpoint, p256dh, auth, locale }, { onConflict: "endpoint" });
  return !error;
}

/** Il dispositivo ha disattivato le notifiche push: si toglie il suo indirizzo (solo se è di questo account). */
export async function removePushSubscription(endpoint: string): Promise<void> {
  const account = await requireAccount("/notifiche");
  if (typeof endpoint !== "string" || endpoint.length > 1000) return;
  await createServiceClient().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", account.userId);
}
