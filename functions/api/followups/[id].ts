// PATCH /api/followups/:id  { action: "cancel" }  予約済み(pending)のフォローアップを取消
import { json, badRequest, readJson } from "../../../shared/util";
import type { Env, AppData } from "../../../shared/types";

export const onRequestPatch: PagesFunction<Env, string, AppData> = async ({ request, env, params, data }) => {
  const { businessId } = data.session!;
  const id = String(params.id);
  const body = await readJson<{ action?: string }>(request);
  if (body?.action !== "cancel") return badRequest("action は cancel のみ");

  const row = await env.DB.prepare("SELECT business_id, status FROM followups WHERE id = ?")
    .bind(id)
    .first<{ business_id: string; status: string }>();
  if (!row || row.business_id !== businessId) return badRequest("not found", 404);
  if (row.status !== "pending") return badRequest("すでに送信済み、または取消済みです");

  await env.DB.prepare("UPDATE followups SET status='canceled' WHERE id = ?").bind(id).run();
  return json({ ok: true });
};
