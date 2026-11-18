import "server-only";
import { createServiceClient } from "./supabase/admin";

/** Utenti amici (amicizia accettata) di un utente. */
export async function friendUserIds(userId: string): Promise<string[]> {
  const svc = createServiceClient();
  const { data } = await svc.from("friendships").select("user_a, user_b")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`).eq("status", "accepted");
  return (data ?? []).map((f) => (f.user_a === userId ? f.user_b : f.user_a) as string);
}

export type Candidate = { id: string; full_name: string; club: string | null; rating: number; guest: boolean; me: boolean };

/** Circuiti dell'utente: quelli in cui gioca e quelli che amministra (il proprietario del sito li ha tutti). */
async function circuitsOf(userId: string): Promise<string[]> {
  const svc = createServiceClient();
  const [{ data: admin }, { data: me }, { data: managed }] = await Promise.all([
    svc.from("admins").select("role").eq("user_id", userId).maybeSingle(),
    svc.from("players").select("id").eq("user_id", userId).maybeSingle(),
    svc.from("championship_admins").select("championship_id").eq("user_id", userId),
  ]);
  if (admin?.role === "owner") {
    const { data: all } = await svc.from("championships").select("id");
    return (all ?? []).map((c) => c.id as string);
  }
  const { data: member } = me ? await svc.from("championship_players").select("championship_id").eq("player_id", me.id) : { data: [] };
  return [...new Set([...(member ?? []), ...(managed ?? [])].map((r) => r.championship_id as string))];
}

/**
 * Giocatori iscrivibili a un amichevole creato da `ownerUserId`: lui stesso, i suoi amici, i suoi ospiti
 * e i giocatori attivi dei suoi circuiti (in cui gioca o che amministra): nello stesso circuito
 * ci si conosce già, e un amichevole non tocca la classifica.
 * Il numero accanto al nome è il miglior punteggio nelle leghe (1000 se nessuno).
 */
export async function friendlyCandidates(ownerUserId: string): Promise<Candidate[]> {
  const svc = createServiceClient();
  const [friends, circuits] = await Promise.all([friendUserIds(ownerUserId), circuitsOf(ownerUserId)]);
  const [{ data: accounts }, { data: guests }, { data: mates }] = await Promise.all([
    svc.from("players").select("id, full_name, club, user_id").in("user_id", [ownerUserId, ...friends]),
    svc.from("players").select("id, full_name, club").eq("guest_of", ownerUserId),
    circuits.length ? svc.from("championship_players").select("players!inner(id, full_name, club, user_id, active)")
      .in("championship_id", circuits).eq("players.active", true) : { data: [] },
  ]);
  const list = [
    ...(accounts ?? []).map((p) => ({ id: p.id as string, full_name: p.full_name as string, club: p.club as string | null, guest: false, me: p.user_id === ownerUserId })),
    ...(guests ?? []).map((p) => ({ id: p.id as string, full_name: p.full_name as string, club: p.club as string | null, guest: true, me: false })),
  ];
  // Compagni di circuito (una volta sola, anche se sono in più circuiti o sono già amici).
  const seen = new Set(list.map((p) => p.id));
  for (const m of (mates ?? []) as unknown as { players: { id: string; full_name: string; club: string | null; user_id: string | null } }[]) {
    if (seen.has(m.players.id)) continue;
    seen.add(m.players.id);
    list.push({ id: m.players.id, full_name: m.players.full_name, club: m.players.club, guest: false, me: m.players.user_id === ownerUserId });
  }
  const best = await bestRatings(list.map((p) => p.id));
  return list.map((p) => ({ ...p, rating: best.get(p.id) ?? 1000 })).sort((a, b) => a.full_name.localeCompare(b.full_name, "it"));
}

/** Miglior punteggio di ogni giocatore tra le leghe a cui partecipa. */
export async function bestRatings(playerIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!playerIds.length) return out;
  const { data } = await createServiceClient().from("championship_players").select("player_id, rating").in("player_id", playerIds);
  for (const r of data ?? []) out.set(r.player_id as string, Math.max(out.get(r.player_id as string) ?? 0, r.rating as number));
  return out;
}
