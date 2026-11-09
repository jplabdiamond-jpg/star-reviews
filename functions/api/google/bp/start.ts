// GET /api/google/bp/start  Googleオーナー連携を開始（Pro・要ログイン）→ 認可画面へリダイレクト
import { json } from "../../../../shared/util";
import { isPro } from "../../../../shared/plan";
import { bpEnabled, buildBpAuthorizeUrl, bpRedirectUri } from "../../../../shared/googlebp";
import type { Env, AppData } from "../../../../shared/types";

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  if (!bpEnabled(env)) return json({ error: "Google連携は未設定です", setup_required: true }, 400);
  const plan = await env.DB.prepare("SELECT plan, plan_until FROM businesses WHERE id = ?")
    .bind(businessId)
    .first<{ plan: string; plan_until: number | null }>();
  if (!isPro(plan)) return json({ error: "Google連携は Pro プラン限定です", plan_required: "pro" }, 402);

  const origin = new URL(request.url).origin;
  const state = crypto.randomUUID().replace(/-/g, "");
  await env.SESSIONS.put(`bpstate:${state}`, JSON.stringify({ businessId }), { expirationTtl: 600 });
  const url = buildBpAuthorizeUrl(env, bpRedirectUri(env, origin), state);
  return new Response(null, { status: 302, headers: { location: url } });
};
