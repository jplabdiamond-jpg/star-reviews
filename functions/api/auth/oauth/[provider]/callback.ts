// GET /api/auth/oauth/:provider/callback?code=...&state=...
// プロバイダからの戻り。state検証→トークン交換→ユーザー特定/作成→セッション発行→/app.htmlへ。
import { isProvider, exchangeCodeForProfile, upsertOAuthUser } from "../../../../../shared/oauth";
import { createSession, sessionCookie } from "../../../../../shared/auth";
import type { Env } from "../../../../../shared/types";

function redirectWithError(base: string, msg: string): Response {
  return Response.redirect(`${base}/?oauth_error=${encodeURIComponent(msg)}#auth`, 302);
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const provider = String(params.provider || "");
  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  const url = new URL(request.url);

  if (!isProvider(provider)) return redirectWithError(base, "不明なログイン方法です。");

  // ユーザーが同意しなかった等
  const providerError = url.searchParams.get("error");
  if (providerError) {
    return redirectWithError(base, "ログインがキャンセルされました。");
  }

  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  if (!code || !state) return redirectWithError(base, "認証情報が不足しています。もう一度お試しください。");

  // state検証（KVから取り出して単発で削除）
  const stateKey = `oauth:state:${state}`;
  const rawState = await env.SESSIONS.get(stateKey);
  await env.SESSIONS.delete(stateKey);
  if (!rawState) return redirectWithError(base, "セッションの有効期限が切れました。もう一度お試しください。");

  let saved: { provider: string; nonce: string; redirectUri: string };
  try {
    saved = JSON.parse(rawState);
  } catch {
    return redirectWithError(base, "認証に失敗しました。もう一度お試しください。");
  }
  if (saved.provider !== provider) return redirectWithError(base, "認証に失敗しました。もう一度お試しください。");

  try {
    const profile = await exchangeCodeForProfile(env, provider, code, saved.redirectUri, saved.nonce);
    const { userId, businessId, email } = await upsertOAuthUser(env, provider, profile);

    const token = await createSession(env, { userId, businessId, email });
    // セッションCookieを付けてダッシュボードへ
    return new Response(null, {
      status: 302,
      headers: { location: `${base}/app.html`, "set-cookie": sessionCookie(token) },
    });
  } catch (e) {
    console.error("oauth callback error", provider, (e as Error)?.message);
    // oauth_accounts 未適用(0014)などもここに来る
    return redirectWithError(base, "ログインに失敗しました。時間をおいて再度お試しください。");
  }
};
