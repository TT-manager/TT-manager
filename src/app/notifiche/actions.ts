"use server";
import { refresh, revalidatePath } from "next/cache";
import { requireAccount } from "@/lib/account";
import { createServiceClient } from "@/lib/supabase/admin";
import { emailPrefs, markAllRead } from "@/lib/notifications";
import { tr } from "@/i18n/server";
import { notificationsText } from "@/i18n/dict/notifications";
import type { ActionState } from "@/components/action-form";

/** Aprendo la pagina delle notifiche si segnano come lette (la campanella si azzera). */
export async function markReadAction(): Promise<void> {
  const account = await requireAccount("/notifiche");
  await markAllRead(account.userId);
  revalidatePath("/", "layout");
}

export async function saveEmailPrefs(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const account = await requireAccount("/notifiche");
  await emailPrefs(account.userId); // crea la riga se manca
  await createServiceClient().from("notification_prefs")
    .update({ email_tournaments: formData.get("email_tournaments") === "on" }).eq("user_id", account.userId);
  refresh();
  return { ok: (await tr(notificationsText)).emailSaved };
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
