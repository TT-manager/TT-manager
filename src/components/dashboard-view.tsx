import Link from "next/link";
import { MyChallenges } from "@/components/challenges";
import { openChallengesOf, playerNames, sideOf, sideOfPlayer } from "@/lib/challenges";
import { challengesText } from "@/i18n/dict/challenges";
import type { ReactNode } from "react";
import { Avatar } from "./avatar";
import { Icon, type IconName } from "./icons";
import type { loadDashboard, Side } from "@/lib/dashboard";
import { timeAgo } from "@/lib/time";
import { formatDeadline } from "@/lib/registration";
import { intlTag } from "@/i18n/locale";
import { getLocale, tr } from "@/i18n/server";
import { compDashboard } from "@/i18n/dict/comp-dashboard";

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;

/** Un lato della sfida: una foto e un nome nel singolare, due foto sovrapposte e due nomi nel doppio. */
function SideView({ side, meId, right = false, you }: { side: Side; meId?: string; right?: boolean; you: string }) {
  const pair = side.length > 1;
  const size = pair ? "h-9 w-9 text-xs sm:h-10 sm:w-10 sm:text-sm" : "h-12 w-12 text-base sm:h-14 sm:w-14 sm:text-lg";
  return (
    <div className={`flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 ${right ? "items-end text-right sm:flex-row-reverse" : "items-start"}`}>
      <span className={`flex shrink-0 ${pair ? (right ? "-space-x-3 flex-row-reverse space-x-reverse" : "-space-x-3") : ""}`}>
        {side.map((p) => <Avatar key={p.id} name={p.name} path={p.avatar} size={size} />)}
      </span>
      <span className={`min-w-0 max-w-full font-bold leading-tight [overflow-wrap:anywhere] ${pair ? "text-sm sm:text-base" : "text-base sm:text-lg"}`}>
        {side.map((p) => <span key={p.id} className="block">{p.id === meId ? you : p.name}</span>)}
      </span>
    </div>);
}

