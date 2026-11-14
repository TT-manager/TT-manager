import Link from "next/link";
import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { requireAccount } from "@/lib/account";
import { createServiceClient } from "@/lib/supabase/admin";
import { statusLabel } from "@/lib/labels";
import { Avatar } from "@/components/avatar";
import { AvatarUploader } from "./avatar-uploader";
import { formatDeadline, registrationIsOpen } from "@/lib/registration";
import { logout } from "../login/actions";
import { cancelClubRequest, cancelRequest, updateProfile } from "./actions";
import { ClubPicker } from "@/components/club-picker";
import { listClubs } from "@/lib/clubs-server";
import { getLocale, tr } from "@/i18n/server";
import { intlTag } from "@/i18n/locale";
import { accountProfileText } from "@/i18n/dict/account-profile";

export async function generateMetadata() {
  return { title: (await tr(accountProfileText)).title };
}
const input = "rounded border bg-transparent px-3 py-2";
const muted = "text-sm text-neutral-600 dark:text-neutral-400";

export default async function ProfilePage() {
  const t = await tr(accountProfileText);
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/" className={`${muted} hover:underline`}>{t.backToRankings}</Link>
      <Suspense fallback={<p className={`mt-6 ${muted}`}>{t.loading}</p>}><Profile /></Suspense>
    </main>
  );
}

