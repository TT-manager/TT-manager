import { describe, expect, it } from "vitest";
import { applyMatch, expectedScore } from "./scambio-punti";
import { computeStandings, roundRobinSchedule, snakeGroups } from "./groups";
import { advance, firstRound, seedOrder, totalRounds } from "./bracket";

describe("scambio di punti", () => {
  it("a parità di rating l'attesa è 0.5", () => {
    expect(expectedScore(1000, 1000)).toBeCloseTo(0.5);
  });
  it("il favorito che vince guadagna poco, l'underdog molto", () => {
    const fav = applyMatch({ rating: 1200, gamesPlayed: 30 }, { rating: 1000, gamesPlayed: 30 });
    const upset = applyMatch({ rating: 1000, gamesPlayed: 30 }, { rating: 1200, gamesPlayed: 30 });
    expect(upset.delta.winner).toBeGreaterThan(fav.delta.winner);
    expect(fav.winner).toBeGreaterThan(1200);
    expect(fav.loser).toBeLessThan(1000);
  });
});

describe("gironi", () => {
  it("serpentina distribuisce le teste di serie", () => {
    expect(snakeGroups([1, 2, 3, 4, 5, 6, 7, 8], 2)).toEqual([
      [1, 4, 5, 8],
      [2, 3, 6, 7],
    ]);
  });
  it("calendario: ognuno incontra tutti una volta", () => {
    for (const n of [3, 4, 5, 6]) {
      const players = Array.from({ length: n }, (_, i) => `p${i}`);
      const matches = roundRobinSchedule(players).flat();
      expect(matches).toHaveLength((n * (n - 1)) / 2);
      const keys = new Set(matches.map(([a, b]) => [a, b].sort().join("-")));
      expect(keys.size).toBe(matches.length);
    }
  });
  it("classifica con scontro diretto tra due pari", () => {
    const s = computeStandings(
      ["a", "b", "c"],
      [
        { playerA: "a", playerB: "b", setsA: 3, setsB: 0 },
        { playerA: "b", playerB: "c", setsA: 3, setsB: 0 },
        { playerA: "c", playerB: "a", setsA: 3, setsB: 2 },
      ],
    );
    // tutti 1 vittoria e 1 sconfitta: decide la differenza set (a +2, b 0, c -2)
    expect(s.map((r) => r.playerId)).toEqual(["a", "b", "c"]);
    expect(s[0].tablePoints).toBe(3);
  });
});

describe("tabellone", () => {
  it("ordine teste di serie per 8", () => {
    expect(seedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
  it("6 giocatori: le prime due teste di serie hanno il bye", () => {
    const m = firstRound(["s1", "s2", "s3", "s4", "s5", "s6"]);
    expect(m).toHaveLength(4);
    const byes = m.filter((x) => x.bye).map((x) => x.a ?? x.b);
    expect(byes.sort()).toEqual(["s1", "s2"]);
    expect(totalRounds(6)).toBe(3);
  });
  it("avanzamento dei vincitori", () => {
    expect(advance(["a", "b", "c", "d"], 2).map((x) => [x.a, x.b])).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

import { rateMatches } from "./scambio-punti";

describe("punti di un torneo", () => {
  const start = new Map([["a", { rating: 1000, gamesPlayed: 0 }], ["b", { rating: 1000, gamesPlayed: 0 }], ["c", { rating: 1200, gamesPlayed: 100 }]]);
  it("applica le partite in sequenza e conta le partite giocate", () => {
    const r = rateMatches([{ id: "m1", winner: "a", loser: "b" }, { id: "m2", winner: "a", loser: "c" }], start);
    expect(r.history).toHaveLength(4);
    const a = r.players.find((p) => p.id === "a")!;
    expect(a.gamesAfter).toBe(2);
    expect(a.ratingAfter).toBe(r.history.at(-2)!.after);
    // La seconda partita parte dal rating aggiornato dalla prima.
    expect(r.history[2].before).toBe(r.history[0].after);
    expect(start.get("a")!.rating).toBe(1000); // l'ingresso non viene modificato
  });
  it("ignora chi non ha giocato e rifiuta giocatori sconosciuti", () => {
    expect(rateMatches([{ id: "m1", winner: "a", loser: "b" }], start).players.map((p) => p.id).sort()).toEqual(["a", "b"]);
    expect(() => rateMatches([{ id: "m1", winner: "a", loser: "x" }], start)).toThrow();
  });
});

describe("scontro diretto con andata e ritorno", () => {
  it("somma le due partite: una vittoria a testa, decide la differenza set", () => {
    // a e b a pari punti; a vince 3-0, b vince 3-2: a è avanti negli scontri diretti.
    const s = computeStandings(["a", "b"], [
      { playerA: "a", playerB: "b", setsA: 3, setsB: 0 },
      { playerA: "b", playerB: "a", setsA: 3, setsB: 2 },
    ]);
    expect(s.map((x) => x.playerId)).toEqual(["a", "b"]);
  });
});
