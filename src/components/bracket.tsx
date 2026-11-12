import { stageName } from "@/lib/domain/format";
import { isPlayed, sourceLabel, type MatchRow } from "@/lib/domain/tournament";

type Resolved = { player_a: string | null; player_b: string | null };

/**
 * Tabellone a eliminazione disegnato a colonne, con le linee che uniscono i turni.
 * Turno `s` ha 2^s posti; la partita (s, p) è alimentata da (s+1, 2p) e (s+1, 2p+1).
 * I posti senza partita nel primo turno sono «passaggi diretti» (bye).
 */
export function Bracket({ knockout, resolved, name }: {
  knockout: MatchRow[]; resolved: Map<string, Resolved>; name: (id: string | null) => string | null;
}) {
  const stages = [...new Set(knockout.map((k) => k.stage as number))].sort((a, b) => b - a);
  if (!stages.length) return null;
  const first = stages[0];
  const at = (s: number, p: number) => knockout.find((k) => k.stage === s && k.position === p);
  const final = at(0, 0);
  const champion = final && isPlayed(final)
    ? name(((final.sets_a as number) > (final.sets_b as number) ? final.player_a ?? resolved.get(final.id)?.player_a : final.player_b ?? resolved.get(final.id)?.player_b) ?? null)
    : null;
  const unit = 112; // altezza di un posto del primo turno, in px

  return (
    <div>
      {champion && (
        <div className="mb-6 flex items-center gap-4 rounded-2xl border-4 border-gold bg-ink p-4 text-white shadow-lg">
          <span className="text-4xl" aria-hidden="true">🏆</span>
          <div><p className="text-xs uppercase tracking-widest text-gold">Vincitore del torneo</p>
            <p className="font-display text-3xl font-bold uppercase">{champion}</p></div>
        </div>
      )}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-6" style={{ minWidth: stages.length * 232 }}>
          {stages.map((s) => {
            const slots = 2 ** s;
            const pairs = s === 0 ? [[0]] : Array.from({ length: slots / 2 }, (_, k) => [2 * k, 2 * k + 1]);
            return (
              <div key={s} className="w-52 shrink-0">
                <p className={`mb-3 text-center font-display text-sm font-bold uppercase tracking-wider ${s === 0 ? "text-brand" : "text-muted"}`}>
                  {s === 0 ? "🏆 " : ""}{stageName(s)}</p>
                <div className="flex flex-col" style={{ height: 2 ** first * unit }}>
                  {pairs.map((pair) => (
                    <div key={pair[0]} className={`relative flex flex-1 flex-col ${s > 0 ? "after:absolute after:left-full after:top-1/4 after:h-1/2 after:w-3 after:rounded-r after:border-y-2 after:border-r-2 after:border-neutral-400 after:content-[''] dark:after:border-neutral-600" : ""}`}>
                      {pair.map((p) => (
                        <div key={p} className="flex flex-1 items-center">
                          <Slot m={at(s, p)} s={s} p={p} first={s === first} at={at} resolved={resolved} name={name} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Slot({ m, s, p, first, at, resolved, name }: {
  m: MatchRow | undefined; s: number; p: number; first: boolean;
  at: (s: number, p: number) => MatchRow | undefined; resolved: Map<string, Resolved>; name: (id: string | null) => string | null;
}) {
  const stub = first ? "" : "before:absolute before:right-full before:top-1/2 before:w-3 before:border-t-2 before:border-neutral-400 before:content-[''] dark:before:border-neutral-600";
  if (!m) {
    // Passaggio diretto: il giocatore compare già nella partita del turno dopo.
    const next = at(s - 1, Math.floor(p / 2));
    const who = next ? (p % 2 === 0 ? next.player_a : next.player_b) : null;
    return (
      <div className="relative w-full rounded-lg border-2 border-dashed border-line px-3 py-2 text-sm text-muted">
        <span className="font-medium">{name(who) ?? "—"}</span><span className="block text-xs">passa il turno</span>
      </div>);
  }
  const r = resolved.get(m.id);
  const a = m.player_a ?? r?.player_a ?? null, b = m.player_b ?? r?.player_b ?? null;
  const played = isPlayed(m);
  const winA = played && (m.sets_a as number) > (m.sets_b as number);
  const row = (id: string | null, src: MatchRow["source_a"], sets: number | null, win: boolean) => (
    <div className={`flex items-center justify-between gap-2 px-3 py-1.5 ${win ? "border-l-4 border-brand bg-brand/10 font-semibold" : played ? "border-l-4 border-transparent text-muted" : "border-l-4 border-transparent"}`}>
      <span className="truncate">{name(id) ?? <span className="text-xs italic text-muted">{src ? sourceLabel(src) : "da definire"}</span>}</span>
      {played && <span className={`font-display text-lg font-bold tabular-nums ${win ? "text-brand" : ""}`}>{sets}</span>}
    </div>
  );
  return (
    <div className={`relative w-full ${stub}`}>
      <div className={`overflow-hidden rounded-lg border bg-surface text-sm shadow-sm ${s === 0 ? "border-2 border-gold" : "border-line"}`}>
        {row(a, m.source_a, m.sets_a, winA)}
        <div className="border-t border-line" />
        {row(b, m.source_b, m.sets_b, played && !winA)}
      </div>
      {played && (m.set_scores?.length ?? 0) > 0 && (
        <p className="absolute inset-x-0 top-full mt-0.5 text-center text-[0.7rem] tabular-nums text-muted">{m.set_scores!.map(([x, y]) => `${x}-${y}`).join("  ")}</p>)}
    </div>
  );
}
