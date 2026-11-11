import { describe, expect, it } from "vitest";
import { CODE_ALPHABET, formatOrganizerCode, hashCode, newOrganizerCode, newPublicCode, normalizeCode, verifyCode } from "./codes";

describe("codici torneo", () => {
  it("lunghezze e alfabeto senza caratteri ambigui", () => {
    const c = newOrganizerCode();
    expect(c).toHaveLength(10);
    expect(newPublicCode()).toHaveLength(6);
    for (const ch of c) expect(CODE_ALPHABET).toContain(ch);
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });
  it("normalizza e formatta", () => {
    expect(normalizeCode(" abcde-fghjk ")).toBe("ABCDEFGHJK");
    expect(formatOrganizerCode("ABCDEFGHJK")).toBe("ABCDE-FGHJK");
  });
  it("impronta: verifica il codice giusto, rifiuta quello sbagliato, sale diverso ogni volta", async () => {
    const code = newOrganizerCode();
    const h1 = await hashCode(code);
    const h2 = await hashCode(code);
    expect(h1).not.toBe(h2);
    expect(h1).not.toContain(code);
    expect(await verifyCode(code, h1)).toBe(true);
    expect(await verifyCode(formatOrganizerCode(code).toLowerCase(), h1)).toBe(true);
    expect(await verifyCode("AAAAAAAAAA", h1)).toBe(false);
    expect(await verifyCode(code, "spazzatura")).toBe(false);
  });
});
