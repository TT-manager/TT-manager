import { describe, expect, it } from "vitest";
import { pointsSwing } from "./explain";
import { computeRanking, DEFAULT_RANKING, parseRankingSettings, startPoints, type RankingInput } from "./ranking";

const S = DEFAULT_RANKING;
const members = (ids: string[]) => ids.map((playerId) => ({ playerId, override: null, joinedOn: null }));

describe("classifica di partenza", () => {
  it("1000 + bonus dei podi sommati; la correzione manuale vince", () => {
    const sp = startPoints(S, [
      { playerId: "a", override: null }, { playerId: "b", override: null }, { playerId: "c", override: 1111 }, { playerId: "d", override: null },
    ], [
      { playerId: "a", position: 1 }, { playerId: "b", position: 2 }, { playerId: "a", position: 1 }, { playerId: "b", position: 3 }, { playerId: "c", position: 1 },
    ]);
    expect(Object.fromEntries(sp)).toEqual({ a: 1120, b: 1065, c: 1111, d: 1000 });
  });
});

describe("ricalcolo", () => {
  const base: RankingInput = { settings: S, members: members(["a", "b", "c"]), pastResults: [], absences: [], tournaments: [] };

  it("singolare: +20/-20 a pari punti, storico con riga di partenza", () => {
    const r = computeRanking({ ...base, tournaments: [{ id: "t1", date: "2026-01-10", participants: ["a", "b"], matches: [{ id: "m1", winners: ["a"], losers: ["b"] }] }] });
    const p = Object.fromEntries(r.players.map((x) => [x.id, x]));
    expect([p.a.rating, p.b.rating, p.a.games]).toEqual([1020, 980, 1]);
    expect(r.history.filter((h) => h.kind === "start")).toHaveLength(3);
  });

  it("calo per torneo saltato: 3% sopra la soglia, mai sotto la soglia, niente calo se giustificato", () => {
    const input: RankingInput = {
      ...base, settings: { ...S, decay: { enabled: true, pct: 3, floor: 1000 } },
      members: [{ playerId: "a", override: 1300, joinedOn: null }, { playerId: "b", override: null, joinedOn: null }, { playerId: "c", override: 1200, joinedOn: null }],
      absences: [{ playerId: "c", from: "2026-01-01", to: "2026-02-01" }],
      tournaments: [{ id: "t1", date: "2026-01-10", participants: [], matches: [] }],
    };
    const r = computeRanking(input);
    const p = Object.fromEntries(r.players.map((x) => [x.id, x.rating]));
    expect(p).toEqual({ a: 1291, b: 1000, c: 1200 });
    expect(r.history.filter((h) => h.kind === "decay")).toEqual([
      { playerId: "a", kind: "decay", tournamentId: "t1", matchId: null, challengeId: null, before: 1300, after: 1291 },
    ]);
  });

  it("chi entra nel campionato dopo un torneo non perde punti per quel torneo", () => {
    const r = computeRanking({ ...base, members: [{ playerId: "a", override: 1300, joinedOn: "2026-03-01" }],
      tournaments: [{ id: "t1", date: "2026-01-10", participants: [], matches: [] }] });
    expect(r.players[0].rating).toBe(1300);
  });

  it("rientro veloce: dopo 2 tornei saltati le prime partite valgono come da nuovo", () => {
    const exp = { ...S, newUntil: 0, midUntil: 0 }; // tutti «esperti» (K 16)
    const tournaments: RankingInput["tournaments"] = [
      { id: "t1", date: "2026-01-01", participants: ["b", "c"], matches: [] },
      { id: "t2", date: "2026-02-01", participants: ["b", "c"], matches: [] },
      { id: "t3", date: "2026-03-01", participants: ["a", "b"], matches: [{ id: "m", winners: ["a"], losers: ["b"] }] },
    ];
    const withCb = computeRanking({ ...base, settings: { ...exp, decay: { ...exp.decay, enabled: false } }, tournaments });
    const noCb = computeRanking({ ...base, settings: { ...exp, decay: { ...exp.decay, enabled: false }, comeback: { ...exp.comeback, enabled: false } }, tournaments });
    expect(withCb.players.find((p) => p.id === "a")!.rating).toBe(1020); // K 40
    expect(noCb.players.find((p) => p.id === "a")!.rating).toBe(1008);   // K 16
    expect(withCb.players.find((p) => p.id === "b")!.rating).toBe(992);  // b non rientra: K 16
  });

  it("doppio: media della coppia, stessi punti ai compagni con pari esperienza", () => {
    const r = computeRanking({
      ...base, members: [
        { playerId: "a", override: 1100, joinedOn: null }, { playerId: "b", override: 900, joinedOn: null },
        { playerId: "c", override: 1000, joinedOn: null }, { playerId: "d", override: 1000, joinedOn: null },
      ],
      tournaments: [{ id: "t", date: "2026-01-01", participants: ["a", "b", "c", "d"], matches: [{ id: "m", winners: ["a", "b"], losers: ["c", "d"] }] }],
    });
    const p = Object.fromEntries(r.players.map((x) => [x.id, x.rating]));
    expect([p.a - 1100, p.b - 900, p.c - 1000, p.d - 1000]).toEqual([20, 20, -20, -20]);
  });

  it("stesso input, stessa classifica (ricalcolo deterministico)", () => {
    const input: RankingInput = { ...base, tournaments: [{ id: "t1", date: "2026-01-10", participants: ["a", "b", "c"], matches: [
      { id: "m1", winners: ["a"], losers: ["b"] }, { id: "m2", winners: ["c"], losers: ["a"] }] }] };
    expect(computeRanking(input)).toEqual(computeRanking(input));
  });
});

