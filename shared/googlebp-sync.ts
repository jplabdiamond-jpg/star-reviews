// Google Business Profile のレビューを取り込む共通処理（手動取り込み・自動同期の両方で使用）。
import { genId, nowSec } from "./util";
import { decToken, refreshAccessToken, listReviews } from "./googlebp";
import type { Env } from "./types";

export interface BpConn {
  business_id: string;
  account_name: string | null;
  location_name: string | null;
  location_title: string | null;
  refresh_token: string;
  autosync: number;
  last_sync_at: number | null;
}

export async function getBpConn(env: Env, businessId: string): Promise<BpConn | null> {
  try {
    return await env.DB.prepare("SELECT * FROM google_bp WHERE business_id = ?")
      .bind(businessId)
      .first<BpConn>();
  } catch {
    return null; // テーブル未適用
  }
}

// 連携済み店舗のGoogleレビューを取り込む。返り値は取り込んだ新規件数。
// location 未選択・未連携・テーブル未適用なら 0 を返す（例外は投げない設計の呼び出し側もあるため throwOnError で制御）。
export async function importBpReviews(
  env: Env,
  businessId: string,
  opts: { throwOnError?: boolean; maxPages?: number } = {}
): Promise<{ imported: number; total: number }> {
  const conn = await getBpConn(env, businessId);
  if (!conn || !conn.account_name || !conn.location_name) return { imported: 0, total: 0 };

  let reviews;
  try {
    const refresh = await decToken(env, conn.refresh_token);
    const access = await refreshAccessToken(env, refresh);
    reviews = await listReviews(access, conn.account_name, conn.location_name, opts.maxPages ?? 20);
  } catch (e) {
    if (opts.throwOnError) throw e;
    return { imported: 0, total: 0 };
  }

  // 取り込み先フォーム（最古）と壁（最古）
  const form = await env.DB.prepare(
    "SELECT id FROM forms WHERE business_id = ? ORDER BY created_at LIMIT 1"
  )
    .bind(businessId)
    .first<{ id: string }>();
  const wall = await env.DB.prepare(
    "SELECT id FROM walls WHERE business_id = ? ORDER BY created_at LIMIT 1"
  )
    .bind(businessId)
    .first<{ id: string }>();
  if (!form) return { imported: 0, total: reviews.length };

  let imported = 0;
  for (const rv of reviews) {
    if (!rv.rating || !rv.comment) continue;
    // 重複チェック（business+source+ext_id）
    const dup = await env.DB.prepare(
      "SELECT id FROM testimonials WHERE business_id = ? AND source = 'Google' AND ext_id = ?"
    )
      .bind(businessId, rv.reviewId)
      .first<{ id: string }>();
    if (dup) continue;

    const id = genId("tst");
    const authorLabel = rv.author || "Googleのお客様";
    const at = Math.floor(rv.createMs / 1000) || nowSec();
    await env.DB.prepare(
      `INSERT INTO testimonials
         (id, business_id, form_id, level, rating, body, author_name, author_label, photo_key, video_key, verified, consent_display, status, submitted_at, approved_at, source, ext_id)
       VALUES (?, ?, ?, 2, ?, ?, ?, ?, NULL, NULL, 1, 1, 'approved', ?, ?, 'Google', ?)`
    )
      .bind(id, businessId, form.id, rv.rating, rv.comment, rv.author, authorLabel, at, nowSec(), rv.reviewId)
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

  try {
    await env.DB.prepare("UPDATE google_bp SET last_sync_at = ? WHERE business_id = ?")
      .bind(nowSec(), businessId)
      .run();
  } catch {
    /* noop */
  }
  return { imported, total: reviews.length };
}
