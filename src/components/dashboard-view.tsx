import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "./avatar";
import type { loadDashboard, Side } from "@/lib/dashboard";
import { timeAgo } from "@/lib/time";
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

export async function DashboardView({ d, me, children }: { d: DashboardData; me: { id: string; full_name: string; avatar_path: string | null }; children: ReactNode }) {
  const t = await tr(compDashboard);
  const l = await getLocale();
  const pct = d.kpi.games ? Math.round((d.kpi.wins / d.kpi.games) * 100) : null;
  const kpis = [
    { label: t.kpiLeagues, value: String(d.kpi.championships).padStart(2, "0"), sub: d.kpi.championships ? t.leaguesSub : t.leaguesSubNone, icon: "🏆" },
    { label: t.kpiLive, value: String(d.live.length).padStart(2, "0"), icon: "🔴",
      href: d.live.length === 1 ? `/t/${d.live[0].code}` : d.live.length ? "#in-corso" : undefined,
      sub: d.live.length === 1 ? d.live[0].name : d.live.length ? t.liveSubMany : t.liveSubNone },
    { label: t.kpiGames, value: String(d.kpi.games).padStart(2, "0"), sub: d.kpi.games ? t.gamesSub : t.gamesSubNone, icon: "🏓" },
    { label: t.kpiWins, value: pct === null ? "—" : `${pct}%`, sub: d.kpi.games ? t.winsSub(d.kpi.wins, d.kpi.games - d.kpi.wins) : t.winsSubNone, icon: "📈" },
  ];
  return (
    <>
      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => {
          const body = (
            <div className="card flex h-full items-start justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted">{k.label}</p>
                <p className="mt-1 font-display text-4xl font-bold leading-none">{k.value}</p>
                <p className="mt-1 text-xs text-muted">{k.sub}</p>
              </div>
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-lg">{k.icon}</span>
            </div>);
          return k.href ? <Link key={k.label} href={k.href} className="block transition hover:-translate-y-0.5">{body}</Link> : <div key={k.label}>{body}</div>;
        })}
      </section>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <h2 className="text-2xl font-bold uppercase">{t.nextTitle}</h2>
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
          ) : (
            <div className="card mt-3 flex flex-wrap items-center gap-4">
              <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-2xl">🏓</span>
              <div className="flex-1"><p className="font-bold">{t.noMatchTitle}</p>
                <p className="text-sm text-muted">{t.noMatchText}</p></div>
              <Link href="/amichevole/nuovo" className="btn-primary">{t.organise}</Link>
            </div>
          )}

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
        </div>

        <aside>
          <h2 className="text-2xl font-bold uppercase">{t.quickActions}</h2>
          <div className="card mt-3 grid gap-2 !p-3">
            {[
              { href: "/amichevole/nuovo", icon: "🏓", title: t.createFriendly, sub: t.challengeFriends },
              { href: "/amici", icon: "👥", title: d.kpi.friendRequests ? t.friendRequests : t.findFriends,
                sub: d.kpi.friendRequests ? t.requestsToAccept(d.kpi.friendRequests) : t.searchPlayers, alert: d.kpi.friendRequests },
              { href: "/profilo", icon: "👤", title: t.myProfile,
                sub: d.kpi.openToJoin ? t.openRegistrations(d.kpi.openToJoin) : t.profileSub, alert: d.kpi.openToJoin },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-lg border border-line bg-background px-3 py-2.5 transition hover:border-brand">
                <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-lg">{a.icon}</span>
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

