// POST /api/auth/verify  { token }
// メール確認トークンを検証し、email_verified を立ててそのままログイン（セッション発行）。
import { createSession, sessionCookie } from "../../../shared/auth";
import { json, badRequest, readJson } from "../../../shared/util";
import type { Env } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<{ token?: string }>(request);
  const token = (body?.token || "").trim();
  if (!token) return badRequest("トークンがありません");

  const key = `verify:${token}`;
  const userId = await env.SESSIONS.get(key);
  if (!userId) return badRequest("リンクが無効か、有効期限が切れています。お手数ですが認証メールを再送してください。", 400);

  const user = await env.DB.prepare("SELECT id, email FROM users WHERE id = ?")
    .bind(userId)
    .first<{ id: string; email: string }>();
  if (!user) {
    await env.SESSIONS.delete(key);
    return badRequest("アカウントが見つかりませんでした。", 404);
  }

  await env.DB.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").bind(userId).run();
  await env.SESSIONS.delete(key); // 単発

  const biz = await env.DB.prepare("SELECT id, name FROM businesses WHERE owner_user_id = ?")
    .bind(userId)
    .first<{ id: string; name: string }>();
  if (!biz) return badRequest("ビジネスが見つかりませんでした。", 500);

  const sessToken = await createSession(env, { userId: user.id, businessId: biz.id, email: user.email });
  return json({ ok: true, business: { id: biz.id, name: biz.name } }, 200, {
    "set-cookie": sessionCookie(sessToken),
  });
};
