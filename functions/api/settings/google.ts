// GET/POST /api/settings/google  Googleクチコミ投稿URLの取得・保存（要ログイン）
// 列(0008)が未適用でも落ちないよう try/catch。
import { json, badRequest, readJson } from "../../../shared/util";
import type { Env, AppData } from "../../../shared/types";

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const { businessId } = data.session!;
  let url: string | null = null;
  let available = true;
  try {
    const row = await env.DB.prepare("SELECT google_url FROM businesses WHERE id = ?")
      .bind(businessId)
      .first<{ google_url: string | null }>();
    url = row?.google_url || null;
  } catch {
    available = false; // 列未適用
  }
  return json({ google_url: url, available });
};

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const body = await readJson<{ google_url?: string }>(request);
  let url = (body?.google_url || "").trim();
  if (url) {
    if (!/^https:\/\/\S+$/i.test(url)) return badRequest("https:// から始まるURLを入力してください");
    if (url.length > 500) return badRequest("URLが長すぎます");
  }
  try {
    await env.DB.prepare("UPDATE businesses SET google_url = ? WHERE id = ?")
      .bind(url || null, businessId)
      .run();
  } catch {
    return badRequest("この機能はまだ有効化されていません（管理者がデータベースの更新を適用してください）。", 503);
  }
  return json({ ok: true, google_url: url || null });
};
