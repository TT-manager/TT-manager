import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { normalizeCode } from "@/lib/codes";
import { getPublicTournament } from "@/lib/data";
import { stageName } from "@/lib/domain/format";
import { groupLabel, isPlayed } from "@/lib/domain/tournament";
import { hasServiceKey, organizerTournamentId } from "@/lib/organizer";
import { MatchForm } from "@/components/match-form";
import { logout, submitResult } from "./actions";
import { OrganizerLogin } from "./forms";

export const metadata = { title: "Inserimento risultati", robots: { index: false } };

export default function OrganizerPage({ params }: PageProps<"/t/[codice]/organizzatore">) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <Suspense fallback={<p>Caricamento…</p>}><Content params={params} /></Suspense>
    </main>
  );
}

async function Content({ params }: { params: PageProps<"/t/[codice]/organizzatore">["params"] }) {
  const raw = (await params).codice;
  const code = normalizeCode(raw);
  if (!/^[A-Z0-9]{6}$/.test(code)) notFound();
  // Indirizzo unico in maiuscolo (il cookie dell'organizzatore dipende dal percorso esatto).
  if (raw !== code) redirect(`/t/${code}/organizzatore`);
  const data = await getPublicTournament(code);
  if (!data) notFound();
  const { tournament: t, names, matches } = data;
  const back = <Link href={`/t/${code}`} className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">← {t.name}</Link>;

  if (!hasServiceKey()) return <>{back}<p className="mt-6">Inserimento risultati non ancora attivo: manca la configurazione del server (chiave segreta).</p></>;
  const tid = await organizerTournamentId(code);
  if (!tid) return (<>{back}<h1 className="mt-4 text-2xl font-bold">Inserimento risultati</h1><OrganizerLogin publicCode={code} /></>);
  if (t.status === "draft") return <>{back}<p className="mt-6">I gironi non sono ancora stati generati.</p></>;
  if (t.status === "closed") return <>{back}<p className="mt-6">Il torneo è chiuso.</p></>;

  const name = (id: string | null) => (id ? names.get(id) ?? "?" : "?");
  const ready = matches.filter((m) => m.player_a && m.player_b);
  const order = (m: (typeof matches)[number]) => (m.phase === "group" ? [0, m.round, m.group_no ?? 0, m.position] : [1, -(m.stage ?? 0), m.position, 0]);
  const sorted = [...ready].sort((x, y) => { const a = order(x), b = order(y); for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; });
  const todo = sorted.filter((m) => !isPlayed(m));
  const done = sorted.filter(isPlayed).reverse();
  const waiting = matches.length - ready.length;
  const label = (m: (typeof matches)[number]) =>
    m.phase === "group" ? `Girone ${groupLabel(m.group_no ?? 0)} · turno ${m.round}` : `${stageName(m.stage ?? 0)} ${m.position + 1}`;

  const Row = ({ m }: { m: (typeof matches)[number] }) => (
    <li className="border-t py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span><span className="text-sm text-neutral-600 dark:text-neutral-400">{label(m)}</span><br />
          <strong>{name(m.player_a)}</strong> – <strong>{name(m.player_b)}</strong></span>
        {isPlayed(m) && <span className="tabular-nums">{m.sets_a}-{m.sets_b}{m.set_scores ? ` (${m.set_scores.map(([a, b]) => `${a}-${b}`).join(", ")})` : ""}</span>}
      </div>
      <MatchForm action={submitResult} hidden={{ public_code: code }} matchId={m.id} bestOf={m.best_of} rules={{ points: m.set_points, golden: m.golden_point }} a={name(m.player_a)} b={name(m.player_b)} initial={m.set_scores} />
    </li>
  );

  return (
    <>
      {back}
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inserimento risultati</h1>
        <form action={logout}><input type="hidden" name="public_code" value={code} /><button className="rounded border px-3 py-1 text-sm">Esci</button></form>
      </div>
      <h2 className="mt-6 text-lg font-semibold">Da giocare ({todo.length})</h2>
      {todo.length ? <ul>{todo.map((m) => <Row key={m.id} m={m} />)}</ul> : <p className="text-neutral-600 dark:text-neutral-400">Nessuna partita pronta.</p>}
      {waiting > 0 && <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{waiting} partite del tabellone in attesa dei risultati precedenti.</p>}
      <h2 className="mt-8 text-lg font-semibold">Già giocate ({done.length})</h2>
      <ul>{done.map((m) => <Row key={m.id} m={m} />)}</ul>
    </>
  );
}
