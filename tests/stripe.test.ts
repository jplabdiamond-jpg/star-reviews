import { describe, it, expect } from "vitest";
import { priceIdForPlan, planForPriceId, formEncode } from "../shared/stripe";

const env = {
  STRIPE_PRICE_STARTER: "price_sm",
  STRIPE_PRICE_PRO: "price_pm",
  STRIPE_PRICE_STARTER_YEAR: "price_sy",
  STRIPE_PRICE_PRO_YEAR: "price_py",
  STRIPE_PRICE_ID: "price_legacy",
};

describe("priceIdForPlan", () => {
  it("月額", () => {
    expect(priceIdForPlan(env, "starter")).toBe("price_sm");
    expect(priceIdForPlan(env, "pro")).toBe("price_pm");
  });
  it("年額", () => {
    expect(priceIdForPlan(env, "starter", "year")).toBe("price_sy");
    expect(priceIdForPlan(env, "pro", "year")).toBe("price_py");
  });
  it("未知プランは null", () => expect(priceIdForPlan(env, "enterprise")).toBeNull());
  it("年額未設定なら null（月額に落とさない）", () => {
    expect(priceIdForPlan({ STRIPE_PRICE_PRO: "price_pm" }, "pro", "year")).toBeNull();
  });
  it("pro月額は legacy をフォールバック", () => {
    expect(priceIdForPlan({ STRIPE_PRICE_ID: "price_legacy" }, "pro")).toBe("price_legacy");
  });
});

describe("planForPriceId", () => {
  it("月額/年額どちらもプラン判定", () => {
    expect(planForPriceId(env, "price_sm")).toBe("starter");
    expect(planForPriceId(env, "price_sy")).toBe("starter");
    expect(planForPriceId(env, "price_pm")).toBe("pro");
    expect(planForPriceId(env, "price_py")).toBe("pro");
    expect(planForPriceId(env, "price_legacy")).toBe("pro");
  });
  it("未知/空は null", () => {
    expect(planForPriceId(env, "price_xxx")).toBeNull();
    expect(planForPriceId(env, null)).toBeNull();
  });
});

describe("formEncode", () => {
  it("undefined/null を除外しネストキーも通す", () => {
    const s = formEncode({ a: "1", b: undefined, c: null, "x[0][y]": "z" });
    expect(s).toContain("a=1");
    expect(s).not.toContain("b=");
    expect(s).toContain("x%5B0%5D%5By%5D=z");
  });
});
