// 新着レビューのオーナー通知（メール=Resend / LINE=Messaging API push）
// いずれも環境変数が未設定ならその経路は黙ってスキップ（best-effort）。本処理は止めない。
import { escapeHtml } from "./util";
import type { Env } from "./types";

export interface NotifyPayload {
  businessId: string;
  formTitle: string;
  rating: number;
  body: string;
  authorLabel: string;
  level: number;
  baseUrl: string; // 管理画面へのリンク用
}

// Resend でメール送信（REST・SDK不使用）
async function sendEmailResend(env: Env, to: string, subject: string, html: string): Promise<void> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ from: env.RESEND_FROM, to: [to], subject, html }),
    });
  } catch {
    /* 通知失敗は本処理に影響させない */
  }
}

// LINE Messaging API push
async function sendLinePush(env: Env, toUserId: string, text: string): Promise<void> {
  if (!env.LINE_CHANNEL_ACCESS_TOKEN || !toUserId) return;
  try {
    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ to: toUserId, messages: [{ type: "text", text }] }),
    });
  } catch {
    /* 同上 */
  }
}

const stars = (n: number) => "★".repeat(Math.max(0, Math.min(5, n))) + "☆".repeat(5 - Math.max(0, Math.min(5, n)));

// 新着レビューを事業者に通知（メール＋LINE）。DBから通知設定・宛先を解決。
export async function notifyNewTestimonial(env: Env, p: NotifyPayload): Promise<void> {
  try {
    const biz = await env.DB.prepare(
      `SELECT b.notify_enabled AS notify_enabled, b.notify_email AS notify_email,
              b.line_user_id AS line_user_id, u.email AS owner_email
         FROM businesses b JOIN users u ON u.id = b.owner_user_id
        WHERE b.id = ?`
    )
      .bind(p.businessId)
      .first<{ notify_enabled: number | null; notify_email: string | null; line_user_id: string | null; owner_email: string | null }>();
    if (!biz) return;
    if (biz.notify_enabled === 0) return; // 明示的にOFFなら送らない

    const snippet = p.body.length > 120 ? p.body.slice(0, 120) + "…" : p.body;
    const appUrl = `${p.baseUrl}/app`;

    // --- メール ---
    const to = (biz.notify_email || biz.owner_email || "").trim();
    if (to) {
      const subject = `【star-reviews】新しいレビューが届きました（${stars(p.rating)}）`;
      const html =
        `<div style="font-family:sans-serif;line-height:1.7;color:#1c1a12">` +
        `<p>新しいお客様の声が届きました。</p>` +
        `<p style="margin:14px 0;padding:14px;background:#fffdf5;border:1px solid #ece3cf;border-radius:10px">` +
        `<b>${escapeHtml(p.formTitle)}</b><br>評価：${stars(p.rating)}（${p.rating}）<br>` +
        `投稿者：${escapeHtml(p.authorLabel)}<br><br>${escapeHtml(snippet)}</p>` +
        `<p><a href="${escapeHtml(appUrl)}" style="color:#eaa400;font-weight:700">受信トレイで確認する →</a></p>` +
        `<p style="color:#7c7563;font-size:12px">このメールは star-reviews から自動送信されています。</p></div>`;
      await sendEmailResend(env, to, subject, html);
    }

    // --- LINE ---
    if (biz.line_user_id) {
      const text =
        `🗣 新しいレビューが届きました\n` +
        `${p.formTitle}\n評価：${stars(p.rating)}（${p.rating}）\n投稿者：${p.authorLabel}\n\n「${snippet}」\n\n受信トレイ：${appUrl}`;
      await sendLinePush(env, biz.line_user_id, text);
    }
  } catch {
    /* 通知全体が失敗しても本処理は継続 */
  }
}
