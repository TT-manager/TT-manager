import "server-only";
import { redirect } from "next/navigation";
import { hasServiceKey } from "./organizer";
import { createServiceClient } from "./supabase/admin";
import { createServerSupabase } from "./supabase/server";

export type Account = {
  userId: string; email: string; isAdmin: boolean;
  player: { id: string; full_name: string; club: string | null; avatar_path: string | null };
};

/** Utente collegato con la sua scheda giocatore (creata al primo accesso), oppure null. */
export async function getAccount(): Promise<Account | null> {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub || !hasServiceKey()) return null;
  const userId = claims.sub, email = String(claims.email ?? "");
  const meta = (claims.user_metadata ?? {}) as { full_name?: unknown; club?: unknown };
  const [{ data: admin }, player] = await Promise.all([
    supabase.from("admins").select("role").eq("user_id", userId).maybeSingle(),
    ensurePlayer(userId, typeof meta.full_name === "string" ? meta.full_name : "", typeof meta.club === "string" ? meta.club : "", email),
  ]);
  return { userId, email, isAdmin: Boolean(admin), player };
}

export async function requireAccount(next: string): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect(`/login?next=${encodeURIComponent(next)}`);
  return account;
}

async function ensurePlayer(userId: string, name: string, club: string, email: string) {
  const svc = createServiceClient();
  const find = () => svc.from("players").select("id, full_name, club, avatar_path").eq("user_id", userId).maybeSingle();
  const { data: found } = await find();
  if (found) return found as Account["player"];
  const fullName = (name.trim() || email.split("@")[0] || "Giocatore").slice(0, 80);
  const { data: created, error } = await svc.from("players")
    .insert({ full_name: fullName, club: club.trim().slice(0, 80) || null, user_id: userId }).select("id, full_name, club, avatar_path").single();
  if (created) return created as Account["player"];
  if (error?.code === "23505") { const { data: again } = await find(); if (again) return again as Account["player"]; }
  throw new Error("Impossibile creare la scheda giocatore");
}

/** Accetta solo percorsi interni (evita redirect verso altri siti). */
export function safeNext(raw: unknown, fallback = "/profilo") {
  const s = typeof raw === "string" ? raw : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : fallback;
}

/**
 * Inserisce l'utente nel campionato. Con `linkPlayerId` l'account viene collegato a un giocatore
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
  return error ? { error: "Non sono riuscito a inserirti nel campionato." } : {};
}
