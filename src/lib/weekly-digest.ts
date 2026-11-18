import "server-only";
import { createServiceClient } from "./supabase/admin";
import { listBackups } from "./backup";
import { SITE_URL, esc, sendEmail } from "./email";

const DAY = 86400000;

/** Dati del riepilogo settimanale: novità degli ultimi 7 giorni e cose da sistemare adesso. */
async function collect() {
  const svc = createServiceClient();
  const since = new Date(Date.now() - 7 * DAY).toISOString();
  const users: { id: string; created_at: string }[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data } = await svc.auth.admin.listUsers({ page, perPage: 1000 });
    users.push(...(data?.users ?? []).filter((u) => u.created_at >= since));
    if ((data?.users.length ?? 0) < 1000) break;
  }
  const ids = users.map((u) => u.id);
  const [{ data: people }, { data: leagues }, { data: requests }, { data: disputedChallenges }, { data: live }, backups] = await Promise.all([
    ids.length ? svc.from("players").select("full_name, user_id, championship_players(championship_id)").in("user_id", ids) : Promise.resolve({ data: [] }),
    svc.from("championships").select("id, name"),
    svc.from("championship_requests").select("championship_id").eq("status", "pending"),
    svc.from("challenges").select("championship_id").eq("status", "disputed"),
    svc.from("tournaments").select("id, name").in("status", ["groups", "knockout"]),
    listBackups(),
  ]);
  const leagueName = new Map((leagues ?? []).map((c) => [c.id as string, c.name as string]));
  const { data: disputedMatches } = (live ?? []).length
    ? await svc.from("matches").select("tournament_id").not("disputed_at", "is", null).in("tournament_id", (live ?? []).map((t) => t.id as string))
    : { data: [] };
  const byLeague = (rows: { championship_id: string }[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) m.set(leagueName.get(r.championship_id) ?? "?", (m.get(leagueName.get(r.championship_id) ?? "?") ?? 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  };
  return {
    newcomers: ((people ?? []) as unknown as { full_name: string; championship_players: { championship_id: string }[] }[])
      .map((p) => ({ name: p.full_name, leagues: p.championship_players.map((c) => leagueName.get(c.championship_id) ?? "?") }))
      .sort((a, b) => a.name.localeCompare(b.name, "it")),
    requests: byLeague(requests as { championship_id: string }[] | null),
    challenges: byLeague(disputedChallenges as { championship_id: string }[] | null),
    matches: (disputedMatches ?? []).length,
    lastBackup: backups[0] ?? null,
  };
}

/** Indirizzi email dei proprietari del sito. */
async function ownerEmails() {
  const svc = createServiceClient();
  const { data } = await svc.from("admins").select("user_id").eq("role", "owner");
  const out: string[] = [];
  for (const r of data ?? []) {
    const { data: u } = await svc.auth.admin.getUserById(r.user_id as string);
    if (u.user?.email) out.push(u.user.email);
  }
  return out;
}

/**
 * Riepilogo settimanale per il proprietario. Parte anche se non c'è nulla di nuovo:
 * così la chiave di Brevo viene usata almeno una volta a settimana e non scade per inattività.
 */
export async function sendWeeklyDigest(): Promise<{ ok: boolean; error?: string; to?: number }> {
  const [d, to] = await Promise.all([collect(), ownerEmails()]);
  if (!to.length) return { ok: false, error: "nessun proprietario con email" };
  const fmt = (iso: string) => new Date(iso).toLocaleString("it-IT", { timeZone: "Europe/Rome", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const backupOld = !d.lastBackup || Date.now() - new Date(d.lastBackup.createdAt).getTime() > 2 * DAY;
  const todo = [
    ...d.requests.map(([l, n]) => `${n} ${n === 1 ? "richiesta" : "richieste"} di ingresso in ${l}`),
    ...d.challenges.map(([l, n]) => `${n} ${n === 1 ? "sfida contestata" : "sfide contestate"} in ${l}`),
    ...(d.matches ? [`${d.matches} ${d.matches === 1 ? "risultato contestato" : "risultati contestati"} nei tornei in corso`] : []),
  ];
  const newcomers = d.newcomers.map((p) => `${p.name}${p.leagues.length ? ` (${p.leagues.join(", ")})` : " (ancora in nessun circuito)"}`);
  const backup = d.lastBackup
    ? `Ultima copia: ${fmt(d.lastBackup.createdAt)}, ${Math.max(1, Math.round(d.lastBackup.size / 1024))} KB.${backupOld ? " Attenzione: è più vecchia di due giorni, controlla la pagina Backup." : ""}`
    : "Nessuna copia trovata: controlla la pagina Backup.";

  const section = (title: string, items: string[], empty: string) =>
    `<h2 style="font-size:16px;margin:24px 0 8px">${esc(title)}</h2>` +
    (items.length ? `<ul style="margin:0;padding-left:20px">${items.map((i) => `<li style="margin:4px 0">${esc(i)}</li>`).join("")}</ul>` : `<p style="margin:0;color:#666">${esc(empty)}</p>`);
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:560px;margin:auto;color:#111">
<h1 style="font-size:20px;margin:0 0 4px">Riepilogo settimanale di PongFu</h1>
<p style="margin:0;color:#666">Le novità degli ultimi 7 giorni.</p>
${section(`Nuovi iscritti (${newcomers.length})`, newcomers, "Nessun nuovo iscritto questa settimana.")}
${section("Da sistemare", todo, "Niente da sistemare.")}
${section("Backup", [backup], "")}
<p style="margin:28px 0 0"><a href="${SITE_URL}/admin" style="background:#d6181f;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600">Apri l'amministrazione</a></p>
<p style="margin:24px 0 0;font-size:12px;color:#888">Email automatica inviata ogni lunedì al proprietario del sito.</p></div>`;
  const text = [
    "Riepilogo settimanale di PongFu", "",
    `Nuovi iscritti (${newcomers.length}):`, ...(newcomers.length ? newcomers.map((x) => `- ${x}`) : ["- nessuno"]), "",
    "Da sistemare:", ...(todo.length ? todo.map((x) => `- ${x}`) : ["- niente"]), "",
    `Backup: ${backup}`, "", `${SITE_URL}/admin`,
  ].join("\n");
  const subject = todo.length ? `PongFu: ${todo.length} ${todo.length === 1 ? "cosa" : "cose"} da sistemare, ${newcomers.length} nuovi iscritti`
    : `PongFu: riepilogo della settimana (${newcomers.length} nuovi iscritti)`;
  const r = await sendEmail({ to: to.map((email) => ({ email })), subject, html, text });
  return r.ok ? { ok: true, to: to.length } : { ok: false, error: r.error };
}
