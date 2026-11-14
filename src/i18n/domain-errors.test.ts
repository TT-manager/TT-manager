import { describe, expect, it } from "vitest";
import { translateDomainError as t } from "./domain-errors";
import { setError, validateMatch } from "../lib/domain/score";
import { parseRankingSettings } from "../lib/domain/ranking";

describe("messaggi della logica in inglese", () => {
  it("punteggi dei set", () => {
    expect(t(setError([11, 10], { points: 11, golden: null })!, "en")).toBe("a lead of at least 2 points is needed");
    const v = validateMatch([[11, 5]], 3, { points: 11, golden: null });
    expect("error" in v && t(v.error, "en")).toBe("Match not finished: 2 sets are needed to win (best of 3).");
  });
  it("regole della classifica", () => {
    const r = parseRankingSettings({ initial: -1 });
    expect("errors" in r && t(r.errors[0], "en")).toBe("Starting points: value between 0 and 5000.");
  });
  it("in italiano non cambia nulla; i messaggi sconosciuti restano com'erano", () => {
    expect(t("punteggi non validi", "it")).toBe("punteggi non validi");
    expect(t("Messaggio nuovo", "en")).toBe("Messaggio nuovo");
  });
});
