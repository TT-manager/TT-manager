import "server-only";
import { createServiceClient } from "./supabase/admin";
import { hasServiceKey } from "./organizer";
import { SITE_URL, esc, hasEmail, sendEmail } from "./email";
import { registrationIsOpen } from "./registration";
import { notificationsText } from "@/i18n/dict/notifications";

/**
 * Avvisi nell'app (campanella) e, per i nuovi tornei, email.
 * Un avviso mancato non deve mai far fallire l'operazione che lo genera: gli errori si annotano e basta.
 */
export type NotificationKind =
  | "challenge_received" | "challenge_accepted" | "challenge_declined" | "challenge_cancelled" | "challenge_result"
  | "challenge_confirmed" | "challenge_disputed" | "challenge_decided" | "match_result" | "tournament_started"
  | "tournament_open" | "friend_request" | "friend_accepted" | "join_approved";

/** Avviso a una lista di account (senza doppioni e senza chi ha fatto l'azione). */
export async function notifyUsers(userIds: (string | null | undefined)[], kind: NotificationKind, params: Record<string, string>, href: string, exceptUserId?: string) {
  const ids = [...new Set(userIds.filter((x): x is string => Boolean(x) && x !== exceptUserId))];
  if (!ids.length || !hasServiceKey()) return;
  const { error } = await createServiceClient().from("notifications").insert(ids.map((user_id) => ({ user_id, kind, params, href })));
  if (error) console.error("Notifica non salvata:", kind, error.message);
}

/** Come notifyUsers, ma partendo dalle schede dei giocatori (chi non ha un account non riceve nulla). */
export async function notifyPlayers(playerIds: (string | null | undefined)[], kind: NotificationKind, params: Record<string, string>, href: string, exceptPlayerId?: string) {
  const ids = [...new Set(playerIds.filter((x): x is string => Boolean(x) && x !== exceptPlayerId))];
  if (!ids.length || !hasServiceKey()) return;
  const { data } = await createServiceClient().from("players").select("user_id").in("id", ids).not("user_id", "is", null);
  await notifyUsers((data ?? []).map((r) => r.user_id as string), kind, params, href);
}

/** Nome di un giocatore (per i testi degli avvisi). */
export async function nameOf(playerId: string | null | undefined) {
  if (!playerId) return "?";
  const { data } = await createServiceClient().from("players").select("full_name").eq("id", playerId).maybeSingle();
  return (data?.full_name as string | undefined) ?? "?";
}

export async function unreadCount(userId: string) {
  const { count } = await createServiceClient().from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", userId).is("read_at", null);
  return count ?? 0;
}

export async function listNotifications(userId: string) {
  const { data } = await createServiceClient().from("notifications").select("id, kind, params, href, read_at, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(60);
  return (data ?? []) as { id: number; kind: string; params: Record<string, string>; href: string; read_at: string | null; created_at: string }[];
}

export async function markAllRead(userId: string) {
  await createServiceClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
}

/** Avvisi più vecchi di 90 giorni: si cancellano (dal controllo giornaliero). */
export async function pruneNotifications() {
  await createServiceClient().from("notifications").delete().lt("created_at", new Date(Date.now() - 90 * 86400000).toISOString());
}

/** Preferenze email di un account (riga creata alla prima lettura). */
export async function emailPrefs(userId: string) {
  const svc = createServiceClient();
  await svc.from("notification_prefs").upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
  const { data } = await svc.from("notification_prefs").select("email_tournaments, unsubscribe_token").eq("user_id", userId).single();
  return data as { email_tournaments: boolean; unsubscribe_token: string };
}

/**
 * Annuncia un torneo di circuito con le iscrizioni aperte: avviso nell'app a tutti i membri con un account
 * ed email a chi non le ha disattivate. Una volta sola per torneo (anche se le iscrizioni si chiudono e riaprono).
 */
export async function announceTournament(tournamentId: string) {
  if (!hasServiceKey()) return;
  const svc = createServiceClient();
  const { data: t } = await svc.from("tournaments")
    .select("id, name, public_code, championship_id, status, registration_open, registration_deadline, starts_on, announced_at, championships(name)")
    .eq("id", tournamentId).maybeSingle();
  if (!t || t.announced_at || !t.championship_id || !registrationIsOpen(t)) return;
  // Si segna come annunciato prima di inviare: due chiamate insieme non mandano due email.
  const { data: claimed } = await svc.from("tournaments").update({ announced_at: new Date().toISOString() })
    .eq("id", tournamentId).is("announced_at", null).select("id");
  if (!claimed?.length) return;
  const league = (t.championships as unknown as { name: string } | null)?.name ?? "";
  const href = `/t/${t.public_code}`;
  const { data: members } = await svc.from("championship_players").select("players!inner(user_id, active)")
    .eq("championship_id", t.championship_id).not("players.user_id", "is", null).eq("players.active", true);
  const users = [...new Set(((members ?? []) as unknown as { players: { user_id: string } }[]).map((m) => m.players.user_id))];
  await notifyUsers(users, "tournament_open", { tournament: t.name as string, league }, href);
  if (!hasEmail() || !users.length) return;

  const tx = notificationsText.it; // email in italiano: la lingua di ognuno non è salvata nell'account
  const { data: prefs } = await svc.from("notification_prefs").select("user_id, email_tournaments").in("user_id", users);
  const off = new Set((prefs ?? []).filter((p) => !p.email_tournaments).map((p) => p.user_id as string));
  const fmt = (iso: string, time: boolean) => new Date(iso).toLocaleString("it-IT", {
    timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", ...(time ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
  for (const userId of users.filter((u) => !off.has(u))) {
    try {
      const [{ data: u }, pref] = await Promise.all([svc.auth.admin.getUserById(userId), emailPrefs(userId)]);
      if (!u.user?.email) continue;
      const unsub = `${SITE_URL}/notifiche/disiscriviti?t=${pref.unsubscribe_token}`;
      const lines = [tx.mailIntro(league), t.starts_on ? tx.mailWhen(fmt(`${t.starts_on}T12:00:00Z`, false)) : "",
        t.registration_deadline ? tx.mailDeadline(fmt(t.registration_deadline as string, true)) : ""].filter(Boolean);
      const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:auto;color:#111">
<h1 style="font-size:22px;margin:0 0 12px">${esc(t.name as string)}</h1>
${lines.map((l) => `<p style="margin:0 0 8px">${esc(l)}</p>`).join("")}
<p style="margin:24px 0"><a href="${SITE_URL}${href}" style="background:#d6181f;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">${esc(tx.mailCta)}</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#888">${esc(tx.mailFooter)} <a href="${unsub}" style="color:#888">${esc(tx.mailUnsub)}</a></p></div>`;
      const text = [t.name as string, "", ...lines, "", `${tx.mailCta}: ${SITE_URL}${href}`, "", `${tx.mailUnsub}: ${unsub}`].join("\n");
      const r = await sendEmail({ to: [{ email: u.user.email }], subject: tx.mailSubject(t.name as string), html, text });
      if (!r.ok) console.error("Email nuovo torneo non inviata:", r.error);
    } catch (e) {
      console.error("Email nuovo torneo non inviata:", (e as Error).message);
    }
  }
}
