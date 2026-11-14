import { ActionForm } from "@/components/action-form";
import { addAbsence, deleteAbsence } from "../../actions";
import { ChampionshipHeader, input, loadManagedChampionship, muted } from "../shared";
import { getLocale, tr } from "@/i18n/server";
import { intlTag } from "@/i18n/locale";
import { pointsLabel } from "@/lib/labels";
import { adminLeaguesText } from "@/i18n/dict/admin-leagues";

export async function generateMetadata() {
  return { title: (await tr(adminLeaguesText)).tabAbsences };
}

export default async function AbsencesPage({ params }: PageProps<"/admin/campionati/[id]/assenze">) {
  const { id } = await params;
  const { supabase, championship: c } = await loadManagedChampionship(id);
  const t = await tr(adminLeaguesText);
  const l = await getLocale();
  const fmt = (d: string) => new Date(d).toLocaleDateString(intlTag(l));
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
        ? t.absencesDecayOn(c.settings.decay.pct, pointsLabel(c.settings.label, l).toLowerCase(), c.settings.decay.floor)
        : t.absencesDecayOff}</p>
      <section>
        <h2 className="text-lg font-semibold">{t.recordedAbsences}</h2>
        {(absences ?? []).length === 0 ? <p className={`mt-2 ${muted}`}>{t.none}</p> : (
          <ul className="mt-2 divide-y">
            {absences!.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
                <span className="font-medium">{names.get(a.player_id) ?? "?"}</span>
                <span>{t.absenceRange(fmt(a.from_date), a.to_date ? fmt(a.to_date) : null)}</span>
                {a.note && <span className={muted}>{a.note}</span>}
                <ActionForm action={deleteAbsence} submitLabel={t.delete} primary={false} inline confirmText={t.confirmDeleteAbsence}>
                  {hidden}<input type="hidden" name="absence_id" value={a.id} />
                </ActionForm>
              </li>))}
          </ul>)}
      </section>
      {players.length > 0 && (
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold">{t.newAbsence}</h2>
          <ActionForm action={addAbsence} submitLabel={t.record} className="mt-3">
            {hidden}
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 sm:col-span-3">{t.player}
                <select name="player_id" required className={`select-arrow ${input}`}>
                  {players.map(([pid, n]) => <option key={pid} value={pid}>{n}</option>)}
                </select></label>
              <label className="grid gap-1">{t.from}<input name="from_date" type="date" required className={input} /></label>
              <label className="grid gap-1">{t.toOptional}<input name="to_date" type="date" className={input} /></label>
              <label className="grid gap-1">{t.reasonOptional}<input name="note" maxLength={200} className={input} placeholder={t.reasonPlaceholder} /></label>
            </div>
          </ActionForm>
        </section>)}
    </main>
  );
}
