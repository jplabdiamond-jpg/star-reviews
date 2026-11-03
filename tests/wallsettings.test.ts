import { describe, it, expect } from "vitest";
import { parseWallSettings, DEFAULT_SETTINGS } from "../shared/wallsettings";

describe("parseWallSettings", () => {
  it("空なら既定値", () => {
    expect(parseWallSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseWallSettings("")).toEqual(DEFAULT_SETTINGS);
    expect(parseWallSettings("not json")).toEqual(DEFAULT_SETTINGS);
  });
  it("不正な色は既定に、正しい色は小文字化", () => {
    expect(parseWallSettings({ accent: "red" }).accent).toBe("#eaa400");
    expect(parseWallSettings({ accent: "#2F6FEB" }).accent).toBe("#2f6feb");
  });
  it("不正な layout/star/theme は既定", () => {
    const s = parseWallSettings({ layout: "spiral", star: "ufo", theme: "neon" });
    expect(s.layout).toBe("grid");
    expect(s.star).toBe("gold");
    expect(s.theme).toBe("light");
  });
  it("正しい値は通る", () => {
    const s = parseWallSettings({ layout: "carousel", star: "heart", theme: "dark" });
    expect(s.layout).toBe("carousel");
    expect(s.star).toBe("heart");
    expect(s.theme).toBe("dark");
  });
  it("count は 0..100 にクランプ", () => {
    expect(parseWallSettings({ count: -5 }).count).toBe(0);
    expect(parseWallSettings({ count: 999 }).count).toBe(100);
    expect(parseWallSettings({ count: 6 }).count).toBe(6);
  });
  it("summary/autoplay は真偽に", () => {
    expect(parseWallSettings({ summary: 0 }).summary).toBe(false);
    expect(parseWallSettings({ autoplay: 1 }).autoplay).toBe(true);
  });
  it("fallbackLayout は accent 等に影響しない", () => {
    expect(parseWallSettings({}, "list").layout).toBe("list");
    expect(parseWallSettings({ layout: "chips" }, "list").layout).toBe("chips");
  });
});
