import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchForm } from "@/components/match-form";
import { requireTournamentManager } from "@/lib/auth";
import { getPublicTournament } from "@/lib/data";
import { stageName } from "@/lib/domain/format";
import { groupLabel, isPlayed } from "@/lib/domain/tournament";
import { createServerSupabase } from "@/lib/supabase/server";
import { adminSubmitResult, confirmDisputedAction } from "@/app/gestione/actions";
import { ActionForm } from "@/components/action-form";
import { getLocale, tr } from "@/i18n/server";
import { adminManageText } from "@/i18n/dict/admin-manage";

export async function generateMetadata() {
  return { title: (await tr(adminManageText)).resultsTitle };
}

export default async function AdminResultsPage({ params }: PageProps<"/gestione/[id]/risultati">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  await requireTournamentManager(id);
  const tx = await tr(adminManageText);
  const l = await getLocale();
  const supabase = await createServerSupabase();
  const { data: t } = await supabase.from("tournaments").select("public_code").eq("id", id).maybeSingle();
  if (!t) notFound();
  const data = await getPublicTournament(t.public_code);
  if (!data) notFound();
  const { tournament, names, matches, playerNames } = data;
  const disputed = matches.filter((m) => m.disputed).length;
  const name = (pid: string | null) => (pid ? names.get(pid) ?? "?" : null);
  const closed = tournament.status === "closed";
  const sorted = [...matches].sort((x, y) => Number(y.disputed) - Number(x.disputed) ||
    (x.phase === y.phase ? 0 : x.phase === "group" ? -1 : 1) ||
    (x.group_no ?? 0) - (y.group_no ?? 0) || (y.stage ?? 0) - (x.stage ?? 0) || x.round - y.round || x.position - y.position);

  return (
    <main>
      <Link href={`/gestione/${id}`} className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">← {tournament.name}</Link>
      <h1 className="mt-2 text-2xl font-bold">{tx.results}</h1>
      {closed && <p className="mt-2 text-amber-700 dark:text-amber-400">{tx.closedFixHint}</p>}
      {disputed > 0 && <p className="mt-3 rounded-lg bg-amber-400/15 px-4 py-2 text-sm"><span className="badge-contested mr-2">{disputed}</span>
        {tx.disputedCount(disputed)}{tx.disputedHint}</p>}
      <ul className="mt-4">
        {sorted.map((m) => (
          <li key={m.id} className="border-t py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {m.phase === "group" ? tx.groupRound(groupLabel(m.group_no ?? 0), m.round) : `${stageName(m.stage ?? 0, l)} ${m.position + 1}`}
                </span><br />
                {name(m.player_a) ?? tx.tbd} – {name(m.player_b) ?? tx.tbd}
              </span>
              <span className="text-right tabular-nums">{isPlayed(m) ? `${m.sets_a}-${m.sets_b}` : tx.toPlay}
                {m.disputed && <span className="badge-contested ml-2">{tx.disputed}</span>}
                {isPlayed(m) && m.reported_by && <span className="block text-xs text-muted">{tx.enteredBy(playerNames.get(m.reported_by) ?? tx.aPlayer)}</span>}</span>
            </div>
            {!closed && m.disputed && (
              <ActionForm action={confirmDisputedAction} submitLabel={tx.confirmAsIs} primary={false} className="mt-2">
                <input type="hidden" name="tournament_id" value={id} />
                <input type="hidden" name="match_id" value={m.id} />
              </ActionForm>)}
            {!closed && m.player_a && m.player_b && (
              <MatchForm action={adminSubmitResult} hidden={{ tournament_id: id }} matchId={m.id} bestOf={m.best_of} rules={{ points: m.set_points, golden: m.golden_point }}
                a={name(m.player_a)!} b={name(m.player_b)!} initial={m.set_scores} />
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
