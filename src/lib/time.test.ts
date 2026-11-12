import { describe, expect, it } from "vitest";
import { timeAgo } from "./time";

const now = new Date("2026-11-12T15:00:00Z");
describe("tempo trascorso", () => {
  it("minuti, ore, ieri, giorni", () => {
    expect(timeAgo("2026-11-12T14:59:30Z", now)).toBe("adesso");
    expect(timeAgo("2026-11-12T14:45:00Z", now)).toBe("15 min fa");
    expect(timeAgo("2026-11-12T14:00:00Z", now)).toBe("1 ora fa");
    expect(timeAgo("2026-11-12T10:00:00Z", now)).toBe("5 ore fa");
    expect(timeAgo("2026-11-11T12:00:00Z", now)).toBe("ieri");
    expect(timeAgo("2026-11-09T12:00:00Z", now)).toBe("3 giorni fa");
  });
});
