import Link from "next/link";
import { Suspense } from "react";
import { getChampionships, getRanking } from "@/lib/data";
import { RankingTable } from "@/components/ranking-table";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Tennis tavolo</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400">Classifiche dei campionati e tornei in diretta.</p>

      <form action="/t" className="mt-6 flex gap-2">
        <input name="codice" placeholder="Hai un codice torneo?" aria-label="Codice torneo"
          className="min-w-0 flex-1 rounded border px-3 py-2 uppercase" />
        <button className="rounded bg-black px-4 py-2 text-white dark:bg-white dark:text-black">Apri</button>
      </form>

      <Suspense fallback={<p className="mt-10 text-neutral-600 dark:text-neutral-400">Caricamento…</p>}>
        <Championships />
      </Suspense>

      <footer className="mt-16 text-sm text-neutral-500 dark:text-neutral-400">
        <Link href="/login" className="hover:underline">Accesso amministratori</Link>
      </footer>
    </main>
  );
}

async function Championships() {
  const list = await getChampionships();
  if (list.length === 0) return <p className="mt-10 text-neutral-600 dark:text-neutral-400">Nessun campionato ancora.</p>;
  const rankings = await Promise.all(list.map((c) => getRanking(c.id)));
  // Con un solo campionato mostriamo tutta la classifica, altrimenti i primi 10 di ognuno.
  const limit = list.length > 1 ? 10 : undefined;
  return list.map((c, i) => (
    <section key={c.id} className="mt-10">
      <h2 className="text-xl font-semibold"><Link href={`/c/${c.slug}`} className="hover:underline">{c.name}</Link>
        <span className="ml-2 text-sm font-normal text-neutral-500 dark:text-neutral-400">{c.kind === "doubles" ? "doppio" : "singolare"}</span></h2>
      <RankingTable rows={rankings[i]} label={c.settings.label} limit={limit} />
      <p className="mt-2 text-sm"><Link href={`/c/${c.slug}`} className="underline">
        {limit && rankings[i].length > limit ? "Classifica completa, tornei e albo d'oro" : "Tornei e albo d'oro"}</Link></p>
    </section>
  ));
}
