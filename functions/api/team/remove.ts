// POST /api/team/remove  { user_id? , invite_id? }  メンバー削除／招待取消（オーナーのみ）
import { json, badRequest, readJson } from "../../../shared/util";
import { isOwner } from "../../../shared/access";
import type { Env, AppData } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId, userId } = data.session!;
  if (!(await isOwner(env, userId, businessId))) return badRequest("操作はオーナーのみ可能です", 403);

  const body = await readJson<{ user_id?: string; invite_id?: string }>(request);
  try {
    if (body?.user_id) {
      await env.DB.prepare("DELETE FROM business_members WHERE business_id = ? AND user_id = ?")
        .bind(businessId, body.user_id).run();
      return json({ ok: true });
    }
    if (body?.invite_id) {
      await env.DB.prepare("DELETE FROM business_invites WHERE business_id = ? AND id = ?")
        .bind(businessId, body.invite_id).run();
      return json({ ok: true });
    }
  } catch {
    return badRequest("この機能はまだ有効化されていません。", 503);
  }
  return badRequest("対象が指定されていません");
};
