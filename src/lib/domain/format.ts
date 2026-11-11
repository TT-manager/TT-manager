import { DEFAULT_SET_RULES, type SetRules } from "./score";

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
  /**
   * Ripescaggio: se indicato, passano solo i migliori `best` tra i classificati
   * nella posizione indicata (una sola) di tutti i gironi, es. «le 3 migliori seconde».
   */
  best?: number;
}

/** Criteri per confrontare giocatori di gironi diversi (medie per partita: gironi di dimensioni diverse). */
export type CrossCriterion = "winPct" | "setDiffAvg" | "pointDiffAvg" | "setRatio" | "pointRatio";
export const CROSS_CRITERIA: Record<CrossCriterion, string> = {
  winPct: "Percentuale di vittorie",
  setDiffAvg: "Differenza set media",
  pointDiffAvg: "Differenza punti media",
  setRatio: "Quoziente set (vinti/persi)",
  pointRatio: "Quoziente punti (fatti/subiti)",
};
export const DEFAULT_CROSS_CRITERIA: CrossCriterion[] = ["winPct", "setDiffAvg", "pointDiffAvg"];

export interface TournamentFormat {
  groupCount: number;
  groupBestOf: BestOf;
  /** 1 = sola andata, 2 = andata e ritorno (default 1). */
  groupLegs?: 1 | 2;
  /** Punti del set e golden point nei gironi (default 11, senza golden point). */
  groupSet?: SetRules;
  qualification: QualificationRule[];
  /** Set per stadio. Gli stadi non indicati usano `defaultKnockoutBestOf`. */
  knockoutBestOf: Record<number, BestOf>;
  defaultKnockoutBestOf: BestOf;
  /** Punti del set e golden point per stadio (default 11, senza golden point). */
  knockoutSet?: Record<number, SetRules>;
  /** Ordine dei criteri per i ripescaggi (default: % vittorie, differenza set, differenza punti). */
  crossCriteria?: CrossCriterion[];
}

export const groupSetRules = (f: TournamentFormat): SetRules => f.groupSet ?? DEFAULT_SET_RULES;
export const stageSetRules = (f: TournamentFormat, stage: number): SetRules => f.knockoutSet?.[stage] ?? DEFAULT_SET_RULES;

