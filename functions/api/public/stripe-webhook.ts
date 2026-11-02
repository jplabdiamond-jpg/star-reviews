// POST /api/public/stripe-webhook  Stripe Webフック受信（署名検証）
// プラン状態を businesses に反映。公開パス(/api/public/)なので認証なしで受ける。
import { verifyStripeEvent, planForPriceId, type PaidPlan } from "../../../shared/stripe";
import { sendEmailResend } from "../../../shared/notify";
import { escapeHtml } from "../../../shared/util";
import type { Env } from "../../../shared/types";

// 決済失敗(dunning)時: オーナーにカード更新を促すメールを送る。
async function notifyPaymentIssue(
  env: Env,
  bizId: string,
  opts: { payUrl: string | null; final: boolean; appUrl: string }
): Promise<void> {
  try {
    const row = await env.DB.prepare(
      `SELECT COALESCE(b.notify_email, u.email) AS to_email, b.name AS biz_name
         FROM businesses b JOIN users u ON u.id = b.owner_user_id WHERE b.id = ?`
    )
      .bind(bizId)
      .first<{ to_email: string | null; biz_name: string | null }>();
    const to = (row?.to_email || "").trim();
    if (!to) return;
    const action = opts.payUrl || opts.appUrl;
    const subject = opts.final
      ? "【star-reviews】お支払いが確認できず、プランを停止しました"
      : "【star-reviews】お支払いに失敗しました（カード情報のご確認のお願い）";
    const lead = opts.final
      ? "数回の再試行の後もお支払いを確認できなかったため、有料プランを一時停止し、無料プランに切り替えました。下のボタンからお支払い方法を更新すると、すぐに復帰できます。"
      : "月額料金のお支払いに失敗しました。カードの有効期限切れや限度額などが考えられます。下のボタンからお支払い方法をご確認ください。数日の間に自動で再試行されます。";
    const html =
      `<div style="font-family:sans-serif;line-height:1.7;color:#1c1a12">` +
      `<p>${escapeHtml(row?.biz_name || "")} のご担当者さま</p>` +
      `<p>${lead}</p>` +
      `<p style="margin:18px 0"><a href="${escapeHtml(action)}" style="display:inline-block;background:#1c1a12;color:#fff;font-weight:700;padding:12px 20px;border-radius:10px;text-decoration:none">お支払い方法を確認する →</a></p>` +
      `<p style="color:#7c7563;font-size:12px">このメールは star-reviews から自動送信されています。</p></div>`;
    await sendEmailResend(env, to, subject, html);
  } catch {
    /* 通知失敗は webhook 処理を止めない */
  }
}

// プラン/期限の変更を、同一オーナーの全店舗(business)に同期する（複数店舗でPro特典を共有）
async function syncSiblings(env: Env, bizId: string): Promise<void> {
  try {
    await env.DB.prepare(
      `UPDATE businesses
          SET plan = (SELECT plan FROM businesses WHERE id = ?1),
              plan_until = (SELECT plan_until FROM businesses WHERE id = ?1)
        WHERE owner_user_id = (SELECT owner_user_id FROM businesses WHERE id = ?1)
          AND id <> ?1`
    )
      .bind(bizId)
      .run();
  } catch {
    /* 同期失敗は致命ではない（次のイベントで整合） */
  }
}

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

    // サブスクのprice_...またはmetadata.planから購入プラン(starter/pro)を判定。不明ならpro扱い。
    function resolvePlan(): PaidPlan {
      const priceId: string | null =
        obj?.items?.data?.[0]?.price?.id || obj?.plan?.id || null;
      const fromPrice = planForPriceId(env, priceId);
      if (fromPrice) return fromPrice;
      const metaPlan = (obj?.metadata?.plan || "").toLowerCase();
      if (metaPlan === "starter" || metaPlan === "pro") return metaPlan as PaidPlan;
      return "pro";
    }

    if (type === "checkout.session.completed") {
      const bizId = await findBusinessId();
      if (bizId) {
        const customer = typeof obj.customer === "string" ? obj.customer : null;
        const sub = typeof obj.subscription === "string" ? obj.subscription : null;
        await env.DB.prepare(
          "UPDATE businesses SET plan = ?, stripe_customer_id = COALESCE(?, stripe_customer_id), stripe_subscription_id = COALESCE(?, stripe_subscription_id) WHERE id = ?"
        ).bind(resolvePlan(), customer, sub, bizId).run();
        await syncSiblings(env, bizId);
      }
    } else if (type === "customer.subscription.updated" || type === "customer.subscription.created") {
      const bizId = await findBusinessId();
      if (bizId) {
        const status: string = obj.status || "";
        const periodEnd: number | null = Number.isFinite(obj.current_period_end) ? obj.current_period_end : null;
        const active = status === "active" || status === "trialing" || status === "past_due";
        await env.DB.prepare(
          "UPDATE businesses SET plan = ?, stripe_subscription_id = COALESCE(?, stripe_subscription_id), plan_until = ? WHERE id = ?"
        ).bind(active ? resolvePlan() : "free", typeof obj.id === "string" ? obj.id : null, periodEnd, bizId).run();
        await syncSiblings(env, bizId);
      }
    } else if (type === "customer.subscription.deleted") {
      const bizId = await findBusinessId();
      if (bizId) {
        const periodEnd: number | null = Number.isFinite(obj.current_period_end) ? obj.current_period_end : null;
        await env.DB.prepare("UPDATE businesses SET plan = 'free', plan_until = ? WHERE id = ?")
          .bind(periodEnd, bizId).run();
        await syncSiblings(env, bizId);
      }
    } else if (type === "invoice.payment_failed") {
      // dunning: 決済失敗。再試行の有無で文面を変える。最終失敗の確定(= free化)は subscription.deleted 側で行う。
      const bizId = await findBusinessId();
      if (bizId) {
        const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
        const payUrl: string | null = typeof obj.hosted_invoice_url === "string" ? obj.hosted_invoice_url : null;
        const willRetry = obj.next_payment_attempt != null;
        await notifyPaymentIssue(env, bizId, { payUrl, final: !willRetry, appUrl: `${base}/app` });
      }
    } else if (type === "invoice.payment_succeeded" || type === "invoice.paid") {
      // 回復: past_due から復帰した場合にプランを有効化し直す（期間末も更新）。
      const bizId = await findBusinessId();
      if (bizId) {
        const sub = typeof obj.subscription === "string" ? obj.subscription : null;
        const periodEnd: number | null = Number.isFinite(obj.lines?.data?.[0]?.period?.end)
          ? obj.lines.data[0].period.end
          : null;
        if (sub) {
          await env.DB.prepare(
            "UPDATE businesses SET plan_until = COALESCE(?, plan_until) WHERE stripe_subscription_id = ?"
          ).bind(periodEnd, sub).run();
          const owner = await env.DB.prepare("SELECT id FROM businesses WHERE stripe_subscription_id = ? LIMIT 1")
            .bind(sub).first<{ id: string }>();
          if (owner?.id) await syncSiblings(env, owner.id);
        }
      }
    }
  } catch (e) {
    // 失敗しても200を返す（Stripeの再送でリカバリ）。ログは今は持たない。
    return new Response("handled with error", { status: 200 });
  }

  return new Response("ok", { status: 200 });
};
