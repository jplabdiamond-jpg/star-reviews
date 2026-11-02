// PATCH /api/stores/:id   { name?, archived? }  店舗の改名・アーカイブ（要ログイン・所有権）
import { json, badRequest, readJson } from "../../../shared/util";
import type { Env, AppData } from "../../../shared/types";

export const onRequestPatch: PagesFunction<Env, string, AppData> = async ({ request, env, params, data }) => {
  const { userId } = data.session!;
  const id = String(params.id);
  const body = await readJson<{ name?: string; archived?: boolean }>(request);
  if (!body) return badRequest("invalid json");

  const biz = await env.DB.prepare(
    "SELECT id, owner_user_id, stripe_subscription_id FROM businesses WHERE id = ?"
  )
    .bind(id)
    .first<{ id: string; owner_user_id: string; stripe_subscription_id: string | null }>();
  if (!biz || biz.owner_user_id !== userId) return badRequest("店舗が見つかりません", 404);

  // 改名
  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (!name) return badRequest("店舗名を入力してください");
    if (name.length > 60) return badRequest("店舗名が長すぎます");
    await env.DB.prepare("UPDATE businesses SET name = ? WHERE id = ?").bind(name, id).run();
  }

  // アーカイブ / 復帰
  if (typeof body.archived === "boolean") {
    if (body.archived) {
      // 契約を持つ店舗（親）はアーカイブ不可
      if (biz.stripe_subscription_id) {
        return badRequest("この店舗はご契約が紐づいているためアーカイブできません。先にプランを管理してください。");
      }
      // 最後の1店舗はアーカイブ不可
      const left = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM businesses WHERE owner_user_id = ? AND archived = 0"
      )
        .bind(userId)
        .first<{ n: number }>();
      if ((left?.n || 0) <= 1) return badRequest("最後の店舗はアーカイブできません。");
    }
    await env.DB.prepare("UPDATE businesses SET archived = ? WHERE id = ?").bind(body.archived ? 1 : 0, id).run();
  }

  return json({ ok: true });
};
