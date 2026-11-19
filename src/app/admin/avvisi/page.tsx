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
 * Sezione Avvisi, con due schede: Circuiti (un avviso a tutto il circuito) e Tornei (agli iscritti di un torneo
 * non chiuso che gestisci). «?scheda=circuiti|tornei» sceglie la scheda e «&a=c:<id>» o «&a=t:<id>» il destinatario
 * (è così che arrivano i link dalle pagine del circuito e del torneo).
 */
export default async function NoticesPage({ searchParams }: PageProps<"/admin/avvisi">) {
  await requireAdmin();
  const [t, l] = [await tr(announcementsText), await getLocale()];
  const sp = await searchParams;
  const wanted = String(sp.a ?? "");
  const tab: "circuiti" | "tornei" = wanted.startsWith("t:") || sp.scheda === "tornei" ? "tornei" : "circuiti";

  const leagues = await managedChampionships();
  // Tornei che questo amministratore può gestire (le regole del database mostrano solo quelli).
  const { data: tours } = await (await createServerSupabase()).from("tournaments")
    .select("id, name, starts_on, status, championship_id").order("starts_on", { ascending: false, nullsFirst: false }).limit(200);
  const tournaments = tours ?? [];
  const when = (d: string | null) => (d ? new Date(d).toLocaleDateString(intlTag(l), { day: "numeric", month: "short" }) : "");
  const leagueName = new Map(leagues.map((c) => [c.id as string, c.name as string]));
  const tourName = new Map(tournaments.map((x) => [x.id as string, x.name as string]));

  const options = tab === "circuiti"
    ? leagues.map((c) => ({ value: `c:${c.id}`, label: t.optLeague(c.name as string) }))
    : tournaments.filter((x) => x.status !== "closed").map((x) => ({ value: `t:${x.id}`, label: t.optTournament(x.name as string, when(x.starts_on as string | null)) }));
  const selected = options.some((o) => o.value === wanted) ? wanted : undefined;

  const allRows = hasServiceKey() ? await listAnnouncementsFor(leagues.map((c) => c.id as string), tournaments.map((x) => x.id as string)) : [];
  const keyOf = (r: { championship_id: string | null; tournament_id: string | null }) => (r.championship_id ? `c:${r.championship_id}` : `t:${r.tournament_id}`);
  const labelOf = (k: string) => (k.startsWith("c:") ? leagueName.get(k.slice(2)) : tourName.get(k.slice(2))) ?? "?";
  const rows = allRows.filter((r) => (tab === "circuiti") === Boolean(r.championship_id));
  const used = [...new Set(rows.map(keyOf))];
  const shown = wanted && used.includes(wanted) ? rows.filter((r) => keyOf(r) === wanted) : rows;
  const now = new Date();

  const tabLink = (id: "circuiti" | "tornei", label: string) => (
    <Link href={`/admin/avvisi?scheda=${id}`} aria-current={tab === id ? "page" : undefined}
      className={`flex-1 rounded-t-xl border-b-4 px-4 py-2.5 text-center font-display text-lg uppercase tracking-wide ${tab === id ? "border-brand bg-surface font-bold text-foreground" : "border-transparent text-muted hover:text-brand"}`}>{label}</Link>);
  const chip = (href: string, label: string, on: boolean) => (
    <Link key={href} href={href} scroll={false}
      className={`shrink-0 rounded-full border px-3 py-1 text-sm ${on ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}>{label}</Link>);

  return (
    <main className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t.pageTitle}</h1>
        <p className="mt-1 text-sm text-muted">{t.pageIntro}</p>
      </div>

      <div className="flex border-b border-line">{tabLink("circuiti", t.tabLeagues)}{tabLink("tornei", t.tabTournaments)}</div>

      <section className="card">
        <h2 className="text-lg font-semibold">{t.writeTitle}</h2>
        {options.length
          ? <AnnouncementForm key={tab} groups={[{ label: tab === "circuiti" ? t.groupLeagues : t.groupTournaments, options }]} initial={selected} />
          : <p className="mt-2 text-muted">{tab === "circuiti" ? t.nothingToWrite : t.nothingToWriteTournaments}</p>}
      </section>

      <section>
        <h2 className="text-lg font-semibold">{t.sentList}</h2>
        {used.length > 1 && (
          <div className="scroll-row mt-2 gap-2">
            {chip(`/admin/avvisi?scheda=${tab}`, t.filterAll, !wanted || !used.includes(wanted))}
            {used.map((k) => chip(`/admin/avvisi?scheda=${tab}&a=${k}`, labelOf(k), k === wanted))}
          </div>)}
        {shown.length === 0 ? <p className="mt-2 text-muted">{tab === "circuiti" ? t.noneLeagues : t.noneTournaments}</p> : (
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
