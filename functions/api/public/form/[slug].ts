// GET /api/public/form/:slug   投稿ページ用の公開フォーム設定（認証不要）
import { json, badRequest, bumpMetric, bumpMetricDaily } from "../../../../shared/util";
import type { Env } from "../../../../shared/types";

const LEVEL_LABEL: Record<number, string> = {
  1: "星＋ひとこと（匿名でOK）",
  2: "＋お名前・写真",
  3: "＋顔出し動画",
};

function rewardText(type: string, value: string): string {
  if (type === "amount") return `${value}円分の特典`;
  if (type === "percent") return `${value}%OFF`;
  if (type === "code") return `特典コード：${value}`;
  return value;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const slug = String(params.slug);
  const form = await env.DB.prepare(
    "SELECT id, business_id, title, intro, thanks_message, levels_enabled FROM forms WHERE slug = ?"
  )
    .bind(slug)
    .first<{ id: string; business_id: string; title: string; intro: string; thanks_message: string; levels_enabled: string }>();
  if (!form) return badRequest("フォームが見つかりません", 404);

  // フォーム閲覧数カウント（ベストエフォート）
  await bumpMetric(env.DB, `form_view:${form.id}`);
  await bumpMetricDaily(env.DB, form.business_id, "form_view");

  const biz = await env.DB.prepare("SELECT name FROM businesses WHERE id = ?")
    .bind(form.business_id)
    .first<{ name: string }>();
  // google_url は 0008 未適用でも落とさない（別クエリ＋try/catch）
  let googleUrl: string | null = null;
  try {
    const g = await env.DB.prepare("SELECT google_url FROM businesses WHERE id = ?")
      .bind(form.business_id)
      .first<{ google_url: string | null }>();
    googleUrl = g?.google_url || null;
  } catch {
    /* 列未適用 */
  }

  // SNSシェア用: 事業者のレビューページURL（slug優先）
  const wall = await env.DB.prepare("SELECT slug, embed_token FROM walls WHERE business_id = ? ORDER BY created_at LIMIT 1")
    .bind(form.business_id)
    .first<{ slug: string | null; embed_token: string }>();
  const origin = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  const wallUrl = wall ? `${origin}/wall/${wall.slug || wall.embed_token}` : null;

  const levels = form.levels_enabled.split(",").map((n) => parseInt(n, 10)).filter(Boolean);

  const { results: rules } = await env.DB.prepare(
    "SELECT level, reward_type, reward_value FROM reward_rules WHERE form_id = ? AND active = 1"
  )
    .bind(form.id)
    .all<{ level: number; reward_type: string; reward_value: string }>();

  const rewards: Record<number, string> = {};
  for (const r of rules) rewards[r.level] = rewardText(r.reward_type, r.reward_value);

  return json({
    id: form.id,
    title: form.title,
    intro: form.intro,
    thanks_message: form.thanks_message,
    business_name: biz?.name || "",
    google_url: googleUrl,
    wall_url: wallUrl,
    levels: levels.map((lv) => ({ level: lv, label: LEVEL_LABEL[lv] || `レベル${lv}`, reward: rewards[lv] || null })),
  });
};
