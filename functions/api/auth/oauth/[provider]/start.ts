// GET /api/auth/oauth/:provider/start
// ソーシャルログイン/登録の起点。state(CSRF)とnonceを発行してKVに保存し、プロバイダの認可画面へリダイレクト。
import { isProvider, isEnabled, buildAuthorizeUrl } from "../../../../../shared/oauth";
import { genId } from "../../../../../shared/util";
import type { Env } from "../../../../../shared/types";

const STATE_TTL = 60 * 10; // 10分

function redirectWithError(base: string, msg: string): Response {
  return Response.redirect(`${base}/?oauth_error=${encodeURIComponent(msg)}#auth`, 302);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const provider = String(params.provider || "");
  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");

  if (!isProvider(provider)) return redirectWithError(base, "不明なログイン方法です。");
  if (!isEnabled(env, provider)) {
    return redirectWithError(base, `${provider === "google" ? "Google" : "LINE"}ログインはまだ設定されていません。`);
  }

  const state = genId("st");
  const nonce = genId("nc");
  const redirectUri = `${base}/api/auth/oauth/${provider}/callback`;

  // state → 検証に必要な情報をKVへ（単発・短命）
  await env.SESSIONS.put(
    `oauth:state:${state}`,
    JSON.stringify({ provider, nonce, redirectUri }),
    { expirationTtl: STATE_TTL }
  );

  const authorizeUrl = buildAuthorizeUrl(env, provider, redirectUri, state, nonce);
  return Response.redirect(authorizeUrl, 302);
};
