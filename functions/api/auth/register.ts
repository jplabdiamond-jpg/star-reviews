// POST /api/auth/register  { email, password, business_name }
import { hashPassword, createSession, sessionCookie } from "../../../shared/auth";
import { json, badRequest, readJson, genId, nowSec } from "../../../shared/util";
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

  const token = await createSession(env, { userId, businessId, email });
  return json({ ok: true, business: { id: businessId, name: businessName } }, 200, {
    "set-cookie": sessionCookie(token),
  });
};
