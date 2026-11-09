// GET/POST /api/cron/google-sync  自動同期ON の店舗のGoogleレビューを取り込む
// 保護: x-cron-key / ?key= == env.CRON_SECRET。GitHub Actions等から定期的に叩く想定。
import { isPro } from "../../../shared/plan";
import { importBpReviews } from "../../../shared/googlebp-sync";
import type { Env } from "../../../shared/types";

async function run(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const key = request.headers.get("x-cron-key") || url.searchParams.get("key") || "";
  if (!env.CRON_SECRET) return new Response("cron disabled", { status: 503 });
  if (key !== env.CRON_SECRET) return new Response("unauthorized", { status: 401 });

  let rows: Array<{ business_id: string; plan: string; plan_until: number | null }> = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT g.business_id, b.plan, b.plan_until
         FROM google_bp g JOIN businesses b ON b.id = g.business_id
        WHERE g.autosync = 1 AND g.location_name IS NOT NULL`
    ).all<{ business_id: string; plan: string; plan_until: number | null }>();
    rows = results || [];
  } catch {
    return new Response("not migrated", { status: 503 });
  }

  let businesses = 0;
  let imported = 0;
  for (const r of rows) {
    if (!isPro({ plan: r.plan, plan_until: r.plan_until })) continue; // Pro期限切れはスキップ
    try {
      const res = await importBpReviews(env, r.business_id, { maxPages: 10 });
      imported += res.imported;
      businesses++;
    } catch (e) {
      console.error("google-sync", r.business_id, String(e).slice(0, 120));
    }
  }
  return new Response(JSON.stringify({ ok: true, businesses, imported }), {
    headers: { "content-type": "application/json" },
  });
}

export const onRequestGet: PagesFunction<Env> = ({ env, request }) => run(env, request);
export const onRequestPost: PagesFunction<Env> = ({ env, request }) => run(env, request);
