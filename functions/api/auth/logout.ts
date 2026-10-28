// POST /api/auth/logout
import { destroySession, clearCookie } from "../../../shared/auth";
import { json } from "../../../shared/util";
import type { Env } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  await destroySession(request, env);
  return json({ ok: true }, 200, { "set-cookie": clearCookie() });
};
