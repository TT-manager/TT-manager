import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getChampionshipBySlug, getChampionshipTournaments, getRanking } from "@/lib/data";
import { STATUS_LABEL } from "@/lib/labels";
import { RankingTable } from "@/components/ranking-table";

export default function ChampionshipPage({ params }: PageProps<"/c/[slug]">) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">← Tutti i campionati</Link>
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
      <h1 className="mt-4 text-3xl font-bold">{c.name}</h1>
      <p className="text-neutral-600 dark:text-neutral-400">{c.kind === "doubles" ? "Doppio" : "Singolare"} ·{" "}
        <Link href={`/partecipa/${c.slug}`} className="underline">Vuoi giocare? Chiedi di partecipare</Link></p>

      <h2 className="mt-8 text-xl font-semibold">Classifica</h2>
      <RankingTable rows={rows} label={c.settings.label} />

      <h2 className="mt-10 text-xl font-semibold">Tornei</h2>
      {tournaments.length === 0 ? <p className="mt-2 text-neutral-600 dark:text-neutral-400">Nessun torneo ancora.</p> : (
        <ul className="mt-2 divide-y">
          {tournaments.map((t) => (
            <li key={t.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
              <Link href={`/t/${t.public_code}`} className="font-medium hover:underline">{t.name}{!t.ranked && <span className="ml-2 text-sm font-normal text-sky-700 dark:text-sky-300">amichevole</span>}</Link>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {t.starts_on ? new Date(t.starts_on).toLocaleDateString("it-IT") : ""} · {STATUS_LABEL[t.status as string]}</span>
            </li>))}
        </ul>)}

      {past.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-semibold">Albo d&apos;oro</h2>
          <ul className="mt-2 divide-y">
            {past.map((p) => (
              <li key={p.id} className="py-2">
                <p className="font-medium">{p.name}{p.held_on && <span className="ml-2 text-sm font-normal text-neutral-500 dark:text-neutral-400">
                  {new Date(p.held_on).toLocaleDateString("it-IT")}</span>}</p>
                <p className="text-sm">{p.podium.map((r) => `${MEDAL[r.position]} ${r.name}`).join("   ")}</p>
              </li>))}
          </ul>
        </>)}
    </>
  );
}
