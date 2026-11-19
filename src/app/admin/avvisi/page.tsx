import Link from "next/link";
import { managedChampionships, requireAdmin } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { listAnnouncementsFor } from "@/lib/announcements";
import { hasServiceKey } from "@/lib/organizer";
import { timeAgo } from "@/lib/time";
import { ActionForm } from "@/components/action-form";
import { AnnouncementForm } from "@/components/announcement-form";
import { deleteAnnouncementAction } from "@/app/avvisi/actions";
import { intlTag } from "@/i18n/locale";
import { getLocale, tr } from "@/i18n/server";
import { announcementsText } from "@/i18n/dict/announcements";

export async function generateMetadata() {
  return { title: (await tr(announcementsText)).pageTitle };
}

/**
 * Sezione Avvisi: si scrive scegliendo il destinatario (un circuito gestito o un suo torneo non chiuso)
 * e si rivedono gli avvisi inviati, con un filtro per circuito o torneo. «?a=c:<id>» o «?a=t:<id>»
 * arriva già scelto (dal link nelle pagine del circuito e del torneo).
 */
export default async function NoticesPage({ searchParams }: PageProps<"/admin/avvisi">) {
  await requireAdmin();
  const [t, l] = [await tr(announcementsText), await getLocale()];
  const leagues = await managedChampionships();
  // Tornei che questo amministratore può gestire (le regole del database mostrano solo quelli).
  const { data: tours } = await (await createServerSupabase()).from("tournaments")
    .select("id, name, starts_on, status, championship_id").order("starts_on", { ascending: false, nullsFirst: false }).limit(200);
  const tournaments = tours ?? [];
  const open = tournaments.filter((x) => x.status !== "closed");
  const leagueName = new Map(leagues.map((c) => [c.id as string, c.name as string]));
  const tourName = new Map(tournaments.map((x) => [x.id as string, x.name as string]));
  const when = (d: string | null) => (d ? new Date(d).toLocaleDateString(intlTag(l), { day: "numeric", month: "short" }) : "");

  const groups = [
    { label: t.groupLeagues, options: leagues.map((c) => ({ value: `c:${c.id}`, label: t.optLeague(c.name as string) })) },
    { label: t.groupTournaments, options: open.map((x) => ({ value: `t:${x.id}`, label: t.optTournament(x.name as string, when(x.starts_on as string | null)) })) },
  ];
  const all = [...groups[0].options, ...groups[1].options];
  const wanted = String((await searchParams).a ?? "");
  const selected = all.some((o) => o.value === wanted) ? wanted : undefined;

  const rows = hasServiceKey() ? await listAnnouncementsFor(leagues.map((c) => c.id as string), tournaments.map((x) => x.id as string)) : [];
  const keyOf = (r: { championship_id: string | null; tournament_id: string | null }) => (r.championship_id ? `c:${r.championship_id}` : `t:${r.tournament_id}`);
  const labelOf = (k: string) => (k.startsWith("c:") ? leagueName.get(k.slice(2)) : tourName.get(k.slice(2))) ?? "?";
  const used = [...new Set(rows.map(keyOf))];
  const shown = wanted && used.includes(wanted) ? rows.filter((r) => keyOf(r) === wanted) : rows;
  const now = new Date();
  const chip = (href: string, label: string, on: boolean) => (
    <Link key={href} href={href} scroll={false}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm ${on ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}>{label}</Link>);

  return (
    <main className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.pageIntro}</p>
      </div>

      <section className="card">
        <h2 className="text-lg font-semibold">{t.writeTitle}</h2>
        {all.length ? <AnnouncementForm groups={groups} initial={selected} /> : <p className="mt-2 text-muted">{t.nothingToWrite}</p>}
      </section>

      <section>
        <h2 className="text-lg font-semibold">{t.sentList}</h2>
        {used.length > 1 && (
          <div className="scroll-row mt-2 gap-2">
            {chip("/admin/avvisi", t.filterAll, !wanted || !used.includes(wanted))}
            {used.map((k) => chip(`/admin/avvisi?a=${k}`, labelOf(k), k === wanted))}
          </div>)}
        {shown.length === 0 ? <p className="mt-2 text-muted">{t.none}</p> : (
          <ul className="card mt-3 divide-y divide-line !py-1">
            {shown.map((a) => {
              const k = keyOf(a);
              return (
                <li key={a.id} className="flex items-start justify-between gap-3 py-3">
                  <span className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wide text-brand">{labelOf(k)}</span>
                    <span className="block whitespace-pre-line [overflow-wrap:anywhere]">{a.body}</span>
                    <span className="text-xs text-muted">{timeAgo(a.created_at, now, l)}</span>
                  </span>
                  <ActionForm action={deleteAnnouncementAction} submitLabel={t.remove} confirmText={t.removeConfirm} primary={false} inline>
                    <input type="hidden" name="target" value={k} /><input type="hidden" name="id" value={a.id} />
                  </ActionForm>
                </li>);
            })}
          </ul>)}
      </section>
    </main>
  );
}
