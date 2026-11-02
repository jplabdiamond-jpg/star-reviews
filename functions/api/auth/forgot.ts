// POST /api/auth/forgot  { email }  パスワード再設定メールを送る（存在有無は秘匿）
import { json, readJson, nowSec } from "../../../shared/util";
import { sendEmailResend } from "../../../shared/notify";
import { escapeHtml } from "../../../shared/util";
import type { Env } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = await readJson<{ email?: string }>(request);
  const email = (b?.email || "").trim().toLowerCase();
  // 常に ok を返す（登録有無を漏らさない）
  if (!email || !email.includes("@")) return json({ ok: true });

  const user = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
  if (user) {
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    // 1時間有効のトークンをKVに保存
    await env.SESSIONS.put(`pwreset:${token}`, JSON.stringify({ userId: user.id, at: nowSec() }), { expirationTtl: 3600 });
    const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
    const link = `${base}/reset?token=${token}`;
    const html =
      `<div style="font-family:sans-serif;line-height:1.7;color:#1c1a12">` +
      `<p>star-reviews のパスワード再設定のリクエストを受け付けました。</p>` +
      `<p>下のボタンから、1時間以内に新しいパスワードを設定してください。</p>` +
      `<p style="margin:18px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1c1a12;color:#fff;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px">パスワードを再設定する</a></p>` +
      `<p style="color:#7c7563;font-size:12px">このメールに心当たりがない場合は破棄してください。リンクの有効期限は1時間です。</p></div>`;
    await sendEmailResend(env, email, "【star-reviews】パスワード再設定のご案内", html);
  }
  return json({ ok: true });
};
