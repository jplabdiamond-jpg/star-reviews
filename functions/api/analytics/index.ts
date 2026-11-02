// GET /api/analytics?range=30d   ダッシュボードのアナリティクス（要ログイン・アクティブ店舗）
// Free/Starter は基本KPI＋投稿推移のみ。Pro は詳細（ファネル/レベル別/ソース別/返礼/平均★推移/閲覧推移）。
import { json, nowSec, jstDay } from "../../../shared/util";
import { isPro } from "../../../shared/plan";
import type { Env, AppData } from "../../../shared/types";

function rangeDays(r: string | null): number {
  if (r === "7d") return 7;
  if (r === "90d") return 90;
  return 30;
}

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const days = rangeDays(new URL(request.url).searchParams.get("range"));
  const cutoff = nowSec() - days * 86400;
  const cutoffDay = jstDay(cutoff);

  const biz = await env.DB.prepare("SELECT plan, plan_until FROM businesses WHERE id = ?")
    .bind(businessId)
    .first<{ plan: string; plan_until: number | null }>();
  const pro = isPro(biz);

  // --- 基本KPI（全プラン）---
  const totals = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status='approved' THEN 1 ELSE 0 END) AS approved,
       SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
       AVG(CASE WHEN status='approved' THEN rating END) AS avg_rating
     FROM testimonials WHERE business_id = ?`
  )
    .bind(businessId)
    .first<{ total: number; approved: number; pending: number; avg_rating: number | null }>();

  const total = totals?.total || 0;
  const approved = totals?.approved || 0;
  const pending = totals?.pending || 0;
  const kpis = {
    total,
    approved,
    pending,
    approval_rate: total > 0 ? Math.round((approved / total) * 100) : 0,
    avg_rating: totals?.avg_rating != null ? Math.round(totals.avg_rating * 10) / 10 : null,
  };

  // 投稿推移（日次・範囲内）
  const subSeries = await env.DB.prepare(
    `SELECT strftime('%Y-%m-%d', submitted_at, 'unixepoch', '+9 hours') AS day, COUNT(*) AS n
       FROM testimonials WHERE business_id = ? AND submitted_at >= ?
      GROUP BY day ORDER BY day`
  )
    .bind(businessId, cutoff)
    .all<{ day: string; n: number }>();

  const result: Record<string, unknown> = {
    pro,
    range_days: days,
    kpis,
    series: { submissions: subSeries.results || [] },
  };

  if (!pro) return json(result);

  // --- 以下 Pro 限定 ---
  // レベル別・ソース別（範囲内）
  const byLevel = await env.DB.prepare(
    `SELECT level, COUNT(*) AS n FROM testimonials WHERE business_id = ? AND submitted_at >= ? GROUP BY level ORDER BY level`
  )
    .bind(businessId, cutoff)
    .all<{ level: number; n: number }>();

  const bySource = await env.DB.prepare(
    `SELECT COALESCE(source,'フォーム') AS source, COUNT(*) AS n
       FROM testimonials WHERE business_id = ? AND submitted_at >= ? GROUP BY source ORDER BY n DESC`
  )
    .bind(businessId, cutoff)
    .all<{ source: string; n: number }>();

  // 平均★の推移（日次・承認分）
  const ratingSeries = await env.DB.prepare(
    `SELECT strftime('%Y-%m-%d', submitted_at, 'unixepoch', '+9 hours') AS day, AVG(rating) AS avg
       FROM testimonials WHERE business_id = ? AND submitted_at >= ? GROUP BY day ORDER BY day`
  )
    .bind(businessId, cutoff)
    .all<{ day: string; avg: number }>();

  // 返礼コード（全期間：発行数・使用数）
  const reward = await env.DB.prepare(
    `SELECT COUNT(*) AS issued,
            SUM(CASE WHEN c.status='redeemed' THEN 1 ELSE 0 END) AS used
       FROM reward_codes c JOIN testimonials t ON t.id = c.testimonial_id
      WHERE t.business_id = ?`
  )
    .bind(businessId)
    .first<{ issued: number; used: number | null }>();

  // ファネル・閲覧推移（metric_daily。未適用環境でも落とさない）
  const funnel = { form_view: 0, submit_start: 0, submit_done: approved + pending, approved };
  let viewSeries: Array<{ day: string; form_view: number; wall_view: number }> = [];
  try {
    const md = await env.DB.prepare(
      `SELECT metric_key, day, count FROM metric_daily WHERE business_id = ? AND day >= ? ORDER BY day`
    )
      .bind(businessId, cutoffDay)
      .all<{ metric_key: string; day: string; count: number }>();
    const byDay: Record<string, { form_view: number; wall_view: number }> = {};
    for (const row of md.results || []) {
      if (row.metric_key === "form_view") funnel.form_view += row.count;
      else if (row.metric_key === "submit_start") funnel.submit_start += row.count;
      else if (row.metric_key === "submit_done") funnel.submit_done = Math.max(funnel.submit_done, 0); // done は testimonials 由来を優先
      if (row.metric_key === "form_view" || row.metric_key === "wall_view") {
        byDay[row.day] = byDay[row.day] || { form_view: 0, wall_view: 0 };
        if (row.metric_key === "form_view") byDay[row.day].form_view += row.count;
        else byDay[row.day].wall_view += row.count;
      }
    }
    // submit_done は範囲内の投稿数（testimonials）で上書き
    let doneInRange = 0;
    for (const s of subSeries.results || []) doneInRange += s.n;
    funnel.submit_done = doneInRange;
    viewSeries = Object.keys(byDay).sort().map((day) => ({ day, ...byDay[day] }));
  } catch {
    /* metric_daily 未適用 */
  }

  result.byLevel = byLevel.results || [];
  result.bySource = bySource.results || [];
  result.series = {
    submissions: subSeries.results || [],
    rating: ratingSeries.results || [],
    views: viewSeries,
  };
  result.funnel = funnel;
  result.reward = { issued: reward?.issued || 0, used: reward?.used || 0 };

  return json(result);
};
