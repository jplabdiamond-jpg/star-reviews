// POST /api/google/bp/sync {autosync}  自動同期のON/OFF（Pro・要ログイン）
import { json, readJson } from "../../../../shared/util";
import { getBpConn } from "../../../../shared/googlebp-sync";
import type { Env, AppData } from "../../../../shared/types";

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const conn = await getBpConn(env, businessId);
  if (!conn) return json({ error: "未連携です" }, 400);
  const b = await readJson<{ autosync?: boolean }>(request);
  await env.DB.prepare("UPDATE google_bp SET autosync = ? WHERE business_id = ?")
    .bind(b?.autosync ? 1 : 0, businessId)
    .run();
  return json({ ok: true, autosync: !!b?.autosync });
};