/** Errore delle regole del set, o null. */
export function setRulesError(r: SetRules): string | null {
  if (!Number.isInteger(r.points) || r.points < 3 || r.points > 50) return "I punti del set devono essere tra 3 e 50.";
  if (r.golden !== null && (!Number.isInteger(r.golden) || r.golden < r.points - 1 || r.golden > 60))
    return `Il golden point deve essere almeno sul ${r.points - 1} pari.`;
  return null;
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
  | { kind: "winner"; stage: number; match: number }
  /** Ripescaggio: il `rank`-esimo migliore tra i classificati in `position`, con i criteri indicati. */
  | { kind: "best"; position: number; rank: number; criteria: CrossCriterion[] };

export interface PlannedMatch {
  stage: number;
  /** Indice nel turno, da 0. */
  match: number;
  a: SlotSource;
  b: SlotSource;
  bestOf: BestOf;
  set: SetRules;
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
  if (f.groupLegs !== undefined && f.groupLegs !== 1 && f.groupLegs !== 2) errors.push("Gironi: solo andata oppure andata e ritorno.");
  const gs = setRulesError(groupSetRules(f));
  if (gs) errors.push(`Gironi: ${gs}`);
  for (const [st, r] of Object.entries(f.knockoutSet ?? {})) {
    const e = setRulesError(r);
    if (e) errors.push(`${stageName(Number(st))}: ${e}`);
  }

  const seen = new Set<number>();
  for (const c of f.crossCriteria ?? []) if (!(c in CROSS_CRITERIA)) errors.push("Criterio di ripescaggio non valido.");
  for (const r of f.qualification) {
    if (!Number.isInteger(r.stage) || r.stage < 0 || r.stage > 6) errors.push("Turno di ingresso non valido.");
    if (r.positions.length === 0) errors.push("Una regola di qualificazione non ha posizioni.");
    if (r.best !== undefined) {
      if (r.positions.length !== 1) errors.push("Un ripescaggio riguarda una sola posizione (es. «2»).");
      if (!Number.isInteger(r.best) || r.best < 1 || r.best > f.groupCount)
        errors.push(`Ripescaggio: i migliori devono essere tra 1 e ${f.groupCount} (uno per girone al massimo).`);
      if (playersPerGroup && r.positions[0] && playersPerGroup.filter((n) => n >= r.positions[0]).length < (r.best ?? 0))
        errors.push(`Non ci sono abbastanza gironi con un ${r.positions[0]}° classificato per ripescarne ${r.best}.`);
    }
    for (const p of r.positions) {
      if (!Number.isInteger(p) || p < 1) errors.push(`Posizione di girone non valida: ${p}.`);
      if (seen.has(p)) errors.push(`La posizione ${p} compare in più regole.`);
      seen.add(p);
      if (r.best === undefined && playersPerGroup && playersPerGroup.some((n) => n < p))
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
    if (rule.best !== undefined) {
      const criteria = f.crossCriteria?.length ? f.crossCriteria : DEFAULT_CROSS_CRITERIA;
      for (let rank = 1; rank <= rule.best; rank++) list.push({ kind: "best", position: rule.positions[0], rank, criteria });
    } else {
      for (const position of rule.positions)
        for (let g = 1; g <= f.groupCount; g++) list.push({ kind: "group", group: g, position });
    }
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
  const planned = new Map<string, PlannedMatch>();
  /** Gironi da cui può provenire chi occupa questo posto. */
  const groupsOf = (s: SlotSource): Set<number> => {
    if (s.kind === "group") return new Set([s.group]);
    if (s.kind === "best") return new Set(); // girone noto solo a fine gironi

    const m = planned.get(`${s.stage}:${s.match}`);
    return m ? new Set([...groupsOf(m.a), ...groupsOf(m.b)]) : new Set();
  };

  for (let stage = first; stage >= 0; stage--) {
    const entrants = byStage.get(stage) ?? [];
    const slots = [...entrants, ...carried];
    if (slots.length < 2) throw new Error(`Al turno "${stageName(stage)}" ci sono meno di 2 giocatori.`);
    if (slots.length % 2 !== 0)
      throw new Error(`Al turno "${stageName(stage)}" i giocatori sono ${slots.length} (dispari): modifica le regole di qualificazione.`);
    if (stage === 0 && slots.length !== 2)
      throw new Error(`La finale ha ${slots.length} giocatori invece di 2: le regole di qualificazione non tornano.`);
    const pairs = pairSlots(slots, groupsOf);
    const matches: PlannedMatch[] = pairs.map(([a, b], i) => ({
      stage, match: i, a, b, bestOf: bestOfForStage(f, stage), set: stageSetRules(f, stage),
    }));
    for (const m of matches) planned.set(`${stage}:${m.match}`, m);
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
  if (s.kind === "group") return s.position * 1000 + s.group;
  if (s.kind === "best") return s.position * 1000 + 500 + s.rank; // dopo i pari posizione «diretti»
  return 1_000_000 + s.match;
}

/**
 * Abbina i posti: il più forte contro il più debole, poi scambia gli avversari
 * per ridurre al minimo i possibili incontri tra compagni dello stesso girone
 * (considerando anche da quali gironi può arrivare il vincente di una partita).
 */
function pairSlots(slots: SlotSource[], groupsOf: (s: SlotSource) => Set<number>): [SlotSource, SlotSource][] {
  const sorted = [...slots].sort((x, y) => strength(x) - strength(y));
  const n = sorted.length;
  const top = sorted.slice(0, n / 2);
  const bottom = sorted.slice(n / 2).reverse(); // il più debole affronta il più forte
  const cost = (a: SlotSource, b: SlotSource) => {
    const ga = groupsOf(a);
    let c = 0;
    for (const g of groupsOf(b)) if (ga.has(g)) c++;
    return c;
  };
  // Scambi a coppie finché migliorano (pochi posti: costo trascurabile).
  for (let improved = true, guard = 0; improved && guard < 100; guard++) {
    improved = false;
    for (let i = 0; i < top.length; i++) {
      for (let j = i + 1; j < top.length; j++) {
        const before = cost(top[i], bottom[i]) + cost(top[j], bottom[j]);
        const after = cost(top[i], bottom[j]) + cost(top[j], bottom[i]);
        if (after < before) {
          [bottom[i], bottom[j]] = [bottom[j], bottom[i]];
          improved = true;
        }
      }
    }
  }
  return top.map((t, i) => [t, bottom[i]]);
}

/**
 * Legge un formato da dati non fidati (modulo, JSON dal database).
 * Restituisce il formato pulito oppure gli errori.
 */
export function parseFormat(raw: unknown): { format: TournamentFormat } | { errors: string[] } {
  const bad = { errors: ["Formato del torneo non valido."] };
  if (typeof raw !== "object" || raw === null) return bad;
  const o = raw as Record<string, unknown>;
  const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) ? v : NaN);
  if (!Array.isArray(o.qualification)) return bad;
  const kb = (typeof o.knockoutBestOf === "object" && o.knockoutBestOf) || {};
  const rules = (v: unknown): SetRules | undefined => {
    if (v === undefined || v === null) return undefined;
    const r = (typeof v === "object" ? v : {}) as Record<string, unknown>;
    return { points: int(r.points), golden: r.golden === null || r.golden === undefined ? null : int(r.golden) };
  };
  const ks = (typeof o.knockoutSet === "object" && o.knockoutSet) || {};
  const format: TournamentFormat = {
    groupCount: int(o.groupCount),
    groupBestOf: int(o.groupBestOf) as BestOf,
    groupLegs: o.groupLegs === undefined ? 1 : (int(o.groupLegs) as 1 | 2),
    groupSet: rules(o.groupSet),
    knockoutSet: Object.fromEntries(Object.entries(ks as Record<string, unknown>).map(([k, v]) => [Number(k), rules(v)!])),
    defaultKnockoutBestOf: int(o.defaultKnockoutBestOf) as BestOf,
    ...(Array.isArray(o.crossCriteria) ? { crossCriteria: o.crossCriteria.map(String) as CrossCriterion[] } : {}),
    knockoutBestOf: Object.fromEntries(
      Object.entries(kb as Record<string, unknown>).map(([k, v]) => [Number(k), int(v) as BestOf])),
    qualification: (o.qualification as unknown[]).map((r) => {
      const rr = (r ?? {}) as Record<string, unknown>;
      return {
        stage: int(rr.stage),
        positions: Array.isArray(rr.positions) ? rr.positions.map(int) : [],
        ...(rr.best === undefined || rr.best === null ? {} : { best: int(rr.best) }),
      };
    }),
  };
  if (format.groupCount > 64) return { errors: ["Troppi gironi (massimo 64)."] };
  if ([...Object.keys(format.knockoutBestOf), ...Object.keys(format.knockoutSet ?? {})]
    .some((k) => !Number.isInteger(Number(k)) || Number(k) < 0 || Number(k) > 6))
    return bad;
  const errors = validateFormat(format);
  return errors.length ? { errors } : { format };
}

const ordinal = (n: number) => `${n}°`;
const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`);
const sets = (b: number) => (b === 1 ? "a set unico" : `al meglio dei ${b} set`);
/** "set a 11" / "set a 11, golden point sul 15 pari" */
export const describeSetRules = (r: SetRules) =>
  `set a ${r.points}${r.golden !== null ? `, golden point sul ${r.golden} pari` : ""}`;

/** Descrizione in italiano del formato, una riga per punto. */
export function describeFormat(f: TournamentFormat): string[] {
  const legs = f.groupLegs === 2 ? " con andata e ritorno" : "";
  const lines = [`${f.groupCount} ${f.groupCount === 1 ? "girone" : "gironi"} all'italiana${legs}, partite ${sets(f.groupBestOf)} (${describeSetRules(groupSetRules(f))}).`];
  for (const r of [...f.qualification].sort((a, b) => b.stage - a.stage)) {
    if (r.best !== undefined) {
      lines.push(`${r.best === 1 ? "Il miglior" : `I migliori ${r.best}`} tra i ${ordinal(r.positions[0])} classificati → ${stageName(r.stage).toLowerCase()} (ripescaggio).`);
      continue;
    }
    const pos = list([...r.positions].sort((a, b) => a - b).map(ordinal));
    lines.push(`${pos} di ogni girone → ${stageName(r.stage).toLowerCase()}.`);
  }
  if (f.qualification.some((r) => r.best !== undefined)) {
    const c = (f.crossCriteria?.length ? f.crossCriteria : DEFAULT_CROSS_CRITERIA).map((k) => CROSS_CRITERIA[k].toLowerCase());
    lines.push(`Ripescaggi decisi da: ${c.join(", ")}; a parità, la testa di serie.`);
  }
  for (const round of planBracket(f).rounds)
    lines.push(`${stageName(round.stage)}: ${round.matches.length} ${round.matches.length === 1 ? "partita" : "partite"} ${sets(round.matches[0].bestOf)} (${describeSetRules(round.matches[0].set)}).`);
  return lines;
}
