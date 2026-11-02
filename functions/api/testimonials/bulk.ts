// POST /api/testimonials/bulk  { ids: [...], action: "approve" | "reject" }
// まとめて掲載／非掲載。無料プランは掲載上限(残り枠)まで。
import { json, badRequest, readJson, nowSec } from "../../../shared/util";
import { isPaid, FREE_WALL_LIMIT } from "../../../shared/plan";
import type { Env, AppData } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const body = await readJson<{ ids?: string[]; action?: string }>(request);
  const action = body?.action;
  const ids = Array.isArray(body?.ids) ? body!.ids.filter((x) => typeof x === "string").slice(0, 300) : [];
  if (action !== "approve" && action !== "reject") return badRequest("action は approve か reject");
  if (ids.length === 0) return badRequest("対象が選択されていません");

  // 自分のもの & 対象ステータスだけに絞る
  const placeholders = ids.map(() => "?").join(",");
  const { results } = await env.DB.prepare(
    `SELECT id FROM testimonials WHERE business_id = ? AND id IN (${placeholders}) AND status = ?`
  )
    .bind(businessId, ...ids, action === "approve" ? "pending" : "approved")
    .all<{ id: string }>();
  let targets = (results || []).map((r) => r.id);
  if (targets.length === 0) return json({ ok: true, done: 0, limited: 0 });

  const now = nowSec();

  if (action === "reject") {
    for (let i = 0; i < targets.length; i += 50) {
      const chunk = targets.slice(i, i + 50);
      const ph = chunk.map(() => "?").join(",");
      await env.DB.prepare(`UPDATE testimonials SET status='rejected', approved_at=NULL WHERE id IN (${ph})`).bind(...chunk).run();
      await env.DB.prepare(`DELETE FROM wall_testimonials WHERE testimonial_id IN (${ph})`).bind(...chunk).run();
    }
    return json({ ok: true, done: targets.length, limited: 0 });
  }

  // approve: 無料プランは残り枠まで
  let limited = 0;
  const biz = await env.DB.prepare("SELECT plan, plan_until FROM businesses WHERE id = ?")
    .bind(businessId)
    .first<{ plan: string; plan_until: number | null }>();
  if (!isPaid(biz)) {
    const cnt = await env.DB.prepare("SELECT COUNT(*) AS n FROM testimonials WHERE business_id = ? AND status = 'approved'")
      .bind(businessId)
      .first<{ n: number }>();
    const remaining = Math.max(0, FREE_WALL_LIMIT - (cnt?.n || 0));
    if (targets.length > remaining) {
      limited = targets.length - remaining;
      targets = targets.slice(0, remaining);
    }
  }
  if (targets.length === 0) {
    return json({ ok: true, done: 0, limited, limit_reached: true, error: `無料プランの掲載上限（${FREE_WALL_LIMIT}件）に達しています。` });
  }

  const wall = await env.DB.prepare("SELECT id FROM walls WHERE business_id = ? ORDER BY created_at LIMIT 1")
    .bind(businessId)
    .first<{ id: string }>();

  for (const id of targets) {
    await env.DB.prepare("UPDATE testimonials SET status='approved', approved_at=? WHERE id = ?").bind(now, id).run();
    if (wall) {
      await env.DB.prepare("INSERT OR IGNORE INTO wall_testimonials (wall_id, testimonial_id, position) VALUES (?, ?, ?)")
        .bind(wall.id, id, now)
        .run();
    }
  }
  return json({ ok: true, done: targets.length, limited });
};
