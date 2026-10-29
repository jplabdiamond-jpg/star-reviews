// POST /api/billing/checkout  Stripe Checkout セッションを作成（事業者・要ログイン）
// 返却: { url } … そのURLへリダイレクトすると決済画面。未設定なら setup_required。
import { json } from "../../../shared/util";
import { stripeFetch } from "../../../shared/stripe";
import type { Env, AppData } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId, email } = data.session!;

  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
    return json(
      { error: "課金はまだ設定されていません。管理者がStripeを登録すると有効になります。", setup_required: true },
      400
    );
  }

  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");

  const biz = await env.DB.prepare("SELECT stripe_customer_id FROM businesses WHERE id = ?")
    .bind(businessId)
    .first<{ stripe_customer_id: string | null }>();

  const body: Record<string, string | number | undefined> = {
    mode: "subscription",
    "line_items[0][price]": env.STRIPE_PRICE_ID,
    "line_items[0][quantity]": 1,
    success_url: `${base}/app?billing=success`,
    cancel_url: `${base}/app?billing=cancel`,
    client_reference_id: businessId,
    "metadata[business_id]": businessId,
    "subscription_data[metadata][business_id]": businessId,
    allow_promotion_codes: "true",
  };
  // 既存のStripe顧客があれば再利用。なければメールで作成。
  if (biz?.stripe_customer_id) body["customer"] = biz.stripe_customer_id;
  else if (email) body["customer_email"] = email;

  const r = await stripeFetch(env.STRIPE_SECRET_KEY, "checkout/sessions", body);
  if (!r.ok || !r.data?.url) {
    return json({ error: "決済セッションの作成に失敗しました", detail: r.data?.error?.message || null }, 502);
  }
  return json({ url: r.data.url });
};
