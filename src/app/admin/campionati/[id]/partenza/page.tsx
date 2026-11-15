import { ActionForm } from "@/components/action-form";
import { startPoints } from "@/lib/domain/ranking";
import { deletePastTournament, savePastTournament, saveStartOverrides } from "../../actions";
import { ChampionshipHeader, input, loadManagedChampionship, muted } from "../shared";
import { getLocale, tr } from "@/i18n/server";
import { intlTag } from "@/i18n/locale";
import { WoodMedal } from "@/components/wood-medal";
import { pointsLabel } from "@/lib/labels";
import { adminLeaguesText } from "@/i18n/dict/admin-leagues";

export async function generateMetadata() {
  return { title: (await tr(adminLeaguesText)).tabStart };
}
const POS = [1, 2, 3, 4] as const;
const MEDAL = ["", "🥇", "🥈", "🥉"];

export default async function StartPage({ params }: PageProps<"/admin/campionati/[id]/partenza">) {
  const { id } = await params;
  const { supabase, championship: c } = await loadManagedChampionship(id);
  const t = await tr(adminLeaguesText);
  const l = await getLocale();
  const [{ data: members }, { data: past }] = await Promise.all([
    supabase.from("championship_players").select("player_id, start_override, players(full_name)").eq("championship_id", id),
    supabase.from("past_tournaments").select("id, name, held_on, past_results(position, player_id)").eq("championship_id", id)
      .order("held_on", { ascending: false, nullsFirst: false }).order("name"),
  ]);
  const players = (members ?? []).map((m) => ({
    id: m.player_id as string, name: (m.players as unknown as { full_name: string } | null)?.full_name ?? "?",
    override: m.start_override as number | null,
  })).sort((a, b) => a.name.localeCompare(b.name, "it"));
  const nameOf = new Map(players.map((p) => [p.id, p.name]));
  const results = (past ?? []).flatMap((p) => (p.past_results ?? []).map((r) => ({ playerId: r.player_id as string, position: r.position as number })));
  const fromPodiums = startPoints(c.settings, players.map((p) => ({ playerId: p.id, override: null })), results);
  const preview = players.map((p) => ({ ...p, computed: fromPodiums.get(p.id)!, final: p.override ?? fromPodiums.get(p.id)! }))
    .sort((a, b) => b.final - a.final || a.name.localeCompare(b.name, "it"));
  const hidden = <input type="hidden" name="championship_id" value={id} />;
  const podiumSelects = (pr: { position: number; player_id: string }[] = []) => (
    <div className="mt-2 grid gap-2 sm:grid-cols-4">
      {POS.map((pos) => (
        <label key={pos} className="grid gap-1 text-sm">{t.place(pos)}
          <select name={`pos${pos}`} defaultValue={pr.find((r) => r.position === pos)?.player_id ?? ""} required={pos === 1} className={`select-arrow ${input}`}>
            <option value="">—</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>))}
    </div>
  );

  return (
    <main className="space-y-10">
      <ChampionshipHeader c={c} current="/partenza" />
      <p>{t.startIntroA} <strong>{c.settings.initial}</strong> {t.startIntroB(pointsLabel(c.settings.label, l).toLowerCase(), c.settings.podium[1], c.settings.podium[2], c.settings.podium[3], c.settings.podium[4])}</p>

      {players.length === 0 && <p className="text-amber-700 dark:text-amber-400">{t.addPlayersFirst}</p>}

      <section>
        <h2 className="text-lg font-semibold">{t.pastTournaments}</h2>
        <div className="mt-3 space-y-4">
          {(past ?? []).length > 0 && (
            <ul className="card divide-y divide-line !py-1">
              {(past ?? []).map((p) => {
                const podium = [...((p.past_results ?? []) as { position: number; player_id: string }[])].sort((a, b) => a.position - b.position);
                return (
                  <li key={p.id}>
                    <details className="group py-3">
                      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0">
                          <span className="block font-semibold">{p.name}
                            {p.held_on && <span className="ml-2 text-sm font-normal text-muted">
                              {new Date(p.held_on).toLocaleDateString(intlTag(l), { day: "numeric", month: "short", year: "numeric" })}</span>}</span>
                          <span className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
                            {podium.map((r) => (
                              <span key={r.position} className="whitespace-nowrap">
                                {r.position === 4 ? <WoodMedal label={t.place(4)} /> : MEDAL[r.position]} {nameOf.get(r.player_id) ?? "?"}</span>))}
                          </span>
                        </span>
                        <span className="shrink-0 rounded-md border border-line px-2.5 py-1 text-sm text-muted group-open:bg-white/10">
                          <span className="group-open:hidden">{t.editPast}</span><span className="hidden group-open:inline">{t.closePast}</span></span>
                      </summary>
                      <div className="mt-3 rounded-lg bg-background p-3">
                        <ActionForm action={savePastTournament} submitLabel={t.save} primary={false}>
                          {hidden}<input type="hidden" name="past_id" value={p.id} />
                          <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
                            <input name="name" defaultValue={p.name} required maxLength={100} className={input} aria-label={t.tournamentName} />
                            <input name="held_on" type="date" defaultValue={p.held_on ?? ""} className={input} aria-label={t.date} />
                          </div>
                          {podiumSelects(p.past_results as { position: number; player_id: string }[])}
                        </ActionForm>
                        <ActionForm action={deletePastTournament} submitLabel={t.deletePast} primary={false} inline className="mt-2"
                          confirmText={t.confirmDeletePast(p.name)}>
                          {hidden}<input type="hidden" name="past_id" value={p.id} />
                        </ActionForm>
                      </div>
                    </details>
                  </li>);
              })}
            </ul>)}
          {players.length > 0 && (
            <details className="rounded-xl border border-dashed border-line p-4" open={(past ?? []).length === 0}>
              <summary className="cursor-pointer font-medium text-brand">+ {t.addPast}</summary>
              <ActionForm action={savePastTournament} submitLabel={t.add} className="mt-3">
                {hidden}
                <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
                  <input name="name" required maxLength={100} placeholder={t.pastNamePlaceholder} className={input} aria-label={t.tournamentName} />
                  <input name="held_on" type="date" className={input} aria-label={t.dateOptional} />
                </div>
                {podiumSelects()}
                <p className={`mt-1 ${muted}`}>{t.winnerEnough}</p>
              </ActionForm>
            </details>)}
        </div>
      </section>

      {players.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">{t.startPreview}</h2>
          <p className={`mt-1 ${muted}`}>{t.startPreviewNote}</p>
          <ActionForm action={saveStartOverrides} submitLabel={t.saveCorrections} className="mt-3">
            {hidden}
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b"><th className="py-1">#</th><th>{t.player}</th><th className="text-right">{t.fromPodiums}</th><th className="text-right">{t.correction}</th><th className="text-right">{t.start}</th></tr></thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-1.5">{i + 1}</td>
                    <td>{p.name}</td>
                    <td className="text-right font-mono">{p.computed}</td>
                    <td className="text-right"><input name={`start_${p.id}`} type="number" min={0} max={5000} defaultValue={p.override ?? ""}
                      className="w-24 rounded border bg-transparent px-2 py-1 text-right" aria-label={t.correctionFor(p.name)} /></td>
                    <td className="text-right font-mono font-semibold">{p.final}</td>
                  </tr>))}
              </tbody>
            </table>
          </ActionForm>
        </section>)}
    </main>
  );
}
