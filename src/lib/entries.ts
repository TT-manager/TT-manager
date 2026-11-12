import type { SupabaseClient } from "@supabase/supabase-js";

/** Una voce del torneo: un giocatore (singolare) o una coppia (doppio). */
export interface Entry {
  id: string;
  seed: number | null;
  group: number | null;
  players: { id: string; name: string }[];
}

export const entryName = (e: Pick<Entry, "players">) => e.players.map((p) => p.name).join(" / ") || "?";

/** Legge le voci di un torneo con i nomi dei giocatori. */
export async function loadEntries(client: SupabaseClient, tournamentId: string): Promise<Entry[]> {
  const [{ data: entries, error: e1 }, { data: members, error: e2 }] = await Promise.all([
    client.from("tournament_entries").select("id, seed, group_no").eq("tournament_id", tournamentId),
    client.from("entry_members").select("entry_id, player_id, players(full_name)").eq("tournament_id", tournamentId),
  ]);
  if (e1 || e2) throw new Error("Impossibile leggere gli iscritti");
  const byEntry = new Map<string, { id: string; name: string }[]>();
  for (const m of members ?? []) {
    const list = byEntry.get(m.entry_id as string) ?? [];
    list.push({ id: m.player_id as string, name: (m.players as unknown as { full_name: string } | null)?.full_name ?? "?" });
    byEntry.set(m.entry_id as string, list);
  }
  return (entries ?? []).map((e) => ({
    id: e.id as string, seed: e.seed as number | null, group: e.group_no as number | null,
    players: (byEntry.get(e.id as string) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
  }));
}
