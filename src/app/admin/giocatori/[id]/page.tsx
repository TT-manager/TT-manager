import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/admin";
import { hasServiceKey } from "@/lib/organizer";
import { listClubs } from "@/lib/clubs-server";
import { clubLabel } from "@/lib/clubs";
import { avatarUrl } from "@/lib/avatar";
import { Avatar } from "@/components/avatar";
import { pointsLabel, statusLabel } from "@/lib/labels";
import { DEFAULT_RANKING, parseRankingSettings } from "@/lib/domain/ranking";
import { DeletePlayerBox, EditPlayerForm, RemovePhotoButton, ToggleActiveButton } from "../player-forms";
import { getLocale, tr } from "@/i18n/server";
import { intlTag } from "@/i18n/locale";
import { adminShellText } from "@/i18n/dict/admin-shell";

export async function generateMetadata() {
  return { title: (await tr(adminShellText)).playerCardTitle };
}

const box = "card space-y-3";
const h2 = "font-display text-lg font-bold uppercase";

/** Scheda del giocatore per l'amministrazione: foto, dati, account, leghe, tornei e sfide. */
export default async function AdminPlayerPage({ params }: PageProps<"/admin/giocatori/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !hasServiceKey()) notFound();
  const [t, l] = [await tr(adminShellText), await getLocale()];
  const svc = createServiceClient();
  const { data: p } = await svc.from("players").select("id, full_name, club_id, active, avatar_path, user_id, created_at").eq("id", id).maybeSingle();
  if (!p) notFound();
  const date = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString(intlTag(l), { day: "numeric", month: "short", year: "numeric" }) : "—");

  const [clubs, { data: memberships }, { data: positions }, { data: entries }, { data: challenges }, user] = await Promise.all([
    listClubs(),
    svc.from("championship_players").select("rating, games_played, championships(id, name, slug, settings)").eq("player_id", id),
    svc.from("championship_ranking").select("championship_id, position, games_played").eq("player_id", id),
    svc.from("entry_members").select("tournament_id").eq("player_id", id),
    svc.from("challenges").select("id, challenger_id, opponent_id, sets_a, sets_b, played_at, ranked")
      .eq("status", "confirmed").or(`challenger_id.eq.${id},opponent_id.eq.${id}`).order("played_at", { ascending: false }).limit(10),
    p.user_id ? svc.auth.admin.getUserById(p.user_id as string).then((r) => r.data.user) : Promise.resolve(null),
  ]);
  const tIds = [...new Set((entries ?? []).map((e) => e.tournament_id as string))];
  const { data: tournaments } = tIds.length ? await svc.from("tournaments")
    .select("id, name, status, starts_on, ranked, championship_id, championships(name)").in("id", tIds)
    .order("starts_on", { ascending: false, nullsFirst: false }).limit(10) : { data: [] };
  const opponentIds = (challenges ?? []).map((c) => (c.challenger_id === id ? c.opponent_id : c.challenger_id) as string);
  const { data: opponents } = opponentIds.length ? await svc.from("players").select("id, full_name").in("id", opponentIds) : { data: [] };
  const oppName = new Map((opponents ?? []).map((o) => [o.id as string, o.full_name as string]));
  const posOf = new Map((positions ?? []).map((x) => [x.championship_id as string, (x.games_played as number) > 0 ? x.position as number : null]));
  const club = clubs.find((c) => c.id === p.club_id);
  const photo = avatarUrl(p.avatar_path as string | null);

  return (
    <main className="space-y-6">
      <Link href="/admin/giocatori" className="inline-block text-sm text-muted hover:underline">{t.backToPlayers}</Link>

      <header className="flex flex-wrap items-center gap-4">
        <Avatar name={p.full_name as string} path={p.avatar_path as string | null} size="h-20 w-20 text-xl" />
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-bold uppercase">{p.full_name as string}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
            {p.active ? <span className="badge-open">{t.active}</span> : <span className="badge-muted">{t.inactive}</span>}
            {club && <span>{clubLabel(club)}</span>}
            <Link href={`/giocatore/${id}`} className="link">{t.publicCard}</Link>
          </p>
          <div className="mt-3"><ToggleActiveButton id={id} active={p.active as boolean} /></div>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className={box}>
          <h2 className={h2}>{t.photo}</h2>
          {photo ? <>
            {/* eslint-disable-next-line @next/next/no-img-element -- foto grande per controllarla */}
            <img src={photo} alt={t.photoOf(p.full_name as string)} className="aspect-square w-full max-w-64 rounded-xl object-cover" />
            <RemovePhotoButton id={id} />
          </> : <p className="text-sm text-muted">{t.noPhoto}</p>}
        </section>

        <section className={box}>
          <h2 className={h2}>{t.details}</h2>
          <EditPlayerForm player={{ id, full_name: p.full_name as string, club_id: p.club_id as string | null, active: p.active as boolean }} clubs={clubs} />
        </section>

        <section className={box}>
          <h2 className={h2}>{t.account}</h2>
          {user ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">{t.email}</dt><dd className="break-all">{user.email}</dd>
              <dt className="text-muted">{t.signedUp}</dt><dd>{date(user.created_at)}</dd>
              <dt className="text-muted">{t.lastLogin}</dt><dd>{date(user.last_sign_in_at)}</dd>
            </dl>
          ) : <p className="text-sm text-muted">{t.noAccount}</p>}
          <p className="text-xs text-muted">{t.cardCreated(date(p.created_at as string))}</p>
        </section>

        <section className={box}>
          <h2 className={h2}>{t.leagues}</h2>
          {(memberships ?? []).length === 0 ? <p className="text-sm text-muted">{t.inNoLeague}</p> : (
            <ul className="divide-y divide-line">
              {(memberships ?? []).map((m) => {
                const c = m.championships as unknown as { id: string; name: string; slug: string; settings: unknown };
                const s = parseRankingSettings(c.settings);
                const pos = posOf.get(c.id);
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link href={`/admin/campionati/${c.id}`} className="font-medium hover:text-brand">{c.name}</Link>
                    <span className="tabular-nums text-muted">{pos ? `#${pos} · ` : ""}<strong className="text-foreground">{m.rating as number}</strong> {pointsLabel(("settings" in s ? s.settings : DEFAULT_RANKING).label, l).toLowerCase()} · {t.matchesCount(m.games_played as number)}</span>
                  </li>);
              })}
            </ul>)}
        </section>

        <section className={box}>
          <h2 className={h2}>{t.recentTournaments}</h2>
          {(tournaments ?? []).length === 0 ? <p className="text-sm text-muted">{t.noTournamentsPlayed}</p> : (
            <ul className="divide-y divide-line">
              {(tournaments ?? []).map((x) => (
                <li key={x.id as string} className="py-2 text-sm">
                  <Link href={`/gestione/${x.id}`} className="font-medium hover:text-brand">{x.name as string}</Link>
                  <span className="block text-xs text-muted">
                    {[(x.championships as unknown as { name: string } | null)?.name ?? t.userFriendly, date(x.starts_on as string | null), statusLabel(x.status as string, l)].join(" · ")}
                    {!x.ranked && x.championship_id ? t.friendlySuffix : ""}</span>
                </li>))}
            </ul>)}
        </section>

        <section className={box}>
          <h2 className={h2}>{t.recentChallenges}</h2>
          {(challenges ?? []).length === 0 ? <p className="text-sm text-muted">{t.noChallengesPlayed}</p> : (
            <ul className="divide-y divide-line">
              {(challenges ?? []).map((c) => {
                const mine = c.challenger_id === id ? [c.sets_a, c.sets_b] : [c.sets_b, c.sets_a];
                const won = (mine[0] as number) > (mine[1] as number);
                return (
                  <li key={c.id as string} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>{t.vs(oppName.get(c.challenger_id === id ? c.opponent_id as string : c.challenger_id as string) ?? "?")}
                      <span className="block text-xs text-muted">{date(c.played_at as string)}{c.ranked ? "" : t.friendlySuffix}</span></span>
                    <span className={`font-bold tabular-nums ${won ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{mine[0]}-{mine[1]}</span>
                  </li>);
              })}
            </ul>)}
        </section>
      </div>

      <DeletePlayerBox id={id} name={p.full_name as string} />
    </main>
  );
}
