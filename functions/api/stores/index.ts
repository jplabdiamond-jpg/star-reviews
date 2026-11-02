// GET  /api/stores   自分(アカウント=オーナー)の店舗一覧
// POST /api/stores   新しい店舗を作成（Pro限定・上限あり）。既定フォーム・壁も自動生成。
import { json, badRequest, readJson, genId, nowSec } from "../../../shared/util";
import { isPro, STORE_LIMIT_PRO } from "../../../shared/plan";
import { createDefaultFormAndWall } from "../../../shared/onboard";
import type { Env, AppData } from "../../../shared/types";

// セッションの businessId からオーナー(userId)を解決
async function ownerIdOf(env: Env, businessId: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT owner_user_id FROM businesses WHERE id = ?")
    .bind(businessId)
    .first<{ owner_user_id: string }>();
  return row?.owner_user_id || null;
}

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const { businessId } = data.session!;
  const ownerId = await ownerIdOf(env, businessId);
  if (!ownerId) return badRequest("アカウントが見つかりません", 404);

  const { results } = await env.DB.prepare(
    `SELECT b.id, b.name, b.plan, b.plan_until, b.archived,
            b.stripe_subscription_id AS sub,
            (SELECT COUNT(*) FROM testimonials t WHERE t.business_id = b.id AND t.status='approved') AS approved_count,
            (SELECT COUNT(*) FROM testimonials t WHERE t.business_id = b.id AND t.status='pending') AS pending_count
       FROM businesses b
      WHERE b.owner_user_id = ?
      ORDER BY b.created_at ASC`
  )
    .bind(ownerId)
    .all<{ id: string; name: string; plan: string; plan_until: number | null; archived: number; sub: string | null; approved_count: number; pending_count: number }>();

  const stores = (results || []).map((s) => ({
    id: s.id,
    name: s.name,
    plan: s.plan,
    archived: !!s.archived,
    has_subscription: !!s.sub,
    approved_count: s.approved_count,
    pending_count: s.pending_count,
    active: s.id === businessId,
  }));

  const activeCount = stores.filter((s) => !s.archived).length;
  // アカウントのプランは全店舗で同期済みのため、アクティブ店舗の plan で判定できる
  const active = stores.find((s) => s.active) || stores[0];
  const proAccount = isPro({ plan: active?.plan, plan_until: (results || []).find((r) => r.id === active?.id)?.plan_until });

  return json({
    stores,
    active_business_id: businessId,
    is_pro: proAccount,
    limit: STORE_LIMIT_PRO,
    can_create: proAccount && activeCount < STORE_LIMIT_PRO,
  });
};

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const body = await readJson<{ name?: string }>(request);
  const name = (body?.name || "").trim();
  if (!name) return badRequest("店舗名を入力してください");
  if (name.length > 60) return badRequest("店舗名が長すぎます");

  const ownerId = await ownerIdOf(env, businessId);
  if (!ownerId) return badRequest("アカウントが見つかりません", 404);

  // 現在の店舗（アクティブ）のプランを取得（= アカウントのプラン。全店舗同期済み）
  const parent = await env.DB.prepare("SELECT plan, plan_until FROM businesses WHERE id = ?")
    .bind(businessId)
    .first<{ plan: string; plan_until: number | null }>();
  if (!isPro(parent)) {
    return json(
      { error: "複数店舗の管理は Pro プラン限定です。Proにアップグレードすると店舗を追加できます。", plan_required: "pro" },
      402
    );
  }

  const cnt = await env.DB.prepare("SELECT COUNT(*) AS n FROM businesses WHERE owner_user_id = ? AND archived = 0")
    .bind(ownerId)
    .first<{ n: number }>();
  if ((cnt?.n || 0) >= STORE_LIMIT_PRO) {
    return json({ error: `店舗はアカウントあたり${STORE_LIMIT_PRO}店舗までです。`, limit_reached: true, limit: STORE_LIMIT_PRO }, 402);
  }

  // 新店舗は親と同じプラン/期限を引き継ぐ（Pro特典をアカウント全体で共有）
  const now = nowSec();
  const newBizId = genId("biz");
  await env.DB.prepare(
    "INSERT INTO businesses (id, owner_user_id, name, plan, plan_until, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(newBizId, ownerId, name, parent!.plan || "pro", parent!.plan_until ?? null, now)
    .run();

  await createDefaultFormAndWall(env, newBizId, name);

  return json({ ok: true, store: { id: newBizId, name } });
};
