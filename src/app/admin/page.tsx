import Link from "next/link";
import { Icon, type IconName } from "@/components/icons";
import { managedChampionships, requireAdmin } from "@/lib/auth";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { hasServiceKey } from "@/lib/organizer";
import { tr } from "@/i18n/server";
import { adminShellText } from "@/i18n/dict/admin-shell";

export async function generateMetadata() {
  return { title: (await tr(adminShellText)).adminArea };
}

/** Home dell'amministrazione: cose da sistemare in cima, poi le sezioni con i loro numeri. */
export default async function AdminHome() {
  const t = await tr(adminShellText);
  const admin = await requireAdmin();
  const owner = admin.role === "owner";
  const leagues = await managedChampionships();
  const ids = leagues.map((c) => c.id as string);
  const supabase = await createServerSupabase();
  const svc = hasServiceKey() ? createServiceClient() : null;
  const none = { count: 0 } as { count: number | null };
  const [tournaments, players, clubRequests, joinRequests, disputedChallenges] = await Promise.all([
    supabase.from("tournaments").select("id, name, status, championship_id"),
    // guest_of non è leggibile con il login normale: si conta con la chiave del server.
    (svc ?? supabase).from("players").select("id", { count: "exact", head: true }).is("guest_of", null),
    owner ? supabase.from("club_requests").select("id", { count: "exact", head: true }).eq("status", "pending") : none,
    ids.length ? supabase.from("championship_requests").select("championship_id").eq("status", "pending").in("championship_id", ids) : { data: [] },
    svc && ids.length ? svc.from("challenges").select("championship_id").eq("status", "disputed").in("championship_id", ids) : { data: [] },
  ]);
  // Se tutte le cose da sistemare sono in un solo circuito, il collegamento porta dritto lì (e si legge il nome).
  const where = (rows: { championship_id: string }[] | null | undefined, anchor = "") => {
    const found = [...new Set((rows ?? []).map((r) => r.championship_id))];
    const one = found.length === 1 ? leagues.find((c) => c.id === found[0]) : undefined;
    return { n: (rows ?? []).length, href: one ? `/admin/campionati/${one.id}${anchor}` : "/admin/campionati", name: one ? (one.name as string) : null };
  };
  const joins = where((joinRequests as { data: { championship_id: string }[] | null }).data, "#richieste");
  const disputes = where((disputedChallenges as { data: { championship_id: string }[] | null }).data);
  const rows = (tournaments as { data: { id: string; name: string; status: string }[] | null }).data ?? [];
  const live = rows.filter((x) => x.status === "groups" || x.status === "knockout");
  const { count: disputedMatches } = live.length
    ? await supabase.from("matches").select("id", { count: "exact", head: true }).not("disputed_at", "is", null).in("tournament_id", live.map((x) => x.id))
    : none;

  const todo = [
    { n: joins.n, label: t.todoJoin, href: joins.href, name: joins.name },
    { n: disputedMatches ?? 0, label: t.todoDisputedMatches, href: "/admin/tornei", name: null },
    { n: disputes.n, label: t.todoDisputedChallenges, href: disputes.href, name: disputes.name },
    { n: clubRequests.count ?? 0, label: t.todoClubs, href: "/admin/circoli", name: null },
  ].filter((x) => x.n > 0).map((x) => ({ ...x, text: x.label(x.n) }));

  const tiles = [
    { href: "/admin/campionati", icon: "trophy" as IconName, title: t.navLeagues, text: t.homeLeagues, stat: t.statLeagues(leagues.length) },
    { href: "/admin/tornei", icon: "tournament" as IconName, title: t.navTournaments, text: t.homeTournaments,
      stat: live.length ? t.statLive(live.length) : t.statTournaments(rows.length), hot: live.length > 0 },
    ...(owner ? [
      { href: "/admin/giocatori", icon: "friends" as IconName, title: t.navPlayers, text: t.homePlayers, stat: t.statPlayers(players.count ?? 0) },
      { href: "/admin/circoli", icon: "clubs" as IconName, title: t.navClubs, text: t.homeClubs, stat: clubRequests.count ? t.statRequests(clubRequests.count) : null, hot: Boolean(clubRequests.count) },
      { href: "/admin/amministratori", icon: "admin" as IconName, title: t.navAdmins, text: t.homeAdmins, stat: null },
      { href: "/admin/backup", icon: "backup" as IconName, title: t.navBackup, text: t.homeBackup, stat: null },
    ] : []),
    { href: "/admin/password", icon: "password" as IconName, title: t.navPassword, text: t.homePassword, stat: null },
  ];

  // Azioni rapide: nuovo torneo (già nel circuito, se ne gestisci uno solo) e i tornei in corso.
  const newHref = leagues.length === 1 ? `/admin/tornei/nuovo?campionato=${leagues[0].id}` : "/admin/tornei/nuovo";

  return (
    <main className="space-y-8">
      <section>
        <h2 className="font-display text-xl font-bold uppercase">{t.quickTitle}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={newHref} className="btn-primary"><Icon name="add" className="h-5 w-5" /> {t.newTournament}</Link>
          {live.slice(0, 4).map((x) => (
            <Link key={x.id} href={`/gestione/${x.id}`} className="btn-outline"><span className="live-dot text-brand" /> {t.quickManage(x.name)}</Link>))}
        </div>
      </section>

      {todo.length > 0 && (
        <section className="rounded-xl border-2 border-amber-400 p-4">
          <h2 className="font-display text-xl font-bold uppercase">{t.todoTitle}</h2>
          <ul className="mt-2 divide-y divide-line">
            {todo.map((x) => (
              <li key={x.text}>
                <Link href={x.href} className="flex items-center justify-between gap-3 py-2.5 hover:text-brand">
                  <span><span className="mr-2 inline-flex min-w-7 justify-center rounded-full bg-amber-400 px-2 font-bold text-ink">{x.n}</span>{x.text}{x.name && <span className="text-muted"> · {x.name}</span>}</span>
                  <span aria-hidden="true" className="text-xl text-muted">›</span>
                </Link>
              </li>))}
          </ul>
        </section>)}

      <section>
        <h1 className="text-2xl font-bold uppercase">{t.homeTitle}</h1>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {tiles.map((x) => (
            <li key={x.href}>
              <Link href={x.href} className="card flex h-full items-center gap-4 transition hover:border-brand">
                <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><Icon name={x.icon} className="h-6 w-6" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-bold uppercase">{x.title}</span>
                    {x.stat && <span className={x.hot ? "badge-live" : "badge-muted"}>{x.hot && <span className="live-dot" />}{x.stat}</span>}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{x.text}</span>
                </span>
                <span aria-hidden="true" className="text-2xl text-muted">›</span>
              </Link>
            </li>))}
        </ul>
      </section>
    </main>
  );
}
