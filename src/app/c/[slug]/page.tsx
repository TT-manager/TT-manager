import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getChampionshipBySlug, getChampionshipTournaments, getRanking } from "@/lib/data";
import { statusLabel } from "@/lib/labels";
import { registrationIsOpen } from "@/lib/registration";
import { RankingTable } from "@/components/ranking-table";
import { PointsExplainer } from "@/components/points-explainer";
import { getLocale, tr } from "@/i18n/server";
import { intlTag } from "@/i18n/locale";
import { publicLeagueText } from "@/i18n/dict/public-home";

export default async function ChampionshipPage({ params }: PageProps<"/c/[slug]">) {
  const t = await tr(publicLeagueText);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">{t.allLeagues}</Link>
      <Suspense fallback={<p className="mt-6 text-neutral-600 dark:text-neutral-400">{t.loading}</p>}>
        <Championship params={params} />
      </Suspense>
    </main>
  );
}

const MEDAL = ["", "🥇", "🥈", "🥉"];

async function Championship({ params }: { params: PageProps<"/c/[slug]">["params"] }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) notFound();
  const c = await getChampionshipBySlug(slug);
  if (!c) notFound();
  const [tx, l] = [await tr(publicLeagueText), await getLocale()];
  const [rows, { tournaments, past }] = await Promise.all([getRanking(c.id), getChampionshipTournaments(c.id)]);
  return (
    <>
      <header className="mt-4 overflow-hidden rounded-2xl bg-ink text-white shadow-lg">
        <div className="relative p-6">
          <div aria-hidden="true" className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-brand/85" />
          <div className="relative">
            <p className="text-sm uppercase tracking-widest text-white/60">{tx.leagueKind(c.kind === "doubles")}</p>
            <h1 className="text-4xl font-bold">{c.name}</h1>
            <p className="mt-2 text-sm text-white/75">{tx.playersInRanking(rows.length)}</p>
            <Link href={`/partecipa/${c.slug}`} className="btn-primary mt-4">{tx.wantToPlay}</Link>
          </div>
        </div>
      </header>

      <h2 className="mt-8 text-2xl font-bold uppercase">{tx.ranking}</h2>
      <RankingTable rows={rows} label={c.settings.label} />
      <PointsExplainer s={c.settings} doubles={c.kind === "doubles"} />

      <h2 className="mt-10 text-2xl font-bold uppercase">{tx.tournaments}</h2>
      {tournaments.length === 0 ? <p className="mt-2 text-muted">{tx.noTournaments}</p> : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {tournaments.map((t) => {
            const live = t.status === "groups" || t.status === "knockout";
            return (
              <li key={t.id}>
                <Link href={`/t/${t.public_code}`} className="card flex h-full flex-col gap-2 transition hover:border-brand">
                  <span className="flex flex-wrap gap-2">
                    {live && <span className="badge-live"><span className="live-dot" /> {tx.inProgress}</span>}
                    {registrationIsOpen(t) && <span className="badge-open">{tx.registrationOpen}</span>}
                    {!t.ranked && <span className="badge-friendly">{tx.friendly}</span>}
                    {t.status === "closed" && <span className="badge-muted">{tx.finished}</span>}
                  </span>
                  <span className="font-display text-xl font-bold uppercase">{t.name}</span>
                  <span className="text-sm text-muted">{t.starts_on ? new Date(t.starts_on).toLocaleDateString(intlTag(l), { day: "numeric", month: "long", year: "numeric" }) + " · " : ""}{statusLabel(t.status as string, l)}</span>
                </Link>
              </li>);
          })}
        </ul>)}

      {past.length > 0 && (
        <>
          <h2 className="mt-10 text-2xl font-bold uppercase">{tx.rollOfHonour}</h2>
          <ul className="card mt-3 divide-y divide-line !py-1">
            {past.map((p) => (
              <li key={p.id} className="py-3">
                <p className="font-medium">{p.name}{p.held_on && <span className="ml-2 text-sm font-normal text-neutral-500 dark:text-neutral-400">
                  {new Date(p.held_on).toLocaleDateString(intlTag(l))}</span>}</p>
                <p className="text-sm">{p.podium.map((r) => `${r.position === 4 ? tx.fourth : MEDAL[r.position]} ${r.name}`).join("   ")}</p>
              </li>))}
          </ul>
        </>)}
    </>
  );
}
