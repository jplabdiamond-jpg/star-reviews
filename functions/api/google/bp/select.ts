// POST /api/google/bp/select {account,name,title}  取り込む店舗を選択（Pro・要ログイン）
import { json, badRequest, readJson } from "../../../../shared/util";
import { getBpConn } from "../../../../shared/googlebp-sync";
import type { Env, AppData } from "../../../../shared/types";

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const conn = await getBpConn(env, businessId);
  if (!conn) return json({ error: "未連携です" }, 400);
  const b = await readJson<{ account?: string; name?: string; title?: string }>(request);
  if (!b?.account || !b?.name) return badRequest("店舗を選択してください");
  await env.DB.prepare(
    "UPDATE google_bp SET account_name = ?, location_name = ?, location_title = ? WHERE business_id = ?"
  )
    .bind(b.account, b.name, (b.title || "").slice(0, 200) || null, businessId)
    .run();
  return json({ ok: true });
};
