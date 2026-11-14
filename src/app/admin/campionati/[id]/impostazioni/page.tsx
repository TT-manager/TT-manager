import type { ReactNode } from "react";
import { ActionForm } from "@/components/action-form";
import { DEFAULT_RANKING } from "@/lib/domain/ranking";
import { saveSettings } from "../../actions";
import { ChampionshipHeader, loadManagedChampionship, muted } from "../shared";
import { tr } from "@/i18n/server";
import { adminLeaguesText } from "@/i18n/dict/admin-leagues";

export async function generateMetadata() {
  return { title: (await tr(adminLeaguesText)).tabRules };
}

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
  const t = await tr(adminLeaguesText);
  const box = "space-y-4 rounded-lg border p-4";
  return (
    <main className="space-y-6">
      <ChampionshipHeader c={c} current="/impostazioni" />
      <p>{t.howItWorks} {c.kind === "doubles" && t.doublesNote}
        {" "}{t.recomputeOnSave}</p>
      <ActionForm action={saveSettings} submitLabel={t.saveAndRecompute} className="space-y-6">
        <input type="hidden" name="championship_id" value={id} />
        <section className={box}>
          <h2 className="text-lg font-semibold">{t.nameAndStart}</h2>
          <label className="grid gap-1">{t.pointsName}
            <input name="label" defaultValue={s.label} maxLength={30} required className="w-60 rounded border bg-transparent px-3 py-2" />
            <span className={muted}>{t.pointsNameHelp(D.label)}</span></label>
          <Num name="initial" label={t.initialPoints} value={s.initial} min={0} max={5000} help={t.defaultValue(D.initial)} />
        </section>

        <section className={box}>
          <h2 className="text-lg font-semibold">{t.speed}</h2>
          <p className={muted}>{t.speedNote}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <Num name="k_new" label={t.kNew} value={s.k.new} min={1} max={100} help={t.defaultValue(D.k.new)} />
            <Num name="k_mid" label={t.kMid} value={s.k.mid} min={1} max={100} help={t.defaultValue(D.k.mid)} />
            <Num name="k_exp" label={t.kExp} value={s.k.exp} min={1} max={100} help={t.defaultValue(D.k.exp)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Num name="new_until" label={t.newUntil} value={s.newUntil} min={0} max={1000} help={t.defaultValue(D.newUntil)} />
            <Num name="mid_until" label={t.midUntil} value={s.midUntil} min={0} max={5000} help={t.defaultValue(D.midUntil)} />
          </div>
        </section>

        <section className={box}>
          <h2 className="text-lg font-semibold">{t.missed}</h2>
          <label className="flex items-center gap-2"><input type="checkbox" name="decay_enabled" defaultChecked={s.decay.enabled} /> {t.decayEnabled}</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Num name="decay_pct" label={t.decayPct} value={s.decay.pct} min={0} max={50} step={0.5}
              help={t.decayPctHelp(D.decay.pct)} />
            <Num name="decay_floor" label={t.decayFloor} value={s.decay.floor} min={0} max={5000} help={t.defaultValue(D.decay.floor)} />
          </div>
          <p className={muted}>{t.decayExample(s.decay.pct, s.decay.floor, s.decay.floor + 200, Math.round(200 * s.decay.pct / 100))}
            {" "}{t.absencesNoLoss}</p>
          <label className="flex items-center gap-2"><input type="checkbox" name="comeback_enabled" defaultChecked={s.comeback.enabled} /> {t.comebackEnabled}</label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Num name="comeback_after" label={t.comebackAfter} value={s.comeback.afterMissed} min={1} max={50} help={t.defaultValue(D.comeback.afterMissed)} />
            <Num name="comeback_matches" label={t.comebackMatches} value={s.comeback.matches} min={1} max={50} help={t.defaultValue(D.comeback.matches)} />
          </div>
        </section>

        <section className={box}>
          <h2 className="text-lg font-semibold">{t.podiumBonus}</h2>
          <p className={muted}>{t.podiumBonusNote}</p>
          <div className="grid gap-4 sm:grid-cols-4">
            {([1, 2, 3, 4] as const).map((p) => <Num key={p} name={`podium${p}`} label={t.place(p)} value={s.podium[p]} min={0} max={1000} help={t.defaultValue(D.podium[p])} />)}
          </div>
        </section>
      </ActionForm>
    </main>
  );
}
