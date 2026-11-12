import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import AutoRefresh from "@/components/auto-refresh";
import { Bracket } from "@/components/bracket";
import { normalizeCode } from "@/lib/codes";
import { getPublicTournament } from "@/lib/data";
import { parseFormat, describeFormat } from "@/lib/domain/format";
import { groupLabel, groupViews, isPlayed, resolveKnockout, type GroupView, type MatchRow } from "@/lib/domain/tournament";
import { STATUS_LABEL } from "@/lib/labels";
import { SelfEnroll } from "./self-enroll";

export default function TournamentPage({ params, searchParams }: PageProps<"/t/[codice]">) {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Suspense fallback={<p className="text-muted">Caricamento…</p>}>
        <Tournament params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function score(m: MatchRow) {
  if (!isPlayed(m)) return null;
  const detail = (m.set_scores ?? []).map(([a, b]) => `${a}-${b}`).join(", ");
  return { sets: `${m.sets_a}-${m.sets_b}`, detail };
}

async function Tournament({ params, searchParams }: Pick<PageProps<"/t/[codice]">, "params" | "searchParams">) {
  const raw = (await params).codice;
  const code = normalizeCode(raw);
  if (!/^[A-Z0-9]{6}$/.test(code)) notFound();
  // Indirizzo unico in maiuscolo (il cookie dell'organizzatore dipende dal percorso esatto).
  if (raw !== code) redirect(`/t/${code}`);
  const data = await getPublicTournament(code);
  if (!data) notFound();
  const { tournament: t, championship, members, names, matches, enrolledCount, enrolled } = data;
  const name = (id: string | null) => (id ? names.get(id) ?? "?" : null);
  const parsed = parseFormat(t.format);
  const groups = groupViews(members, matches);
  const knockout = matches.filter((m) => m.phase === "knockout");
  const resolved = new Map(resolveKnockout(groups, knockout).map((r) => [r.id, r]));
  const live = t.status === "groups" || t.status === "knockout";
  const league = "format" in parsed && parsed.format.mode === "league";

  // Due schede quando ci sono sia la qualificazione (gironi) sia la fase finale (tabellone).
  const both = groups.length > 0 && knockout.length > 0;
  const groupsDone = groups.length > 0 && groups.every((g) => g.complete);
  const wanted = (await searchParams).scheda;
  const tab = !both ? (knockout.length ? "finale" : "qualificazione")
    : wanted === "finale" || wanted === "qualificazione" ? wanted
    : t.status === "knockout" || t.status === "closed" || groupsDone ? "finale" : "qualificazione";
  const tabLink = (id: string, label: string, sub: string) => (
    <Link href={`/t/${t.public_code}?scheda=${id}`} scroll={false}
      className={`flex-1 rounded-t-xl border-b-4 px-4 py-3 text-center ${tab === id ? "border-brand bg-surface font-bold text-foreground" : "border-transparent text-muted hover:text-brand"}`}>
      <span className="block font-display text-lg uppercase tracking-wide">{label}</span><span className="text-xs">{sub}</span>
    </Link>);

  return (
    <>
      <header className="overflow-hidden rounded-2xl bg-ink text-white shadow-lg">
        <div className="relative p-6">
          <div aria-hidden="true" className="absolute inset-y-0 left-0 w-2 bg-brand" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {live && <span className="badge-live"><span className="live-dot" /> In corso</span>}
                {t.status === "closed" && <span className="badge bg-white/15 text-white">Concluso</span>}
                {t.status === "draft" && <span className="badge bg-white/15 text-white">In preparazione</span>}
                {!t.ranked && <span className="badge-friendly">Amichevole</span>}
                {t.kind === "doubles" && <span className="badge bg-white/15 text-white">Doppio</span>}
              </div>
              <h1 className="text-3xl font-bold sm:text-4xl">{t.name}</h1>
              <p className="mt-1 text-sm text-white/75">
                {championship && <><Link href={`/c/${championship.slug}`} className="underline decoration-brand underline-offset-2 hover:text-white">{championship.name}</Link>{t.ranked ? " · vale per la classifica" : " · non vale per la classifica"} · </>}
                {t.starts_on && `${new Date(t.starts_on).toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" })} · `}codice <span className="font-mono">{t.public_code}</span>
              </p>
            </div>
            {t.status !== "closed" && (
              <div className="text-right text-sm">
                <AutoRefresh />
                <Link href={`/t/${t.public_code}/organizzatore`} className="mt-1 inline-block underline decoration-brand underline-offset-2">Inserisci risultati (organizzatore)</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {"format" in parsed && (
        <details className="card mt-4"><summary className="cursor-pointer font-medium">Formato del torneo</summary>
          <ul className="mt-2 list-disc pl-5 text-sm">{describeFormat(parsed.format, enrolledCount || undefined).map((l) => <li key={l}>{l}</li>)}</ul>
        </details>
      )}

      {t.status === "draft" ? (
        <>
          <Suspense fallback={null}><SelfEnroll t={t} slug={championship?.slug ?? null} /></Suspense>
          <section className="card mt-6">
            <h2 className="text-xl font-bold uppercase">{t.kind === "doubles" ? "Iscrizioni" : "Iscritti"} <span className="text-muted">({enrolledCount})</span></h2>
            <p className="text-sm text-muted">Il torneo è in preparazione: gironi e tabellone non sono ancora stati sorteggiati.</p>
            {enrolled.length > 0 && (
              <ul className="mt-3 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {enrolled.map((e, i) => <li key={i} className="rounded-lg bg-background px-3 py-1.5">{e.name}{e.solo && <span className="text-sm text-muted"> · cerca un compagno</span>}</li>)}
              </ul>)}
          </section>
        </>
      ) : (
        <>
          {both && (
            <nav className="mt-6 flex gap-1 border-b border-line">
              {tabLink("qualificazione", "Qualificazione", `${groups.length} ${groups.length === 1 ? "girone" : "gironi"}${groupsDone ? " · conclusa" : ""}`)}
              {tabLink("finale", "Fase finale", "tabellone a eliminazione")}
            </nav>)}

          {tab === "qualificazione" && groups.length > 0 && (
            <div className={`mt-6 grid gap-6 ${groups.length > 1 ? "lg:grid-cols-2" : ""}`}>
              {groups.map((g) => <Group key={g.group} g={g} name={name} single={league || groups.length === 1} />)}
            </div>)}

          {tab === "finale" && knockout.length > 0 && (
            <section className="mt-6">
              {both && !groupsDone && <p className="mb-4 rounded-lg bg-brand/10 px-4 py-2 text-sm">La qualificazione è ancora in corso: i nomi compariranno man mano che i gironi si concludono.</p>}
              <Bracket knockout={knockout} resolved={resolved} name={name} />
            </section>)}
        </>
      )}
      <p className="mt-8 text-sm text-muted">Stato: {STATUS_LABEL[t.status]}</p>
    </>
  );
}

function Group({ g, name, single = false }: { g: GroupView; name: (id: string | null) => string | null; single?: boolean }) {
  return (
    <section className="card overflow-hidden !p-0">
      <h3 className="flex items-center justify-between bg-ink px-4 py-2.5 text-lg font-bold uppercase text-white">
        {single ? "Classifica" : `Girone ${groupLabel(g.group)}`}
        {g.complete ? <span className="badge bg-white/15 text-white">Concluso</span> : <span className="badge-live"><span className="live-dot" /> In corso</span>}
      </h3>
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-muted"><tr><th className="py-2 pl-4">#</th><th>Giocatore</th><th className="text-right">V</th><th className="text-right">P</th><th className="text-right">Set</th><th className="pr-4 text-right">Punti</th></tr></thead>
        <tbody>
          {g.standings.map((s) => (
            <tr key={s.playerId} className="border-t border-line">
              <td className="py-2 pl-4"><span className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-display font-bold ${s.rank === 1 ? "bg-gold text-ink" : "text-muted"}`}>{s.rank}</span></td>
              <td className="font-medium">{name(s.playerId)}</td>
              <td className="text-right tabular-nums">{s.wins}</td>
              <td className="text-right tabular-nums">{s.losses}</td>
              <td className="text-right tabular-nums text-muted">{s.setsFor}-{s.setsAgainst}</td>
              <td className="pr-4 text-right font-display text-lg font-bold tabular-nums">{s.tablePoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4 className="mt-3 flex items-center justify-between border-y border-line bg-ink/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted dark:bg-white/5">
        Incontri
        <span className="font-normal normal-case tracking-normal">{g.matches.filter((m) => score(m)).length} su {g.matches.length} giocati</span>
      </h4>
      <ul className="divide-y divide-line text-sm">
        {g.matches.map((m) => {
          const sc = score(m);
          const winA = sc && (m.sets_a as number) > (m.sets_b as number);
          return (
            <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2">
              <span><span className={winA ? "rounded bg-gold/20 px-1 font-semibold" : ""}>{name(m.player_a)}</span> <span className="text-muted">vs</span> <span className={sc && !winA ? "rounded bg-gold/20 px-1 font-semibold" : ""}>{name(m.player_b)}</span></span>
              {sc ? <span className="text-right"><span className="rounded bg-ink px-2 py-0.5 font-display font-bold tabular-nums text-white dark:bg-neutral-700">{sc.sets}</span>
                {sc.detail && <span className="block text-[0.7rem] text-muted">{sc.detail}</span>}</span>
                : <span className="text-xs text-muted">da giocare</span>}
            </li>);
        })}
      </ul>
    </section>
  );
}
