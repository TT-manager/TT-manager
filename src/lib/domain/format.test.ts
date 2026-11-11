import { describe, expect, it } from "vitest";
import { planBracket, validateFormat, type TournamentFormat } from "./format";

const base: TournamentFormat = {
  groupCount: 4,
  groupBestOf: 1,
  qualification: [
    { positions: [1], stage: 2 },
    { positions: [2, 3], stage: 3 },
  ],
  knockoutBestOf: { 0: 5, 1: 5 },
  defaultKnockoutBestOf: 3,
};

describe("formato torneo", () => {
  it("24 giocatori: primi ai quarti, 2° e 3° agli ottavi", () => {
    expect(validateFormat(base, [6, 6, 6, 6])).toEqual([]);
    const plan = planBracket(base);
    expect(plan.rounds.map((r) => [r.stage, r.matches.length])).toEqual([[3, 4], [2, 4], [1, 2], [0, 1]]);
    // Agli ottavi nessuno incontra un compagno di girone e si affrontano 2° e 3°.
    for (const m of plan.rounds[0].matches) {
      if (m.a.kind !== "group" || m.b.kind !== "group") throw new Error("atteso girone");
      expect(m.a.group).not.toBe(m.b.group);
      expect([m.a.position, m.b.position].sort()).toEqual([2, 3]);
    }
    // Ai quarti ogni vincitore di girone affronta un vincitore degli ottavi.
    for (const m of plan.rounds[1].matches) {
      const kinds = [m.a.kind, m.b.kind].sort();
      expect(kinds).toEqual(["group", "winner"]);
    }
  });

  it("set diversi per fase: 1 set nei gironi, 3 nei quarti, 5 in semifinale e finale", () => {
    const plan = planBracket(base);
    const bo = Object.fromEntries(plan.rounds.map((r) => [r.stage, r.matches[0].bestOf]));
    expect(bo).toEqual({ 3: 3, 2: 3, 1: 5, 0: 5 });
  });

  it("semplice: 2 gironi, primi 2 in semifinale", () => {
    const f: TournamentFormat = { ...base, groupCount: 2, qualification: [{ positions: [1, 2], stage: 1 }] };
    expect(validateFormat(f)).toEqual([]);
    const plan = planBracket(f);
    expect(plan.rounds.map((r) => r.matches.length)).toEqual([2, 1]);
    // 1° A contro 2° B e 1° B contro 2° A.
    const semis = plan.rounds[0].matches.map((m) => JSON.stringify([m.a, m.b]));
    expect(semis.join()).toContain('"group":1,"position":1');
    for (const m of plan.rounds[0].matches) {
      if (m.a.kind === "group" && m.b.kind === "group") expect(m.a.group).not.toBe(m.b.group);
    }
  });

  it("segnala numeri incoerenti in italiano", () => {
    const dispari = validateFormat({ ...base, groupCount: 3, qualification: [{ positions: [1, 2, 3], stage: 3 }] });
    expect(dispari.join(" ")).toMatch(/dispari|finale/);
    expect(validateFormat({ ...base, qualification: [] })).not.toEqual([]);
    expect(validateFormat({ ...base, groupBestOf: 2 as never })).not.toEqual([]);
    expect(validateFormat({ ...base, qualification: [{ positions: [1], stage: 2 }, { positions: [1], stage: 3 }] }).join(" "))
      .toMatch(/più regole/);
    expect(validateFormat(base, [6, 6, 6, 2]).join(" ")).toMatch(/meno di 3/);
  });
});

import { describeFormat, parseFormat } from "./format";

describe("lettura e descrizione del formato", () => {
  it("accetta un formato valido arrivato come JSON", () => {
    const r = parseFormat(JSON.parse(JSON.stringify(base)));
    expect("format" in r && r.format.knockoutBestOf[0]).toBe(5);
  });
  it("rifiuta dati malformati senza eccezioni", () => {
    for (const raw of [null, 42, "x", {}, { ...base, qualification: "no" }, { ...base, groupCount: 1e9 },
      { ...base, knockoutBestOf: { "-1": 3 } }, { ...base, qualification: [{ stage: 2, positions: ["a"] }] }]) {
      expect("errors" in parseFormat(raw)).toBe(true);
    }
  });
  it("descrive il caso a 24 giocatori in italiano", () => {
    const d = describeFormat(base);
    expect(d[0]).toBe("4 gironi all'italiana, partite a set unico (set a 11).");
    expect(d).toContain("2° e 3° di ogni girone → ottavi di finale.");
    expect(d).toContain("1° di ogni girone → quarti di finale.");
    expect(d).toContain("Ottavi di finale: 4 partite al meglio dei 3 set (set a 11).");
    expect(d).toContain("Finale: 1 partita al meglio dei 5 set (set a 11).");
  });
});

describe("niente rivincite tra compagni di girone", () => {
  it("24 giocatori: ai quarti il 1° di un girone non può ritrovare un compagno", () => {
    const plan = planBracket(base);
    const ottavi = plan.rounds[0].matches;
    const groupsFrom = (s: import("./format").SlotSource): number[] =>
      s.kind === "group" ? [s.group] : [ottavi[s.match].a, ottavi[s.match].b].flatMap(groupsFrom);
    for (const q of plan.rounds[1].matches) {
      const a = groupsFrom(q.a), b = groupsFrom(q.b);
      expect(a.filter((g) => b.includes(g))).toEqual([]);
    }
  });
  it("2 gironi, primi 2 in semifinale: incrocio 1°A-2°B e 1°B-2°A", () => {
    const plan = planBracket({ ...base, groupCount: 2, qualification: [{ positions: [1, 2], stage: 1 }] });
    for (const m of plan.rounds[0].matches)
      if (m.a.kind === "group" && m.b.kind === "group") expect(m.a.group).not.toBe(m.b.group);
  });
});

describe("andata e ritorno, punti e golden point", () => {
  it("descrive e valida le nuove opzioni", () => {
    const f = { ...base, groupLegs: 2 as const, groupSet: { points: 11, golden: 15 }, knockoutSet: { 0: { points: 21, golden: null } } };
    expect(validateFormat(f)).toEqual([]);
    const d = describeFormat(f);
    expect(d[0]).toBe("4 gironi all'italiana con andata e ritorno, partite a set unico (set a 11, golden point sul 15 pari).");
    expect(d).toContain("Finale: 1 partita al meglio dei 5 set (set a 21).");
    expect(planBracket(f).rounds.at(-1)!.matches[0].set).toEqual({ points: 21, golden: null });
  });
  it("rifiuta regole del set impossibili e passa per parseFormat", () => {
    expect(validateFormat({ ...base, groupSet: { points: 11, golden: 8 } }).join(" ")).toMatch(/golden point/);
    expect(validateFormat({ ...base, groupSet: { points: 1, golden: null } }).join(" ")).toMatch(/tra 3 e 50/);
    expect(validateFormat({ ...base, groupLegs: 3 as never }).join(" ")).toMatch(/andata/);
    const r = parseFormat(JSON.parse(JSON.stringify({ ...base, groupLegs: 2, groupSet: { points: 11, golden: 15 } })));
    expect("format" in r && r.format.groupSet).toEqual({ points: 11, golden: 15 });
    // Formati salvati prima di queste opzioni restano validi (sola andata, set a 11).
    const old = parseFormat(JSON.parse(JSON.stringify(base)));
    expect("format" in old && old.format.groupLegs).toBe(1);
  });
});
