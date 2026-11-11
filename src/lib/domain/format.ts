/**
 * Formato di un torneo, completamente configurabile.
 *
 * - Fase a gironi: numero di gironi e numero di set (best of) delle partite di girone.
 * - Qualificazione: per ogni regola, QUALI posizioni di girone (es. 1° / 2° e 3°)
 *   entrano e IN QUALE TURNO del tabellone iniziano.
 * - Tabellone: numero di set per ogni turno (finale, semifinali, ...).
 *
 * I turni si indicano come "stadi" contando dalla finale:
 *   0 = finale, 1 = semifinali, 2 = quarti, 3 = ottavi, 4 = sedicesimi ...
 */

export const VALID_BEST_OF = [1, 3, 5, 7] as const;
export type BestOf = (typeof VALID_BEST_OF)[number];

export interface QualificationRule {
  /** Posizioni di girone che si qualificano con questa regola (1 = primo). */
  positions: number[];
  /** Stadio in cui entrano nel tabellone (0 = finale, 1 = semifinali, 2 = quarti, ...). */
  stage: number;
}

export interface TournamentFormat {
  groupCount: number;
  groupBestOf: BestOf;
  qualification: QualificationRule[];
  /** Set per stadio. Gli stadi non indicati usano `defaultKnockoutBestOf`. */
  knockoutBestOf: Record<number, BestOf>;
  defaultKnockoutBestOf: BestOf;
}

export const STAGE_NAMES: Record<number, string> = {
  0: "Finale", 1: "Semifinali", 2: "Quarti di finale", 3: "Ottavi di finale", 4: "Sedicesimi di finale",
};
export const stageName = (stage: number) => STAGE_NAMES[stage] ?? `Turno ${stage}`;

export function bestOfForStage(f: TournamentFormat, stage: number): BestOf {
  return f.knockoutBestOf[stage] ?? f.defaultKnockoutBestOf;
}

/** Sorgente di un posto nel tabellone. */
export type SlotSource =
  | { kind: "group"; group: number; position: number } // gruppo 1-based, posizione 1-based
  | { kind: "winner"; stage: number; match: number };

export interface PlannedMatch {
  stage: number;
  /** Indice nel turno, da 0. */
  match: number;
  a: SlotSource;
  b: SlotSource;
  bestOf: BestOf;
}

export interface BracketPlan {
  /** Dal primo turno alla finale. */
  rounds: { stage: number; matches: PlannedMatch[] }[];
}

/** Controlla il formato; restituisce l'elenco dei problemi in italiano (vuoto = valido). */
export function validateFormat(f: TournamentFormat, playersPerGroup?: number[]): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(f.groupCount) || f.groupCount < 1) errors.push("Serve almeno un girone.");
  if (!VALID_BEST_OF.includes(f.groupBestOf)) errors.push("Set dei gironi non valido (1, 3, 5 o 7).");
  if (!VALID_BEST_OF.includes(f.defaultKnockoutBestOf)) errors.push("Set del tabellone non valido (1, 3, 5 o 7).");
  for (const [s, b] of Object.entries(f.knockoutBestOf))
    if (!VALID_BEST_OF.includes(b)) errors.push(`Set non validi per il turno ${s}.`);
  if (f.qualification.length === 0) errors.push("Indica almeno una regola di qualificazione.");

  const seen = new Set<number>();
  for (const r of f.qualification) {
    if (!Number.isInteger(r.stage) || r.stage < 0 || r.stage > 6) errors.push("Turno di ingresso non valido.");
    if (r.positions.length === 0) errors.push("Una regola di qualificazione non ha posizioni.");
    for (const p of r.positions) {
      if (!Number.isInteger(p) || p < 1) errors.push(`Posizione di girone non valida: ${p}.`);
      if (seen.has(p)) errors.push(`La posizione ${p} compare in più regole.`);
      seen.add(p);
      if (playersPerGroup && playersPerGroup.some((n) => n < p))
        errors.push(`C'è un girone con meno di ${p} giocatori: la posizione ${p} non esiste.`);
    }
  }
  if (errors.length === 0) {
    try { planBracket(f); } catch (e) { errors.push((e as Error).message); }
  }
  return errors;
}

