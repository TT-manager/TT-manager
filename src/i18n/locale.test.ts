import { describe, expect, it } from "vitest";
import { dict, localeFromAcceptLanguage } from "./locale";

describe("lingua dal browser", () => {
  it("italiano solo se è la prima scelta", () => {
    expect(localeFromAcceptLanguage("it-IT,it;q=0.9,en;q=0.8")).toBe("it");
    expect(localeFromAcceptLanguage("en-US,en;q=0.9,it;q=0.8")).toBe("en");
    expect(localeFromAcceptLanguage("de-DE,de;q=0.9")).toBe("en");
    expect(localeFromAcceptLanguage("en;q=0.5,it;q=0.9")).toBe("it");
  });
  it("senza preferenza: italiano", () => {
    expect(localeFromAcceptLanguage(null)).toBe("it");
    expect(localeFromAcceptLanguage("*")).toBe("it");
  });
  it("dizionario con funzioni", () => {
    const d = dict({ hi: "Ciao", n: (k: number) => `${k} partite` }, { hi: "Hi", n: (k: number) => `${k} matches` });
    expect(d.en.n(3)).toBe("3 matches");
  });
});
