// POST /api/auth/register  { email, password, business_name }
// メール認証が完全必須。登録時点ではログインさせず、確認メールのリンクで認証を完了させる。
import { hashPassword } from "../../../shared/auth";
import { json, badRequest, readJson, genId, nowSec } from "../../../shared/util";
import { sendVerificationEmail } from "../../../shared/verify";
import type { Env } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<{ email?: string; password?: string; business_name?: string }>(request);
  if (!body) return badRequest("invalid json");
  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const businessName = (body.business_name || "").trim() || "マイビジネス";

  if (!email || !email.includes("@")) return badRequest("メールアドレスが正しくありません");
  if (password.length < 8) return badRequest("パスワードは8文字以上にしてください");

  const existing = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
  if (existing) return badRequest("このメールアドレスは既に登録されています", 409);

  const now = nowSec();
  const userId = genId("usr");
  const businessId = genId("biz");
  const pwHash = await hashPassword(password);

  // email_verified は列のDEFAULT(0)に委ねる（INSERTで列名を指定しない＝未適用環境でも安全）
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)").bind(
      userId,
      email,
      pwHash,
      now
    ),
    env.DB.prepare(
      "INSERT INTO businesses (id, owner_user_id, name, plan, created_at) VALUES (?, ?, ?, 'free', ?)"
    ).bind(businessId, userId, businessName, now),
  ]);

  // 認証メール送信（Resend未設定でも失敗させない）
  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  await sendVerificationEmail(env, userId, email, base);

  return json({ ok: true, pending_verification: true, email });
};
