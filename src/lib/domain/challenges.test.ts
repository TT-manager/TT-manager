import { describe, expect, it } from "vitest";
import { countsForRanking, isExpired, romeDay, romeWeek } from "./challenges";

describe("settimana delle sfide (ora italiana)", () => {
  it("parte dal lunedì", () => {
    expect(romeWeek("2026-11-14T10:00:00Z")).toBe("2026-11-09"); // sabato
    expect(romeWeek("2026-11-09T10:00:00Z")).toBe("2026-11-09"); // lunedì
    expect(romeWeek("2026-11-15T20:00:00Z")).toBe("2026-11-09"); // domenica sera
  });
  it("domenica alle 23:30 UTC in Italia è già lunedì", () => {
    expect(romeDay("2026-11-15T23:30:00Z")).toBe("2026-11-16");
    expect(romeWeek("2026-11-15T23:30:00Z")).toBe("2026-11-16");
  });
});

describe("limite settimanale", () => {
  const on = { enabled: true, perWeek: 1 };
  it("la prima della settimana vale, la seconda è amichevole", () => {
    expect(countsForRanking(on, "2026-11-14T10:00:00Z", [])).toBe(true);
    expect(countsForRanking(on, "2026-11-14T10:00:00Z", [{ played_at: "2026-11-10T10:00:00Z" }])).toBe(false);
    expect(countsForRanking(on, "2026-11-17T10:00:00Z", [{ played_at: "2026-11-10T10:00:00Z" }])).toBe(true);
  });
  it("con più sfide a settimana o senza limite", () => {
    const two = [{ played_at: "2026-11-10T10:00:00Z" }];
    expect(countsForRanking({ enabled: true, perWeek: 2 }, "2026-11-14T10:00:00Z", two)).toBe(true);
    expect(countsForRanking({ enabled: true, perWeek: 0 }, "2026-11-14T10:00:00Z", [...two, ...two, ...two])).toBe(true);
  });
  it("con le sfide spente non vale mai", () => {
    expect(countsForRanking({ enabled: false, perWeek: 0 }, "2026-11-14T10:00:00Z", [])).toBe(false);
  });
});

describe("scadenza", () => {
  const now = new Date("2026-11-20T12:00:00Z").getTime();
  it("in attesa dopo 7 giorni, accettata dopo 21", () => {
    expect(isExpired({ status: "pending", created_at: "2026-11-12T12:00:00Z" }, now)).toBe(true);
    expect(isExpired({ status: "pending", created_at: "2026-11-14T12:00:00Z" }, now)).toBe(false);
    expect(isExpired({ status: "accepted", created_at: "2026-11-12T12:00:00Z" }, now)).toBe(false);
    expect(isExpired({ status: "reported", created_at: "2026-01-01T12:00:00Z" }, now)).toBe(false);
  });
});
