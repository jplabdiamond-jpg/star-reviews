import { describe, it, expect } from "vitest";
import { slugify, genCode, jstDay, escapeHtml, genId } from "../shared/util";

describe("slugify", () => {
  it("英数字＋ハイフン＋サフィックス", () => {
    const s = slugify("Cafe Soleil 本店");
    expect(s).toMatch(/-[0-9a-f]{6}$/);
    expect(s).not.toMatch(/\s/);
  });
  it("空入力でもサフィックスは出る", () => {
    expect(slugify("")).toMatch(/^[0-9a-f-]{6}$/);
  });
});

describe("genCode", () => {
  it("接頭辞＋6文字（紛らわしい文字なし）", () => {
    const c = genCode("SR");
    expect(c).toMatch(/^SR-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
});

describe("genId", () => {
  it("接頭辞付き・毎回ユニーク", () => {
    const a = genId("tst"); const b = genId("tst");
    expect(a).toMatch(/^tst_[0-9a-f]{32}$/);
    expect(a).not.toBe(b);
  });
});

describe("jstDay", () => {
  it("YYYY-MM-DD 形式", () => {
    expect(jstDay(1762000000)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("JSTはUTCより先行（0時またぎ）", () => {
    // 2026-01-01 00:30 UTC = 2026-01-01 09:30 JST（同日）
    const d = jstDay(Date.UTC(2026, 0, 1, 0, 30) / 1000);
    expect(d).toBe("2026-01-01");
    // 2026-01-01 15:30 UTC = 2026-01-02 00:30 JST（翌日）
    const d2 = jstDay(Date.UTC(2026, 0, 1, 15, 30) / 1000);
    expect(d2).toBe("2026-01-02");
  });
});

describe("escapeHtml", () => {
  it("特殊文字をエスケープ", () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe("&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;");
  });
  it("null/undefinedは空文字", () => {
    expect(escapeHtml(null as unknown as string)).toBe("");
  });
});
