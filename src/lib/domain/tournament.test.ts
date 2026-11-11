import { describe, expect, it } from "vitest";
import type { TournamentFormat } from "./format";
import { buildTournament, groupViews, resolveKnockout, sourceLabel, type MatchRow } from "./tournament";

const fmt: TournamentFormat = {
  groupCount: 2, groupBestOf: 3, defaultKnockoutBestOf: 5, knockoutBestOf: {},
  qualification: [{ positions: [1, 2], stage: 1 }],
};
const players = Array.from({ length: 8 }, (_, i) => ({ id: `p${i + 1}`, rating: 2000 - i * 10 }));

/** Simula il database: converte il piano in righe. */
function rows(plan: ReturnType<typeof buildTournament>): MatchRow[] {
  return [
    ...plan.matches.map((m, i): MatchRow => ({
      id: `g${i}`, phase: "group", group_no: m.group, stage: null, position: i, player_a: m.a, player_b: m.b,
      sets_a: null, sets_b: null, set_scores: null, source_a: null, source_b: null,
    })),
    ...plan.knockout.map((k): MatchRow => ({
      id: `k${k.stage}-${k.position}`, phase: "knockout", group_no: null, stage: k.stage, position: k.position,
      player_a: null, player_b: null, sets_a: null, sets_b: null, set_scores: null, source_a: k.a, source_b: k.b,
    })),
  ];
}

describe("torneo completo", () => {
  it("compone gironi a serpentina e calendario completo", () => {
    const plan = buildTournament(players, fmt);
    expect(plan.assignments.filter((a) => a.group === 1).map((a) => a.playerId)).toEqual(["p1", "p4", "p5", "p8"]);
    expect(plan.matches).toHaveLength(2 * 6); // 2 gironi da 4: 6 partite ciascuno
    expect(plan.matches.every((m) => m.bestOf === 3)).toBe(true);
    expect(plan.knockout.map((k) => [k.stage, k.position])).toEqual([[1, 0], [1, 1], [0, 0]]);
  });

  it("rifiuta numeri impossibili con messaggi chiari", () => {
    expect(() => buildTournament(players.slice(0, 3), fmt)).toThrow(/almeno 4 iscritti/);
    expect(() => buildTournament(players.slice(0, 4), { ...fmt, qualification: [{ positions: [1, 2, 3], stage: 2 }] }))
      .toThrow(/meno di 3 giocatori|dispari|finale/);
  });

  it("il tabellone si riempie solo a gironi conclusi, poi con i vincenti", () => {
    const plan = buildTournament(players, fmt);
    let db = rows(plan);
    const members = plan.assignments.map((a) => ({ playerId: a.playerId, group: a.group }));
    // Nessun risultato: tabellone vuoto, etichette leggibili.
    expect(resolveKnockout(groupViews(members, db), db.filter((m) => m.phase === "knockout"))
      .every((k) => k.player_a === null && k.player_b === null)).toBe(true);
    expect(sourceLabel({ kind: "group", group: 1, position: 1 })).toBe("1° girone A");
    expect(sourceLabel({ kind: "winner", stage: 1, match: 0 })).toBe("Vincente semifinali 1");

    // Nei gironi vince sempre il giocatore con l'id più basso (p1 > p2 > ...).
    const num = (id: string | null) => Number(id!.slice(1));
    db = db.map((m) => m.phase === "group"
      ? { ...m, sets_a: num(m.player_a) < num(m.player_b) ? 2 : 0, sets_b: num(m.player_a) < num(m.player_b) ? 0 : 2 }
      : m);
    const groups = groupViews(members, db);
    expect(groups.every((g) => g.complete)).toBe(true);
    expect(groups[0].standings.map((s) => s.playerId)).toEqual(["p1", "p4", "p5", "p8"]);
    const ko = db.filter((m) => m.phase === "knockout");
    const r = resolveKnockout(groups, ko);
    const semis = r.slice(0, 2).map((k) => [k.player_a, k.player_b].sort());
    // Semifinali incrociate: 1° A contro 2° B, 1° B contro 2° A.
    expect(semis).toEqual(expect.arrayContaining([["p1", "p3"].sort(), ["p2", "p4"].sort()]));
    expect(r[2]).toMatchObject({ player_a: null, player_b: null }); // finale ancora da definire
  });
});
