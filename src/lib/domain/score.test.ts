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
