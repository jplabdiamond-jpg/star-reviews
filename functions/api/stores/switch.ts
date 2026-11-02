// POST /api/stores/switch  { businessId }  アクティブ店舗を切り替える
import { json, badRequest, readJson } from "../../../shared/util";
import { setActiveBusiness } from "../../../shared/auth";
import type { Env, AppData } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId, userId } = data.session!;
  const body = await readJson<{ businessId?: string }>(request);
  const target = (body?.businessId || "").trim();
  if (!target) return badRequest("店舗を指定してください");
  if (target === businessId) return json({ ok: true, business_id: businessId });

  // 所有権の確認（自分の店舗のみ切替可）
  const owned = await env.DB.prepare("SELECT id FROM businesses WHERE id = ? AND owner_user_id = ?")
    .bind(target, userId)
    .first<{ id: string }>();
  if (!owned) return badRequest("その店舗は見つかりません", 404);

  const ok = await setActiveBusiness(request, env, target);
  if (!ok) return badRequest("切り替えに失敗しました。再度ログインしてください。", 401);
  return json({ ok: true, business_id: target });
};
