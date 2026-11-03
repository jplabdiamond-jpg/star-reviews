// POST/GET /api/cron/digest   日次ダイジェスト（1日1回のまとめ通知）を送信
// 保護: x-cron-key / ?key= == env.CRON_SECRET。1日1回スケジュールから叩く想定。
import { sendEmailResend } from "../../../shared/notify";
import { escapeHtml, nowSec } from "../../../shared/util";
import { isPaid } from "../../../shared/plan";
import type { Env } from "../../../shared/types";

const stars = (n: number) => "★".repeat(Math.max(0, Math.min(5, n))) + "☆".repeat(5 - Math.max(0, Math.min(5, n)));

async function run(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const key = request.headers.get("x-cron-key") || url.searchParams.get("key") || "";
  if (!env.CRON_SECRET) return new Response("cron disabled", { status: 503 });
  if (key !== env.CRON_SECRET) return new Response("unauthorized", { status: 401 });

  const now = nowSec();
  const base = (env.PUBLIC_BASE_URL || url.origin).replace(/\/+$/, "");

  let bizzes: Array<{ id: string; name: string; plan: string; plan_until: number | null; notify_email: string | null; owner_email: string | null; digest_last_at: number | null }> = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT b.id, b.name, b.plan, b.plan_until, b.notify_email, b.digest_last_at, u.email AS owner_email
         FROM businesses b JOIN users u ON u.id = b.owner_user_id
        WHERE b.notify_digest = 'daily' AND b.notify_enabled <> 0`
    ).all<{ id: string; name: string; plan: string; plan_until: number | null; notify_email: string | null; owner_email: string | null; digest_last_at: number | null }>();
    bizzes = results || [];
  } catch {
    return new Response("not migrated", { status: 503 });
  }

  let sent = 0;
  for (const b of bizzes) {
    try {
      if (!isPaid({ plan: b.plan, plan_until: b.plan_until })) continue; // 通知は有料のみ
      const since = b.digest_last_at || now - 24 * 3600;
      const { results } = await env.DB.prepare(
        `SELECT f.title AS form_title, t.rating, t.body, t.author_label, t.submitted_at
           FROM testimonials t JOIN forms f ON f.id = t.form_id
          WHERE t.business_id = ? AND t.submitted_at > ? ORDER BY t.submitted_at DESC LIMIT 50`
      ).bind(b.id, since).all<{ form_title: string; rating: number; body: string; author_label: string; submitted_at: number }>();
      const items = results || [];
      // 送信先が無い、または新着ゼロでも digest_last_at は進めて次回の窓を更新
      if (items.length > 0) {
        const to = (b.notify_email || b.owner_email || "").trim();
        if (to) {
          const rows = items.map((it) => {
            const snip = (it.body || "").length > 100 ? it.body.slice(0, 100) + "…" : it.body || "";
            return `<tr><td style="padding:8px 10px;border-bottom:1px solid #ece3cf;vertical-align:top;white-space:nowrap">${stars(it.rating)}</td><td style="padding:8px 10px;border-bottom:1px solid #ece3cf">${escapeHtml(it.author_label || "匿名のお客様")}<br><span style="color:#413d30">${escapeHtml(snip)}</span></td></tr>`;
          }).join("");
          const html =
            `<div style="font-family:sans-serif;line-height:1.7;color:#1c1a12">` +
            `<p>昨日から新しいお客様の声が <b>${items.length}件</b> 届きました。</p>` +
            `<table style="border-collapse:collapse;width:100%;margin:12px 0">${rows}</table>` +
            `<p><a href="${escapeHtml(base)}/app" style="color:#eaa400;font-weight:700">受信トレイで確認する →</a></p>` +
            `<p style="color:#7c7563;font-size:12px">このメールは star-reviews の日次ダイジェストです。</p></div>`;
          await sendEmailResend(env, to, `【star-reviews】新着レビュー ${items.length}件のまとめ`, html);
          sent++;
        }
      }
      await env.DB.prepare("UPDATE businesses SET digest_last_at = ? WHERE id = ?").bind(now, b.id).run();
    } catch (e) {
      console.error("digest failed for business", b.id, e);
    }
  }

  return new Response(JSON.stringify({ ok: true, businesses: bizzes.length, sent }), {
    headers: { "content-type": "application/json" },
  });
}

export const onRequestPost: PagesFunction<Env> = ({ request, env }) => run(env, request);
export const onRequestGet: PagesFunction<Env> = ({ request, env }) => run(env, request);
