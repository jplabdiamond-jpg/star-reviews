// POST /api/google/bp/import  選択店舗のGoogleレビューを全件取り込む（Pro・要ログイン）
import { json } from "../../../../shared/util";
import { isPro } from "../../../../shared/plan";
import { importBpReviews, getBpConn } from "../../../../shared/googlebp-sync";
import type { Env, AppData } from "../../../../shared/types";

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const { businessId } = data.session!;
  const plan = await env.DB.prepare("SELECT plan, plan_until FROM businesses WHERE id = ?")
    .bind(businessId)
    .first<{ plan: string; plan_until: number | null }>();
  if (!isPro(plan)) return json({ error: "Google連携は Pro プラン限定です", plan_required: "pro" }, 402);

  const conn = await getBpConn(env, businessId);
  if (!conn || !conn.location_name) return json({ error: "取り込む店舗を選択してください" }, 400);
  try {
    const r = await importBpReviews(env, businessId, { throwOnError: true, maxPages: 40 });
    return json({ ok: true, imported: r.imported, total: r.total });
  } catch (e) {
    return json({ error: "取り込みに失敗しました。Googleのレビュー取得権限（v4 API承認）をご確認ください。", detail: String(e).slice(0, 160) }, 502);
  }
};
