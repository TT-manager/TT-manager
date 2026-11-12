import "server-only";
import { redirect } from "next/navigation";
import { hasServiceKey } from "./organizer";
import { createServiceClient } from "./supabase/admin";
import { createServerSupabase } from "./supabase/server";
import { createClubRequest } from "./clubs-server";
import { parseClubChoice } from "./clubs";

export type Account = {
  userId: string; email: string; isAdmin: boolean;
  player: { id: string; full_name: string; club: string | null; club_id: string | null; avatar_path: string | null };
};

/** Utente collegato con la sua scheda giocatore (creata al primo accesso), oppure null. */
export async function getAccount(): Promise<Account | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || !hasServiceKey()) return null;
  const userId = claims.sub, email = String(claims.email ?? "");
  const meta = (claims.user_metadata ?? {}) as { full_name?: unknown; club_id?: unknown; club_request?: unknown };
  const [{ data: admin }, player] = await Promise.all([
    supabase.from("admins").select("role").eq("user_id", userId).maybeSingle(),
    ensurePlayer(userId, typeof meta.full_name === "string" ? meta.full_name : "", meta, email),
  ]);
  return { userId, email, isAdmin: Boolean(admin), player };
}

export async function requireAccount(next: string): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect(`/login?next=${encodeURIComponent(next)}`);
  return account;
}

/** Circolo scelto in registrazione (salvato nei dati dell'account): uno dell'elenco o una richiesta. */
function signupClub(meta: { club_id?: unknown; club_request?: unknown }) {
  const req = (meta.club_request ?? null) as { name?: unknown; city?: unknown } | null;
  const choice = parseClubChoice((k) => ({
    club_id: req ? "nuovo" : meta.club_id, new_club_name: req?.name, new_club_city: req?.city,
  } as Record<string, unknown>)[k]);
  return "error" in choice ? { kind: "none" as const } : choice;
}

async function ensurePlayer(userId: string, name: string, meta: { club_id?: unknown; club_request?: unknown }, email: string) {
  const svc = createServiceClient();
  const find = () => svc.from("players").select("id, full_name, club, club_id, avatar_path").eq("user_id", userId).maybeSingle();
  const { data: found } = await find();
  if (found) return found as Account["player"];
  const fullName = (name.trim() || email.split("@")[0] || "Giocatore").slice(0, 80);
  const club = signupClub(meta);
  const insert = (clubId: string | null) => svc.from("players")
    .insert({ full_name: fullName, club_id: clubId, user_id: userId }).select("id, full_name, club, club_id, avatar_path").single();
  let { data: created, error } = await insert(club.kind === "existing" ? club.clubId : null);
  if (error?.code === "23503") ({ data: created, error } = await insert(null)); // circolo eliminato nel frattempo
  if (created) {
    if (club.kind === "request") {
      const r = await createClubRequest(userId, club.name, club.city);
      if (r.existingId) { // il circolo nel frattempo è entrato in elenco: lo assegniamo subito
        const { data: updated } = await svc.from("players").update({ club_id: r.existingId }).eq("id", created.id)
          .select("id, full_name, club, club_id, avatar_path").single();
        if (updated) created = updated;
      }
    }
    return created as Account["player"];
  }
  if (error?.code === "23505") { const { data: again } = await find(); if (again) return again as Account["player"]; }
  throw new Error("Impossibile creare la scheda giocatore");
}

/** Accetta solo percorsi interni (evita redirect verso altri siti). */
export function safeNext(raw: unknown, fallback = "/") {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}

/**
 * Inserisce l'utente nella lega. Con `linkPlayerId` l'account viene collegato a un giocatore
 * già presente (es. dai podi passati) invece di usare la sua scheda nuova.
 * Da chiamare solo dopo i controlli (invito valido o approvazione di un gestore).
 */
export async function attachToChampionship(cid: string, userId: string, linkPlayerId: string | null): Promise<{ error?: string }> {
  const svc = createServiceClient();
  const { data: own } = await svc.from("players").select("id").eq("user_id", userId).maybeSingle();
  let playerId = own?.id as string | undefined;
  if (linkPlayerId && linkPlayerId !== playerId) {
    const { data: target } = await svc.from("players").select("id, user_id, full_name").eq("id", linkPlayerId).maybeSingle();
    if (!target) return { error: "Il giocatore da collegare non esiste più." };
    if (target.user_id) return { error: `${target.full_name} è già collegato a un altro account.` };
    if (playerId) {
      const [{ count: inChamp }, { count: played }] = await Promise.all([
        svc.from("championship_players").select("player_id", { count: "exact", head: true }).eq("player_id", playerId),
        svc.from("entry_members").select("player_id", { count: "exact", head: true }).eq("player_id", playerId),
      ]);
      if (inChamp || played) return { error: `Questo account gioca già con un'altra scheda: non si può collegare a ${target.full_name}.` };
      await svc.from("players").delete().eq("id", playerId);
    }
    const { error } = await svc.from("players").update({ user_id: userId }).eq("id", linkPlayerId).is("user_id", null);
    if (error) return { error: "Non sono riuscito a collegare l'account." };
    playerId = linkPlayerId;
  }
  if (!playerId) return { error: "Scheda giocatore mancante: riprova." };
  const { error } = await svc.from("championship_players")
    .upsert({ championship_id: cid, player_id: playerId }, { onConflict: "championship_id,player_id", ignoreDuplicates: true });
  return error ? { error: "Non sono riuscito a inserirti nella lega." } : {};
}
