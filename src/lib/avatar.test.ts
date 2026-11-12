import { describe, expect, it } from "vitest";
import { imageKind } from "./avatar";

describe("foto profilo", () => {
  it("riconosce WebP e JPEG dai primi byte", () => {
    expect(imageKind(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0]))).toBe("webp");
    expect(imageKind(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpg");
  });
  it("rifiuta tutto il resto", () => {
    expect(imageKind(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(imageKind(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBeNull();
  });
});
