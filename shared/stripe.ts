// Stripe REST ラッパ（SDK不使用・Workers fetch + WebCrypto）
// 有効化には環境変数が必要:
//   STRIPE_SECRET_KEY      決済に必須
//   STRIPE_PRICE_ID        月額プランの price_...（checkoutに必要）
//   STRIPE_WEBHOOK_SECRET  Webアック署名検証に必要

// form-url-encoded 本文を生成（ネストキー対応: line_items[0][price] など）
export function formEncode(obj: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    p.append(k, String(v));
  }
  return p.toString();
}

// Stripe APIを叩く（form-encoded）。失敗時は {ok:false, status, error} を返す。
export async function stripeFetch(
  secret: string,
  path: string,
  body?: Record<string, string | number | undefined | null>
): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body ? formEncode(body) : undefined,
  });
  let data: any = null;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

// Stripe Webhook 署名検証（stripe-signature: t=...,v1=...）
// 成功なら parse したイベントJSONを返し、失敗なら null。
export async function verifyStripeEvent(
  rawBody: string,
  sigHeader: string | null,
  secret: string,
  toleranceSec = 300
): Promise<any | null> {
  if (!sigHeader || !secret) return null;
  const parts = sigHeader.split(",").reduce<Record<string, string>>((acc, kv) => {
    const i = kv.indexOf("=");
    if (i > 0) acc[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
    return acc;
  }, {});
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return null;

  // タイムスタンプ許容チェック
  const ts = parseInt(t, 10);
  if (!Number.isFinite(ts)) return null;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSec) return null;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${rawBody}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  // 定数時間に近い比較
  if (expected.length !== v1.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  if (diff !== 0) return null;

  try { return JSON.parse(rawBody); } catch { return null; }
}

// ===== プラン ⇔ Stripe Price ID の対応 =====
// 2段階プラン(Starter/Pro)を扱う。環境変数:
//   STRIPE_PRICE_STARTER  Starter(¥1,980/月)の price_...
//   STRIPE_PRICE_PRO      Pro(¥3,980/月)の price_...
//   STRIPE_PRICE_ID       旧・単一プラン用。Proのフォールバックとして参照（互換）。
export type PaidPlan = "starter" | "pro";

interface PriceEnv {
  STRIPE_PRICE_STARTER?: string;
  STRIPE_PRICE_PRO?: string;
  STRIPE_PRICE_ID?: string;
}

// プラン名 → Checkoutで使う price_...（未設定なら null）
export function priceIdForPlan(env: PriceEnv, plan: string | null | undefined): string | null {
  switch ((plan || "").toLowerCase()) {
    case "starter":
      return env.STRIPE_PRICE_STARTER || null;
    case "pro":
      return env.STRIPE_PRICE_PRO || env.STRIPE_PRICE_ID || null;
    default:
      return null;
  }
}

// price_... → プラン名（Webフックで購入プランを判定。未知なら null）
export function planForPriceId(env: PriceEnv, priceId: string | null | undefined): PaidPlan | null {
  if (!priceId) return null;
  if (env.STRIPE_PRICE_STARTER && priceId === env.STRIPE_PRICE_STARTER) return "starter";
  if (env.STRIPE_PRICE_PRO && priceId === env.STRIPE_PRICE_PRO) return "pro";
  if (env.STRIPE_PRICE_ID && priceId === env.STRIPE_PRICE_ID) return "pro";
  return null;
}
