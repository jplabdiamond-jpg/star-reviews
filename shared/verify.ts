// メールアドレス確認（サインアップ時の本人確認）
// トークンは KV(SESSIONS) に verify:<token> = userId で保存。24時間・単発。
import { sendEmailResend } from "./notify";
import { escapeHtml } from "./util";
import type { Env } from "./types";

const VERIFY_TTL = 60 * 60 * 24; // 24時間

export async function sendVerificationEmail(env: Env, userId: string, email: string, baseUrl: string): Promise<void> {
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  await env.SESSIONS.put(`verify:${token}`, userId, { expirationTtl: VERIFY_TTL });

  const link = `${baseUrl.replace(/\/+$/, "")}/verify?token=${token}`;
  const subject = "【star-reviews】メールアドレスの確認をお願いします";
  const html =
    `<div style="font-family:sans-serif;line-height:1.7;color:#1c1a12">` +
    `<p>star-reviews へのご登録ありがとうございます。</p>` +
    `<p>下のボタンをクリックして、メールアドレスの確認を完了してください。確認が済むとダッシュボードをご利用いただけます。</p>` +
    `<p style="margin:18px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1c1a12;color:#fff;font-weight:700;padding:12px 22px;border-radius:10px;text-decoration:none">メールアドレスを確認する →</a></p>` +
    `<p style="color:#7c7563;font-size:12.5px">このリンクは24時間で無効になります。ボタンが開けない場合は次のURLをブラウザに貼り付けてください：<br>${escapeHtml(link)}</p>` +
    `<p style="color:#7c7563;font-size:12px">心当たりがない場合はこのメールを破棄してください。</p></div>`;
  await sendEmailResend(env, email, subject, html);
}
