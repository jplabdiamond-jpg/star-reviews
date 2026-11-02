// POST /api/testimonials/import  CSV一括インポート（要ログイン）
// body: { form_id, rows: [{ author_name?, rating, body, date? }] }
// 取り込んだ声は status='approved', source='CSV' で即掲載し、デフォルト壁に追加。
import { json, badRequest, readJson, genId, nowSec } from "../../../shared/util";
import { isPaid, FREE_WALL_LIMIT } from "../../../shared/plan";
import type { Env, AppData } from "../../../shared/types";

interface Row { author_name?: string; rating?: number | string; body?: string; date?: string }

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const b = await readJson<{ form_id?: string; rows?: Row[] }>(request);
  if (!b || !Array.isArray(b.rows)) return badRequest("invalid json");
  if (b.rows.length === 0) return badRequest("取り込む行がありません");
  if (b.rows.length > 1000) return badRequest("一度に取り込めるのは1000件までです");

  // 取り込み先フォーム（自分のもの）
  const form = await env.DB.prepare("SELECT id FROM forms WHERE id = ? AND business_id = ?")
    .bind(b.form_id || "", businessId)
    .first<{ id: string }>();
  if (!form) return badRequest("取り込み先のフォームを選択してください");

  const wall = await env.DB.prepare("SELECT id FROM walls WHERE business_id = ? ORDER BY created_at LIMIT 1")
    .bind(businessId)
    .first<{ id: string }>();

  // --- プラン上限: 無料プランは掲載(承認)できる件数に上限。取込は即掲載なので残り枠まで ---
  let remaining = Infinity;
  const biz = await env.DB.prepare("SELECT plan, plan_until FROM businesses WHERE id = ?")
    .bind(businessId)
    .first<{ plan: string; plan_until: number | null }>();
  if (!isPaid(biz)) {
    const cnt = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM testimonials WHERE business_id = ? AND status = 'approved'"
    )
      .bind(businessId)
      .first<{ n: number }>();
    remaining = Math.max(0, FREE_WALL_LIMIT - (cnt?.n || 0));
    if (remaining === 0) {
      return json(
        {
          error: `無料プランで掲載できるのは${FREE_WALL_LIMIT}件までです。Starter以上にアップグレードすると無制限に取り込めます。`,
          limit_reached: true,
          limit: FREE_WALL_LIMIT,
        },
        402
      );
    }
  }

  let imported = 0;
  let skipped = 0;
  let limited = 0;
  for (const rv of b.rows) {
    if (imported >= remaining) { limited++; continue; }
    const rating = Math.min(5, Math.max(1, Math.round(Number(rv.rating) || 0)));
    const text = (rv.body || "").toString().trim();
    if (!rating || !text) { skipped++; continue; }
    const authorName = (rv.author_name || "").toString().trim() || null;
    const authorLabel = authorName || "お客様";
    let at = nowSec();
    if (rv.date) {
      const ms = Date.parse(String(rv.date));
      if (!Number.isNaN(ms)) at = Math.floor(ms / 1000);
    }
    const id = genId("tst");
    await env.DB.prepare(
      `INSERT INTO testimonials
         (id, business_id, form_id, level, rating, body, author_name, author_label, photo_key, video_key, verified, consent_display, status, submitted_at, approved_at, source)
       VALUES (?, ?, ?, 2, ?, ?, ?, ?, NULL, NULL, 1, 1, 'approved', ?, ?, 'CSV')`
    )
      .bind(id, businessId, form.id, rating, text, authorName, authorLabel, at, nowSec())
      .run();
    if (wall) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO wall_testimonials (wall_id, testimonial_id, position) VALUES (?, ?, ?)"
      ).bind(wall.id, id, nowSec()).run();
    }
    imported++;
  }

  return json({
    ok: true,
    imported,
    skipped,
    limited,
    ...(limited > 0
      ? { notice: `無料プランの掲載上限（${FREE_WALL_LIMIT}件）に達したため、${limited}件は取り込めませんでした。Starter以上で無制限になります。` }
      : {}),
  });
};
