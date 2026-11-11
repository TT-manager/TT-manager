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

import { clientKey } from "./codes";

describe("chiave dell'indirizzo per il limite tentativi", () => {
  it("IPv4 invariato, IPv6 raggruppato per /64, primo della lista", () => {
    expect(clientKey("203.0.113.7")).toBe("203.0.113.7");
    expect(clientKey("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
    expect(clientKey("2001:db8:1:2:ffff::1")).toBe("2001:db8:1:2::/64");
    expect(clientKey("198.51.100.1, 10.0.0.1")).toBe("198.51.100.1");
    expect(clientKey(null)).toBe("sconosciuto");
  });
});
