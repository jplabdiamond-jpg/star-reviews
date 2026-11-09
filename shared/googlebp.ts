// Google Business Profile 連携（オーナーOAuth・全レビュー取り込み / 自動同期）。
// 既存のソーシャルログイン用 GOOGLE_OAUTH_CLIENT_ID/SECRET を再利用し、
// スコープ business.manage でオフラインアクセス（refresh_token）を取得する。
// refresh_token は AES-GCM で暗号化して D1 に保存（鍵は client_secret から導出）。
//
// 依存（さね側の前提）:
//  - Google Cloud で Business Profile 系API（Account Management / Business Information）を有効化
//  - レビュー取得は従来の My Business API v4 のため、Googleへ「Business Profile API アクセス申請」を行い承認が必要
//  - OAuth同意画面に business.manage スコープを追加、承認済みリダイレクトURIに /api/google/bp/callback を登録
import type { Env } from "./types";

export const BP_SCOPE = "https://www.googleapis.com/auth/business.manage";

export function bpEnabled(env: Env): boolean {
  return !!(env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET);
}

export function bpRedirectUri(env: Env, origin: string): string {
  const base = (env.PUBLIC_BASE_URL || origin).replace(/\/+$/, "");
  return `${base}/api/google/bp/callback`;
}

export function buildBpAuthorizeUrl(env: Env, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: redirectUri,
    scope: BP_SCOPE,
    state,
    access_type: "offline", // refresh_token を得る
    prompt: "consent", // 毎回同意→refresh_token を確実に受領
    include_granted_scopes: "true",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenResp {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

export async function exchangeCode(
  env: Env,
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresIn: number }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET!,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const tok = (await res.json().catch(() => ({}))) as TokenResp;
  if (!res.ok || !tok.access_token) {
    throw new Error(`token exchange failed: ${tok.error || res.status} ${tok.error_description || ""}`);
  }
  return {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token || null,
    expiresIn: tok.expires_in || 3600,
  };
}

export async function refreshAccessToken(env: Env, refreshToken: string): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET!,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  const tok = (await res.json().catch(() => ({}))) as TokenResp;
  if (!res.ok || !tok.access_token) {
    throw new Error(`token refresh failed: ${tok.error || res.status}`);
  }
  return tok.access_token;
}

// ---- refresh_token の暗号化（AES-GCM・鍵は client_secret の SHA-256）----
async function aesKey(env: Env): Promise<CryptoKey> {
  const raw = new TextEncoder().encode(env.GOOGLE_OAUTH_CLIENT_SECRET || "");
  const hash = await crypto.subtle.digest("SHA-256", raw);
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
function b64(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
function unb64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
export async function encToken(env: Env, plain: string): Promise<string> {
  const key = await aesKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plain));
  return `${b64(iv)}:${b64(ct)}`;
}
export async function decToken(env: Env, enc: string): Promise<string> {
  const [ivs, cts] = enc.split(":");
  const key = await aesKey(env);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(ivs) }, key, unb64(cts));
  return new TextDecoder().decode(pt);
}

// ---- Business Profile API 呼び出し ----
export interface BpLocation {
  account: string; // "accounts/123"
  name: string; // "locations/456"
  title: string;
}

export async function listAccounts(accessToken: string): Promise<string[]> {
  const out: string[] = [];
  let pageToken = "";
  for (let i = 0; i < 10; i++) {
    const url =
      "https://mybusinessaccountmanagement.googleapis.com/v1/accounts?pageSize=100" +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`accounts ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as { accounts?: { name: string }[]; nextPageToken?: string };
    for (const a of j.accounts || []) out.push(a.name);
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  return out;
}

export async function listLocations(accessToken: string, account: string): Promise<BpLocation[]> {
  const out: BpLocation[] = [];
  let pageToken = "";
  for (let i = 0; i < 20; i++) {
    const url =
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account}/locations` +
      `?readMask=name,title&pageSize=100` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`locations ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as { locations?: { name: string; title?: string }[]; nextPageToken?: string };
    for (const l of j.locations || []) out.push({ account, name: l.name, title: l.title || l.name });
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  return out;
}

export interface BpReview {
  reviewId: string;
  rating: number; // 1..5
  comment: string;
  author: string | null;
  createMs: number;
}

const STAR: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

// v4 Reviews API（承認制）。parent = accounts/{aid}/locations/{lid}
export async function listReviews(
  accessToken: string,
  account: string,
  location: string,
  maxPages = 20
): Promise<BpReview[]> {
  const parent = `${account}/${location}`; // "accounts/123/locations/456"
  const out: BpReview[] = [];
  let pageToken = "";
  for (let i = 0; i < maxPages; i++) {
    const url =
      `https://mybusiness.googleapis.com/v4/${parent}/reviews?pageSize=50` +
      (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : "");
    const res = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`reviews ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const j = (await res.json()) as {
      reviews?: {
        reviewId: string;
        starRating?: string;
        comment?: string;
        createTime?: string;
        reviewer?: { displayName?: string };
      }[];
      nextPageToken?: string;
    };
    for (const r of j.reviews || []) {
      out.push({
        reviewId: r.reviewId,
        rating: STAR[r.starRating || ""] || 0,
        comment: (r.comment || "").trim(),
        author: (r.reviewer?.displayName || "").trim() || null,
        createMs: r.createTime ? Date.parse(r.createTime) : Date.now(),
      });
    }
    if (!j.nextPageToken) break;
    pageToken = j.nextPageToken;
  }
  return out;
}
