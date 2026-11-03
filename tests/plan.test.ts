import { describe, it, expect } from "vitest";
import { isPaid, isPro, planLabel, FREE_WALL_LIMIT, STORE_LIMIT_PRO } from "../shared/plan";

const now = Math.floor(Date.now() / 1000);

describe("isPaid", () => {
  it("free は false", () => expect(isPaid({ plan: "free" })).toBe(false));
  it("null/undefined は false", () => {
    expect(isPaid(null)).toBe(false);
    expect(isPaid(undefined)).toBe(false);
  });
  it("starter(期限なし) は true", () => expect(isPaid({ plan: "starter", plan_until: null })).toBe(true));
  it("pro(未来期限) は true", () => expect(isPaid({ plan: "pro", plan_until: now + 1000 })).toBe(true));
  it("期限切れ(1日猶予超) は false", () => expect(isPaid({ plan: "pro", plan_until: now - 2 * 86400 })).toBe(false));
  it("期限切れ直後(猶予内) は true", () => expect(isPaid({ plan: "pro", plan_until: now - 100 })).toBe(true));
});

describe("isPro", () => {
  it("starter は pro ではない", () => expect(isPro({ plan: "starter", plan_until: null })).toBe(false));
  it("pro(有効) は true", () => expect(isPro({ plan: "pro", plan_until: null })).toBe(true));
  it("pro(期限切れ) は false", () => expect(isPro({ plan: "pro", plan_until: now - 2 * 86400 })).toBe(false));
});

describe("planLabel / 定数", () => {
  it("ラベル", () => {
    expect(planLabel("pro")).toBe("Pro");
    expect(planLabel("starter")).toBe("Starter");
    expect(planLabel("free")).toBe("Free");
    expect(planLabel(null)).toBe("Free");
  });
  it("Free掲載上限は5", () => expect(FREE_WALL_LIMIT).toBe(5));
  it("店舗上限は5", () => expect(STORE_LIMIT_PRO).toBe(5));
});
