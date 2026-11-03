// POST/GET /api/cron/followups   期限が来たフォローアップを送信（定期実行から叩く）
// 保護: ヘッダ x-cron-key または ?key= が env.CRON_SECRET と一致した時のみ実行。
// GitHub Actions 等から毎時叩く想定。1回あたり最大 BATCH 件を処理。
import { sendEmailResend } from "../../../shared/notify";
import { escapeHtml, nowSec } from "../../../shared/util";
import type { Env } from "../../../shared/types";

const BATCH = 80;

function reviewRequestHtml(bizName: string, link: string): string {
  return (
    `<div style="font-family:sans-serif;line-height:1.75;color:#1c1a12">` +
    `<p>${escapeHtml(bizName)} です。先日はありがとうございました。</p>` +
    `<p>よろしければ、ご感想をひとことお聞かせいただけませんか？ 30秒ほどで、匿名でも投稿できます。</p>` +
    `<p style="margin:18px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1c1a12;color:#fff;font-weight:700;padding:13px 22px;border-radius:10px;text-decoration:none">感想を投稿する →</a></p>` +
    `<p style="color:#7c7563;font-size:12px">このメールは ${escapeHtml(bizName)} からのご依頼で star-reviews を通じて送信されています。</p></div>`
  );
}

async function run(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const key = request.headers.get("x-cron-key") || url.searchParams.get("key") || "";
  if (!env.CRON_SECRET) return new Response("cron disabled", { status: 503 });
  if (key !== env.CRON_SECRET) return new Response("unauthorized", { status: 401 });

  const now = nowSec();
  const base = (env.PUBLIC_BASE_URL || url.origin).replace(/\/+$/, "");

  let due: Array<{ id: string; business_id: string; form_id: string; to_email: string }> = [];
  try {
    const { results } = await env.DB.prepare(
      "SELECT id, business_id, form_id, to_email FROM followups WHERE status='pending' AND send_at <= ? ORDER BY send_at LIMIT ?"
    ).bind(now, BATCH).all<{ id: string; business_id: string; form_id: string; to_email: string }>();
    due = results || [];
  } catch {
    return new Response("not migrated", { status: 503 });
  }

  let sent = 0, failed = 0;
  for (const f of due) {
    try {
      const biz = await env.DB.prepare("SELECT name FROM businesses WHERE id = ?").bind(f.business_id).first<{ name: string }>();
      const form = await env.DB.prepare("SELECT slug FROM forms WHERE id = ?").bind(f.form_id).first<{ slug: string }>();
      if (!form) { await env.DB.prepare("UPDATE followups SET status='failed' WHERE id = ?").bind(f.id).run(); failed++; continue; }
      const link = `${base}/f/${form.slug}`;
      const bizName = biz?.name || "お店";
      await sendEmailResend(env, f.to_email, `【${bizName}】ご感想をお聞かせください`, reviewRequestHtml(bizName, link));
      await env.DB.prepare("UPDATE followups SET status='sent', sent_at=? WHERE id = ?").bind(nowSec(), f.id).run();
      sent++;
    } catch (e) {
      console.error("followup send failed", f.id, e);
      await env.DB.prepare("UPDATE followups SET status='failed' WHERE id = ?").bind(f.id).run().catch(() => {});
      failed++;
    }
  }

  return new Response(JSON.stringify({ ok: true, processed: due.length, sent, failed }), {
    headers: { "content-type": "application/json" },
  });
}

export const onRequestPost: PagesFunction<Env> = ({ request, env }) => run(env, request);
export const onRequestGet: PagesFunction<Env> = ({ request, env }) => run(env, request);
