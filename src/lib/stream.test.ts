import { describe, expect, it } from "vitest";
import { parseStreamUrl, streamPlatform } from "./stream";

describe("link della diretta", () => {
  it("vuoto = nessuna diretta", () => expect(parseStreamUrl("  ")).toEqual({ url: null }));
  it("aggiunge https e passa http a https", () => {
    expect(parseStreamUrl("youtube.com/live/abc")).toEqual({ url: "https://youtube.com/live/abc" });
    expect(parseStreamUrl("http://twitch.tv/circolo")).toEqual({ url: "https://twitch.tv/circolo" });
  });
  it("rifiuta link non validi o pericolosi", () => {
    expect(parseStreamUrl("javascript:alert(1)")).toHaveProperty("error");
    expect(parseStreamUrl("ciao")).toHaveProperty("error");
    expect(parseStreamUrl("https://" + "a".repeat(300) + ".com")).toHaveProperty("error");
  });
  it("riconosce le piattaforme", () => {
    expect(streamPlatform("https://www.youtube.com/watch?v=x")).toBe("YouTube");
    expect(streamPlatform("https://youtu.be/x")).toBe("YouTube");
    expect(streamPlatform("https://m.facebook.com/x/live")).toBe("Facebook");
    expect(streamPlatform("https://twitch.tv/x")).toBe("Twitch");
    expect(streamPlatform("https://esempio.it/diretta")).toBeNull();
  });
});
