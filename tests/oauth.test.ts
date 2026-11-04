import { describe, it, expect } from "vitest";
import { isProvider, isEnabled, buildAuthorizeUrl, providerLabel } from "../shared/oauth";
import type { Env } from "../shared/types";

const base = { } as unknown as Env;

describe("isProvider", () => {
  it("google/line は true", () => {
    expect(isProvider("google")).toBe(true);
    expect(isProvider("line")).toBe(true);
  });
  it("その他は false", () => {
    expect(isProvider("github")).toBe(false);
    expect(isProvider(undefined)).toBe(false);
    expect(isProvider("")).toBe(false);
  });
});

describe("isEnabled", () => {
  it("環境変数が無ければ false", () => {
    expect(isEnabled(base, "google")).toBe(false);
    expect(isEnabled(base, "line")).toBe(false);
  });
  it("id/secret 両方で true", () => {
    const g = { GOOGLE_OAUTH_CLIENT_ID: "x", GOOGLE_OAUTH_CLIENT_SECRET: "y" } as unknown as Env;
    expect(isEnabled(g, "google")).toBe(true);
    expect(isEnabled(g, "line")).toBe(false);
    const l = { LINE_LOGIN_CHANNEL_ID: "x", LINE_LOGIN_CHANNEL_SECRET: "y" } as unknown as Env;
    expect(isEnabled(l, "line")).toBe(true);
  });
  it("片方だけでは false", () => {
    const g = { GOOGLE_OAUTH_CLIENT_ID: "x" } as unknown as Env;
    expect(isEnabled(g, "google")).toBe(false);
  });
});

describe("buildAuthorizeUrl", () => {
  const env = {
    GOOGLE_OAUTH_CLIENT_ID: "gid",
    GOOGLE_OAUTH_CLIENT_SECRET: "gsec",
    LINE_LOGIN_CHANNEL_ID: "lid",
    LINE_LOGIN_CHANNEL_SECRET: "lsec",
  } as unknown as Env;

  it("Googleの認可URLに必要なパラメータが載る", () => {
    const u = new URL(buildAuthorizeUrl(env, "google", "https://ex.com/cb", "st1", "nc1"));
    expect(u.origin + u.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(u.searchParams.get("client_id")).toBe("gid");
    expect(u.searchParams.get("redirect_uri")).toBe("https://ex.com/cb");
    expect(u.searchParams.get("response_type")).toBe("code");
    expect(u.searchParams.get("state")).toBe("st1");
    expect(u.searchParams.get("nonce")).toBe("nc1");
    expect(u.searchParams.get("scope")).toContain("email");
  });

  it("LINEの認可URLはLINEのエンドポイントとscope", () => {
    const u = new URL(buildAuthorizeUrl(env, "line", "https://ex.com/cb", "st2", "nc2"));
    expect(u.origin + u.pathname).toBe("https://access.line.me/oauth2/v2.1/authorize");
    expect(u.searchParams.get("client_id")).toBe("lid");
    expect(u.searchParams.get("scope")).toContain("openid");
  });
});

describe("providerLabel", () => {
  it("表示名", () => {
    expect(providerLabel("google")).toBe("Google");
    expect(providerLabel("line")).toBe("LINE");
  });
});
