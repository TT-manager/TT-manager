import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { AddPlayerForm, PlayersTable } from "./player-forms";
import { listClubs } from "@/lib/clubs-server";
import { tr } from "@/i18n/server";
import { adminShellText } from "@/i18n/dict/admin-shell";

export async function generateMetadata() {
  return { title: (await tr(adminShellText)).playersTitle };
}

export default async function PlayersPage() {
  await requireAdmin();
  const t = await tr(adminShellText);
  const supabase = await createServerSupabase();
  const clubs = await listClubs();
  const { data: players, error } = await supabase
    .from("players").select("id, full_name, club_id, active, avatar_path, user_id, championship_players(championships(name))").is("guest_of", null)
    .order("active", { ascending: false }).order("full_name");
  if (error) throw new Error(t.playersCantRead);
  return (
    <main>
      <h1 className="text-2xl font-bold">{t.playersTitle}</h1>
      <p className="mt-1 text-sm text-muted">{t.playersIntroShort}</p>
      <AddPlayerForm clubs={clubs} />
      <PlayersTable clubs={clubs} players={players.map((p) => ({
        id: p.id as string, full_name: p.full_name as string, club_id: p.club_id as string | null, active: p.active as boolean,
        avatar_path: p.avatar_path as string | null, hasAccount: Boolean(p.user_id),
        championships: ((p.championship_players ?? []) as unknown as { championships: { name: string } | null }[]).map((c) => c.championships?.name ?? "?"),
      }))} />
    </main>
  );
}
