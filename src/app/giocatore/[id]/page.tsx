import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getPlayer } from "@/lib/data";
import { Avatar } from "@/components/avatar";
import { tr } from "@/i18n/server";
import { publicPlayerText } from "@/i18n/dict/public-home";

type T = (typeof publicPlayerText)["it"];

export default async function PlayerPage({ params }: PageProps<"/giocatore/[id]">) {
  const t = await tr(publicPlayerText);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className="text-sm text-neutral-600 dark:text-neutral-400 hover:underline">{t.back}</Link>
      <Suspense fallback={<p className="mt-6 text-neutral-600 dark:text-neutral-400">{t.loading}</p>}>
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
  const { player, championships } = data;
  const t = await tr(publicPlayerText);
  return (
    <>
      <header className="mt-4 flex items-center gap-5 rounded-2xl bg-ink p-5 text-white shadow-lg">
        <Avatar name={player.full_name} path={player.avatar_path as string | null} size="h-24 w-24 text-3xl" />
        <div>
          <h1 className="text-3xl font-bold sm:text-4xl">{player.full_name}</h1>
          <p className="text-white/70">{player.club ?? t.noClub}</p>
        </div>
      </header>
      {championships.length === 0 && <p className="mt-6 text-neutral-600 dark:text-neutral-400">{t.noLeague}</p>}
      {championships.map((c) => <ChampionshipBlock key={c.id} c={c} t={t} />)}
    </>
  );
}

type Block = NonNullable<Awaited<ReturnType<typeof getPlayer>>>["championships"][number];

/** Raggruppa lo storico: partenza, ogni torneo giocato (somma delle partite), ogni calo per torneo saltato. */
function groupHistory(history: Block["history"], t: T) {
  const out: { key: string; label: string; date: string; before: number; after: number }[] = [];
  for (const h of history) {
    const last = out[out.length - 1];
    const label = h.kind === "start" ? t.startRanking
      : h.challengeOpponent ? t.challengeAgainst(h.challengeOpponent)
      : h.kind === "decay" ? t.skipped(h.tournament?.name ?? t.tournamentFallback) : h.tournament?.name ?? t.tournament;
    // Le partite dello stesso torneo si sommano; ogni sfida resta una riga a sé.
    const key = h.challenge_id ? `challenge:${h.challenge_id}` : `${h.kind}:${h.tournament?.name ?? ""}`;
    if (last && last.key === key && h.kind === "match") { last.after = h.rating_after; continue; }
    out.push({ key, label, date: h.created_at, before: h.rating_before, after: h.rating_after });
  }
  return out;
}

function ChampionshipBlock({ c, t }: { c: Block; t: T }) {
  const rows = groupHistory(c.history, t);
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold"><Link href={`/c/${c.slug}`} className="hover:underline">{c.name}</Link></h2>
      <p className="mt-2 text-5xl font-bold tabular-nums">{c.rating}
        <span className="ml-2 text-base font-normal text-neutral-500 dark:text-neutral-400">{c.label.toLowerCase()} · {t.matches(c.games)}</span></p>
      {rows.length > 1 && <Chart points={[rows[0].before, ...rows.map((r) => r.after)]} label={t.chartAria} />}
      {rows.length > 0 && (
        <ul className="mt-4 divide-y">
          {[...rows].reverse().map((r, i) => {
            const delta = r.after - r.before;
            return (
              <li key={i} className="flex justify-between gap-4 py-2">
                <span>{r.label}</span>
                <span className="tabular-nums">{r.after}{" "}
                  {r.key !== "start:" && <span className={delta >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}>
                    ({delta >= 0 ? "+" : ""}{delta})</span>}</span>
              </li>
            );
          })}
        </ul>)}
    </section>
  );
}

function Chart({ points, label }: { points: number[]; label: string }) {
  const w = 600, h = 160, pad = 8;
  const min = Math.min(...points), max = Math.max(...points);
  const span = Math.max(max - min, 1);
  const x = (i: number) => pad + (i * (w - 2 * pad)) / Math.max(points.length - 1, 1);
  const y = (v: number) => h - pad - ((v - min) * (h - 2 * pad)) / span;
  const d = points.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-3 w-full" role="img" aria-label={label}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="2" />
      {points.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3" fill="currentColor" />)}
    </svg>
  );
}
