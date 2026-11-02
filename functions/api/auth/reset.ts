// POST /api/auth/reset  { token, password }  トークン検証→パスワード更新
import { json, badRequest, readJson } from "../../../shared/util";
import { hashPassword } from "../../../shared/auth";
import type { Env } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const b = await readJson<{ token?: string; password?: string }>(request);
  const token = (b?.token || "").trim();
  const password = b?.password || "";
  if (!token) return badRequest("リンクが無効です");
  if (password.length < 8) return badRequest("パスワードは8文字以上にしてください");

  const key = `pwreset:${token}`;
  const raw = await env.SESSIONS.get(key);
  if (!raw) return badRequest("リンクが無効か、有効期限が切れています。もう一度お試しください。");
  let userId = "";
  try { userId = (JSON.parse(raw) as { userId: string }).userId; } catch { /* noop */ }
  if (!userId) return badRequest("リンクが無効です");

  const pwHash = await hashPassword(password);
  await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?").bind(pwHash, userId).run();
  await env.SESSIONS.delete(key); // 使い捨て
  return json({ ok: true });
};
