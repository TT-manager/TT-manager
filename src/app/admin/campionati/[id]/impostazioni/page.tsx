import type { ReactNode } from "react";
import { ActionForm } from "@/components/action-form";
import { DEFAULT_RANKING } from "@/lib/domain/ranking";
import { saveSettings } from "../../actions";
import { ChampionshipHeader, loadManagedChampionship, muted } from "../shared";

export const metadata = { title: "Regole della classifica" };

function Num({ name, label, value, min, max, step, help }: { name: string; label: string; value: number; min: number; max: number; step?: number; help?: ReactNode }) {
  return (
    <label className="grid gap-1">
      <span>{label}</span>
      <input name={name} type="number" required min={min} max={max} step={step ?? 1} defaultValue={value}
        className="w-32 rounded border bg-transparent px-3 py-2" />
      {help && <span className={muted}>{help}</span>}
    </label>
  );
}

export default async function SettingsPage({ params }: PageProps<"/admin/campionati/[id]/impostazioni">) {
  const { id } = await params;
  const { championship: c } = await loadManagedChampionship(id);
  const s = c.settings, D = DEFAULT_RANKING;
  const box = "space-y-4 rounded-lg border p-4";
  return (
    <main className="space-y-6">
      <ChampionshipHeader c={c} current="/impostazioni" />
      <p>Come funziona: a ogni partita il vincitore prende punti e il perdente li perde, in egual misura. Se vince lo sfavorito
        (chi ha meno punti) lo scambio è grande; se vince il favorito è piccolo. {c.kind === "doubles" && "Nel doppio la forza di una coppia è la media dei due giocatori, ed entrambi guadagnano o perdono gli stessi punti (ognuno con la propria velocità)."}
        {" "}Quando salvi, la classifica viene ricalcolata da capo con le nuove regole.</p>
      <ActionForm action={saveSettings} submitLabel="Salva e ricalcola" className="space-y-6">
        <input type="hidden" name="championship_id" value={id} />
        <section className={box}>
          <h2 className="text-lg font-semibold">Nome e partenza</h2>
          <label className="grid gap-1">Nome dei punti sul sito
            <input name="label" defaultValue={s.label} maxLength={30} required className="w-60 rounded border bg-transparent px-3 py-2" />
            <span className={muted}>Es. «Punti», «Ranking»… (predefinito: {D.label})</span></label>
          <Num name="initial" label="Punti di un giocatore nuovo" value={s.initial} min={0} max={5000} help={`Predefinito: ${D.initial}`} />
        </section>

        <section className={box}>
          <h2 className="text-lg font-semibold">Velocità di movimento</h2>
          <p className={muted}>Punti massimi che si possono vincere o perdere in una partita. Chi ha giocato poco si muove più in fretta, così trova presto il suo posto.</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Num name="k_new" label="Giocatori nuovi" value={s.k.new} min={1} max={100} help={`Predefinito: ${D.k.new}`} />
            <Num name="k_mid" label="Intermedi" value={s.k.mid} min={1} max={100} help={`Predefinito: ${D.k.mid}`} />
            <Num name="k_exp" label="Esperti" value={s.k.exp} min={1} max={100} help={`Predefinito: ${D.k.exp}`} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Num name="new_until" label="«Nuovo» fino a (partite)" value={s.newUntil} min={0} max={1000} help={`Predefinito: ${D.newUntil}`} />
            <Num name="mid_until" label="«Intermedio» fino a (partite)" value={s.midUntil} min={0} max={5000} help={`Predefinito: ${D.midUntil}`} />
          </div>
        </section>

        <section className={box}>
          <h2 className="text-lg font-semibold">Tornei saltati</h2>
          <label className="flex items-center gap-2"><input type="checkbox" name="decay_enabled" defaultChecked={s.decay.enabled} /> Chi salta un torneo perde punti</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Num name="decay_pct" label="Percentuale persa per torneo saltato" value={s.decay.pct} min={0} max={50} step={0.5}
              help={`Si calcola solo sulla parte sopra la soglia. Predefinito: ${D.decay.pct}%`} />
            <Num name="decay_floor" label="Soglia (sotto non si scende)" value={s.decay.floor} min={0} max={5000} help={`Predefinito: ${D.decay.floor}`} />
          </div>
          <p className={muted}>Esempio: con {s.decay.pct}% e soglia {s.decay.floor}, chi ha {s.decay.floor + 200} punti e salta un torneo ne perde {Math.round(200 * s.decay.pct / 100)}.
            Le assenze giustificate (pagina «Assenze») non fanno perdere punti.</p>
          <label className="flex items-center gap-2"><input type="checkbox" name="comeback_enabled" defaultChecked={s.comeback.enabled} /> Rientro veloce dopo un&apos;assenza</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Num name="comeback_after" label="Dopo quanti tornei saltati di fila" value={s.comeback.afterMissed} min={1} max={50} help={`Predefinito: ${D.comeback.afterMissed}`} />
            <Num name="comeback_matches" label="Per quante partite si muove come un nuovo" value={s.comeback.matches} min={1} max={50} help={`Predefinito: ${D.comeback.matches}`} />
          </div>
        </section>

        <section className={box}>
          <h2 className="text-lg font-semibold">Bonus dei tornei passati</h2>
          <p className={muted}>Servono a costruire la classifica di partenza (pagina «Classifica di partenza»).</p>
          <div className="grid gap-4 sm:grid-cols-4">
            {([1, 2, 3, 4] as const).map((p) => <Num key={p} name={`podium${p}`} label={`${p}° posto`} value={s.podium[p]} min={0} max={1000} help={`Predefinito: ${D.podium[p]}`} />)}
          </div>
        </section>
      </ActionForm>
    </main>
  );
}
