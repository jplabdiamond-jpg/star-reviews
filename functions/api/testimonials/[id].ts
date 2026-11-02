// PATCH /api/testimonials/:id   { action: "approve" | "reject" }
// 承認すると事業者のデフォルト壁に自動で載る
import { json, badRequest, readJson, nowSec } from "../../../shared/util";
import { isPaid, FREE_WALL_LIMIT } from "../../../shared/plan";
import type { Env, AppData } from "../../../shared/types";

export const onRequestPatch: PagesFunction<Env, string, AppData> = async ({ request, env, params, data }) => {
  const { businessId } = data.session!;
  const id = String(params.id);
  const body = await readJson<{ action?: string }>(request);
  const action = body?.action;
  if (action !== "approve" && action !== "reject") return badRequest("action は approve か reject");

  const row = await env.DB.prepare("SELECT business_id FROM testimonials WHERE id = ?")
    .bind(id)
    .first<{ business_id: string }>();
  if (!row || row.business_id !== businessId) return badRequest("not found", 404);

  const now = nowSec();
  if (action === "reject") {
    await env.DB.prepare("UPDATE testimonials SET status='rejected', approved_at=NULL WHERE id = ?").bind(id).run();
    await env.DB.prepare("DELETE FROM wall_testimonials WHERE testimonial_id = ?").bind(id).run();
    return json({ ok: true, status: "rejected" });
  }

  // --- プラン上限: 無料プランは掲載(承認)できる件数に上限 ---
  const biz = await env.DB.prepare("SELECT plan, plan_until FROM businesses WHERE id = ?")
    .bind(businessId)
    .first<{ plan: string; plan_until: number | null }>();
  if (!isPaid(biz)) {
    const cnt = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM testimonials WHERE business_id = ? AND status = 'approved'"
    )
      .bind(businessId)
      .first<{ n: number }>();
    if ((cnt?.n || 0) >= FREE_WALL_LIMIT) {
      return json(
        {
          error: `無料プランで掲載できるのは${FREE_WALL_LIMIT}件までです。Starter以上にアップグレードすると無制限に掲載できます。`,
          limit_reached: true,
          limit: FREE_WALL_LIMIT,
        },
        402
      );
    }
  }

  await env.DB.prepare("UPDATE testimonials SET status='approved', approved_at=? WHERE id = ?").bind(now, id).run();

  const wall = await env.DB.prepare("SELECT id FROM walls WHERE business_id = ? ORDER BY created_at LIMIT 1")
    .bind(businessId)
    .first<{ id: string }>();
  if (wall) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO wall_testimonials (wall_id, testimonial_id, position) VALUES (?, ?, ?)"
    )
      .bind(wall.id, id, now)
      .run();
  }
  return json({ ok: true, status: "approved" });
};
