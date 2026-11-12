import { ActionForm } from "@/components/action-form";
import { startPoints } from "@/lib/domain/ranking";
import { deletePastTournament, savePastTournament, saveStartOverrides } from "../../actions";
import { ChampionshipHeader, input, loadManagedChampionship, muted } from "../shared";

export const metadata = { title: "Classifica di partenza" };
const POS = [1, 2, 3, 4] as const;

export default async function StartPage({ params }: PageProps<"/admin/campionati/[id]/partenza">) {
  const { id } = await params;
  const { supabase, championship: c } = await loadManagedChampionship(id);
  const [{ data: members }, { data: past }] = await Promise.all([
    supabase.from("championship_players").select("player_id, start_override, players(full_name)").eq("championship_id", id),
    supabase.from("past_tournaments").select("id, name, held_on, past_results(position, player_id)").eq("championship_id", id)
      .order("held_on", { ascending: true, nullsFirst: true }).order("name"),
  ]);
  const players = (members ?? []).map((m) => ({
    id: m.player_id as string, name: (m.players as unknown as { full_name: string } | null)?.full_name ?? "?",
    override: m.start_override as number | null,
  })).sort((a, b) => a.name.localeCompare(b.name, "it"));
  const results = (past ?? []).flatMap((p) => (p.past_results ?? []).map((r) => ({ playerId: r.player_id as string, position: r.position as number })));
  const fromPodiums = startPoints(c.settings, players.map((p) => ({ playerId: p.id, override: null })), results);
  const preview = players.map((p) => ({ ...p, computed: fromPodiums.get(p.id)!, final: p.override ?? fromPodiums.get(p.id)! }))
    .sort((a, b) => b.final - a.final || a.name.localeCompare(b.name, "it"));
  const hidden = <input type="hidden" name="championship_id" value={id} />;
  const podiumSelects = (pr: { position: number; player_id: string }[] = []) => (
    <div className="mt-2 grid gap-2 sm:grid-cols-4">
      {POS.map((pos) => (
        <label key={pos} className="grid gap-1 text-sm">{pos}° posto
          <select name={`pos${pos}`} defaultValue={pr.find((r) => r.position === pos)?.player_id ?? ""} required={pos === 1} className={`select-arrow ${input}`}>
            <option value="">—</option>
            {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></label>))}
    </div>
  );

  return (
    <main className="space-y-10">
      <ChampionshipHeader c={c} current="/partenza" />
      <p>Prima del primo torneo del campionato, ogni giocatore parte da <strong>{c.settings.initial}</strong> {c.settings.label.toLowerCase()}, più un bonus per ogni podio
        nei tornei passati (1° +{c.settings.podium[1]}, 2° +{c.settings.podium[2]}, 3° +{c.settings.podium[3]}, 4° +{c.settings.podium[4]}: li cambi in «Regole della classifica»).
        Se serve, puoi correggere a mano il punteggio di qualcuno.</p>

      {players.length === 0 && <p className="text-amber-700 dark:text-amber-400">Prima aggiungi i giocatori al campionato (Panoramica).</p>}

      <section>
        <h2 className="text-lg font-semibold">Tornei passati (albo d&apos;oro)</h2>
        <div className="mt-3 space-y-4">
          {(past ?? []).map((p) => (
            <div key={p.id} className="rounded-lg border p-4">
              <ActionForm action={savePastTournament} submitLabel="Salva" primary={false}>
                {hidden}<input type="hidden" name="past_id" value={p.id} />
                <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
                  <input name="name" defaultValue={p.name} required maxLength={100} className={input} aria-label="Nome del torneo" />
                  <input name="held_on" type="date" defaultValue={p.held_on ?? ""} className={input} aria-label="Data" />
                </div>
                {podiumSelects(p.past_results as { position: number; player_id: string }[])}
              </ActionForm>
              <ActionForm action={deletePastTournament} submitLabel="Elimina questo torneo" primary={false} inline className="mt-2"
                confirmText={`Eliminare «${p.name}» e il suo podio?`}>
                {hidden}<input type="hidden" name="past_id" value={p.id} />
              </ActionForm>
            </div>
          ))}
          {players.length > 0 && (
            <div className="rounded-lg border border-dashed p-4">
              <p className="font-medium">Aggiungi un torneo passato</p>
              <ActionForm action={savePastTournament} submitLabel="Aggiungi" className="mt-2">
                {hidden}
                <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
                  <input name="name" required maxLength={100} placeholder="Nome (es. Torneo di Natale 2025)" className={input} aria-label="Nome del torneo" />
                  <input name="held_on" type="date" className={input} aria-label="Data (facoltativa)" />
                </div>
                {podiumSelects()}
                <p className={`mt-1 ${muted}`}>Basta il vincitore; gli altri posti sono facoltativi.</p>
              </ActionForm>
            </div>)}
        </div>
      </section>

      {players.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold">Anteprima della classifica di partenza</h2>
          <p className={`mt-1 ${muted}`}>Lascia vuoto per usare il punteggio calcolato dai podi; scrivi un numero per correggerlo.</p>
          <ActionForm action={saveStartOverrides} submitLabel="Salva le correzioni" className="mt-3">
            {hidden}
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b"><th className="py-1">#</th><th>Giocatore</th><th className="text-right">Dai podi</th><th className="text-right">Correzione</th><th className="text-right">Partenza</th></tr></thead>
              <tbody>
                {preview.map((p, i) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-1.5">{i + 1}</td>
                    <td>{p.name}</td>
                    <td className="text-right font-mono">{p.computed}</td>
                    <td className="text-right"><input name={`start_${p.id}`} type="number" min={0} max={5000} defaultValue={p.override ?? ""}
                      className="w-24 rounded border bg-transparent px-2 py-1 text-right" aria-label={`Correzione per ${p.name}`} /></td>
                    <td className="text-right font-mono font-semibold">{p.final}</td>
                  </tr>))}
              </tbody>
            </table>
          </ActionForm>
        </section>)}
    </main>
  );
}
