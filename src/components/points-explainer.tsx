import Link from "next/link";
import { pointsSwing } from "@/lib/domain/explain";
import type { RankingSettings } from "@/lib/domain/ranking";
import { tr } from "@/i18n/server";
import { compPoints } from "@/i18n/dict/comp-points";

const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const SITUATIONS = [0, 100, 200, -100, -200];

/** Spiegazione, con i numeri della lega, di come si guadagnano e si perdono i punti. */
export async function PointsExplainer({ s, doubles }: { s: RankingSettings; doubles: boolean }) {
  const t = await tr(compPoints);
  const pts = s.label.toLowerCase();
  const speeds = [
    { name: t.newName, k: s.k.new, when: t.newWhen(s.newUntil) },
    { name: t.midName, k: s.k.mid, when: t.midWhen(s.midUntil) },
    { name: t.expName, k: s.k.exp, when: t.expWhen(s.midUntil) },
  ].filter((x, i) => !(i === 1 && s.midUntil === s.newUntil));
  const podium = ([1, 2, 3, 4] as const).filter((p) => s.podium[p] > 0);
  return (
    <details className="card mt-3 group">
      <summary className="cursor-pointer list-none font-bold">
        <span className="flex items-center justify-between gap-3">{t.summary(pts)}
          <span aria-hidden="true" className="text-muted transition group-open:rotate-90">›</span></span>
      </summary>
      <div className="mt-4 space-y-5 text-sm leading-relaxed">
        <section>
          <h3 className="font-bold">{t.startTitle(s.initial, pts)}</h3>
          <p className="text-muted">{t.startText(s.initial, pts)}
            {podium.length > 0 && t.podiumBonus(podium.map((p) => t.podiumPlace(p, s.podium[p])).join(", "))}.</p>
        </section>

        <section>
          <h3 className="font-bold">{t.swingTitle(pts)}</h3>
          <p className="text-muted">{t.swingText(pts)}</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr><th className="py-1.5 pr-2">{t.opponent}</th>{speeds.map((v) => <th key={v.name} className="px-1 text-center">{v.name}<span className="block font-normal normal-case tracking-normal">{t.winLose}</span></th>)}</tr>
              </thead>
              <tbody>
                {SITUATIONS.map((diff) => (
                  <tr key={diff} className="border-t border-line">
                    <td className="py-1.5 pr-2">{diff === 0 ? t.even : diff > 0 ? t.stronger(diff) : t.weaker(-diff)}</td>
                    {speeds.map((v) => { const r = pointsSwing(v.k, diff); return (
                      <td key={v.name} className="whitespace-nowrap px-1 text-center tabular-nums">
                        <span className="font-semibold text-green-700 dark:text-green-400">{sign(r.win)}</span>
                        <span className="text-muted">/</span>
                        <span className="font-semibold text-red-700 dark:text-red-400">{sign(r.loss)}</span>
                      </td>); })}
                  </tr>))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="font-bold">{t.speedTitle}</h3>
          <p className="text-muted">{t.speedText}
            {" "}{speeds.map((v) => t.speedLine(v.name, v.when, v.k, pts)).join("; ")}.</p>
        </section>

        {doubles && (
          <section>
            <h3 className="font-bold">{t.doublesTitle}</h3>
            <p className="text-muted">{t.doublesText(pts)}</p>
          </section>)}

        {s.decay.enabled && s.decay.pct > 0 && (
          <section>
            <h3 className="font-bold">{t.decayTitle}</h3>
            <p className="text-muted">{t.decayText(s.decay.pct, s.decay.floor, pts)}</p>
          </section>)}

        {s.comeback.enabled && (
          <section>
            <h3 className="font-bold">{t.comebackTitle}</h3>
            <p className="text-muted">{t.comebackText(s.comeback.afterMissed, s.comeback.matches, s.k.new, pts)}</p>
          </section>)}

        <section>
          <h3 className="font-bold">{t.notCountTitle}</h3>
          <p className="text-muted">{t.notCountText}</p>
          <p className="mt-2"><Link href="/faq" className="link">{t.moreFaq}</Link></p>
        </section>
      </div>
    </details>
  );
}
