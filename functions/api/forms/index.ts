// GET  /api/forms          自分のフォーム一覧
// POST /api/forms          フォーム作成（同時に声の壁を1つ作成）
import { json, badRequest, readJson, genId, nowSec, slugify } from "../../../shared/util";
import type { Env, AppData } from "../../../shared/types";

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const { businessId } = data.session!;
  const { results } = await env.DB.prepare(
    `SELECT f.*,
       (SELECT embed_token FROM walls w WHERE w.business_id = f.business_id ORDER BY w.created_at LIMIT 1) AS embed_token,
       (SELECT COUNT(*) FROM testimonials t WHERE t.form_id = f.id AND t.status='pending') AS pending_count,
       (SELECT COUNT(*) FROM testimonials t WHERE t.form_id = f.id AND t.status='approved') AS approved_count
     FROM forms f WHERE f.business_id = ? ORDER BY f.created_at DESC`
  )
    .bind(businessId)
    .all();
  return json({ forms: results });
};

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const body = await readJson<{
    title?: string;
    intro?: string;
    thanks_message?: string;
    levels_enabled?: string;
    require_verified?: boolean;
  }>(request);
  if (!body) return badRequest("invalid json");
  const title = (body.title || "").trim();
  if (!title) return badRequest("タイトルを入力してください");

  const now = nowSec();
  const formId = genId("frm");
  const slug = slugify(title);

  await env.DB.prepare(
    `INSERT INTO forms (id, business_id, slug, title, intro, thanks_message, levels_enabled, require_verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      formId,
      businessId,
      slug,
      title,
      body.intro || null,
      body.thanks_message || "ありがとうございました！",
      body.levels_enabled || "1,2",
      body.require_verified ? 1 : 0,
      now
    )
    .run();

  // 事業者にまだ壁がなければデフォルトの壁を作成
  const hasWall = await env.DB.prepare("SELECT id FROM walls WHERE business_id = ? LIMIT 1")
    .bind(businessId)
    .first();
  if (!hasWall) {
    await env.DB.prepare(
      "INSERT INTO walls (id, business_id, name, layout, embed_token, created_at) VALUES (?, ?, ?, 'grid', ?, ?)"
    )
      .bind(genId("wal"), businessId, "声の壁", genId("pub"), now)
      .run();
  }

  return json({ ok: true, form: { id: formId, slug } });
};
