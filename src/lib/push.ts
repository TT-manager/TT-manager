import "server-only";
import webpush from "web-push";
import { createServiceClient } from "./supabase/admin";
import { SITE_URL } from "./email";
import type { NotificationKind } from "./notifications";
import { notificationsText } from "@/i18n/dict/notifications";

/**
 * Notifiche push: solo per le cose importanti. Le altre restano nella campanella dell'app.
 * Sfida ricevuta, risultato da confermare, nuovo torneo aperto o iniziato, avviso dell'organizzazione.
 */
export const PUSH_KINDS: ReadonlySet<NotificationKind> = new Set<NotificationKind>([
  "challenge_received", "challenge_result", "tournament_open", "tournament_started", "announcement",
]);

/** Contatto per i servizi di notifica (obbligatorio per le chiavi VAPID): l'indirizzo del sito. */
const CONTACT = SITE_URL;

let cached: { publicKey: string; privateKey: string } | null = null;

/**
 * Chiavi del sito per firmare le notifiche: create la prima volta e custodite nel database
 * (schema privato, leggibili solo dal server). Non passano mai da variabili d'ambiente o dal codice.
 */
export async function pushKeys(): Promise<{ publicKey: string; privateKey: string } | null> {
  if (cached) return cached;
  const svc = createServiceClient();
  const read = async () => {
    const { data } = await svc.rpc("push_keys_get");
    const row = (data as { public_key: string; private_key: string }[] | null)?.[0];
    return row ? { publicKey: row.public_key, privateKey: row.private_key } : null;
  };
  let keys = await read();
  if (!keys) {
    const fresh = webpush.generateVAPIDKeys();
    await svc.rpc("push_keys_init", { p_public: fresh.publicKey, p_private: fresh.privateKey });
    keys = await read(); // se due richieste le creano insieme, vince la prima: si rilegge quella salvata
  }
  if (keys) cached = keys;
  return keys;
}

/** Chiave pubblica da dare al browser per attivare le notifiche. */
export async function pushPublicKey(): Promise<string | null> {
  return (await pushKeys())?.publicKey ?? null;
}

/**
 * Manda la notifica a tutti i dispositivi degli account indicati, nella lingua scelta su ciascun dispositivo.
 * I dispositivi non più validi (notifiche disattivate o app disinstallata) vengono tolti.
 */
export async function sendPush(userIds: string[], kind: NotificationKind, params: Record<string, string>, href: string) {
  if (!userIds.length || !PUSH_KINDS.has(kind)) return;
  const keys = await pushKeys();
  if (!keys) return;
  const svc = createServiceClient();
  const { data: subs } = await svc.from("push_subscriptions").select("id, endpoint, p256dh, auth, locale").in("user_id", userIds);
  if (!subs?.length) return;
  const gone: number[] = [];
  await Promise.all(subs.map(async (s) => {
    const tx = notificationsText[s.locale === "en" ? "en" : "it"];
    const payload = JSON.stringify({ title: "PongFu", body: tx.text(kind, params), url: href, tag: `${kind}:${href}` });
    try {
      await webpush.sendNotification({ endpoint: s.endpoint as string, keys: { p256dh: s.p256dh as string, auth: s.auth as string } }, payload, {
        vapidDetails: { subject: CONTACT, publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 60 * 60 * 24,
      });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(s.id as number);
      else console.error("Notifica push non inviata:", code ?? (e as Error).message);
    }
  }));
  if (gone.length) await svc.from("push_subscriptions").delete().in("id", gone);
}
