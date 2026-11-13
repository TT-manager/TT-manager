import { describe, expect, it } from "vitest";
import { normName, sameNameMatch } from "./names";

describe("stesso nome", () => {
  it("ignora maiuscole, accenti e spazi", () => {
    expect(normName("  Niccolò   DE LUCA ")).toBe("niccolo de luca");
  });
  it("trova il giocatore anche con nome e cognome invertiti", () => {
    const c = [{ id: "1", name: "Mario Rossi" }, { id: "2", name: "Luca Bianchi" }];
    expect(sameNameMatch("rossi mario", c)?.id).toBe("1");
    expect(sameNameMatch("Mario Rossi", c)?.id).toBe("1");
    expect(sameNameMatch("Mario Verdi", c)).toBeNull();
  });
  it("con due omonimi non sceglie da solo", () => {
    expect(sameNameMatch("Mario Rossi", [{ id: "1", name: "Mario Rossi" }, { id: "2", name: "mario rossi" }])).toBeNull();
  });
});
