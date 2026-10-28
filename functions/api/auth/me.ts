// GET /api/auth/me  現在ログイン中の事業者情報
import { getSession } from "../../../shared/auth";
import { json } from "../../../shared/util";
import type { Env } from "../../../shared/types";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const session = await getSession(request, env);
  if (!session) return json({ authenticated: false }, 200);
  const biz = await env.DB.prepare("SELECT id, name, plan FROM businesses WHERE id = ?")
    .bind(session.businessId)
    .first<{ id: string; name: string; plan: string }>();
  return json({ authenticated: true, email: session.email, business: biz });
};
