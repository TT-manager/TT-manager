/**
 * Logica del torneo che lega formato, gironi e tabellone.
 * Funzioni pure: nessun accesso al database.
 */
import { computeStandings, roundRobinSchedule, snakeGroups, type Standing } from "./groups";
import { groupSetRules, planBracket, stageName, validateFormat, type SlotSource, type TournamentFormat } from "./format";
import type { SetRules } from "./score";

export const groupLabel = (g: number) => (g >= 1 && g <= 26 ? String.fromCharCode(64 + g) : String(g));

export interface SeededPlayer { id: string; rating: number }

export interface GroupStagePlan {
  assignments: { playerId: string; seed: number; group: number }[];
  matches: { group: number; round: number; position: number; a: string; b: string; bestOf: number; set: SetRules }[];
  knockout: { stage: number; position: number; a: SlotSource; b: SlotSource; bestOf: number; set: SetRules }[];
}

/**
 * Compone i gironi a serpentina (per rating), crea il calendario all'italiana
 * e lo scheletro del tabellone. Lancia un Error in italiano se non è possibile.
 */
export function buildTournament(players: SeededPlayer[], f: TournamentFormat): GroupStagePlan {
  if (players.length < 2) throw new Error("Servono almeno 2 iscritti.");
  if (players.length < f.groupCount * 2)
    throw new Error(`Con ${f.groupCount} gironi servono almeno ${f.groupCount * 2} iscritti (ora sono ${players.length}).`);
  const seeded = [...players].sort((x, y) => y.rating - x.rating || x.id.localeCompare(y.id));
  const groups = snakeGroups(seeded, f.groupCount);
  const errors = validateFormat(f, groups.map((g) => g.length));
  if (errors.length) throw new Error(errors.join(" "));

  const assignments = seeded.map((p, i) => ({
    playerId: p.id, seed: i + 1, group: groups.findIndex((g) => g.includes(p)) + 1,
  }));
  const matches: GroupStagePlan["matches"] = [];
  const set = groupSetRules(f);
  groups.forEach((g, gi) => {
    const firstLeg = roundRobinSchedule(g.map((p) => p.id));
    // Ritorno: stessi turni, campi invertiti, numerati dopo l'andata.
    const rounds = f.groupLegs === 2 ? [...firstLeg, ...firstLeg.map((r) => r.map(([a, b]) => [b, a] as [string, string]))] : firstLeg;
    rounds.forEach((round, ri) =>
      round.forEach(([a, b], pi) => matches.push({ group: gi + 1, round: ri + 1, position: pi, a, b, bestOf: f.groupBestOf, set })));
  });
  const knockout = planBracket(f).rounds.flatMap((r) =>
    r.matches.map((m) => ({ stage: m.stage, position: m.match, a: m.a, b: m.b, bestOf: m.bestOf, set: m.set })));
  return { assignments, matches, knockout };
}

/** Una partita come arriva dal database (campi usati qui). */
export interface MatchRow {
  id: string;
  phase: "group" | "knockout";
  group_no: number | null;
  stage: number | null;
  position: number;
  player_a: string | null;
  player_b: string | null;
  sets_a: number | null;
  sets_b: number | null;
  set_scores: [number, number][] | null;
  source_a: SlotSource | null;
  source_b: SlotSource | null;
}

export const isPlayed = (m: Pick<MatchRow, "sets_a" | "sets_b">) =>
  m.sets_a !== null && m.sets_b !== null && m.sets_a !== m.sets_b;

export function winnerOf(m: MatchRow): string | null {
  if (!isPlayed(m) || !m.player_a || !m.player_b) return null;
  return (m.sets_a as number) > (m.sets_b as number) ? m.player_a : m.player_b;
}

export interface GroupView { group: number; standings: Standing[]; complete: boolean; matches: MatchRow[] }

/** Classifica e stato di ciascun girone. */
export function groupViews(members: { playerId: string; group: number }[], matches: MatchRow[]): GroupView[] {
  const groups = [...new Set(members.map((m) => m.group))].sort((a, b) => a - b);
  return groups.map((g) => {
    const ids = members.filter((m) => m.group === g).map((m) => m.playerId);
    const gm = matches.filter((m) => m.phase === "group" && m.group_no === g)
      .sort((x, y) => x.position - y.position);
    const results = gm.filter(isPlayed).filter((m) => m.player_a && m.player_b).map((m) => {
      const pts = (m.set_scores ?? []).reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
      return { playerA: m.player_a!, playerB: m.player_b!, setsA: m.sets_a!, setsB: m.sets_b!, pointsA: pts[0], pointsB: pts[1] };
    });
    return { group: g, standings: computeStandings(ids, results), complete: gm.length > 0 && gm.every(isPlayed), matches: gm };
  });
}

