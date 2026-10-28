// GET /api/wall/:token   承認済みの声を返す（埋め込みウィジェット用・CORS許可）
import type { Env } from "../../../shared/types";

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const token = String(params.token);
  const origin = new URL(request.url).origin;
  const cors = { "access-control-allow-origin": "*", "content-type": "application/json; charset=utf-8" };

  const wall = await env.DB.prepare("SELECT id, business_id, layout, name FROM walls WHERE embed_token = ?")
    .bind(token)
    .first<{ id: string; business_id: string; layout: string; name: string }>();
  if (!wall) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: cors });

  const { results } = await env.DB.prepare(
    `SELECT t.rating, t.body, t.author_label, t.photo_key, t.level, t.verified
     FROM wall_testimonials wt
     JOIN testimonials t ON t.id = wt.testimonial_id
     WHERE wt.wall_id = ? AND t.status = 'approved'
     ORDER BY wt.position DESC
     LIMIT 100`
  )
    .bind(wall.id)
    .all<{ rating: number; body: string; author_label: string; photo_key: string | null; level: number; verified: number }>();

  const items = results.map((r) => ({
    rating: r.rating,
    body: r.body,
    author: r.author_label,
    verified: r.verified === 1,
    photo_url: r.photo_key ? `${origin}/api/media/${r.photo_key}` : null,
  }));

  return new Response(JSON.stringify({ layout: wall.layout, name: wall.name, items }), { headers: cors });
};
