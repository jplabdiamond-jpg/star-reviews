// POST /api/public/metric  { slug, key }  軽量ビーコン（投稿開始などの計測・認証不要）
// 現状 key は 'submit_start' のみ許可。slug から business を解決して日次加算する。
import { json, readJson, bumpMetricDaily } from "../../../shared/util";
import type { Env } from "../../../shared/types";

const ALLOWED = new Set(["submit_start"]);

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = await readJson<{ slug?: string; key?: string }>(request);
  const slug = (b?.slug || "").trim();
  const key = (b?.key || "").trim();
  if (!slug || !ALLOWED.has(key)) return json({ ok: true }); // 黙ってok（計測は壊さない）

  try {
    const form = await env.DB.prepare("SELECT business_id FROM forms WHERE slug = ?")
      .bind(slug)
      .first<{ business_id: string }>();
    if (form) await bumpMetricDaily(env.DB, form.business_id, key);
  } catch {
    /* no-op */
  }
  return json({ ok: true });
};
