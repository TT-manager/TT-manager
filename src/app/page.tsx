import Link from "next/link";
import { Suspense } from "react";
import { getRanking } from "@/lib/data";

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-3xl font-bold">Campionato di tennis tavolo</h1>
      <p className="mt-2 text-neutral-600">Classifica generale e tornei in diretta.</p>

      <form action="/t" className="mt-6 flex gap-2">
        <input name="codice" placeholder="Hai un codice torneo?" aria-label="Codice torneo"
          className="min-w-0 flex-1 rounded border px-3 py-2 uppercase" />
        <button className="rounded bg-black px-4 py-2 text-white">Apri</button>
      </form>

      <h2 className="mt-10 text-xl font-semibold">Classifica</h2>
      <Suspense fallback={<p className="mt-3 text-neutral-600">Caricamento…</p>}>
        <Ranking />
      </Suspense>
    </main>
  );
}

async function Ranking() {
  const rows = await getRanking();
  if (rows.length === 0) {
    return <p className="mt-3 text-neutral-600">Nessun giocatore in classifica.</p>;
  }
  return (
    <table className="mt-3 w-full text-left">
      <thead className="text-sm text-neutral-500">
        <tr><th className="py-2">#</th><th>Giocatore</th><th className="hidden sm:table-cell">Circolo</th>
          <th className="text-right">Partite</th><th className="text-right">Elo</th></tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t">
            <td className="py-2 tabular-nums">{r.position}</td>
            <td><Link href={`/giocatore/${r.id}`} className="font-medium underline-offset-2 hover:underline">{r.full_name}</Link></td>
            <td className="hidden text-neutral-600 sm:table-cell">{r.club}</td>
            <td className="text-right tabular-nums">{r.games_played}</td>
            <td className="text-right font-semibold tabular-nums">{r.rating}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
