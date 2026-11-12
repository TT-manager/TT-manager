import { describe, expect, it } from "vitest";
import { isoToRomeLocal, registrationIsOpen, romeToIso } from "./registration";

const base = { status: "draft", registration_open: true, registration_deadline: null, championship_id: "c" };

describe("iscrizioni autonome", () => {
  it("aperte solo se il torneo è in preparazione, aperto e di un campionato", () => {
    expect(registrationIsOpen(base)).toBe(true);
    expect(registrationIsOpen({ ...base, status: "groups" })).toBe(false);
    expect(registrationIsOpen({ ...base, registration_open: false })).toBe(false);
    expect(registrationIsOpen({ ...base, championship_id: null })).toBe(false);
  });
  it("si chiudono alla scadenza", () => {
    const t = { ...base, registration_deadline: "2026-11-20T19:00:00.000Z" };
    expect(registrationIsOpen(t, new Date("2026-11-20T18:59:00Z"))).toBe(true);
    expect(registrationIsOpen(t, new Date("2026-11-20T19:00:00Z"))).toBe(false);
  });
  it("mostra la scadenza in ora italiana (inverno e estate)", () => {
    expect(isoToRomeLocal("2026-11-20T19:00:00.000Z")).toBe("2026-11-20T20:00");
    expect(isoToRomeLocal("2026-07-01T18:00:00.000Z")).toBe("2026-07-01T20:00");
  });
  it("legge la scadenza scritta in ora italiana", () => {
    expect(romeToIso("2026-11-20T20:00")).toBe("2026-11-20T19:00:00.000Z");
    expect(romeToIso("2026-07-01T20:00")).toBe("2026-07-01T18:00:00.000Z");
    expect(romeToIso("non valida")).toBeNull();
  });
});