/**
 * Chi occupa un posto del tabellone, se già noto:
 * - posizione di girone: solo a girone concluso;
 * - vincente di una partita: solo a partita giocata.
 */
export function resolveSource(src: SlotSource, groups: GroupView[], knockout: MatchRow[]): string | null {
  if (src.kind === "group") {
    const g = groups.find((x) => x.group === src.group);
    if (!g?.complete) return null;
    return g.standings.find((s) => s.rank === src.position)?.playerId ?? null;
  }
  const m = knockout.find((k) => k.stage === src.stage && k.position === src.match);
  return m ? winnerOf(m) : null;
}

/** Etichetta leggibile di un posto ancora da definire. */
export function sourceLabel(src: SlotSource): string {
  return src.kind === "group"
    ? `${src.position}° girone ${groupLabel(src.group)}`
    : `Vincente ${stageName(src.stage).toLowerCase()} ${src.match + 1}`;
}

/**
 * Giocatori che dovrebbero occupare ogni partita del tabellone, dati gironi e risultati.
 * Serve sia a mostrare il tabellone sia ad aggiornarlo nel database.
 */
export function resolveKnockout(groups: GroupView[], knockout: MatchRow[]) {
  return knockout.map((m) => ({
    id: m.id,
    player_a: m.source_a ? resolveSource(m.source_a, groups, knockout) : m.player_a,
    player_b: m.source_b ? resolveSource(m.source_b, groups, knockout) : m.player_b,
  }));
}

export interface ResultChange {
  sets_a: number | null; sets_b: number | null; set_scores: [number, number][] | null;
}

export type ApplyOutcome =
  | { error: string }
  | { knockoutUpdates: { id: string; player_a: string | null; player_b: string | null }[]; allGroupsComplete: boolean };

/**
 * Calcola l'effetto di un risultato (o della sua cancellazione) su tutto il torneo.
 * Rifiuta le modifiche che cambierebbero i giocatori di partite del tabellone già giocate.
 */
export function applyResult(
  matches: (MatchRow & { rated?: boolean })[],
  members: { playerId: string; group: number }[],
  matchId: string,
  change: ResultChange,
): ApplyOutcome {
  const target = matches.find((m) => m.id === matchId);
  if (!target) return { error: "Partita non trovata." };
  if (target.rated) return { error: "Questa partita è già stata conteggiata nella classifica generale: può correggerla solo un amministratore." };
  if (!target.player_a || !target.player_b) return { error: "I giocatori di questa partita non sono ancora definiti." };

  let next = matches.map((m) => (m.id === matchId ? { ...m, ...change } : m));
  const groups = groupViews(members, next);
  // Propaga turno per turno finché il tabellone non cambia più.
  for (let i = 0; i < 10; i++) {
    const ko = next.filter((m) => m.phase === "knockout");
    const resolved = new Map(resolveKnockout(groups, ko).map((r) => [r.id, r]));
    let changed = false;
    next = next.map((m) => {
      const r = resolved.get(m.id);
      if (!r || (r.player_a === m.player_a && r.player_b === m.player_b)) return m;
      changed = true;
      return { ...m, player_a: r.player_a, player_b: r.player_b };
    });
    if (!changed) break;
  }

  const updates: { id: string; player_a: string | null; player_b: string | null }[] = [];
  for (const before of matches) {
    if (before.phase !== "knockout" || before.id === matchId) continue;
    const after = next.find((m) => m.id === before.id)!;
    if (after.player_a === before.player_a && after.player_b === before.player_b) continue;
    if (isPlayed(before))
      return { error: "Questa modifica cambierebbe i giocatori di una partita del tabellone già giocata: cancella prima quel risultato." };
    updates.push({ id: before.id, player_a: after.player_a, player_b: after.player_b });
  }
  const allGroupsComplete = groups.length > 0 && groups.every((g) => g.complete);
  return { knockoutUpdates: updates, allGroupsComplete };
}
