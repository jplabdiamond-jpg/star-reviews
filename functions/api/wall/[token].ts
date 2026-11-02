// GET /api/wall/:token   承認済みの声を返す（埋め込みウィジェット用・CORS許可）
// 返却: layout, name, business_name, summary{count,avg}, items[]（JSON-LD用に date も含む）
import { bumpMetric, bumpMetricDaily } from "../../../shared/util";
import { isPaid } from "../../../shared/plan";
import { parseWallSettings } from "../../../shared/wallsettings";
import type { Env } from "../../../shared/types";

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const token = String(params.token);
  const origin = new URL(request.url).origin;
  const cors = { "access-control-allow-origin": "*", "content-type": "application/json; charset=utf-8" };

  const wall = await env.DB.prepare(
    "SELECT id, business_id, layout, theme, name FROM walls WHERE embed_token = ?"
  )
    .bind(token)
    .first<{ id: string; business_id: string; layout: string; theme: string | null; name: string }>();
  if (!wall) return new Response(JSON.stringify({ error: "not found" }), { status: 404, headers: cors });

  const settings = parseWallSettings(wall.theme, wall.layout);

  // 表示回数カウント（ベストエフォート）
  await bumpMetric(env.DB, `wall_view:${wall.id}`);
  await bumpMetricDaily(env.DB, wall.business_id, "wall_view");

  const biz = await env.DB.prepare("SELECT name, plan, plan_until FROM businesses WHERE id = ?")
    .bind(wall.business_id)
    .first<{ name: string; plan: string; plan_until: number | null }>();
  // 有料プランはホワイトラベル（クレジット非表示）
  const branding = !isPaid(biz);

  type TRow = {
    rating: number; body: string; author_label: string;
    photo_key: string | null; video_key: string | null; level: number;
    verified: number; source: string | null; at: number; reply?: string | null;
  };
  const baseSel =
    `t.rating, t.body, t.author_label, t.photo_key, t.video_key, t.level, t.verified, t.source,
            COALESCE(t.approved_at, t.submitted_at) AS at`;
  const tail =
    ` FROM wall_testimonials wt JOIN testimonials t ON t.id = wt.testimonial_id
      WHERE wt.wall_id = ? AND t.status = 'approved' ORDER BY wt.position DESC LIMIT 100`;
  let results: TRow[] = [];
  try {
    const q = await env.DB.prepare(`SELECT ${baseSel}, t.reply ${tail}`).bind(wall.id).all<TRow>();
    results = q.results || [];
  } catch {
    const q = await env.DB.prepare(`SELECT ${baseSel} ${tail}`).bind(wall.id).all<TRow>();
    results = q.results || [];
  }

  const allItems = results.map((r) => ({
    rating: r.rating,
    body: r.body,
    author: r.author_label,
    verified: r.verified === 1,
    source: r.source || null,
    date: r.at ? new Date(r.at * 1000).toISOString().slice(0, 10) : null,
    photo_url: r.photo_key ? `${origin}/api/media/${r.photo_key}` : null,
    video_url: r.video_key ? `${origin}/api/media/${r.video_key}` : null,
    reply: r.reply || null,
  }));

  // 星サマリーは全件で算出し、表示枚数(count)だけ items を絞る
  const total = allItems.length;
  const avg = total ? Math.round((allItems.reduce((s, i) => s + (i.rating || 0), 0) / total) * 10) / 10 : 0;
  const items = settings.count > 0 ? allItems.slice(0, settings.count) : allItems;

  return new Response(
    JSON.stringify({
      layout: settings.layout, // 後方互換
      settings,
      name: wall.name,
      business_name: biz?.name || "",
      summary: { count: total, avg },
      branding,
      items,
    }),
    { headers: cors }
  );
};
