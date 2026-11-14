import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTournamentManager } from "@/lib/auth";
import { loadEntries } from "@/lib/entries";
import { statusLabel } from "@/lib/labels";
import { getLocale, tr } from "@/i18n/server";
import { intlTag } from "@/i18n/locale";
import { adminManageText } from "@/i18n/dict/admin-manage";
import { createServerSupabase } from "@/lib/supabase/server";
import { describeFormat, parseFormat } from "@/lib/domain/format";
import { closingSummary } from "@/lib/closing";
import { hasServiceKey } from "@/lib/organizer";
import { friendlyCandidates } from "@/lib/friends";
import { ActionForm } from "@/components/action-form";
import { formatDeadline, isoToRomeLocal, registrationIsOpen } from "@/lib/registration";
import { setPlayerResults, setPublicAndStream, setRegistration } from "@/app/gestione/actions";
import { disputedCount } from "@/lib/results";
import { ClosingControl, DeleteTournament, EnrollmentForm, GroupsControl, GuestForm, PairsForm, RegenerateCode } from "./tournament-forms";

export async function generateMetadata() {
  return { title: (await tr(adminManageText)).tournamentTitle };
}

export default async function TournamentAdminPage({ params }: PageProps<"/gestione/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const access = await requireTournamentManager(id);
  const { championshipId } = access;
  const tx = await tr(adminManageText);
  const l = await getLocale();
  const supabase = await createServerSupabase();
  const { data: t } = await supabase.from("tournaments")
    .select("id, name, starts_on, status, public_code, format, registration_open, registration_deadline, player_results, featured, stream_url").eq("id", id).maybeSingle();
  if (!t) notFound();
  // Torneo di lega: si iscrivono i giocatori della lega, con i loro punti.
  // Amichevole di un utente: lui, i suoi amici e i suoi ospiti.
  const [players, entries, championship] = await Promise.all([
    championshipId
      ? supabase.from("championship_ranking").select("player_id, full_name, club, rating").eq("championship_id", championshipId).order("full_name")
          .then(({ data }) => (data ?? []).map((r) => ({ id: r.player_id as string, full_name: r.full_name as string, club: r.club as string | null, rating: r.rating as number })))
      : access.ownerUserId && hasServiceKey() ? friendlyCandidates(access.ownerUserId) : Promise.resolve([]),
    loadEntries(supabase, id),
    championshipId ? supabase.from("championships").select("name").eq("id", championshipId).maybeSingle().then(({ data }) => data) : Promise.resolve(null),
  ]);
  const doubles = access.kind === "doubles";
  const friendly = !access.ranked;
  const userFriendly = !championshipId;
  const enrolledIds = entries.flatMap((e) => e.players.map((p) => p.id));
  const pairs = entries.map((e) => e.players.map((p) => p.id));
  const parsed = parseFormat(t.format);
  const mode = "format" in parsed ? parsed.format.mode ?? "groups" : "groups";
  const knockoutOnly = mode === "knockout";
  const summary = t.status !== "draft" && hasServiceKey() ? await closingSummary(t.id) : null;
  const disputed = t.status !== "draft" && hasServiceKey() ? await disputedCount(t.id) : 0;

  return (
    <main className="space-y-8">
      <div>
        {championshipId
          ? <Link href={`/admin/campionati/${championshipId}`} className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">← {championship?.name ?? tx.league}</Link>
          : <Link href="/profilo" className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">{tx.myProfile}</Link>}
        <h1 className="mt-2 text-2xl font-bold">{t.name}
          {friendly && <span className="ml-3 rounded bg-sky-100 px-2 py-0.5 align-middle text-sm font-normal text-sky-900 dark:bg-sky-900 dark:text-sky-100">{tx.friendly}</span>}</h1>
        {friendly && <p className="text-sm text-neutral-600 dark:text-neutral-400">{tx.noRanking}</p>}
        <p className="text-neutral-600 dark:text-neutral-400">
          {t.starts_on ? new Date(t.starts_on).toLocaleDateString(intlTag(l)) : tx.noDate} · {statusLabel(t.status, l)}
        </p>
        <p className="mt-2">{tx.publicCode} <span className="font-mono text-lg">{t.public_code}</span>{" "}
          <span className="text-sm text-neutral-600 dark:text-neutral-400">{tx.publicPagePath(t.public_code)}</span></p>
      </div>

      <section>
        <h2 className="text-lg font-semibold">{tx.format}</h2>
        {t.format === null
          ? <p className="mt-2">{tx.formatNotSet}</p>
          : "format" in parsed
            ? <ul className="mt-2 list-disc pl-5">{describeFormat(parsed.format, entries.length || undefined, l).map((l) => <li key={l}>{l}</li>)}</ul>
            : <p className="mt-2 text-red-700 dark:text-red-400">{tx.formatInvalid}</p>}
        {t.status === "draft" && (
          <Link href={`/gestione/${t.id}/formato`} className="mt-3 inline-block rounded border px-4 py-2">
            {t.format === null ? tx.setFormat : tx.editFormat}</Link>
        )}
      </section>

      {championshipId && t.status === "draft" && (
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">{tx.registrationTitle}</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {registrationIsOpen({ ...t, championship_id: championshipId })
              ? <>{tx.regOpenA}{t.registration_deadline ? tx.regOpenUntil(formatDeadline(t.registration_deadline, l)) : ""}{tx.regOpenB} <a href={`/t/${t.public_code}`} className="underline">{tx.regPublicPage}</a>{doubles ? tx.regDoublesNote : ""}.</>
              : t.registration_open ? tx.regExpired : tx.regClosed}
            {" "}{tx.regClosesOnGenerate(knockoutOnly ? "knockout" : mode === "league" ? "league" : "groups")}</p>
          <ActionForm action={setRegistration} submitLabel={tx.save} primary={false} className="mt-3 flex flex-wrap items-end gap-4">
            <input type="hidden" name="tournament_id" value={t.id} />
            <label className="flex items-center gap-2"><input type="checkbox" name="open" defaultChecked={t.registration_open} /> {tx.regOpenCheckbox}</label>
            <label className="grid gap-1 text-sm">{tx.regDeadline}
              <input type="datetime-local" name="deadline" defaultValue={t.registration_deadline ? isoToRomeLocal(t.registration_deadline) : ""}
                className="rounded border bg-transparent px-3 py-1.5" /></label>
          </ActionForm>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{tx.reloadToSee}</p>
        </section>)}

      <section>
        <h2 className="text-lg font-semibold">{doubles ? tx.pairsEntered(entries.length) : tx.entries(entries.length)}</h2>
        {doubles
          ? <PairsForm tournamentId={t.id} players={players} initialPairs={pairs} locked={t.status !== "draft"} closed={t.status === "closed"} />
          : <EnrollmentForm tournamentId={t.id} players={players} enrolledIds={enrolledIds} locked={t.status !== "draft"} closed={t.status === "closed"} />}
        {userFriendly && t.status === "draft" && (
          <div className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
            <p>{tx.friendlyEnrollA} <a href="/amici" className="underline">{tx.friends}</a>{tx.friendlyEnrollB}</p>
            <GuestForm tournamentId={t.id} />
          </div>)}
      </section>

      <section>
        <h2 className="text-lg font-semibold">{knockoutOnly ? tx.bracket : mode === "league" ? tx.schedule : tx.groups}</h2>
        {t.status !== "draft" && <p className="mt-2">{knockoutOnly ? tx.bracketGenerated : mode === "league" ? tx.scheduleGenerated : tx.groupsGenerated} <Link href={`/t/${t.public_code}`} className="underline">{tx.openPublicPage}</Link></p>}
        <GroupsControl tournamentId={t.id} status={t.status} mode={mode} hasFormat={t.format !== null} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">{tx.results}</h2>
        {disputed > 0 && <p className="mt-2 rounded-lg bg-amber-400/15 px-4 py-2 text-sm"><span className="badge-contested mr-2">{disputed}</span>
          {tx.disputedCount(disputed)}: <Link href={`/gestione/${t.id}/risultati`} className="underline">{tx.decide}</Link>.</p>}
        {t.status !== "draft" && <p className="mt-2"><Link href={`/gestione/${t.id}/risultati`} className="underline">{tx.seeAllResults}</Link></p>}
        {t.status !== "closed" && (
          <ActionForm action={setPlayerResults} submitLabel={tx.save} primary={false} className="mt-3">
            <input type="hidden" name="tournament_id" value={t.id} />
            <label className="flex items-start gap-2"><input type="checkbox" name="player_results" defaultChecked={t.player_results} className="mt-1" />
              <span>{tx.playersEnterResults}
                <span className="block text-sm text-neutral-600 dark:text-neutral-400">{tx.playersEnterResultsNote}</span></span></label>
          </ActionForm>)}
      </section>

      {t.status !== "closed" && (
        <section>
          <h2 className="text-lg font-semibold">{tx.publicAndStream}</h2>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{tx.alreadyVisible} <span className="font-mono">{t.public_code}</span>.</p>
          <ActionForm action={setPublicAndStream} submitLabel={tx.save} primary={false} className="mt-3 space-y-3">
            <input type="hidden" name="tournament_id" value={t.id} />
            <label className="flex items-start gap-2"><input type="checkbox" name="featured" defaultChecked={t.featured} className="mt-1" />
              <span>{tx.featured}
                <span className="block text-sm text-neutral-600 dark:text-neutral-400">{tx.featuredNote}</span></span></label>
            <label className="grid gap-1 text-sm">{tx.streamLink}
              <input name="stream_url" type="url" inputMode="url" defaultValue={t.stream_url ?? ""} placeholder="https://www.youtube.com/live/…" maxLength={300}
                className="rounded border bg-transparent px-3 py-2" />
              <span className="text-neutral-600 dark:text-neutral-400">{tx.streamNote}</span></label>
          </ActionForm>
        </section>)}

      <section>
        <h2 className="text-lg font-semibold">{tx.closing}</h2>
        <ClosingControl tournamentId={t.id} status={t.status} summary={summary} ranked={access.ranked} />
      </section>

      <section>
        <h2 className="text-lg font-semibold">{tx.organizerCode}</h2>
        <RegenerateCode tournamentId={t.id} />
      </section>

      <section className="rounded-lg border border-red-600/40 p-4">
        <h2 className="text-lg font-semibold">{tx.deleteTournament}</h2>
        <DeleteTournament tournamentId={t.id} name={t.name} played={summary?.toRate ?? 0}
          blocked={t.status === "closed" && access.ranked && Boolean(championshipId)} />
      </section>
    </main>
  );
}
