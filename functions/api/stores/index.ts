// GET  /api/stores   自分(アカウント=オーナー)の店舗一覧
// POST /api/stores   新しい店舗を作成（Pro限定・上限あり）。既定フォーム・壁も自動生成。
import { json, badRequest, readJson, genId, nowSec } from "../../../shared/util";
import { isPro, STORE_LIMIT_PRO } from "../../../shared/plan";
import { createDefaultFormAndWall } from "../../../shared/onboard";
import { memberBusinessIds } from "../../../shared/access";
import type { Env, AppData } from "../../../shared/types";

type Row = { id: string; name: string; plan: string; plan_until: number | null; archived: number; owner_user_id: string; sub: string | null; approved_count: number; pending_count: number };

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const { businessId, userId } = data.session!;

  // 自分がオーナーの店舗 ＋ メンバー参加している店舗
  const memberIds = await memberBusinessIds(env, userId);
  const ids = new Set<string>(memberIds);
  const selectCols =
    `b.id, b.name, b.plan, b.plan_until, b.archived, b.owner_user_id, b.stripe_subscription_id AS sub,
     (SELECT COUNT(*) FROM testimonials t WHERE t.business_id = b.id AND t.status='approved') AS approved_count,
     (SELECT COUNT(*) FROM testimonials t WHERE t.business_id = b.id AND t.status='pending') AS pending_count`;

  const owned = await env.DB.prepare(`SELECT ${selectCols} FROM businesses b WHERE b.owner_user_id = ? ORDER BY b.created_at ASC`)
    .bind(userId)
    .all<Row>();
  const ownedRows = owned.results || [];
  ownedRows.forEach((r) => ids.delete(r.id)); // オーナー分はメンバー集合から除外

  let memberRows: Row[] = [];
  if (ids.size > 0) {
    const arr = [...ids];
    const ph = arr.map(() => "?").join(",");
    const m = await env.DB.prepare(`SELECT ${selectCols} FROM businesses b WHERE b.id IN (${ph}) ORDER BY b.created_at ASC`)
      .bind(...arr)
      .all<Row>();
    memberRows = m.results || [];
  }

  const all = [...ownedRows, ...memberRows];
  const stores = all.map((s) => ({
    id: s.id,
    name: s.name,
    plan: s.plan,
    archived: !!s.archived,
    has_subscription: !!s.sub,
    approved_count: s.approved_count,
    pending_count: s.pending_count,
    active: s.id === businessId,
    role: s.owner_user_id === userId ? "owner" : "member",
  }));

  const ownedActiveCount = ownedRows.filter((s) => !s.archived).length;
  const active = all.find((s) => s.id === businessId) || all[0];
  const proAccount = isPro({ plan: active?.plan, plan_until: active?.plan_until });
  const activeIsOwned = !!active && active.owner_user_id === userId;

  return json({
    stores,
    active_business_id: businessId,
    active_role: active ? (active.owner_user_id === userId ? "owner" : "member") : null,
    is_pro: proAccount,
    limit: STORE_LIMIT_PRO,
    // 店舗追加は自分がオーナーの Pro アカウントのみ
    can_create: proAccount && activeIsOwned && ownedActiveCount < STORE_LIMIT_PRO,
  });
};

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId, userId } = data.session!;
  const body = await readJson<{ name?: string }>(request);
  const name = (body?.name || "").trim();
  if (!name) return badRequest("店舗名を入力してください");
  if (name.length > 60) return badRequest("店舗名が長すぎます");

  const ownerId = userId; // 店舗は自分のアカウントに作成する

  // アクティブ店舗が自分のものか確認（メンバーとして他人の店舗を見ている時は追加不可）
  const parent = await env.DB.prepare("SELECT plan, plan_until, owner_user_id FROM businesses WHERE id = ?")
    .bind(businessId)
    .first<{ plan: string; plan_until: number | null; owner_user_id: string }>();
  if (!parent || parent.owner_user_id !== userId) {
    return badRequest("店舗の追加は、自分がオーナーの店舗を表示しているときに行えます。", 403);
  }
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
