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

/**
 * Giocatori iscrivibili a un amichevole creato da `ownerUserId`: lui stesso, i suoi amici
 * e i suoi ospiti. Il numero accanto al nome è il miglior punteggio nei campionati (1000 se nessuno).
 */
export async function friendlyCandidates(ownerUserId: string): Promise<Candidate[]> {
  const svc = createServiceClient();
  const friends = await friendUserIds(ownerUserId);
  const [{ data: accounts }, { data: guests }] = await Promise.all([
    svc.from("players").select("id, full_name, club, user_id").in("user_id", [ownerUserId, ...friends]),
    svc.from("players").select("id, full_name, club").eq("guest_of", ownerUserId),
  ]);
  const list = [
    ...(accounts ?? []).map((p) => ({ id: p.id as string, full_name: p.full_name as string, club: p.club as string | null, guest: false, me: p.user_id === ownerUserId })),
    ...(guests ?? []).map((p) => ({ id: p.id as string, full_name: p.full_name as string, club: p.club as string | null, guest: true, me: false })),
  ];
  const best = await bestRatings(list.map((p) => p.id));
  return list.map((p) => ({ ...p, rating: best.get(p.id) ?? 1000 })).sort((a, b) => a.full_name.localeCompare(b.full_name, "it"));
}

/** Miglior punteggio di ogni giocatore tra i campionati a cui partecipa. */
export async function bestRatings(playerIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (!playerIds.length) return out;
  const { data } = await createServiceClient().from("championship_players").select("player_id, rating").in("player_id", playerIds);
  for (const r of data ?? []) out.set(r.player_id as string, Math.max(out.get(r.player_id as string) ?? 0, r.rating as number));
  return out;
}
