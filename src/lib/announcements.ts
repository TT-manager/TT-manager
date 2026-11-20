import "server-only";
import { createServiceClient } from "./supabase/admin";
import { notifyUsers } from "./notifications";

export type AnnouncementTarget = { championshipId: string } | { tournamentId: string };
export type Announcement = { id: number; body: string; created_at: string; pinned: boolean };

/** Avvisi in evidenza al massimo per circuito o torneo, per non riempire la pagina. */
export const MAX_PINNED = 2;
export type AnnouncementRow = Announcement & { championship_id: string | null; tournament_id: string | null };

const column = (t: AnnouncementTarget) =>
  "championshipId" in t ? { col: "championship_id", id: t.championshipId } : { col: "tournament_id", id: t.tournamentId };

/**
 * Avvisi da mostrare in cima alla pagina: quelli in evidenza (sempre) più i normali recenti.
 * Da usare dopo i controlli di visibilità della pagina.
 */
export async function pageAnnouncements(target: AnnouncementTarget, sinceDays?: number): Promise<Announcement[]> {
  const { col, id } = column(target);
  const svc = createServiceClient();
  let recent = svc.from("announcements").select("id, body, created_at, pinned").eq(col, id).eq("pinned", false)
    .order("created_at", { ascending: false }).limit(10);
  if (sinceDays) recent = recent.gte("created_at", new Date(Date.now() - sinceDays * 86_400_000).toISOString());
  const [{ data: pinned }, { data: normal }] = await Promise.all([
    svc.from("announcements").select("id, body, created_at, pinned").eq(col, id).eq("pinned", true).order("created_at", { ascending: false }).limit(MAX_PINNED),
    recent,
  ]);
  return [...(pinned ?? []), ...(normal ?? [])] as Announcement[];
}

/** Quanti avvisi in evidenza ha già un circuito o un torneo. */
export async function pinnedCount(target: AnnouncementTarget): Promise<number> {
  const { col, id } = column(target);
  const { count } = await createServiceClient().from("announcements").select("id", { count: "exact", head: true }).eq(col, id).eq("pinned", true);
  return count ?? 0;
}

/** Mette o toglie l'evidenza a un avviso del circuito o del torneo indicato. Da chiamare SOLO dopo i controlli. */
export async function setPinned(target: AnnouncementTarget, announcementId: number, pinned: boolean) {
  const { col, id } = column(target);
  await createServiceClient().from("announcements").update({ pinned }).eq("id", announcementId).eq(col, id);
}

/** Ultimi avvisi di un circuito o di un torneo (dal più recente). Da usare dopo i controlli di visibilità della pagina. */
export async function listAnnouncements(target: AnnouncementTarget, opts: { limit?: number; sinceDays?: number } = {}): Promise<Announcement[]> {
  const { col, id } = column(target);
  let q = createServiceClient().from("announcements").select("id, body, created_at, pinned").eq(col, id)
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
export async function postAnnouncement(target: AnnouncementTarget, body: string, authorUserId: string, pinned = false): Promise<number | null> {
  const svc = createServiceClient();
  const { col, id } = column(target);
  const { error } = await svc.from("announcements").insert({ [col]: id, body, author_user_id: authorUserId, pinned });
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

/** Avvisi di più circuiti e tornei insieme (per la sezione Avvisi). Da usare dopo i controlli. */
export async function listAnnouncementsFor(championshipIds: string[], tournamentIds: string[], limit = 100): Promise<AnnouncementRow[]> {
  const ors = [
    championshipIds.length && `championship_id.in.(${championshipIds.join(",")})`,
    tournamentIds.length && `tournament_id.in.(${tournamentIds.join(",")})`,
  ].filter(Boolean).join(",");
  if (!ors) return [];
  const { data } = await createServiceClient().from("announcements").select("id, body, created_at, pinned, championship_id, tournament_id")
    .or(ors).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as AnnouncementRow[];
}

/** Quanti avvisi ha un circuito o un torneo (per il link «Avvisi (n)»). */
export async function countAnnouncements(target: AnnouncementTarget): Promise<number> {
  const { col, id } = column(target);
  const { count } = await createServiceClient().from("announcements").select("id", { count: "exact", head: true }).eq(col, id);
  return count ?? 0;
}
