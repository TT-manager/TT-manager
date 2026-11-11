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
