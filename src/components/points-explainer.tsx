import Link from "next/link";
import { pointsSwing } from "@/lib/domain/explain";
import type { RankingSettings } from "@/lib/domain/ranking";

const sign = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
const SITUATIONS = [
  { diff: 0, label: "alla pari" },
  { diff: 100, label: "più forte di 100" },
  { diff: 200, label: "più forte di 200" },
  { diff: -100, label: "più debole di 100" },
  { diff: -200, label: "più debole di 200" },
];

/** Spiegazione, con i numeri della lega, di come si guadagnano e si perdono i punti. */
export function PointsExplainer({ s, doubles }: { s: RankingSettings; doubles: boolean }) {
  const pts = s.label.toLowerCase();
  const speeds = [
    { name: "Nuovi", k: s.k.new, when: `prime ${s.newUntil} partite` },
    { name: "Intermedi", k: s.k.mid, when: `fino a ${s.midUntil} partite` },
    { name: "Esperti", k: s.k.exp, when: `oltre ${s.midUntil} partite` },
  ].filter((x, i) => !(i === 1 && s.midUntil === s.newUntil));
  const podium = ([1, 2, 3, 4] as const).filter((p) => s.podium[p] > 0);
  return (
    <details className="card mt-3 group">
      <summary className="cursor-pointer list-none font-bold">
        <span className="flex items-center justify-between gap-3">Come si guadagnano e si perdono i {pts}
          <span aria-hidden="true" className="text-muted transition group-open:rotate-90">›</span></span>
      </summary>
      <div className="mt-4 space-y-5 text-sm leading-relaxed">
        <section>
          <h3 className="font-bold">1. Si parte da {s.initial} {pts}</h3>
          <p className="text-muted">Ogni giocatore entra in classifica con {s.initial} {pts}
            {podium.length > 0 && <>, più un bonus per i podi dei tornei giocati prima che la lega fosse su PongFu
              ({podium.map((p) => `${p}° posto +${s.podium[p]}`).join(", ")})</>}.</p>
        </section>

        <section>
          <h3 className="font-bold">2. Ogni partita sposta i {pts}</h3>
          <p className="text-muted">Chi vince prende {pts}, chi perde ne cede. Quanti dipende da chi hai davanti:
            battere un avversario più forte vale di più, mentre perdere contro uno più forte costa poco.
            Al contrario, battere uno più debole vale poco e perderci costa caro. Conta solo chi vince la partita, non il punteggio dei set.</p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr><th className="py-1.5 pr-2">Avversario…</th>{speeds.map((v) => <th key={v.name} className="px-1 text-center">{v.name}<span className="block font-normal normal-case tracking-normal">vinci/perdi</span></th>)}</tr>
              </thead>
              <tbody>
                {SITUATIONS.map((x) => (
                  <tr key={x.diff} className="border-t border-line">
                    <td className="py-1.5 pr-2">{x.label}</td>
                    {speeds.map((v) => { const r = pointsSwing(v.k, x.diff); return (
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
          <h3 className="font-bold">3. All&apos;inizio ci si muove più in fretta</h3>
          <p className="text-muted">Per trovare presto il proprio posto in classifica, chi ha giocato poche partite guadagna e perde di più:
            {" "}{speeds.map((v) => `${v.name.toLowerCase()} (${v.when}) fino a ${v.k} ${pts} a partita`).join("; ")}.</p>
        </section>

        {doubles && (
          <section>
            <h3 className="font-bold">In doppio conta la coppia</h3>
            <p className="text-muted">La forza di una coppia è la media dei {pts} dei due compagni. I {pts} vinti o persi
              si calcolano su questa media e valgono per entrambi, ognuno con la propria velocità (punto 3).</p>
          </section>)}

        {s.decay.enabled && s.decay.pct > 0 && (
          <section>
            <h3 className="font-bold">Se salti un torneo</h3>
            <p className="text-muted">Chi non partecipa a un torneo della lega perde il {s.decay.pct}% dei {pts} che ha sopra quota {s.decay.floor}
              {" "}(chi è a {s.decay.floor} o sotto non perde nulla). Per esempio, con {s.decay.floor + 200} {pts} se ne perdono {Math.round((s.decay.pct / 100) * 200)}.
              Se sei infortunato o fuori per lavoro, chiedi all&apos;amministratore di segnare l&apos;assenza: in quel periodo non perdi nulla.</p>
          </section>)}

        {s.comeback.enabled && (
          <section>
            <h3 className="font-bold">Quando rientri</h3>
            <p className="text-muted">Se hai saltato {s.comeback.afterMissed === 1 ? "un torneo" : `${s.comeback.afterMissed} tornei di fila`}, nelle prime {s.comeback.matches} partite
              al rientro ti muovi alla velocità dei nuovi ({s.k.new} {pts}), così recuperi in fretta il tuo livello.</p>
          </section>)}

        <section>
          <h3 className="font-bold">Cosa non conta</h3>
          <p className="text-muted">I tornei amichevoli non toccano la classifica. Anche i «Punti» nella tabella dei gironi sono un&apos;altra cosa:
            servono solo a ordinare il girone (2 per una vittoria, 1 per una sconfitta). La classifica si aggiorna quando l&apos;organizzatore chiude il torneo.</p>
          <p className="mt-2"><Link href="/faq" className="link">Altre domande frequenti</Link></p>
        </section>
      </div>
    </details>
  );
}
