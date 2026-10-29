// POST /api/public/stripe-webhook  Stripe Webフック受信（署名検証）
// プラン状態を businesses に反映。公開パス(/api/public/)なので認証なしで受ける。
import { verifyStripeEvent } from "../../../shared/stripe";
import type { Env } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    // 未設定時は 200 を返して Stripe 側の再送ループを避ける（何もしない）
    return new Response("billing not configured", { status: 200 });
  }

  const raw = await request.text();
  const sig = request.headers.get("stripe-signature");
  const event = await verifyStripeEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!event) return new Response("invalid signature", { status: 400 });

  try {
    const obj = event.data?.object || {};
    const type: string = event.type || "";

    // 対象事業者の特定: metadata.business_id → client_reference_id → 顧客/サブスクID
    const bizIdFromMeta: string | null =
      obj?.metadata?.business_id || obj?.client_reference_id || null;

    async function findBusinessId(): Promise<string | null> {
      if (bizIdFromMeta) return bizIdFromMeta;
      const customer: string | null = typeof obj.customer === "string" ? obj.customer : null;
      const subId: string | null = typeof obj.id === "string" && obj.object === "subscription" ? obj.id : null;
      if (customer) {
        const row = await env.DB.prepare("SELECT id FROM businesses WHERE stripe_customer_id = ? LIMIT 1")
          .bind(customer).first<{ id: string }>();
        if (row) return row.id;
      }
      if (subId) {
        const row = await env.DB.prepare("SELECT id FROM businesses WHERE stripe_subscription_id = ? LIMIT 1")
          .bind(subId).first<{ id: string }>();
        if (row) return row.id;
      }
      return null;
    }

    if (type === "checkout.session.completed") {
      const bizId = await findBusinessId();
      if (bizId) {
        const customer = typeof obj.customer === "string" ? obj.customer : null;
        const sub = typeof obj.subscription === "string" ? obj.subscription : null;
        await env.DB.prepare(
          "UPDATE businesses SET plan = 'pro', stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = COALESCE(?, stripe_subscription_id) WHERE id = ?"
        ).bind(customer, sub, bizId).run();
      }
    } else if (type === "customer.subscription.updated" || type === "customer.subscription.created") {
      const bizId = await findBusinessId();
      if (bizId) {
        const status: string = obj.status || "";
        const periodEnd: number | null = Number.isFinite(obj.current_period_end) ? obj.current_period_end : null;
        const active = status === "active" || status === "trialing" || status === "past_due";
        await env.DB.prepare(
          "UPDATE businesses SET plan = ?, stripe_subscription_id = COALESCE(?, stripe_subscription_id), plan_until = ? WHERE id = ?"
        ).bind(active ? "pro" : "free", typeof obj.id === "string" ? obj.id : null, periodEnd, bizId).run();
      }
    } else if (type === "customer.subscription.deleted") {
      const bizId = await findBusinessId();
      if (bizId) {
        const periodEnd: number | null = Number.isFinite(obj.current_period_end) ? obj.current_period_end : null;
        await env.DB.prepare("UPDATE businesses SET plan = 'free', plan_until = ? WHERE id = ?")
          .bind(periodEnd, bizId).run();
      }
    }
  } catch (e) {
    // 失敗しても200を返す（Stripeの再送でリカバリ）。ログは今は持たない。
    return new Response("handled with error", { status: 200 });
  }

  return new Response("ok", { status: 200 });
};
