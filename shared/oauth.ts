// ソーシャルログイン/登録（Google / LINE）の共通ロジック。
// 認可コードフロー（サーバーサイド・機密クライアント）。state(CSRF)はKVで管理。
// プロバイダのメールは検証済みとして扱い、メール認証メールは送らない。
import { genId, nowSec } from "./util";
import type { Env } from "./types";

export type Provider = "google" | "line";

export interface OAuthProfile {
  uid: string; // プロバイダの安定ID（id_token の sub）
  email: string | null; // プロバイダ提供メール（LINEは未取得の場合あり）
  emailVerified: boolean;
  name: string | null;
}

interface ProviderConf {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId: (env: Env) => string | undefined;
  clientSecret: (env: Env) => string | undefined;
  // LINEの認可URLは bot_prompt など追加パラメータは無し。拡張余地のためフック化。
  extraAuthParams?: Record<string, string>;
}

const CONF: Record<Provider, ProviderConf> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scope: "openid email profile",
    clientId: (e) => e.GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: (e) => e.GOOGLE_OAUTH_CLIENT_SECRET,
    extraAuthParams: { access_type: "online", prompt: "select_account" },
  },
  line: {
    authorizeUrl: "https://access.line.me/oauth2/v2.1/authorize",
    tokenUrl: "https://api.line.me/oauth2/v2.1/token",
    scope: "profile openid email",
    clientId: (e) => e.LINE_LOGIN_CHANNEL_ID,
    clientSecret: (e) => e.LINE_LOGIN_CHANNEL_SECRET,
  },
};

export function isProvider(v: string | undefined): v is Provider {
  return v === "google" || v === "line";
}

export function isEnabled(env: Env, provider: Provider): boolean {
  const c = CONF[provider];
  return !!(c.clientId(env) && c.clientSecret(env));
}

export function providerLabel(provider: Provider): string {
  return provider === "google" ? "Google" : "LINE";
}

// 認可URLを組み立てる
export function buildAuthorizeUrl(
  env: Env,
  provider: Provider,
  redirectUri: string,
  state: string,
  nonce: string
): string {
  const c = CONF[provider];
  const params = new URLSearchParams({
    response_type: "code",
    client_id: c.clientId(env)!,
    redirect_uri: redirectUri,
    scope: c.scope,
    state,
    nonce,
    ...(c.extraAuthParams || {}),
  });
  return `${c.authorizeUrl}?${params.toString()}`;
}

// base64url デコード（UTF-8対応）
function b64urlDecode(input: string): string {
  let s = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  const bin = atob(s);
  const bytes = Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const parts = jwt.split(".");
  if (parts.length < 2) throw new Error("invalid id_token");
  return JSON.parse(b64urlDecode(parts[1]));
}

// 認可コードをトークンに交換し、id_token からプロフィールを取り出す。
// id_token はプロバイダのトークンエンドポイントからTLSで直接受領しているため、署名検証は省略（機密クライアント）。
export async function exchangeCodeForProfile(
  env: Env,
  provider: Provider,
  code: string,
  redirectUri: string,
  expectedNonce: string | null
): Promise<OAuthProfile> {
  const c = CONF[provider];
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: c.clientId(env)!,
    client_secret: c.clientSecret(env)!,
  });

  const res = await fetch(c.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`token exchange failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const tok = (await res.json()) as { id_token?: string; access_token?: string };
  if (!tok.id_token) throw new Error("no id_token in response");

  const claims = decodeJwtPayload(tok.id_token) as {
    sub?: string;
    email?: string;
    email_verified?: boolean | string;
    name?: string;
    nonce?: string;
  };

  if (expectedNonce && claims.nonce && claims.nonce !== expectedNonce) {
    throw new Error("nonce mismatch");
  }

  const uid = (claims.sub || "").trim();
  if (!uid) throw new Error("no subject in id_token");

  const email = (claims.email || "").trim().toLowerCase() || null;
  // Googleは email_verified を返す。LINEのメールはLINEアカウントの登録メール＝検証済み扱い。
  const emailVerified =
    provider === "line"
      ? !!email
      : claims.email_verified === true || claims.email_verified === "true";

  return { uid, email, emailVerified, name: (claims.name || "").trim() || null };
}

// パスワードログイン不可の無効ハッシュ（ソーシャル専用ユーザー向け）。
// salt$hash 形式だが hash はランダムなので、いかなるパスワードも verify に通らない。
function disabledPasswordHash(): string {
  const rnd = (n: number) =>
    [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${rnd(16)}$${rnd(32)}`;
}

