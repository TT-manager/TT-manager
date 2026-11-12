/**
 * Logica del torneo che lega formato, gironi e tabellone.
 * Funzioni pure: nessun accesso al database.
 */
import { computeStandings, roundRobinSchedule, snakeGroups, type Standing } from "./groups";
import { bestOfForStage, groupSetRules, isKnockoutOnly, knockoutFirstStage, planBracket, stageName, stageSetRules, validateFormat, type CrossCriterion, type SlotSource, type TournamentFormat } from "./format";
import { seedOrder } from "./bracket";
import type { SetRules } from "./score";

export const groupLabel = (g: number) => (g >= 1 && g <= 26 ? String.fromCharCode(64 + g) : String(g));

export interface SeededPlayer { id: string; rating: number }

export interface KnockoutPlanMatch {
  stage: number; position: number;
  /** Provenienza dei giocatori (null se il giocatore è già noto e indicato in playerA/playerB). */
  a: SlotSource | null; b: SlotSource | null;
  playerA?: string | null; playerB?: string | null;
  bestOf: number; set: SetRules;
}

export interface GroupStagePlan {
  /** group = null nei tornei a sola eliminazione diretta. */
  assignments: { playerId: string; seed: number; group: number | null }[];
  matches: { group: number; round: number; position: number; a: string; b: string; bestOf: number; set: SetRules }[];
  knockout: KnockoutPlanMatch[];
}

/**
 * Tabellone a sola eliminazione diretta: teste di serie per rating nelle posizioni standard
 * (1 e 2 in metà opposte), bye ai migliori se i giocatori non sono una potenza di 2.
 */
function buildKnockoutOnly(seeded: SeededPlayer[], f: TournamentFormat): GroupStagePlan {
  const n = seeded.length;
  const first = knockoutFirstStage(n);
  const size = 2 ** (first + 1);
  const order = seedOrder(size);
  const at = (seed: number) => seeded[seed - 1]?.id ?? null;
  const knockout: KnockoutPlanMatch[] = [];
  const rules = (stage: number) => ({ bestOf: bestOfForStage(f, stage), set: stageSetRules(f, stage) });
  // Primo turno: le coppie con un bye non diventano partite, il giocatore passa direttamente.
  type Slot = { src: SlotSource | null; player: string | null };
  let slots: Slot[] = [];
  for (let i = 0; i < size / 2; i++) {
    const pa = at(order[2 * i]), pb = at(order[2 * i + 1]);
    if (pa && pb) {
      knockout.push({ stage: first, position: i, a: null, b: null, playerA: pa, playerB: pb, ...rules(first) });
      slots.push({ src: { kind: "winner", stage: first, match: i }, player: null });
    } else slots.push({ src: null, player: pa ?? pb });
  }
  for (let stage = first - 1; stage >= 0; stage--) {
    const next: Slot[] = [];
    for (let j = 0; j < slots.length / 2; j++) {
      const x = slots[2 * j], y = slots[2 * j + 1];
      knockout.push({ stage, position: j, a: x.src, b: y.src, playerA: x.player, playerB: y.player, ...rules(stage) });
      next.push({ src: { kind: "winner", stage, match: j }, player: null });
    }
    slots = next;
  }
  return { assignments: seeded.map((p, i) => ({ playerId: p.id, seed: i + 1, group: null })), matches: [], knockout };
}

/**
 * Compone i gironi a serpentina (per rating), crea il calendario all'italiana
 * e lo scheletro del tabellone. Lancia un Error in italiano se non è possibile.
 */