export async function DashboardView({ d, me, children, challengeLeagues = [] }: {
  d: DashboardData; me: { id: string; full_name: string; avatar_path: string | null }; children: ReactNode;
  /** Circuiti di cui fai parte in cui le sfide sono attive. */
  challengeLeagues?: { name: string; slug: string }[];
}) {
  const t = await tr(compDashboard);
  const l = await getLocale();
  const pct = d.kpi.games ? Math.round((d.kpi.wins / d.kpi.games) * 100) : null;
  const kpis = [
    { label: t.kpiLeagues, value: String(d.kpi.championships), sub: d.kpi.championships ? t.leaguesSub : t.leaguesSubNone, icon: "trophy" as IconName },
    { label: t.kpiLive, value: String(d.live.length), icon: "live" as IconName,
      href: d.live.length === 1 ? `/t/${d.live[0].code}` : d.live.length ? "#in-corso" : undefined,
      sub: d.live.length === 1 ? d.live[0].name : d.live.length ? t.liveSubMany : t.liveSubNone },
    { label: t.kpiGames, value: String(d.kpi.games), sub: d.kpi.games ? t.gamesSub : t.gamesSubNone, icon: "match" as IconName },
    { label: t.kpiWins, value: pct === null ? "—" : `${pct}%`, sub: d.kpi.games ? t.winsSub(d.kpi.wins, d.kpi.games - d.kpi.wins) : t.winsSubNone, icon: "wins" as IconName },
  ];
  // Senza una partita di torneo, il riquadro propone il prossimo passo: prima una sfida che aspetta te,
  // poi una sfida accettata da giocare; altrimenti lancia una sfida o crea un amichevole.
  let step: { text: string; action: boolean } | null = null;
  if (!d.next) {
    const open = await openChallengesOf(me.id);
    const mySide = (c: (typeof open)[number]) => sideOfPlayer(c, me.id);
    const needsMe = open.find((c) => (c.status === "pending" && mySide(c) === "b")
      || (c.status === "reported" && sideOfPlayer(c, c.reported_by ?? "") !== mySide(c)));
    const c = needsMe ?? open.find((x) => x.status === "accepted");
    if (c) {
      const other = mySide(c) === "a" ? "b" : "a";
      const [names, tc] = await Promise.all([playerNames(sideOf(c, other)), tr(challengesText)]);
      const name = sideOf(c, other).map((id) => names.get(id) ?? "?").join(" / ");
      step = needsMe
        ? { text: c.status === "pending" ? tc.challengedYou(name) : tc.toConfirm(name), action: true }
        : { text: tc.acceptedWith(name), action: false };
    }
  }
  return (
    <>
      {d.open.length > 0 && (
        <section className="mt-6">
          <h2 className="flex items-center gap-2 text-2xl font-bold uppercase">{t.openTitle}
            <span className="rounded-full bg-green-600 px-2.5 text-base text-white">{d.open.length}</span></h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {d.open.map((x) => (
              <li key={x.code}><Link href={`/t/${x.code}`}
                className={`card flex items-center justify-between gap-3 border-2 transition hover:-translate-y-0.5 ${x.enrolled ? "" : "border-green-600"}`}>
                <span className="min-w-0">
                  <span className="block truncate font-display text-xl font-bold uppercase">{x.name}</span>
                  <span className="block text-sm text-muted">{x.league}
                    {x.startsOn && ` · ${new Date(x.startsOn).toLocaleDateString(intlTag(l), { weekday: "short", day: "numeric", month: "long" })}`}</span>
                  {x.deadline && <span className="block text-xs text-muted">{t.closesOn(formatDeadline(x.deadline, l))}</span>}
                </span>
                {x.enrolled
                  ? <span className="badge shrink-0 bg-green-600/15 text-green-700 dark:text-green-400">{t.enrolled}</span>
                  : <span className="btn-primary shrink-0 py-1.5 text-sm">{t.signUp}</span>}
              </Link></li>))}
          </ul>
        </section>)}


      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <h2 className="text-2xl font-bold uppercase">{d.next ? t.nextTitle : t.whatNowTitle}</h2>
          {d.next ? (
            <Link href={`/t/${d.next.code}`} className="card mt-3 block transition hover:border-brand">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="badge-live"><span className="live-dot" /> {d.next.tournament}</span>
                <span className="text-xs uppercase tracking-wide text-muted">{d.next.phase}{d.next.ranked ? "" : t.friendlySuffix}</span>
              </div>
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
                <SideView side={d.next.me} meId={me.id} you={t.you} />
                <span className="font-display text-2xl font-bold text-muted">VS</span>
                <SideView side={d.next.opponent} right you={t.you} />
              </div>
              <p className="mt-4 border-t border-line pt-3 text-right text-sm font-semibold text-brand">{t.openTournament}</p>
            </Link>
          ) : step ? (
            <div className="card mt-3 flex flex-wrap items-center gap-4 border-2 border-brand">
              <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Icon name="match" className="h-7 w-7" /></span>
              <p className="min-w-0 flex-1 font-bold">{step.text}</p>
              <Link href="#sfide" className="btn-primary">{step.action ? t.stepAnswer : t.stepOpen}</Link>
            </div>
          ) : (
            <div className="card mt-3">
              <div className="flex flex-wrap items-center gap-4">
                <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand"><Icon name="match" className="h-7 w-7" /></span>
                <div className="min-w-0 flex-1"><p className="font-bold">{t.nothingTitle}</p>
                  <p className="text-sm text-muted">{t.nothingText}</p></div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {challengeLeagues.slice(0, 3).map((c) => (
                  <Link key={c.slug} href={`/c/${c.slug}#sfide-circuito`} className="btn-primary">
                    {challengeLeagues.length === 1 ? t.launchChallenge : t.challengeIn(c.name)}</Link>))}
                <Link href="/amichevole/nuovo" className={challengeLeagues.length ? "btn-outline" : "btn-primary"}>{t.createFriendly}</Link>
              </div>
            </div>
          )}

          <MyChallenges playerId={me.id} className="mt-8" />

          {d.live.length > 0 && <>
            <h2 id="in-corso" className="mt-8 scroll-mt-24 text-2xl font-bold uppercase">{t.liveTitle}</h2>
            <ul className="mt-3 grid gap-3">
              {d.live.map((x) => (
                <li key={x.code}><Link href={`/t/${x.code}`} className="card block transition hover:border-brand">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2 font-bold"><span className="live-dot text-brand" /> <span className="truncate">{x.name}</span></span>
                    <span className="flex items-center gap-2">
                      {x.playing && <span className="badge bg-gold/20 text-ink dark:text-gold">{t.youPlay}</span>}
                      <span className="text-xs uppercase tracking-wide text-muted">{x.phase}</span>
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted">{x.league ?? t.friendly}{x.league && !x.ranked ? t.friendlySuffix : ""}</p>
                  {x.total > 0 && (
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full bg-brand" style={{ width: `${Math.round((x.played / x.total) * 100)}%` }} /></span>
                      <span className="tabular-nums">{t.progress(x.played, x.total)}</span>
                    </div>)}
                </Link></li>))}
            </ul>
          </>}

          <h2 className="mt-8 text-2xl font-bold uppercase">{t.myLeagues}</h2>
          {children}

          {/* I tuoi numeri, in piccolo: in fondo, perché cambiano poco e non chiedono di fare niente. */}
          <section className="mt-8 grid grid-cols-4 gap-2 text-center">
            {kpis.map((k) => {
              const body = <>
                <span className="block font-display text-2xl font-bold leading-none">{k.value}</span>
                <span className="mt-1 block text-[0.7rem] font-bold uppercase leading-tight tracking-wide text-muted">{k.label}</span>
              </>;
              const cls = "block h-full rounded-lg border border-line px-1 py-2.5";
              return k.href ? <Link key={k.label} href={k.href} className={`${cls} hover:border-brand`}>{body}</Link> : <div key={k.label} className={cls}>{body}</div>;
            })}
          </section>
        </div>

        <aside>
          <h2 id="azioni-rapide" className="scroll-mt-24 text-2xl font-bold uppercase">{t.quickActions}</h2>
          <div className="card mt-3 grid gap-2 !p-3">
            {[
              { href: "/amichevole/nuovo", icon: "add" as IconName, title: t.createFriendly, sub: t.challengeFriends },
              ...challengeLeagues.map((c) => ({
                href: `/c/${c.slug}#sfide-circuito`, icon: "match" as IconName,
                title: challengeLeagues.length === 1 ? t.launchChallenge : t.challengeIn(c.name), sub: t.challengeSub,
              })),
              { href: "/amici", icon: "friends" as IconName, title: d.kpi.friendRequests ? t.friendRequests : t.findFriends,
                sub: d.kpi.friendRequests ? t.requestsToAccept(d.kpi.friendRequests) : t.searchPlayers, alert: d.kpi.friendRequests },
              { href: "/profilo", icon: "profile" as IconName, title: t.myProfile,
                sub: d.kpi.openToJoin ? t.openRegistrations(d.kpi.openToJoin) : t.profileSub, alert: d.kpi.openToJoin },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-lg border border-line bg-background px-3 py-2.5 transition hover:border-brand">
                <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-brand"><Icon name={a.icon} /></span>
                <span className="flex-1"><span className="block text-sm font-bold">{a.title}</span><span className="text-xs text-muted">{a.sub}</span></span>
                {"alert" in a && a.alert ? <span className="rounded-full bg-brand px-2 text-xs font-bold text-white">{a.alert}</span> : null}
                <span aria-hidden="true" className="text-muted">›</span>
              </Link>))}
          </div>

          <h2 className="mt-8 text-2xl font-bold uppercase">{t.activityTitle}</h2>
          <div className="card mt-3 !py-1">
            {d.activity.length === 0 ? (
              <p className="py-3 text-sm text-muted">{d.hasFriends ? t.noActivity : <>{t.addFriends} <Link href="/amici" className="link">{t.findFriends}</Link></>}</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.activity.map((a, i) => (
                  <li key={i}><Link href={a.href} className="flex items-start gap-3 py-3 hover:text-brand">
                    <Avatar name={a.who} size="h-8 w-8 text-[0.7rem]" />
                    <span className="text-sm"><b>{a.who}</b> {a.text}<span className="block text-xs text-muted">{timeAgo(a.at, undefined, l)}{a.detail ? ` · ${a.detail}` : ""}</span></span>
                  </Link></li>))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