// プロバイダのプロフィールから star-reviews ユーザーを特定/作成し、紐付けを保存する。
// 返り値のログイン用 businessId は、そのユーザーが最初に作った店舗（親）。
export async function upsertOAuthUser(
  env: Env,
  provider: Provider,
  profile: OAuthProfile
): Promise<{ userId: string; businessId: string; email: string }> {
  const now = nowSec();

  // 1) 既存の紐付けを探す
  const link = await env.DB.prepare(
    "SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_uid = ?"
  )
    .bind(provider, profile.uid)
    .first<{ user_id: string }>();

  let userId: string | null = link?.user_id || null;
  let userEmail = profile.email || "";

  // 2) 紐付けが無ければ、メール一致の既存ユーザーに紐付けるか、新規作成する
  if (!userId) {
    if (profile.email) {
      const existing = await env.DB.prepare("SELECT id, email FROM users WHERE email = ?")
        .bind(profile.email)
        .first<{ id: string; email: string }>();
      if (existing) {
        userId = existing.id;
        userEmail = existing.email;
        // プロバイダで本人確認できたので認証済みに昇格（未適用環境では無視）
        if (profile.emailVerified) {
          try {
            await env.DB.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").bind(userId).run();
          } catch {
            /* email_verified 列が未適用でも続行 */
          }
        }
      }
    }

    if (!userId) {
      // 新規ユーザー作成。メール未取得(LINE)はプレースホルダで一意性を確保。
      userId = genId("usr");
      userEmail = profile.email || `${provider}-${profile.uid}@users.noreply.star-reviews.net`;
      const businessName = profile.name ? `${profile.name}のビジネス` : "マイビジネス";
      const businessId = genId("biz");

      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)"
        ).bind(userId, userEmail, disabledPasswordHash(), now),
        env.DB.prepare(
          "INSERT INTO businesses (id, owner_user_id, name, plan, created_at) VALUES (?, ?, ?, 'free', ?)"
        ).bind(businessId, userId, businessName, now),
      ]);
      // ソーシャル登録は本人確認済みとして扱う（未適用環境では無視）
      try {
        await env.DB.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").bind(userId).run();
      } catch {
        /* email_verified 列が未適用でも続行 */
      }
    }

    // 紐付けを保存
    await env.DB.prepare(
      "INSERT OR IGNORE INTO oauth_accounts (provider, provider_uid, user_id, email, created_at) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(provider, profile.uid, userId, profile.email, now)
      .run();
  }

  // 3) ログインに使う店舗（最も古い＝親）を取得。無ければ作成（データ不整合の保険）。
  let biz = await env.DB.prepare(
    "SELECT id FROM businesses WHERE owner_user_id = ? ORDER BY created_at ASC LIMIT 1"
  )
    .bind(userId)
    .first<{ id: string }>();
  if (!biz) {
    const businessId = genId("biz");
    await env.DB.prepare(
      "INSERT INTO businesses (id, owner_user_id, name, plan, created_at) VALUES (?, ?, 'マイビジネス', 'free', ?)"
    )
      .bind(businessId, userId, now)
      .run();
    biz = { id: businessId };
  }

  if (!userEmail) {
    const u = await env.DB.prepare("SELECT email FROM users WHERE id = ?")
      .bind(userId)
      .first<{ email: string }>();
    userEmail = u?.email || "";
  }

  return { userId, businessId: biz.id, email: userEmail };
}
