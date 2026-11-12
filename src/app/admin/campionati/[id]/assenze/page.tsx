import { ActionForm } from "@/components/action-form";
import { addAbsence, deleteAbsence } from "../../actions";
import { ChampionshipHeader, input, loadManagedChampionship, muted } from "../shared";

export const metadata = { title: "Assenze giustificate" };
const fmt = (d: string) => new Date(d).toLocaleDateString("it-IT");

export default async function AbsencesPage({ params }: PageProps<"/admin/campionati/[id]/assenze">) {
  const { id } = await params;
  const { supabase, championship: c } = await loadManagedChampionship(id);
  const [{ data: members }, { data: absences }] = await Promise.all([
    supabase.from("championship_players").select("player_id, players(full_name)").eq("championship_id", id),
    supabase.from("player_absences").select("id, player_id, from_date, to_date, note").eq("championship_id", id).order("from_date", { ascending: false }),
  ]);
  const names = new Map((members ?? []).map((m) => [m.player_id as string, (m.players as unknown as { full_name: string } | null)?.full_name ?? "?"]));
  const players = [...names].sort((a, b) => a[1].localeCompare(b[1], "it"));
  const hidden = <input type="hidden" name="championship_id" value={id} />;
  return (
    <main className="space-y-8">
      <ChampionshipHeader c={c} current="/assenze" />
      <p>{c.settings.decay.enabled
        ? <>Chi salta un torneo del campionato perde il {c.settings.decay.pct}% dei {c.settings.label.toLowerCase()} sopra quota {c.settings.decay.floor}. Nei periodi indicati qui (infortunio, lavoro…) il calo non si applica.</>
        : <>Il calo per i tornei saltati è disattivato in «Regole della classifica»: le assenze qui non cambiano nulla finché non lo riattivi.</>}</p>
      <section>
        <h2 className="text-lg font-semibold">Assenze registrate</h2>
        {(absences ?? []).length === 0 ? <p className={`mt-2 ${muted}`}>Nessuna.</p> : (
          <ul className="mt-2 divide-y">
            {absences!.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <span className="font-medium">{names.get(a.player_id) ?? "?"}</span>
                <span>dal {fmt(a.from_date)} {a.to_date ? `al ${fmt(a.to_date)}` : "(senza fine)"}</span>
                {a.note && <span className={muted}>{a.note}</span>}
                <ActionForm action={deleteAbsence} submitLabel="Elimina" primary={false} inline confirmText="Eliminare questa assenza?">
                  {hidden}<input type="hidden" name="absence_id" value={a.id} />
                </ActionForm>
              </li>))}
          </ul>)}
      </section>
      {players.length > 0 && (
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">Nuova assenza</h2>
          <ActionForm action={addAbsence} submitLabel="Registra" className="mt-3">
            {hidden}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 sm:col-span-3">Giocatore
                <select name="player_id" required className={`select-arrow ${input}`}>
                  {players.map(([pid, n]) => <option key={pid} value={pid}>{n}</option>)}
                </select></label>
              <label className="grid gap-1">Dal<input name="from_date" type="date" required className={input} /></label>
              <label className="grid gap-1">Al (facoltativo)<input name="to_date" type="date" className={input} /></label>
              <label className="grid gap-1">Motivo (facoltativo)<input name="note" maxLength={200} className={input} placeholder="es. infortunio" /></label>
            </div>
          </ActionForm>
        </section>)}
    </main>
  );
}
