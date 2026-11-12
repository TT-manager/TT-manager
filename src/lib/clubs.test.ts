import { describe, expect, it } from "vitest";
import { clubLabel, NEW_CLUB, parseClubChoice } from "./clubs";

const form = (o: Record<string, string>) => (k: string) => o[k];
const ID = "0d8c72e0-69c6-4832-880a-29ee737be0fe";

describe("scelta del circolo", () => {
  it("vuoto = nessun circolo", () => {
    expect(parseClubChoice(form({}))).toEqual({ kind: "none" });
  });
  it("accetta solo identificativi validi dall'elenco", () => {
    expect(parseClubChoice(form({ club_id: ID }))).toEqual({ kind: "existing", clubId: ID });
    expect(parseClubChoice(form({ club_id: "Circolo inventato" }))).toEqual({ error: "Circolo non valido." });
  });
  it("richiesta di un circolo nuovo: nome obbligatorio, spazi ripuliti", () => {
    expect(parseClubChoice(form({ club_id: NEW_CLUB, new_club_name: "  TT   Roma ", new_club_city: " Roma " })))
      .toEqual({ kind: "request", name: "TT Roma", city: "Roma" });
    expect(parseClubChoice(form({ club_id: NEW_CLUB, new_club_name: "x" }))).toHaveProperty("error");
    expect(parseClubChoice(form({ club_id: NEW_CLUB, new_club_name: "TT Roma" }))).toEqual({ kind: "request", name: "TT Roma", city: null });
  });
  it("dove le richieste non sono previste, vale solo l'elenco", () => {
    expect(parseClubChoice(form({ club_id: NEW_CLUB, new_club_name: "TT Roma" }), false)).toHaveProperty("error");
  });
  it("etichetta con la città", () => {
    expect(clubLabel({ id: ID, name: "TT Roma", city: "Roma" })).toBe("TT Roma (Roma)");
    expect(clubLabel({ id: ID, name: "TT Roma", city: null })).toBe("TT Roma");
  });
});