describe("sfide singole", () => {
  const base: RankingInput = { settings: S, members: members(["a", "b"]), pastResults: [], absences: [], tournaments: [] };

  it("valgono la frazione scelta dei punti di una partita di torneo", () => {
    const full = computeRanking({ ...base, challenges: [{ id: "c1", date: "2026-01-05", winner: "a", loser: "b", weight: 1 }] });
    const half = computeRanking({ ...base, challenges: [{ id: "c1", date: "2026-01-05", winner: "a", loser: "b", weight: 0.5 }] });
    const quarter = computeRanking({ ...base, challenges: [{ id: "c1", date: "2026-01-05", winner: "a", loser: "b", weight: 0.25 }] });
    expect(full.players.map((p) => p.rating)).toEqual([1020, 980]);
    expect(half.players.map((p) => p.rating)).toEqual([1010, 990]);
    expect(quarter.players.map((p) => p.rating)).toEqual([1005, 995]);
    expect(half.history.filter((h) => h.challengeId === "c1").map((h) => [h.playerId, h.kind, h.before, h.after]))
      .toEqual([["a", "match", 1000, 1010], ["b", "match", 1000, 990]]);
    expect(half.players[0].games).toBe(1);
  });

  it("si inseriscono in ordine di data con i tornei (stesso giorno: dopo il torneo)", () => {
    const r = computeRanking({ ...base,
      tournaments: [{ id: "t", date: "2026-02-01", participants: ["a", "b"], matches: [{ id: "m", winners: ["b"], losers: ["a"] }] }],
      challenges: [
        { id: "late", date: "2026-02-01", winner: "a", loser: "b", weight: 1 },
        { id: "early", date: "2026-01-20", winner: "a", loser: "b", weight: 1 },
      ] });
    const order = r.history.filter((h) => h.kind === "match" && h.playerId === "a").map((h) => h.challengeId ?? h.matchId);
    expect(order).toEqual(["early", "m", "late"]);
  });

  it("non contano come presenza: chi salta il torneo perde comunque punti", () => {
    const r = computeRanking({ ...base, members: [{ playerId: "a", override: 1300, joinedOn: null }, { playerId: "b", override: 1300, joinedOn: null }],
      tournaments: [{ id: "t", date: "2026-02-01", participants: [], matches: [] }],
      challenges: [{ id: "c", date: "2026-01-20", winner: "a", loser: "b", weight: 0.5 }] });
    expect(r.history.filter((h) => h.kind === "decay")).toHaveLength(2);
  });

  it("ignora le sfide di chi non è più nella lega", () => {
    const r = computeRanking({ ...base, challenges: [{ id: "c", date: "2026-01-20", winner: "a", loser: "z", weight: 1 }] });
    expect(r.players.map((p) => p.rating)).toEqual([1000, 1000]);
  });
});

describe("impostazioni", () => {
  it("sfide: spente di base, metà punti, una a settimana; valori controllati", () => {
    const d = parseRankingSettings({});
    expect("settings" in d && d.settings.challenges).toEqual({ enabled: false, weight: 0.5, perWeek: 1 });
    const ok = parseRankingSettings({ challenges: { enabled: true, weight: 0.25, perWeek: 0 } });
    expect("settings" in ok && ok.settings.challenges).toEqual({ enabled: true, weight: 0.25, perWeek: 0 });
    expect(parseRankingSettings({ challenges: { weight: 0.3 } })).toHaveProperty("errors");
    expect(parseRankingSettings({ challenges: { perWeek: 9 } })).toHaveProperty("errors");
  });

  it("completa con i default e rifiuta valori impossibili", () => {
    const ok = parseRankingSettings({ label: "Punti", decay: { pct: 5 } });
    expect("settings" in ok && [ok.settings.decay.pct, ok.settings.initial, ok.settings.podium[1]]).toEqual([5, 1000, 60]);
    expect(parseRankingSettings({ initial: -3 })).toHaveProperty("errors");
    expect(parseRankingSettings({ newUntil: 50, midUntil: 10 })).toHaveProperty("errors");
    expect(parseRankingSettings({ decay: { pct: "x" } })).toHaveProperty("errors");
  });
});

describe("esempi della spiegazione dei punti", () => {
  it("contro un avversario pari si vince o si perde metà della velocità", () => {
    expect(pointsSwing(16, 0)).toEqual({ win: 8, loss: -8 });
  });
  it("battere uno più forte rende di più, perderci costa poco", () => {
    expect(pointsSwing(16, 200)).toEqual({ win: 12, loss: -4 });
    expect(pointsSwing(16, -200)).toEqual({ win: 4, loss: -12 });
  });
  it("coincide con il ricalcolo vero", () => {
    const r = computeRanking({
      settings: DEFAULT_RANKING,
      members: [{ playerId: "a", override: 1000, joinedOn: null }, { playerId: "b", override: 1100, joinedOn: null }],
      pastResults: [], absences: [],
      tournaments: [{ id: "t", date: "2026-01-01", participants: ["a", "b"], matches: [{ id: "m", winners: ["a"], losers: ["b"] }] }],
    });
    const a = r.players.find((p) => p.id === "a")!, b = r.players.find((p) => p.id === "b")!;
    expect(a.rating - 1000).toBe(pointsSwing(DEFAULT_RANKING.k.new, 100).win);
    expect(b.rating - 1100).toBe(pointsSwing(DEFAULT_RANKING.k.new, -100).loss);
  });
});
