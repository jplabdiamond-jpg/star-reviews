// 新規店舗(business)の初期セットアップ共通ロジック。
// 既定の投稿フォームとレビューページを1つずつ作成し、すぐ使える状態にする。
import { genId, nowSec, slugify } from "./util";
import type { Env } from "./types";

export async function createDefaultFormAndWall(env: Env, businessId: string, storeName?: string): Promise<{ formId: string; slug: string }> {
  const now = nowSec();
  const formId = genId("frm");
  const title = (storeName && storeName.trim()) ? `${storeName.trim()} のお客様の声` : "お客様の声";
  const slug = slugify(title);

  await env.DB.prepare(
    `INSERT INTO forms (id, business_id, slug, title, intro, thanks_message, levels_enabled, require_verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, '1,2', 0, ?)`
  )
    .bind(formId, businessId, slug, title, null, "ありがとうございました！", now)
    .run();

  // 事業者にまだ壁がなければ既定の壁を作成
  const hasWall = await env.DB.prepare("SELECT id FROM walls WHERE business_id = ? LIMIT 1").bind(businessId).first();
  if (!hasWall) {
    await env.DB.prepare(
      "INSERT INTO walls (id, business_id, name, layout, embed_token, created_at) VALUES (?, ?, ?, 'grid', ?, ?)"
    )
      .bind(genId("wal"), businessId, "レビューページ", genId("pub"), now)
      .run();
  }

  return { formId, slug };
}
