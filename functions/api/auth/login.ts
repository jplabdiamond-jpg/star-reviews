// POST /api/auth/login  { email, password }
import { verifyPassword, createSession, sessionCookie } from "../../../shared/auth";
import { json, badRequest, readJson } from "../../../shared/util";
import type { Env } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<{ email?: string; password?: string }>(request);
  if (!body) return badRequest("invalid json");
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!email || !password) return badRequest("メールとパスワードを入力してください");

  const user = await env.DB.prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; password_hash: string }>();
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return badRequest("メールまたはパスワードが違います", 401);
  }

  // メール認証チェック（完全必須）。email_verified 列が未適用の環境では素通り＝ロックアウト回避。
  try {
    const v = await env.DB.prepare("SELECT email_verified FROM users WHERE id = ?")
      .bind(user.id)
      .first<{ email_verified: number | null }>();
    if (v && !v.email_verified) {
      return json(
        {
          error: "メールアドレスの確認が完了していません。ご登録時の確認メールにあるリンクを開いてください。",
          unverified: true,
          email,
        },
        403
      );
    }
  } catch {
    /* email_verified 列が未適用の場合は認証チェックをスキップ */
  }

  const biz = await env.DB.prepare("SELECT id, name FROM businesses WHERE owner_user_id = ?")
    .bind(user.id)
    .first<{ id: string; name: string }>();
  if (!biz) return badRequest("ビジネスが見つかりません", 500);

  const token = await createSession(env, { userId: user.id, businessId: biz.id, email });
  return json({ ok: true, business: { id: biz.id, name: biz.name } }, 200, {
    "set-cookie": sessionCookie(token),
  });
};
