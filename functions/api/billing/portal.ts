// POST /api/billing/portal  Stripe カスタマーポータル（プラン変更・解約）セッションを作成（要ログイン）
// 返却: { url }。Stripe顧客が未作成なら 400。
import { json } from "../../../shared/util";
import { stripeFetch } from "../../../shared/stripe";
import type { Env, AppData } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;

  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "課金はまだ設定されていません。", setup_required: true }, 400);
  }

  const biz = await env.DB.prepare("SELECT stripe_customer_id FROM businesses WHERE id = ?")
    .bind(businessId)
    .first<{ stripe_customer_id: string | null }>();
  if (!biz?.stripe_customer_id) {
    return json({ error: "ご契約情報が見つかりません。まずアップグレードしてください。" }, 400);
  }

  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  const r = await stripeFetch(env.STRIPE_SECRET_KEY, "billing_portal/sessions", {
    customer: biz.stripe_customer_id,
    return_url: `${base}/app`,
  });
  if (!r.ok || !r.data?.url) {
    return json({ error: "ポータルの作成に失敗しました", detail: r.data?.error?.message || null }, 502);
  }
  return json({ url: r.data.url });
};
