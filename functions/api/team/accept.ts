// POST /api/team/accept  { token }  招待を受けてメンバーに加わる（要ログイン）
import { json, badRequest, readJson, nowSec } from "../../../shared/util";
import type { Env, AppData } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { userId } = data.session!;
  const body = await readJson<{ token?: string }>(request);
  const token = (body?.token || "").trim();
  if (!token) return badRequest("招待トークンがありません");

  let inv: { id: string; business_id: string } | null = null;
  try {
    inv = await env.DB.prepare("SELECT id, business_id FROM business_invites WHERE token = ? AND accepted_at IS NULL")
      .bind(token)
      .first<{ id: string; business_id: string }>();
  } catch {
    return badRequest("この機能はまだ有効化されていません。", 503);
  }
  if (!inv) return badRequest("招待が無効か、すでに使用済みです。", 400);

  // オーナー本人なら不要
  const owner = await env.DB.prepare("SELECT 1 AS x FROM businesses WHERE id = ? AND owner_user_id = ?")
    .bind(inv.business_id, userId)
    .first<{ x: number }>();

  const now = nowSec();
  if (!owner) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO business_members (business_id, user_id, role, created_at) VALUES (?, ?, 'member', ?)"
    ).bind(inv.business_id, userId, now).run();
  }
  await env.DB.prepare("UPDATE business_invites SET accepted_at = ? WHERE id = ?").bind(now, inv.id).run();

  const biz = await env.DB.prepare("SELECT name FROM businesses WHERE id = ?").bind(inv.business_id).first<{ name: string }>();
  return json({ ok: true, business_id: inv.business_id, name: biz?.name || "" });
};
