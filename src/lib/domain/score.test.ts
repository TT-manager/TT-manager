import { describe, expect, it } from "vitest";
import { setError, validateMatch } from "./score";

describe("punteggi dei set", () => {
  it.each([[[11, 9]], [[11, 0]], [[12, 10]], [[15, 13]], [[9, 11]]])("valido %j", (s) => {
    expect(setError(s as [number, number])).toBeNull();
  });
  it.each([[[10, 8]], [[11, 10]], [[13, 10]], [[12, 9]], [[-1, 11]], [[11.5, 3]]])("non valido %j", (s) => {
    expect(setError(s as [number, number])).not.toBeNull();
  });
});

describe("partita", () => {
  it("al meglio dei 5: 3-1", () => {
    const r = validateMatch([[11, 7], [9, 11], [11, 5], [12, 10]], 5);
    expect("result" in r && [r.result.setsA, r.result.setsB]).toEqual([3, 1]);
  });
  it("set unico", () => {
    const r = validateMatch([[8, 11]], 1);
    expect("result" in r && [r.result.setsA, r.result.setsB]).toEqual([0, 1]);
  });
  it("rifiuta partite non finite, set in più e troppi set", () => {
    expect(validateMatch([[11, 7], [9, 11]], 3)).toHaveProperty("error");
    expect(validateMatch([[11, 7], [11, 9], [11, 2]], 3)).toHaveProperty("error");
    expect(validateMatch([[11, 7], [11, 9], [5, 11], [11, 2]], 3)).toHaveProperty("error");
    expect(validateMatch([], 3)).toHaveProperty("error");
    expect(validateMatch([[11, 10]], 1)).toMatchObject({ error: expect.stringMatching(/Set 1/) });
  });
});

describe("set da evidenziare", () => {
  it("indica il set sbagliato o di troppo", () => {
    expect(validateMatch([[11, 7], [11, 10]], 3)).toMatchObject({ set: 2 });
    expect(validateMatch([[11, 7], [11, 9], [11, 2]], 3)).toMatchObject({ set: 3 });
    expect(validateMatch([[11, 7], [9, 11]], 3)).not.toHaveProperty("set");
  });
});

import { setsFromForm } from "./score";

describe("lettura dei set dal modulo", () => {
  const form = (rows: [string, string][]) => {
    const f = new FormData();
    rows.forEach(([a, b], i) => { f.set(`a${i + 1}`, a); f.set(`b${i + 1}`, b); });
    return f;
  };
  it("ignora le righe vuote finali", () => {
    expect(setsFromForm(form([["11", "7"], ["11", "9"], ["", ""]]))).toEqual([[11, 7], [11, 9]]);
  });
  it("segnala un set vuoto in mezzo e un punteggio mancante", () => {
    expect(setsFromForm(form([["11", "7"], ["", ""], ["11", "5"]]))).toMatchObject({ set: 2 });
    expect(setsFromForm(form([["11", ""]]))).toMatchObject({ set: 1 });
  });
});

describe("punti per set e golden point", () => {
  const g = { points: 11, golden: 15 };
  it.each([[[11, 9]], [[12, 10]], [[15, 13]], [[16, 14]], [[16, 15]]])("golden sul 15: valido %j", (s) => {
    expect(setError(s as [number, number], g)).toBeNull();
  });
  it.each([[[17, 15]], [[18, 16]], [[15, 14]], [[16, 16]]])("golden sul 15: non valido %j", (s) => {
    expect(setError(s as [number, number], g)).not.toBeNull();
  });
  it("set a 21 e a 7", () => {
    expect(setError([21, 18], { points: 21, golden: null })).toBeNull();
    expect(setError([11, 9], { points: 21, golden: null })).toMatch(/21/);
    expect(setError([7, 3], { points: 7, golden: null })).toBeNull();
    expect(setError([9, 7], { points: 7, golden: null })).toBeNull();
    expect(setError([9, 6], { points: 7, golden: null })).toMatch(/esattamente 2/);
  });
  it("le regole arrivano alla validazione della partita", () => {
    expect(validateMatch([[16, 15], [11, 3]], 3, g)).toHaveProperty("result");
    expect(validateMatch([[17, 15], [11, 3]], 3, g)).toMatchObject({ set: 1 });
  });
});
