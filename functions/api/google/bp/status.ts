// GET /api/google/bp/status  連携状態（Pro・要ログイン）
import { json } from "../../../../shared/util";
import { isPro } from "../../../../shared/plan";
import { bpEnabled } from "../../../../shared/googlebp";
import { getBpConn } from "../../../../shared/googlebp-sync";
import type { Env, AppData } from "../../../../shared/types";

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const { businessId } = data.session!;
  const plan = await env.DB.prepare("SELECT plan, plan_until FROM businesses WHERE id = ?")
    .bind(businessId)
    .first<{ plan: string; plan_until: number | null }>();
  const pro = isPro(plan);
  const setup = !bpEnabled(env);
  const conn = pro ? await getBpConn(env, businessId) : null;
  return json({
    pro,
    setup_required: setup,
    connected: !!conn,
    location_selected: !!(conn && conn.location_name),
    location_title: conn?.location_title || null,
    autosync: !!(conn && conn.autosync),
    last_sync_at: conn?.last_sync_at || null,
  });
};
