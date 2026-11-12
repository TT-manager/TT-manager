import { ActionForm } from "@/components/action-form";
import { MatchForm } from "@/components/match-form";
import { getAccount } from "@/lib/account";
import { stageName } from "@/lib/domain/format";
import { groupLabel, isPlayed, type MatchRow } from "@/lib/domain/tournament";
import { playerContestResult, playerSubmitResult } from "./risultati-actions";

type M = MatchRow & { round: number; best_of: number; set_points: number; golden_point: number | null; reported_by: string | null };

/**
 * «Le tue partite»: chi gioca nel torneo inserisce i propri risultati (valgono subito)
 * e può contestare quelli inseriti dagli avversari. Va dentro <Suspense>.
 */
export async function MyMatches({ t, matches, entryPlayers, playerNames, name }: {
  t: { public_code: string; status: string; player_results: boolean };
  matches: M[]; entryPlayers: Map<string, string[]>; playerNames: Map<string, string>;
  name: (id: string | null) => string | null;
}) {
  if (!t.player_results || (t.status !== "groups" && t.status !== "knockout")) return null;
  const account = await getAccount();
  if (!account) return null;
  return <MyMatchesList t={t} matches={matches} entryPlayers={entryPlayers} playerNames={playerNames} name={name} me={account.player.id} />;
}

export function MyMatchesList({ t, matches, entryPlayers, playerNames, name, me }: {
  t: { public_code: string }; matches: M[]; entryPlayers: Map<string, string[]>; playerNames: Map<string, string>;
  name: (id: string | null) => string | null; me: string;
}) {
  const myEntries = new Set([...entryPlayers].filter(([, ps]) => ps.includes(me)).map(([id]) => id));
  if (!myEntries.size) return null;
  const mine = matches
    .filter((m) => m.player_a && m.player_b && (myEntries.has(m.player_a) || myEntries.has(m.player_b)))
    .sort((x, y) => Number(isPlayed(x)) - Number(isPlayed(y)) || (x.phase === y.phase ? 0 : x.phase === "group" ? -1 : 1)
      || (y.stage ?? 0) - (x.stage ?? 0) || x.round - y.round || x.position - y.position);
  if (!mine.length) return null;
  const hidden = { public_code: t.public_code };

  return (
    <section className="card mt-6">
      <h2 className="text-xl font-bold uppercase">Le tue partite</h2>
      <p className="text-sm text-muted">Inserisci tu il risultato appena finisci: vale subito. Se un avversario ne inserisce uno sbagliato, contestalo e decide l&apos;organizzatore.</p>
      <ul className="mt-3 divide-y divide-line">
        {mine.map((m) => {
          const mySide = myEntries.has(m.player_a!) ? m.player_a! : m.player_b!;
          const mates = entryPlayers.get(mySide) ?? [];
          const byUs = m.reported_by !== null && mates.includes(m.reported_by);
          const reporter = m.reported_by ? (m.reported_by === me ? "te" : playerNames.get(m.reported_by) ?? "un giocatore") : null;
          const played = isPlayed(m);
          const label = m.phase === "group" ? `Girone ${groupLabel(m.group_no ?? 0)} · turno ${m.round}` : stageName(m.stage ?? 0);
          return (
            <li key={m.id} className="py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span><span className="text-xs uppercase tracking-wide text-muted">{label}</span><br />
                  <span className="font-medium">{name(m.player_a)}</span> <span className="text-muted">vs</span> <span className="font-medium">{name(m.player_b)}</span></span>
                <span className="text-right">
                  {played ? <span className="rounded bg-ink px-2 py-0.5 font-display font-bold tabular-nums text-white dark:bg-neutral-700">{m.sets_a}-{m.sets_b}</span>
                    : <span className="text-xs text-muted">da giocare</span>}
                  {m.disputed && <span className="badge-contested ml-2">Contestato</span>}
                </span>
              </div>
              {played && <p className="mt-1 text-xs text-muted">{reporter ? `Inserito da ${reporter}` : "Inserito dall'organizzatore"}{m.disputed ? " · decide l'organizzatore" : ""}</p>}
              <div className="mt-2">
                {!m.disputed && (!played || byUs) && (
                  <MatchForm action={playerSubmitResult} hidden={hidden} matchId={m.id} bestOf={m.best_of} rules={{ points: m.set_points, golden: m.golden_point }}
                    a={name(m.player_a)!} b={name(m.player_b)!} initial={m.set_scores} />)}
                {!m.disputed && played && m.reported_by && !byUs && (
                  <ActionForm action={playerContestResult} submitLabel="Contesta il risultato" primary={false}
                    confirmText="Contestare questo risultato? L'organizzatore deciderà e intanto il torneo, per questa partita, resta in attesa.">
                    <input type="hidden" name="public_code" value={t.public_code} />
                    <input type="hidden" name="match_id" value={m.id} />
                  </ActionForm>)}
              </div>
            </li>);
        })}
      </ul>
    </section>
  );
}
