import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPlayer } from "@/lib/data";

export default function PlayerPage({ params }: PageProps<"/giocatore/[id]">) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">← Classifica</Link>
      <Suspense fallback={<p className="mt-6 text-neutral-600 dark:text-neutral-400">Caricamento…</p>}>
        <Player params={params} />
      </Suspense>
    </main>
  );
}

async function Player({ params }: { params: PageProps<"/giocatore/[id]">["params"] }) {
  const { id } = await params;
  // Un id non valido farebbe fallire la query: lo trattiamo come "non trovato".
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const data = await getPlayer(id);
  if (!data) notFound();
  const { player, history } = data;
  return (
    <>
      <h1 className="mt-4 text-3xl font-bold">{player.full_name}</h1>
      <p className="text-neutral-600 dark:text-neutral-400">{player.club ?? "Nessun circolo"}</p>
      <p className="mt-4 text-5xl font-bold tabular-nums">{player.rating}
        <span className="ml-2 text-base font-normal text-neutral-500 dark:text-neutral-400">Elo · {player.games_played} partite</span></p>

      <h2 className="mt-8 text-xl font-semibold">Storico rating</h2>
      {history.length === 0 ? (
        <p className="mt-2 text-neutral-600 dark:text-neutral-400">Ancora nessuna partita registrata.</p>
      ) : (
        <>
          <Chart points={[history[0].rating_before, ...history.map((h) => h.rating_after)]} />
          <ul className="mt-4 divide-y">
            {[...history].reverse().map((h) => {
              const delta = h.rating_after - h.rating_before;
              return (
                <li key={h.id} className="flex justify-between py-2">
                  <span>{h.tournament?.name ?? "Torneo"} <span className="text-sm text-neutral-500 dark:text-neutral-400">
                    {new Date(h.created_at).toLocaleDateString("it-IT")}</span></span>
                  <span className="tabular-nums">{h.rating_after}{" "}
                    <span className={delta >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                      ({delta >= 0 ? "+" : ""}{delta})</span></span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </>
  );
}

function Chart({ points }: { points: number[] }) {
  const w = 600, h = 160, pad = 8;
  const min = Math.min(...points), max = Math.max(...points);
  const span = Math.max(max - min, 1);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(points.length - 1, 1);
  const y = (v: number) => h - pad - ((v - min) * (h - 2 * pad)) / span;
  const d = points.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full" role="img" aria-label="Andamento del rating">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
      {points.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="currentColor" />)}
    </svg>
  );
}
