import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import AutoRefresh from "@/components/auto-refresh";
import { normalizeCode } from "@/lib/codes";
import { getPublicTournament } from "@/lib/data";
import { parseFormat, stageName, describeFormat } from "@/lib/domain/format";
import { groupLabel, groupViews, isPlayed, resolveKnockout, sourceLabel, type GroupView, type MatchRow } from "@/lib/domain/tournament";
import { STATUS_LABEL } from "@/lib/labels";

export default function TournamentPage({ params }: PageProps<"/t/[codice]">) {
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/" className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">← Classifica generale</Link>
      <Suspense fallback={<p className="mt-6">Caricamento…</p>}>
        <Tournament params={params} />
      </Suspense>
    </main>
  );
}

const muted = "text-neutral-600 dark:text-neutral-400";

function score(m: MatchRow) {
  if (!isPlayed(m)) return null;
  const detail = (m.set_scores ?? []).map(([a, b]) => `${a}-${b}`).join(", ");
  return `${m.sets_a}-${m.sets_b}${detail ? ` (${detail})` : ""}`;
}

async function Tournament({ params }: { params: PageProps<"/t/[codice]">["params"] }) {
  const code = normalizeCode((await params).codice);
  if (!/^[A-Z0-9]{6}$/.test(code)) notFound();
  const data = await getPublicTournament(code);
  if (!data) notFound();
  const { tournament: t, members, names, matches, enrolledCount } = data;
  const name = (id: string | null) => (id ? names.get(id) ?? "?" : null);
  const parsed = parseFormat(t.format);
  const groups = groupViews(members, matches);
  const knockout = matches.filter((m) => m.phase === "knockout");
  const resolved = new Map(resolveKnockout(groups, knockout).map((r) => [r.id, r]));
  const stages = [...new Set(knockout.map((k) => k.stage as number))].sort((a, b) => b - a);

  return (
    <>
      <header className="mt-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-bold">{t.name}</h1>
          <p className={muted}>
            {[t.starts_on && new Date(t.starts_on).toLocaleDateString("it-IT"), STATUS_LABEL[t.status], `codice ${t.public_code}`]
              .filter(Boolean).join(" · ")}
          </p>
        </div>
        {t.status !== "closed" && (
          <div className="text-right">
            <AutoRefresh />
            <Link href={`/t/${t.public_code}/organizzatore`} className="text-sm underline">Inserisci risultati (organizzatore)</Link>
          </div>
        )}
      </header>

      {"format" in parsed && (
        <details className="mt-4"><summary className="cursor-pointer">Formato del torneo</summary>
          <ul className="mt-2 list-disc pl-5">{describeFormat(parsed.format).map((l) => <li key={l}>{l}</li>)}</ul>
        </details>
      )}

      {t.status === "draft" ? (
        <p className="mt-8">Il torneo è in preparazione: {enrolledCount} iscritti. I gironi non sono ancora stati sorteggiati.</p>
      ) : (
        <>
          <h2 className="mt-8 text-2xl font-semibold">Gironi</h2>
          <div className="mt-3 grid gap-6 lg:grid-cols-2">
            {groups.map((g) => <Group key={g.group} g={g} name={name} />)}
          </div>

          {stages.length > 0 && (
            <>
              <h2 className="mt-10 text-2xl font-semibold">Tabellone</h2>
              <div className="mt-3 grid gap-6 md:auto-cols-fr md:grid-flow-col">
                {stages.map((s) => (
                  <section key={s}>
                    <h3 className="font-semibold">{stageName(s)}</h3>
                    <ul className="mt-2 space-y-3">
                      {knockout.filter((k) => k.stage === s).sort((x, y) => x.position - y.position).map((k) => {
                        const r = resolved.get(k.id);
                        const a = name(k.player_a ?? r?.player_a ?? null);
                        const b = name(k.player_b ?? r?.player_b ?? null);
                        const sc = score(k);
                        const winA = isPlayed(k) && (k.sets_a as number) > (k.sets_b as number);
                        return (
                          <li key={k.id} className="rounded border p-2 text-sm">
                            <div className={winA ? "font-semibold" : ""}>{a ?? <span className={muted}>{k.source_a ? sourceLabel(k.source_a) : "—"}</span>}</div>
                            <div className={isPlayed(k) && !winA ? "font-semibold" : ""}>{b ?? <span className={muted}>{k.source_b ? sourceLabel(k.source_b) : "—"}</span>}</div>
                            {sc && <div className={`mt-1 ${muted}`}>{sc}</div>}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function Group({ g, name }: { g: GroupView; name: (id: string | null) => string | null }) {
  return (
    <section className="rounded-lg border p-4">
      <h3 className="text-lg font-semibold">Girone {groupLabel(g.group)} {g.complete && <span className={`text-sm font-normal ${muted}`}>· concluso</span>}</h3>
      <table className="mt-2 w-full text-left text-sm">
        <thead className={muted}><tr><th className="py-1">#</th><th>Giocatore</th><th className="text-right">V</th><th className="text-right">P</th><th className="text-right">Set</th><th className="text-right">Punti</th></tr></thead>
        <tbody>
          {g.standings.map((s) => (
            <tr key={s.playerId} className="border-t">
              <td className="py-1 tabular-nums">{s.rank}</td>
              <td>{name(s.playerId)}</td>
              <td className="text-right tabular-nums">{s.wins}</td>
              <td className="text-right tabular-nums">{s.losses}</td>
              <td className="text-right tabular-nums">{s.setsFor}-{s.setsAgainst}</td>
              <td className="text-right font-semibold tabular-nums">{s.tablePoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="mt-3 space-y-1 text-sm">
        {g.matches.map((m) => (
          <li key={m.id} className="flex justify-between gap-2">
            <span>{name(m.player_a)} – {name(m.player_b)}</span>
            <span className={isPlayed(m) ? "tabular-nums" : muted}>{score(m) ?? "da giocare"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
