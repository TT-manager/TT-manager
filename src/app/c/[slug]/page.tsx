import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getChampionshipBySlug, getChampionshipTournaments, getRanking } from "@/lib/data";
import { STATUS_LABEL } from "@/lib/labels";
import { registrationIsOpen } from "@/lib/registration";
import { RankingTable } from "@/components/ranking-table";
import { PointsExplainer } from "@/components/points-explainer";

export default function ChampionshipPage({ params }: PageProps<"/c/[slug]">) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">← Tutte le leghe</Link>
      <Suspense fallback={<p className="mt-6 text-neutral-600 dark:text-neutral-400">Caricamento…</p>}>
        <Championship params={params} />
      </Suspense>
    </main>
  );
}

const MEDAL = ["", "🥇", "🥈", "🥉", "4°"];

async function Championship({ params }: { params: PageProps<"/c/[slug]">["params"] }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) notFound();
  const c = await getChampionshipBySlug(slug);
  if (!c) notFound();
  const [rows, { tournaments, past }] = await Promise.all([getRanking(c.id), getChampionshipTournaments(c.id)]);
  return (
    <>
      <header className="mt-4 overflow-hidden rounded-2xl bg-ink text-white shadow-lg">
        <div className="relative p-6">
          <div aria-hidden="true" className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-brand/85" />
          <div className="relative">
            <p className="text-sm uppercase tracking-widest text-white/60">Lega · {c.kind === "doubles" ? "doppio" : "singolare"}</p>
            <h1 className="text-4xl font-bold">{c.name}</h1>
            <p className="mt-2 text-sm text-white/75">{rows.length} giocatori in classifica</p>
            <Link href={`/partecipa/${c.slug}`} className="btn-primary mt-4">Vuoi giocare? Chiedi di partecipare</Link>
          </div>
        </div>
      </header>

      <h2 className="mt-8 text-2xl font-bold uppercase">Classifica</h2>
      <RankingTable rows={rows} label={c.settings.label} />
      <PointsExplainer s={c.settings} doubles={c.kind === "doubles"} />

      <h2 className="mt-10 text-2xl font-bold uppercase">Tornei</h2>
      {tournaments.length === 0 ? <p className="mt-2 text-muted">Nessun torneo ancora.</p> : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {tournaments.map((t) => {
            const live = t.status === "groups" || t.status === "knockout";
            return (
              <li key={t.id}>
                <Link href={`/t/${t.public_code}`} className="card flex h-full flex-col gap-2 transition hover:border-brand">
                  <span className="flex flex-wrap gap-2">
                    {live && <span className="badge-live"><span className="live-dot" /> In corso</span>}
                    {registrationIsOpen(t) && <span className="badge-open">Iscrizioni aperte</span>}
                    {!t.ranked && <span className="badge-friendly">Amichevole</span>}
                    {t.status === "closed" && <span className="badge-muted">Concluso</span>}
                  </span>
                  <span className="font-display text-xl font-bold uppercase">{t.name}</span>
                  <span className="text-sm text-muted">{t.starts_on ? new Date(t.starts_on).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" }) + " · " : ""}{STATUS_LABEL[t.status as string]}</span>
                </Link>
              </li>);
          })}
        </ul>)}

      {past.length > 0 && (
        <>
          <h2 className="mt-10 text-2xl font-bold uppercase">Albo d&apos;oro</h2>
          <ul className="card mt-3 divide-y divide-line !py-1">
            {past.map((p) => (
              <li key={p.id} className="py-3">
                <p className="font-medium">{p.name}{p.held_on && <span className="ml-2 text-sm font-normal text-neutral-500 dark:text-neutral-400">
                  {new Date(p.held_on).toLocaleDateString("it-IT")}</span>}</p>
                <p className="text-sm">{p.podium.map((r) => `${MEDAL[r.position]} ${r.name}`).join("   ")}</p>
              </li>))}
          </ul>
        </>)}
    </>
  );
}
