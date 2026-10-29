// GET /api/auth/me  現在ログイン中の事業者情報
import { getSession } from "../../../shared/auth";
import { json } from "../../../shared/util";
import type { Env } from "../../../shared/types";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session) return json({ authenticated: false }, 200);
  const biz = await env.DB.prepare(
    "SELECT id, name, plan, plan_until, stripe_subscription_id FROM businesses WHERE id = ?"
  )
    .bind(session.businessId)
    .first<{ id: string; name: string; plan: string; plan_until: number | null; stripe_subscription_id: string | null }>();
  const business = biz
    ? { id: biz.id, name: biz.name, plan: biz.plan, plan_until: biz.plan_until, has_subscription: !!biz.stripe_subscription_id }
    : null;
  return json({
    authenticated: true,
    email: session.email,
    business,
    billing_enabled: !!env.STRIPE_SECRET_KEY, // Stripe設定済みか（UI出し分け用）
  });
};
