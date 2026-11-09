// POST /api/google/bp/disconnect  連携解除（Pro・要ログイン）。取り込み済みの声は残す。
import { json } from "../../../../shared/util";
import type { Env, AppData } from "../../../../shared/types";

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const { businessId } = data.session!;
  try {
    await env.DB.prepare("DELETE FROM google_bp WHERE business_id = ?").bind(businessId).run();
  } catch {
    /* noop */
  }
  return json({ ok: true });
};
