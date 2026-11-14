import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { statusLabel } from "@/lib/labels";
import { getLocale, tr } from "@/i18n/server";
import { intlTag } from "@/i18n/locale";
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
        <ul className="mt-6 divide-y">
          {data.map((t) => (
            <li key={t.id} className="flex flex-wrap items-baseline gap-x-4 py-3">
              <Link href={`/gestione/${t.id}`} className="font-medium underline-offset-2 hover:underline">{t.name}</Link>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {t.championship_id ? (t.championships as unknown as { name: string } | null)?.name : tx.userFriendly}{t.championship_id && !t.ranked ? tx.friendlySuffix : ""} · {t.starts_on ? new Date(t.starts_on).toLocaleDateString(intlTag(l)) : tx.noDate} · {statusLabel(t.status, l)} · {tx.code(t.public_code)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
