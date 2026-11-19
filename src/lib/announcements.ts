import "server-only";
import { createServiceClient } from "./supabase/admin";
import { notifyUsers } from "./notifications";

export type AnnouncementTarget = { championshipId: string } | { tournamentId: string };
export type Announcement = { id: number; body: string; created_at: string };

const column = (t: AnnouncementTarget) =>
  "championshipId" in t ? { col: "championship_id", id: t.championshipId } : { col: "tournament_id", id: t.tournamentId };

/** Ultimi avvisi di un circuito o di un torneo (dal più recente). Da usare dopo i controlli di visibilità della pagina. */
export async function listAnnouncements(target: AnnouncementTarget, opts: { limit?: number; sinceDays?: number } = {}): Promise<Announcement[]> {
  const { col, id } = column(target);
  let q = createServiceClient().from("announcements").select("id, body, created_at").eq(col, id)
    .order("created_at", { ascending: false }).limit(opts.limit ?? 20);
  if (opts.sinceDays) q = q.gte("created_at", new Date(Date.now() - opts.sinceDays * 86_400_000).toISOString());
  const { data } = await q;
  return (data ?? []) as Announcement[];
}

/**
 * Pubblica un avviso e lo manda nelle notifiche: a tutti i giocatori attivi del circuito con un account,
 * oppure agli iscritti del torneo. Restituisce quante persone lo ricevono, o null se non è stato salvato.
 * Da chiamare SOLO dopo aver verificato che l'autore gestisce il circuito o il torneo.
 */
export async function postAnnouncement(target: AnnouncementTarget, body: string, authorUserId: string): Promise<number | null> {
  const svc = createServiceClient();
  const { col, id } = column(target);
  const { error } = await svc.from("announcements").insert({ [col]: id, body, author_user_id: authorUserId });
  if (error) { console.error("Avviso non salvato:", error.message); return null; }

  let users: string[] = [], from = "", href = "";
  if ("championshipId" in target) {
    const [{ data: c }, { data: members }] = await Promise.all([
      svc.from("championships").select("name, slug").eq("id", id).maybeSingle(),
      svc.from("championship_players").select("players!inner(user_id, active)").eq("championship_id", id)
        .not("players.user_id", "is", null).eq("players.active", true),
    ]);
    from = (c?.name as string) ?? ""; href = `/c/${c?.slug ?? ""}`;
    users = ((members ?? []) as unknown as { players: { user_id: string } }[]).map((m) => m.players.user_id);
  } else {
    const [{ data: t }, { data: entrants }] = await Promise.all([
      svc.from("tournaments").select("name, public_code").eq("id", id).maybeSingle(),
      svc.from("entry_members").select("players!inner(user_id)").eq("tournament_id", id).not("players.user_id", "is", null),
    ]);
    from = (t?.name as string) ?? ""; href = `/t/${t?.public_code ?? ""}`;
    users = ((entrants ?? []) as unknown as { players: { user_id: string } }[]).map((m) => m.players.user_id);
  }
  const recipients = [...new Set(users)].filter((u) => u !== authorUserId);
  const text = body.length > 140 ? `${body.slice(0, 139)}…` : body;
  await notifyUsers(recipients, "announcement", { from, text }, href);
  return recipients.length;
}

/** Cancella un avviso del circuito o del torneo indicato. Da chiamare SOLO dopo i controlli. */
export async function deleteAnnouncement(target: AnnouncementTarget, announcementId: number) {
  const { col, id } = column(target);
  await createServiceClient().from("announcements").delete().eq("id", announcementId).eq(col, id);
}
