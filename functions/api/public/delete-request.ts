// POST /api/public/delete-request  { w, email, message }  掲載・個人情報の削除依頼（認証不要）
// w = 声の壁の slug または embed_token。該当店舗のオーナーに依頼メールを送る。
import { json, badRequest, readJson, escapeHtml } from "../../../shared/util";
import { sendEmailResend } from "../../../shared/notify";
import type { Env } from "../../../shared/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = await readJson<{ w?: string; email?: string; message?: string }>(request);
  const w = (b?.w || "").trim();
  const email = (b?.email || "").trim();
  const message = (b?.message || "").trim();
  if (!w) return badRequest("対象の店舗が指定されていません");
  if (!EMAIL_RE.test(email)) return badRequest("ご連絡先メールを正しく入力してください");
  if (!message || message.length < 5) return badRequest("ご依頼内容を入力してください");
  if (message.length > 2000) return badRequest("内容が長すぎます");

  // レート制限（IP単位・10分5件）
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  try {
    const key = `rl:del:${ip}`;
    const cur = parseInt((await env.SESSIONS.get(key)) || "0", 10) || 0;
    if (cur >= 5) return badRequest("送信が多すぎます。しばらくしてからお試しください。", 429);
    await env.SESSIONS.put(key, String(cur + 1), { expirationTtl: 600 });
  } catch { /* no-op */ }

  const wall = await env.DB.prepare("SELECT business_id FROM walls WHERE slug = ? OR embed_token = ? LIMIT 1")
    .bind(w, w)
    .first<{ business_id: string }>();
  if (!wall) return badRequest("対象の店舗が見つかりませんでした", 404);

  const biz = await env.DB.prepare(
    `SELECT b.name AS biz_name, COALESCE(b.notify_email, u.email) AS to_email
       FROM businesses b JOIN users u ON u.id = b.owner_user_id WHERE b.id = ?`
  ).bind(wall.business_id).first<{ biz_name: string; to_email: string | null }>();

  const to = (biz?.to_email || "").trim();
  if (to) {
    const html =
      `<div style="font-family:sans-serif;line-height:1.7;color:#1c1a12">` +
      `<p>${escapeHtml(biz?.biz_name || "")} 宛てに、掲載・個人情報の削除依頼が届きました。</p>` +
      `<p style="margin:14px 0;padding:14px;background:#fffdf5;border:1px solid #ece3cf;border-radius:10px">` +
      `<b>ご連絡先：</b>${escapeHtml(email)}<br><br>${escapeHtml(message)}</p>` +
      `<p>対象の声は、管理画面の「受信トレイ」から「掲載を外す」で非表示にできます。ご本人確認のうえご対応ください。</p>` +
      `<p style="color:#7c7563;font-size:12px">このメールは star-reviews の削除依頼フォームから自動送信されています。</p></div>`;
    try {
      await sendEmailResend(env, to, `【star-reviews】掲載・削除のご依頼が届きました`, html);
    } catch (e) {
      console.error("delete-request email failed", e);
    }
  }

  return json({ ok: true });
};
