// GET/POST /api/settings/notify  新着通知の設定（要ログイン）
// GET : 現在の設定・配信可否・LINE連携コードを返す（未連携なら連携コードを発行）
// POST: { notify_enabled?, notify_email? } を更新
import { json, readJson, genCode, nowSec } from "../../../shared/util";
import type { Env, AppData } from "../../../shared/types";

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const { businessId, email } = data.session!;
  const biz = await env.DB.prepare(
    "SELECT notify_enabled, notify_email, line_user_id, line_link_code FROM businesses WHERE id = ?"
  )
    .bind(businessId)
    .first<{ notify_enabled: number | null; notify_email: string | null; line_user_id: string | null; line_link_code: string | null }>();

  const lineConfigured = !!(env.LINE_CHANNEL_ACCESS_TOKEN && env.LINE_CHANNEL_SECRET);
  const lineLinked = !!biz?.line_user_id;

  // 未連携かつLINE設定済みなら、連携コードを用意（なければ発行）
  let linkCode = biz?.line_link_code || null;
  if (lineConfigured && !lineLinked && !linkCode) {
    linkCode = genCode("LINK").replace(/-/g, ""); // 例: LINK7FK3Q9
    await env.DB.prepare("UPDATE businesses SET line_link_code = ? WHERE id = ?").bind(linkCode, businessId).run();
  }

  return json({
    notify_enabled: biz?.notify_enabled !== 0,
    notify_email: biz?.notify_email || "",
    owner_email: email,
    email_configured: !!(env.RESEND_API_KEY && env.RESEND_FROM),
    line_configured: lineConfigured,
    line_linked: lineLinked,
    line_link_code: lineLinked ? null : linkCode,
  });
};

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const b = await readJson<{ notify_enabled?: boolean; notify_email?: string }>(request);
  if (!b) return json({ error: "invalid json" }, 400);

  const email = (b.notify_email ?? "").trim();
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: "メールアドレスの形式が正しくありません" }, 400);
  }
  const enabled = b.notify_enabled === false ? 0 : 1;
  await env.DB.prepare("UPDATE businesses SET notify_enabled = ?, notify_email = ? WHERE id = ?")
    .bind(enabled, email || null, businessId)
    .run();
  return json({ ok: true, notify_enabled: enabled === 1, notify_email: email });
};
