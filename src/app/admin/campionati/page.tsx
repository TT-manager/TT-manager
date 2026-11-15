import Link from "next/link";
import { getAdmin, managedChampionships } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { createChampionship } from "./actions";
import { createServerSupabase } from "@/lib/supabase/server";
import { tr } from "@/i18n/server";
import { adminLeaguesText } from "@/i18n/dict/admin-leagues";

export async function generateMetadata() {
  return { title: (await tr(adminLeaguesText)).leaguesTitle };
}
const input = "rounded border bg-transparent px-3 py-2";

export default async function ChampionshipsPage() {
  const [admin, list] = await Promise.all([getAdmin(), managedChampionships()]);
  const t = await tr(adminLeaguesText);
  const ids = list.map((c) => c.id as string);
  const supabase = await createServerSupabase();
  const [{ data: members }, { data: tournaments }] = ids.length ? await Promise.all([
    supabase.from("championship_players").select("championship_id").in("championship_id", ids),
    supabase.from("tournaments").select("championship_id, status").in("championship_id", ids).neq("status", "closed"),
  ]) : [{ data: [] }, { data: [] }];
  type Row = { championship_id: string; status?: string };
  const count = (rows: Row[] | null, id: string, f: (r: Row) => boolean = () => true) =>
    (rows ?? []).filter((r) => r.championship_id === id && f(r)).length;
  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t.leaguesTitle}{list.length > 0 && <span className="ml-2 text-base font-normal text-muted">({list.length})</span>}</h1>
        {list.length === 0
          ? <p className="mt-4 text-neutral-600 dark:text-neutral-400">
              {admin?.role === "owner" ? t.noLeaguesOwner : t.noLeaguesAdmin}</p>
          : <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {list.map((c) => {
                const id = c.id as string;
                const live = count(tournaments as Row[] | null, id, (r) => r.status === "groups" || r.status === "knockout");
                const upcoming = count(tournaments as Row[] | null, id, (r) => r.status === "draft");
                return (
                  <li key={id}>
                    <Link href={`/admin/campionati/${id}`} className="card flex h-full items-center justify-between gap-3 border-l-4 !border-l-brand transition hover:border-brand">
                      <span className="min-w-0">
                        <span className="block truncate font-display text-xl font-bold uppercase">{c.name as string}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
                          <span className="badge-muted">{c.kind === "doubles" ? t.doubles : t.singles}</span>
                          {t.membersCount(count(members as Row[] | null, id))}
                          {live > 0 && <span className="badge-live"><span className="live-dot" /> {t.liveCount(live)}</span>}
                          {upcoming > 0 && <span>· {t.upcomingCount(upcoming)}</span>}
                        </span>
                      </span>
                      <span aria-hidden="true" className="text-2xl text-muted">›</span>
                    </Link>
                  </li>);
              })}
            </ul>}
      </div>
      {admin?.role === "owner" && (
        <section className="border-t-2 border-line pt-8">
          <h2 className="text-lg font-semibold">＋ {t.newLeague}</h2>
          <div className="mt-3 rounded-lg border border-dashed p-4">
          <ActionForm action={createChampionship} submitLabel={t.createLeague}>
            <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
              <label className="grid gap-1">{t.name}<input name="name" required maxLength={100} className={input} placeholder={t.namePlaceholder} /></label>
              <label className="grid gap-1">{t.type}
                <select name="kind" className={`select-arrow ${input}`} defaultValue="singles">
                  <option value="singles">{t.singles}</option>
                  <option value="doubles">{t.doubles}</option>
                </select></label>
            </div>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{t.typeNote}</p>
          </ActionForm>
          </div>
        </section>
      )}
    </main>
  );
}
