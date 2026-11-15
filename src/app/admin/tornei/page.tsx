import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { AdminTournamentCard, tournamentOrder } from "@/components/admin-tournament-card";
import { getLocale, tr } from "@/i18n/server";
import { adminShellText } from "@/i18n/dict/admin-shell";

export async function generateMetadata() {
  return { title: (await tr(adminShellText)).tournamentsTitle };
}


export default async function TournamentsPage() {
  await requireAdmin();
  const tx = await tr(adminShellText);
  const l = await getLocale();
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.from("tournaments")
    .select("id, name, starts_on, status, public_code, ranked, championship_id, championships(name)").order("created_at", { ascending: false });
  if (error) throw new Error(tx.tournamentsCantRead);
  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{tx.tournamentsTitle}</h1>
        <Link href="/admin/tornei/nuovo" className="btn-primary">{tx.newTournament}</Link>
      </div>
      {data.length === 0 ? <p className="mt-6 text-neutral-600 dark:text-neutral-400">{tx.noTournaments}</p> : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {[...data].sort((x, y) => tournamentOrder(x.status) - tournamentOrder(y.status)).map((t) => (
            <li key={t.id}>
              <AdminTournamentCard t={t} l={l} noDate={tx.noDate} code={tx.code(t.public_code)}
                sub={t.championship_id ? (t.championships as unknown as { name: string } | null)?.name : tx.userFriendly}
                friendlyLabel={t.championship_id && !t.ranked ? tx.friendlyBadge : null} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
