// PATCH /api/testimonials/:id   { action: "approve" | "reject" }
// 承認すると事業者のデフォルト壁に自動で載る
import { json, badRequest, readJson, nowSec } from "../../../shared/util";
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
