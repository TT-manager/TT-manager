import { describe, expect, it } from "vitest";
import { placementFactor, placementPoints, tournamentPlacements } from "./placement";
import type { MatchRow } from "./tournament";

const FULL = { 1: 100, 2: 50, 3: 25, 4: 20 } as const;

describe("premio di piazzamento", () => {
  it("quasi nullo nei tornei piccoli, pieno a 32, al massimo il doppio", () => {
    expect([4, 5, 8, 12, 16, 24, 32, 40, 48, 100].map((n) => placementPoints(FULL, 1, n)))
      .toEqual([0, 1, 5, 15, 28, 60, 100, 146, 200, 200]);
    expect(placementPoints(FULL, 2, 32)).toBe(50);
    expect(placementPoints(FULL, 4, 32)).toBe(20);
    expect(placementFactor(3)).toBe(0);
  });
  it("i semifinalisti sconfitti prendono la media tra 3° e 4°", () => {
    expect(placementPoints(FULL, 3, 32, true)).toBe(23); // (25 + 20) / 2 = 22,5
  });
});

const m = (o: Partial<MatchRow>): MatchRow => ({
  id: Math.random().toString(), phase: "knockout", group_no: null, stage: null, position: 0,
  player_a: null, player_b: null, sets_a: null, sets_b: null, set_scores: null, source_a: null, source_b: null, ...o,
});

describe("piazzamenti di un torneo", () => {
  it("con tabellone: finale e semifinali", () => {
    const matches = [
      m({ stage: 1, position: 0, player_a: "a", player_b: "b", sets_a: 3, sets_b: 1 }),
      m({ stage: 1, position: 1, player_a: "c", player_b: "d", sets_a: 0, sets_b: 3 }),
      m({ stage: 0, position: 0, player_a: "a", player_b: "d", sets_a: 2, sets_b: 3 }),
      m({ phase: "group", group_no: 1, player_a: "a", player_b: "e", sets_a: 3, sets_b: 0 }),
    ];
    expect(tournamentPlacements(matches, [])).toEqual([
      { entryId: "d", place: 1, shared3: false },
      { entryId: "a", place: 2, shared3: false },
      { entryId: "b", place: 3, shared3: true },
      { entryId: "c", place: 3, shared3: true },
    ]);
  });
  it("finale non giocata: nessun piazzamento", () => {
    expect(tournamentPlacements([m({ stage: 0, player_a: "a", player_b: "b" })], [])).toEqual([]);
  });
  it("girone unico: le prime posizioni della classifica", () => {
    const g = (a: string, b: string, sa: number, sb: number) =>
      m({ phase: "group", group_no: 1, player_a: a, player_b: b, sets_a: sa, sets_b: sb, set_scores: [] });
    const members = ["a", "b", "c"].map((playerId) => ({ playerId, group: 1 }));
    const r = tournamentPlacements([g("a", "b", 3, 0), g("a", "c", 3, 0), g("b", "c", 3, 1)], members);
    expect(r.map((x) => [x.entryId, x.place])).toEqual([["a", 1], ["b", 2], ["c", 3]]);
  });
});