export function buildTournament(players: SeededPlayer[], f: TournamentFormat): GroupStagePlan {
  if (players.length < 2) throw new Error("Servono almeno 2 iscritti.");
  if (isKnockoutOnly(f)) {
    const errors = validateFormat(f);
    if (errors.length) throw new Error(errors.join(" "));
    return buildKnockoutOnly([...players].sort((x, y) => y.rating - x.rating || x.id.localeCompare(y.id)), f);
  }
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

export interface GroupView {
  group: number; standings: Standing[]; complete: boolean; matches: MatchRow[];
  /** Testa di serie di ogni giocatore (1 = rating più alto), per gli spareggi tra gironi. */
  seeds: Map<string, number>;
}

/** Classifica e stato di ciascun girone. */
export function groupViews(members: { playerId: string; group: number; seed?: number | null }[], matches: MatchRow[]): GroupView[] {
  const groups = [...new Set(members.map((m) => m.group))].sort((a, b) => a - b);
  return groups.map((g) => {
    const ids = members.filter((m) => m.group === g).map((m) => m.playerId);
    const gm = matches.filter((m) => m.phase === "group" && m.group_no === g)
      .sort((x, y) => x.position - y.position);
    const results = gm.filter(isPlayed).filter((m) => m.player_a && m.player_b).map((m) => {
      const pts = (m.set_scores ?? []).reduce(([a, b], [x, y]) => [a + x, b + y], [0, 0]);
      return { playerA: m.player_a!, playerB: m.player_b!, setsA: m.sets_a!, setsB: m.sets_b!, pointsA: pts[0], pointsB: pts[1] };
    });
    const seeds = new Map(members.filter((m) => m.group === g).map((m) => [m.playerId, m.seed ?? 9999]));
    return { group: g, standings: computeStandings(ids, results), complete: gm.length > 0 && gm.every(isPlayed), matches: gm, seeds };
  });
}

/**
 * Chi occupa un posto del tabellone, se già noto:
 * - posizione di girone: solo a girone concluso;
 * - vincente di una partita: solo a partita giocata.
 */
/** Valore di un criterio per confrontare giocatori di gironi diversi (più alto = meglio). */
function criterionValue(c: CrossCriterion, s: Standing): number {
  const n = Math.max(s.played, 1);
  const ratio = (a: number, b: number) => (b === 0 ? (a === 0 ? 1 : Number.MAX_SAFE_INTEGER) : a / b);
  switch (c) {
    case "winPct": return s.wins / n;
    case "setDiffAvg": return (s.setsFor - s.setsAgainst) / n;
    case "pointDiffAvg": return (s.pointsFor - s.pointsAgainst) / n;
    case "setRatio": return ratio(s.setsFor, s.setsAgainst);
    case "pointRatio": return ratio(s.pointsFor, s.pointsAgainst);
  }
}

/**
 * Classifica dei ripescabili: chi è arrivato in `position` in ciascun girone, ordinato con i criteri
 * indicati e, a parità, per testa di serie. Disponibile solo quando TUTTI i gironi sono conclusi.
 */
export function bestRanking(position: number, criteria: CrossCriterion[], groups: GroupView[]) {
  if (groups.length === 0 || !groups.every((g) => g.complete)) return null;
  const rows = groups.flatMap((g) => {
    const s = g.standings.find((x) => x.rank === position);
    return s ? [{ playerId: s.playerId, group: g.group, standing: s, seed: g.seeds.get(s.playerId) ?? 9999 }] : [];
  });
  const EPS = 1e-9;
  rows.sort((x, y) => {
    for (const c of criteria) {
      const d = criterionValue(c, y.standing) - criterionValue(c, x.standing);
      if (Math.abs(d) > EPS) return d;
    }
    return x.seed - y.seed;
  });
  return rows;
}

export function resolveSource(src: SlotSource, groups: GroupView[], knockout: MatchRow[]): string | null {
  if (src.kind === "best") return bestRanking(src.position, src.criteria, groups)?.[src.rank - 1]?.playerId ?? null;
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
  if (src.kind === "best") return `Ripescato: ${src.rank}° miglior ${src.position}° classificato`;
  return src.kind === "group"
    ? `${src.position}° girone ${groupLabel(src.group)}`
    : `Vincente ${stageName(src.stage).toLowerCase()} ${src.match + 1}`;
}

/**
 * Giocatori che dovrebbero occupare ogni partita del tabellone, dati gironi e risultati.
 * Serve sia a mostrare il tabellone sia ad aggiornarlo nel database.
 */
export function resolveKnockout(groups: GroupView[], knockout: MatchRow[]) {
  const out = knockout.map((m) => ({
    id: m.id, stage: m.stage,
    player_a: m.source_a ? resolveSource(m.source_a, groups, knockout) : m.player_a,
    player_b: m.source_b ? resolveSource(m.source_b, groups, knockout) : m.player_b,
  }));
  // Ripescati: se possibile non affrontano subito un compagno di girone.
  // Si scambiano tra loro i ripescati della stessa posizione nello stesso turno.
  const groupOf = new Map(groups.flatMap((g) => g.standings.map((s) => [s.playerId, g.group] as const)));
  const slots: { row: (typeof out)[number]; side: "player_a" | "player_b"; position: number }[] = [];
  knockout.forEach((m, i) => {
    if (m.source_a?.kind === "best") slots.push({ row: out[i], side: "player_a", position: m.source_a.position });
    if (m.source_b?.kind === "best") slots.push({ row: out[i], side: "player_b", position: m.source_b.position });
  });
  const opp = (x: (typeof slots)[number]) => x.row[x.side === "player_a" ? "player_b" : "player_a"];
  const clash = (p: string | null, q: string | null) => (p && q && groupOf.get(p) === groupOf.get(q) ? 1 : 0);
  for (let changed = true, guard = 0; changed && guard < 50; guard++) {
    changed = false;
    for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
      const x = slots[i], y = slots[j];
      if (x.position !== y.position || x.row.stage !== y.row.stage) continue;
      const px = x.row[x.side], py = y.row[y.side];
      if (!px || !py) continue;
      if (clash(py, opp(x)) + clash(px, opp(y)) < clash(px, opp(x)) + clash(py, opp(y))) {
        x.row[x.side] = py; y.row[y.side] = px; changed = true;
      }
    }
  }
  return out.map(({ id, player_a, player_b }) => ({ id, player_a, player_b }));
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