async function Profile() {
  const account = await requireAccount("/profilo");
  const [t, l] = await Promise.all([tr(accountProfileText), getLocale()]);
  const svc = createServiceClient();
  const [{ data: memberships }, { data: requests }, { data: all }, { data: friendlies }, { count: friendRequests }, clubs, { data: clubRequest }] = await Promise.all([
    svc.from("championship_players").select("rating, games_played, championships(id, name, slug)").eq("player_id", account.player.id),
    svc.from("championship_requests").select("id, status, created_at, championships(name, slug)").eq("user_id", account.userId)
      .neq("status", "approved").order("created_at", { ascending: false }).limit(20),
    svc.from("championships").select("id, name, slug, kind").order("name"),
    svc.from("tournaments").select("id, name, starts_on, status, public_code").eq("owner_user_id", account.userId).neq("status", "closed")
      .order("created_at", { ascending: false }).limit(30),
    svc.from("friendships").select("user_a", { count: "exact", head: true })
      .or(`user_a.eq.${account.userId},user_b.eq.${account.userId}`).eq("status", "pending").neq("requested_by", account.userId),
    listClubs(),
    svc.from("club_requests").select("name, city, status").eq("user_id", account.userId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  type C = { id: string; name: string; slug: string };
  const mine = (memberships ?? []).map((m) => ({ ...(m.championships as unknown as C), rating: m.rating as number, games: m.games_played as number }));
  const mineIds = new Set(mine.map((m) => m.id));
  const { data: openRows } = mine.length ? await svc.from("tournaments")
    .select("id, name, starts_on, status, public_code, championship_id, registration_open, registration_deadline")
    .in("championship_id", [...mineIds]).eq("status", "draft").eq("registration_open", true) : { data: [] };
  const open = (openRows ?? []).filter((t) => registrationIsOpen(t));
  const { data: myEntries } = open.length ? await svc.from("entry_members").select("tournament_id")
    .eq("player_id", account.player.id).in("tournament_id", open.map((t) => t.id)) : { data: [] };
  const enrolledIn = new Set((myEntries ?? []).map((e) => e.tournament_id as string));
  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const pendingSlugs = new Set(pending.map((r) => (r.championships as unknown as C).slug));
  const others = (all ?? []).filter((c) => !mineIds.has(c.id) && !pendingSlugs.has(c.slug));
  return (
    <div className="space-y-10">
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <Avatar name={account.player.full_name} path={account.player.avatar_path} size="h-20 w-20 text-2xl" />
          <div>
            <h1 className="text-3xl font-bold">{account.player.full_name}</h1>
            <AvatarUploader hasPhoto={Boolean(account.player.avatar_path)} />
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {account.isAdmin && <Link href="/admin" className="underline">{t.administration}</Link>}
          <Link href="/amici" className="underline">{t.friends}{friendRequests ? t.friendRequests(friendRequests) : ""}</Link>
          <Link href={`/giocatore/${account.player.id}`} className="underline">{t.publicCard}</Link>
        </div>
      </div>

      {open.length > 0 && (
        <section className="rounded-lg border-2 border-emerald-600 p-4">
          <h2 className="text-xl font-semibold">{t.openTournaments}</h2>
          <ul className="mt-2 divide-y">
            {open.map((o) => (
              <li key={o.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <Link href={`/t/${o.public_code}`} className="font-medium hover:underline">{o.name}</Link>
                <span className={muted}>{enrolledIn.has(o.id) ? t.enrolled : t.notEnrolled}
                  {o.registration_deadline ? t.closes(formatDeadline(o.registration_deadline, l)) : ""}</span>
              </li>))}
          </ul>
        </section>)}

      <section>
        <h2 className="text-xl font-semibold">{t.myLeagues}</h2>
        {mine.length === 0 ? <p className={`mt-2 ${muted}`}>{t.noLeagues}</p> : (
          <ul className="mt-2 divide-y">
            {mine.map((m) => (
              <li key={m.id} className="flex justify-between py-2">
                <Link href={`/c/${m.slug}`} className="font-medium hover:underline">{m.name}</Link>
                <span className="tabular-nums">{m.rating} · {t.games(m.games)}</span>
              </li>))}
          </ul>)}
        {pending.length > 0 && (
          <>
            <h3 className="mt-4 font-medium">{t.pendingRequests}</h3>
            <ul className="mt-1 space-y-1">
              {pending.map((r) => (
                <li key={r.id} className="flex items-center gap-3">{(r.championships as unknown as C).name}
                  <ActionForm action={cancelRequest} submitLabel={t.cancel} primary={false} inline>
                    <input type="hidden" name="request_id" value={r.id} />
                  </ActionForm>
                </li>))}
            </ul>
          </>)}
        {(requests ?? []).some((r) => r.status === "rejected") && (
          <p className={`mt-2 ${muted}`}>{t.rejectedRequests((requests ?? []).filter((r) => r.status === "rejected").map((r) => (r.championships as unknown as C).name).join(", "))}</p>)}
      </section>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">{t.myFriendlies}</h2>
          <Link href="/amichevole/nuovo" className="btn-primary text-sm">{t.createFriendly}</Link>
        </div>
        {(friendlies ?? []).length === 0 ? <p className={`mt-2 ${muted}`}>{t.noFriendlies}</p> : (
          <ul className="mt-2 divide-y">
            {friendlies!.map((f) => (
              <li key={f.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                <Link href={`/gestione/${f.id}`} className="font-medium hover:underline">{f.name}</Link>
                <span className={muted}>{f.starts_on ? new Date(f.starts_on).toLocaleDateString(intlTag(l)) + " · " : ""}{statusLabel(f.status as string, l)} ·{" "}
                  <Link href={`/t/${f.public_code}`} className="underline">{t.publicPage}</Link></span>
              </li>))}
          </ul>)}
      </section>

      {others.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold">{t.otherLeagues}</h2>
          <ul className="mt-2 divide-y">
            {others.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{c.name} <span className={muted}>· {c.kind === "doubles" ? t.doubles : t.singles}</span></span>
                <Link href={`/partecipa/${c.slug}`} className="rounded border px-3 py-1 text-sm">{t.askToJoin}</Link>
              </li>))}
          </ul>
        </section>)}

      <section>
        <h2 className="text-xl font-semibold">{t.myData}</h2>
        <ActionForm action={updateProfile} submitLabel={t.save} className="mt-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <input name="full_name" defaultValue={account.player.full_name} required maxLength={80} className={input} aria-label={t.fullName} />
            <ClubPicker clubs={clubs} defaultValue={account.player.club_id ?? ""} allowRequest={clubRequest?.status !== "pending"} className={`${input} w-full`} />
          </div>
        </ActionForm>
        {clubRequest?.status === "pending" && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="badge">{t.pending}</span>
            <span>{t.clubRequestedBefore}<strong>{clubRequest.name}</strong>{clubRequest.city ? ` (${clubRequest.city})` : ""}.</span>
            <ActionForm action={cancelClubRequest} submitLabel={t.cancelRequest} primary={false} inline />
          </div>)}
        {clubRequest?.status === "rejected" && !account.player.club_id && (
          <p className={`mt-2 ${muted}`}>{t.clubRejected(clubRequest.name)}</p>)}
        <div className={`mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 ${muted}`}>
          <span>{t.email} {account.email} · <Link href="/nuova-password" className="underline">{t.changePassword}</Link></span>
          <form action={logout}><button className="btn-outline px-3 py-1 text-sm">{t.logout}</button></form>
        </div>
      </section>
    </div>
  );
}
