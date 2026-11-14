import { createServerSupabase } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { AddPlayerForm, PlayerRow } from "./player-forms";
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
    .from("players").select("id, full_name, club_id, active, avatar_path, championship_players(championships(name))")
    .order("active", { ascending: false }).order("full_name");
  if (error) throw new Error(t.playersCantRead);
  return (
    <main>
      <h1 className="text-2xl font-bold">{t.playersTitle}</h1>
      <AddPlayerForm clubs={clubs} />
      <p className="mt-8 text-sm text-neutral-600 dark:text-neutral-400">
        {t.playersIntro(players.length)}
      </p>
      <ul className="mt-2 divide-y">
        {players.map((p) => <PlayerRow key={p.id} clubs={clubs} player={{ id: p.id, full_name: p.full_name, club_id: p.club_id as string | null, active: p.active, avatar_path: p.avatar_path as string | null,
          championships: ((p.championship_players ?? []) as unknown as { championships: { name: string } | null }[]).map((c) => c.championships?.name ?? "?") }} />)}
      </ul>
    </main>
  );
}
