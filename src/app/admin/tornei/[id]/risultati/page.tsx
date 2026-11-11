import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchForm } from "@/components/match-form";
import { requireAdmin } from "@/lib/auth";
import { getPublicTournament } from "@/lib/data";
import { stageName } from "@/lib/domain/format";
import { groupLabel, isPlayed } from "@/lib/domain/tournament";
import { createServerSupabase } from "@/lib/supabase/server";
import { adminSubmitResult } from "../../actions";

export const metadata = { title: "Risultati torneo" };

export default async function AdminResultsPage({ params }: PageProps<"/admin/tornei/[id]/risultati">) {
  await requireAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createServerSupabase();
  const { data: t } = await supabase.from("tournaments").select("public_code").eq("id", id).maybeSingle();
  if (!t) notFound();
  const data = await getPublicTournament(t.public_code);
  if (!data) notFound();
  const { tournament, names, matches } = data;
  const name = (pid: string | null) => (pid ? names.get(pid) ?? "?" : null);
  const closed = tournament.status === "closed";
  const sorted = [...matches].sort((x, y) =>
    (x.phase === y.phase ? 0 : x.phase === "group" ? -1 : 1) ||
    (x.group_no ?? 0) - (y.group_no ?? 0) || (y.stage ?? 0) - (x.stage ?? 0) || x.round - y.round || x.position - y.position);

  return (
    <main>
      <Link href={`/admin/tornei/${id}`} className="text-sm text-neutral-600 hover:underline dark:text-neutral-400">← {tournament.name}</Link>
      <h1 className="mt-2 text-2xl font-bold">Risultati</h1>
      {closed && <p className="mt-2 text-amber-700 dark:text-amber-400">Torneo chiuso: per correggere un risultato riaprilo dalla pagina del torneo.</p>}
      <ul className="mt-4">
        {sorted.map((m) => (
          <li key={m.id} className="border-t py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span>
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  {m.phase === "group" ? `Girone ${groupLabel(m.group_no ?? 0)} · turno ${m.round}` : `${stageName(m.stage ?? 0)} ${m.position + 1}`}
                </span><br />
                {name(m.player_a) ?? "da definire"} – {name(m.player_b) ?? "da definire"}
              </span>
              <span className="tabular-nums">{isPlayed(m) ? `${m.sets_a}-${m.sets_b}` : "da giocare"}</span>
            </div>
            {!closed && m.player_a && m.player_b && (
              <MatchForm action={adminSubmitResult} hidden={{ tournament_id: id }} matchId={m.id} bestOf={m.best_of}
                a={name(m.player_a)!} b={name(m.player_b)!} initial={m.set_scores} />
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