/** Quanti qualificati entrano a ciascuno stadio. */
function entrantsByStage(f: TournamentFormat): Map<number, SlotSource[]> {
  const byStage = new Map<number, SlotSource[]>();
  for (const rule of f.qualification) {
    const list = byStage.get(rule.stage) ?? [];
    for (const position of rule.positions)
      for (let g = 1; g <= f.groupCount; g++) list.push({ kind: "group", group: g, position });
    byStage.set(rule.stage, list);
  }
  return byStage;
}

/**
 * Costruisce lo schema del tabellone (chi incontra chi, con riferimenti ai gironi
 * e ai vincitori dei turni precedenti). Lancia un Error in italiano se il formato è incoerente.
 */
export function planBracket(f: TournamentFormat): BracketPlan {
  const byStage = entrantsByStage(f);
  const stages = [...byStage.keys()];
  const first = Math.max(...stages);
  const rounds: BracketPlan["rounds"] = [];
  let carried: SlotSource[] = []; // vincitori del turno precedente

  for (let stage = first; stage >= 0; stage--) {
    const entrants = byStage.get(stage) ?? [];
    const slots = [...entrants, ...carried];
    if (slots.length < 2) throw new Error(`Al turno "${stageName(stage)}" ci sono meno di 2 giocatori.`);
    if (slots.length % 2 !== 0)
      throw new Error(`Al turno "${stageName(stage)}" i giocatori sono ${slots.length} (dispari): modifica le regole di qualificazione.`);
    if (stage === 0 && slots.length !== 2)
      throw new Error(`La finale ha ${slots.length} giocatori invece di 2: le regole di qualificazione non tornano.`);
    const pairs = pairSlots(slots);
    const matches: PlannedMatch[] = pairs.map(([a, b], i) => ({
      stage, match: i, a, b, bestOf: bestOfForStage(f, stage),
    }));
    rounds.push({ stage, matches });
    carried = matches.map((m) => ({ kind: "winner", stage, match: m.match }));
  }
  // Coerenza: dopo la finale resta 1 solo vincitore.
  if (carried.length !== 1) throw new Error("Le regole di qualificazione non portano a una sola finale.");
  // Gli stadi intermedi senza ingressi devono comunque avere esattamente metà dei giocatori del turno prima.
  return { rounds };
}

/** Forza di un posto: più basso = più forte. I vincitori di turni precedenti sono i più deboli. */
function strength(s: SlotSource): number {
  return s.kind === "group" ? s.position * 1000 + s.group : 1_000_000 + s.match;
}

/** Abbina i posti: il più forte contro il più debole, evitando (se possibile) due dello stesso girone. */
function pairSlots(slots: SlotSource[]): [SlotSource, SlotSource][] {
  const sorted = [...slots].sort((x, y) => strength(x) - strength(y));
  const n = sorted.length;
  const top = sorted.slice(0, n / 2);
  const bottom = sorted.slice(n / 2).reverse(); // il più debole affronta il più forte
  const clash = (a: SlotSource, b: SlotSource) =>
    a.kind === "group" && b.kind === "group" && a.group === b.group;
  // Risolve gli scontri tra stesso girone scambiando con un altro avversario.
  for (let i = 0; i < top.length; i++) {
    if (!clash(top[i], bottom[i])) continue;
    for (let j = 0; j < bottom.length; j++) {
      if (j === i) continue;
      if (!clash(top[i], bottom[j]) && !clash(top[j], bottom[i])) {
        [bottom[i], bottom[j]] = [bottom[j], bottom[i]];
        break;
      }
    }
  }
  return top.map((t, i) => [t, bottom[i]]);
}
