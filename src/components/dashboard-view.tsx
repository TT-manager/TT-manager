import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "./avatar";
import type { loadDashboard } from "@/lib/dashboard";
import { timeAgo } from "@/lib/time";

export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;

export function DashboardView({ d, me, children }: { d: DashboardData; me: { full_name: string; avatar_path: string | null }; children: ReactNode }) {
  const pct = d.kpi.games ? Math.round((d.kpi.wins / d.kpi.games) * 100) : null;
  const kpis = [
    { label: "Campionati", value: String(d.kpi.championships).padStart(2, "0"), sub: d.kpi.championships ? "a cui partecipi" : "inizia a partecipare", icon: "🏆" },
    { label: "Partite giocate", value: String(d.kpi.games).padStart(2, "0"), sub: d.kpi.games ? "amichevoli comprese" : "la prima ti aspetta", icon: "🏓" },
    { label: "Vittorie", value: pct === null ? "—" : `${pct}%`, sub: d.kpi.games ? `${d.kpi.wins} vinte · ${d.kpi.games - d.kpi.wins} perse` : "inizia a giocare", icon: "📈" },
    { label: "Da fare", value: String(d.kpi.todo).padStart(2, "0"), href: d.kpi.friendRequests ? "/amici" : "/profilo",
      sub: d.kpi.todo ? [d.kpi.friendRequests && (d.kpi.friendRequests === 1 ? "1 richiesta d'amicizia" : `${d.kpi.friendRequests} richieste d'amicizia`), d.kpi.openToJoin && (d.kpi.openToJoin === 1 ? "1 iscrizione aperta" : `${d.kpi.openToJoin} iscrizioni aperte`)].filter(Boolean).join(" · ") : "niente in sospeso", icon: "🔔" },
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
          return k.href && d.kpi.todo ? <Link key={k.label} href={k.href} className="block transition hover:-translate-y-0.5">{body}</Link> : <div key={k.label}>{body}</div>;
        })}
      </section>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div>
          <h2 className="text-2xl font-bold uppercase">La tua prossima sfida</h2>
          {d.next ? (
            <Link href={`/t/${d.next.code}`} className="card mt-3 block transition hover:border-brand">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="badge-live"><span className="live-dot" /> {d.next.tournament}</span>
                <span className="text-xs uppercase tracking-wide text-muted">{d.next.phase}{d.next.ranked ? "" : " · amichevole"}</span>
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3"><Avatar name={me.full_name} path={me.avatar_path} size="h-14 w-14 text-lg" />
                  <span className="truncate text-lg font-bold">Tu</span></div>
                <span className="font-display text-2xl font-bold text-muted">VS</span>
                <div className="flex min-w-0 items-center justify-end gap-3"><span className="truncate text-right text-lg font-bold">{d.next.opponent}</span>
                  <Avatar name={d.next.opponent} size="h-14 w-14 text-lg" /></div>
              </div>
              <p className="mt-4 border-t border-line pt-3 text-right text-sm font-semibold text-brand">Apri il torneo →</p>
            </Link>
          ) : (
            <div className="card mt-3 flex flex-wrap items-center gap-4">
              <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-2xl">🏓</span>
              <div className="flex-1"><p className="font-bold">Nessuna partita da giocare adesso</p>
                <p className="text-sm text-muted">Quando un torneo a cui sei iscritto è in corso, qui trovi il tuo prossimo avversario.</p></div>
              <Link href="/amichevole/nuovo" className="btn-primary">Organizza una sfida</Link>
            </div>
          )}

          <h2 className="mt-8 text-2xl font-bold uppercase">I tuoi campionati</h2>
          {children}
        </div>

        <aside>
          <h2 className="text-2xl font-bold uppercase">Azioni rapide</h2>
          <div className="card mt-3 grid gap-2 !p-3">
            {[
              { href: "/amichevole/nuovo", icon: "🏓", title: "Crea un torneo amichevole", sub: "Sfida i tuoi amici" },
              { href: "/amici", icon: "👥", title: "Trova amici", sub: "Cerca e aggiungi giocatori" },
              { href: "/profilo", icon: "👤", title: "Il mio profilo", sub: "Foto, dati, richieste" },
            ].map((a) => (
              <Link key={a.href} href={a.href} className="flex items-center gap-3 rounded-lg border border-line bg-background px-3 py-2.5 transition hover:border-brand">
                <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface text-lg">{a.icon}</span>
                <span className="flex-1"><span className="block text-sm font-bold">{a.title}</span><span className="text-xs text-muted">{a.sub}</span></span>
                <span aria-hidden="true" className="text-muted">›</span>
              </Link>))}
          </div>

          <h2 className="mt-8 text-2xl font-bold uppercase">Attività degli amici</h2>
          <div className="card mt-3 !py-1">
            {d.activity.length === 0 ? (
              <p className="py-3 text-sm text-muted">{d.hasFriends ? "Ancora nessuna attività dei tuoi amici." : <>Aggiungi i tuoi amici per vedere qui i loro risultati. <Link href="/amici" className="link">Trova amici</Link></>}</p>
            ) : (
              <ul className="divide-y divide-line">
                {d.activity.map((a, i) => (
                  <li key={i}><Link href={a.href} className="flex items-start gap-3 py-3 hover:text-brand">
                    <Avatar name={a.who} size="h-8 w-8 text-[0.7rem]" />
                    <span className="text-sm"><b>{a.who}</b> {a.text}<span className="block text-xs text-muted">{timeAgo(a.at)}{a.detail ? ` · ${a.detail}` : ""}</span></span>
                  </Link></li>))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

