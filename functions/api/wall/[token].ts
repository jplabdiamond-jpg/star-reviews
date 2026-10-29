// GET /api/wall/:token   承認済みの声を返す（埋め込みウィジェット用・CORS許可）
// 返却: layout, name, business_name, summary{count,avg}, items[]（JSON-LD用に date も含む）
import { bumpMetric } from "../../../shared/util";
import type { Env } from "../../../shared/types";

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const token = String(params.token);
  const origin = new URL(request.url).origin;
  const cors = { "access-control-allow-origin": "*", "content-type": "application/json; charset=utf-8" };

  const wall = await env.DB.prepare(
    "SELECT id, business_id, layout, name FROM walls WHERE embed_token = ?"
  )
    .bind(token)
    .first<{ id: string; business_id: string; layout: string; name: string }>();
  if (!wall) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: cors });

  // 表示回数カウント（ベストエフォート）
  await bumpMetric(env.DB, `wall_view:${wall.id}`);

  const biz = await env.DB.prepare("SELECT name FROM businesses WHERE id = ?")
    .bind(wall.business_id)
    .first<{ name: string }>();

  const { results } = await env.DB.prepare(
    `SELECT t.rating, t.body, t.author_label, t.photo_key, t.video_key, t.level, t.verified, t.source,
            COALESCE(t.approved_at, t.submitted_at) AS at
     FROM wall_testimonials wt
     JOIN testimonials t ON t.id = wt.testimonial_id
     WHERE wt.wall_id = ? AND t.status = 'approved'
     ORDER BY wt.position DESC
     LIMIT 100`
  )
    .bind(wall.id)
    .all<{
      rating: number;
      body: string;
      author_label: string;
      photo_key: string | null;
      video_key: string | null;
      level: number;
      verified: number;
      source: string | null;
      at: number;
    }>();

  const items = results.map((r) => ({
    rating: r.rating,
    body: r.body,
    author: r.author_label,
    verified: r.verified === 1,
    source: r.source || null,
    date: r.at ? new Date(r.at * 1000).toISOString().slice(0, 10) : null,
    photo_url: r.photo_key ? `${origin}/api/media/${r.photo_key}` : null,
    video_url: r.video_key ? `${origin}/api/media/${r.video_key}` : null,
  }));

  // 星サマリー（平均・件数）
  const count = items.length;
  const avg = count ? Math.round((items.reduce((s, i) => s + (i.rating || 0), 0) / count) * 10) / 10 : 0;

  return new Response(
    JSON.stringify({
      layout: wall.layout,
      name: wall.name,
      business_name: biz?.name || "",
      summary: { count, avg },
      items,
    }),
    { headers: cors }
  );
};
