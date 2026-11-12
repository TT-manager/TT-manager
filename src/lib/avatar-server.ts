import "server-only";
import { createServiceClient } from "./supabase/admin";

/** Toglie la foto di un giocatore (file e riferimento). Da chiamare dopo i controlli. */
export async function clearAvatar(playerId: string) {
  const svc = createServiceClient();
  const { data } = await svc.from("players").select("avatar_path").eq("id", playerId).maybeSingle();
  if (!data?.avatar_path) return;
  await svc.from("players").update({ avatar_path: null }).eq("id", playerId);
  await svc.storage.from("avatars").remove([data.avatar_path as string]);
}
