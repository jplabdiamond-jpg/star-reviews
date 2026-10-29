// POST /api/google/import   Googleの口コミを取り込む（事業者・要ログイン）
// body: { place: "ChIJ... (Place ID) または Google Maps のURL", form_id }
//
// 有効化には環境変数 GOOGLE_MAPS_API_KEY（Google Maps Platform / Places API のキー）が必要。
// 未設定なら「設定が必要」を返す（UI側で案内を表示）。
// 注意: Places API(New) の Place Details は最も関連する最大5件のレビューのみ返す。
//       全件取り込みには Business Profile API（オーナーOAuth）が別途必要。
import { json, badRequest, genId, nowSec } from "../../../shared/util";
import type { Env, AppData } from "../../../shared/types";

function extractPlaceId(input: string): string | null {
  const s = (input || "").trim();
  if (!s) return null;
  // そのままPlace ID（ChIJ... など）
  if (/^[A-Za-z0-9_-]{20,}$/.test(s) && !s.includes("/")) return s;
  // URLに place_id= が含まれる場合
  const m = s.match(/place_id[=:]([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  // それ以外（短縮URL・店名URL）はこのMVPでは未対応
  return null;
}

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;

  if (!env.GOOGLE_MAPS_API_KEY) {
    return json(
      {
        error: "Google連携はまだ設定されていません。管理者がGoogle Places APIキーを登録すると有効になります。",
        setup_required: true,
      },
      400
    );
  }

  const b = await (async () => {
    try { return (await request.json()) as { place?: string; form_id?: string }; } catch { return null; }
  })();
  if (!b) return badRequest("invalid json");

  const placeId = extractPlaceId(b.place || "");
  if (!placeId) return badRequest("Place ID か place_id を含むURLを入力してください");

  // 取り込み先フォーム（自分のもの）
  const form = await env.DB.prepare("SELECT id FROM forms WHERE id = ? AND business_id = ?")
    .bind(b.form_id || "", businessId)
    .first<{ id: string }>();
  if (!form) return badRequest("取り込み先のフォームを選択してください");

  // Places API (New): Place Details で reviews を取得
  let reviews: Array<{ rating?: number; text?: { text?: string }; authorAttribution?: { displayName?: string }; publishTime?: string }> = [];
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "reviews,displayName",
      },
    });
    if (!res.ok) {
      const t = await res.text();
      return json({ error: `Google APIエラー（${res.status}）`, detail: t.slice(0, 200) }, 502);
    }
    const j = (await res.json()) as { reviews?: typeof reviews };
    reviews = j.reviews || [];
  } catch (e) {
    return json({ error: "Googleへの接続に失敗しました" }, 502);
  }

  if (!reviews.length) return json({ ok: true, imported: 0, message: "取り込めるレビューがありませんでした" });

  // 壁を取得
  const wall = await env.DB.prepare("SELECT id FROM walls WHERE business_id = ? ORDER BY created_at LIMIT 1")
    .bind(businessId)
    .first<{ id: string }>();

  let imported = 0;
  for (const rv of reviews.slice(0, 5)) {
    const rating = Math.min(5, Math.max(1, Number(rv.rating) || 0));
    const text = (rv.text?.text || "").trim();
    if (!rating || !text) continue;
    const authorName = (rv.authorAttribution?.displayName || "").trim() || null;
    const authorLabel = authorName || "Googleのお客様";
    let at = nowSec();
    if (rv.publishTime) {
      const ms = Date.parse(rv.publishTime);
      if (!Number.isNaN(ms)) at = Math.floor(ms / 1000);
    }
    const id = genId("tst");
    await env.DB.prepare(
      `INSERT INTO testimonials
         (id, business_id, form_id, level, rating, body, author_name, author_label, photo_key, video_key, verified, consent_display, status, submitted_at, approved_at, source)
       VALUES (?, ?, ?, 2, ?, ?, ?, ?, NULL, NULL, 1, 1, 'approved', ?, ?, 'Google')`
    )
      .bind(id, businessId, form.id, rating, text, authorName, authorLabel, at, nowSec())
      .run();
    if (wall) {
      await env.DB.prepare(
        "INSERT OR IGNORE INTO wall_testimonials (wall_id, testimonial_id, position) VALUES (?, ?, ?)"
      )
        .bind(wall.id, id, nowSec())
        .run();
    }
    imported++;
  }

  return json({ ok: true, imported });
};
