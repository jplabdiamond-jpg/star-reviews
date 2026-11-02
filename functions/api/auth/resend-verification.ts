// POST /api/auth/resend-verification  { email }
// 未認証ユーザーに確認メールを再送。存在有無・認証状態は漏らさず常に ok を返す。
import { json, readJson } from "../../../shared/util";
import { sendVerificationEmail } from "../../../shared/verify";
import type { Env } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const body = await readJson<{ email?: string }>(request);
  const email = (body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return json({ ok: true });

  try {
    const user = await env.DB.prepare("SELECT id, email_verified FROM users WHERE email = ?")
      .bind(email)
      .first<{ id: string; email_verified: number | null }>();
    if (user && !user.email_verified) {
      const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
      await sendVerificationEmail(env, user.id, email, base);
    }
  } catch {
    /* email_verified 列が未適用でも落とさない（存在を漏らさないため常にok） */
  }

  return json({ ok: true });
};
