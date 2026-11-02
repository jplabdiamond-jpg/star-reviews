// GET  /api/team   現在の店舗のメンバー＋保留中の招待（オーナーのみ招待情報まで見える）
// POST /api/team   メンバーをメールで招待（オーナーのみ）  body: { email }
import { json, badRequest, readJson, genId, nowSec, escapeHtml } from "../../../shared/util";
import { isOwner } from "../../../shared/access";
import { sendEmailResend } from "../../../shared/notify";
import type { Env, AppData } from "../../../shared/types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const { businessId, userId } = data.session!;
  const owner = await isOwner(env, userId, businessId);

  const bizOwner = await env.DB.prepare(
    `SELECT u.id, u.email FROM businesses b JOIN users u ON u.id = b.owner_user_id WHERE b.id = ?`
  ).bind(businessId).first<{ id: string; email: string }>();

  const members: Array<{ user_id: string; email: string; role: string }> = [];
  if (bizOwner) members.push({ user_id: bizOwner.id, email: bizOwner.email, role: "owner" });
  try {
    const { results } = await env.DB.prepare(
      `SELECT m.user_id, u.email FROM business_members m JOIN users u ON u.id = m.user_id WHERE m.business_id = ? ORDER BY m.created_at`
    ).bind(businessId).all<{ user_id: string; email: string }>();
    for (const r of results || []) members.push({ user_id: r.user_id, email: r.email, role: "member" });
  } catch { /* 未適用 */ }

  let invites: Array<{ id: string; email: string; created_at: number }> = [];
  if (owner) {
    try {
      const { results } = await env.DB.prepare(
        `SELECT id, email, created_at FROM business_invites WHERE business_id = ? AND accepted_at IS NULL ORDER BY created_at DESC`
      ).bind(businessId).all<{ id: string; email: string; created_at: number }>();
      invites = results || [];
    } catch { /* 未適用 */ }
  }

  return json({ is_owner: owner, members, invites });
};

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId, userId } = data.session!;
  if (!(await isOwner(env, userId, businessId))) return badRequest("メンバーの招待はオーナーのみ可能です", 403);

  const body = await readJson<{ email?: string }>(request);
  const email = (body?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return badRequest("メールアドレスが正しくありません");

  // 既にオーナー/メンバーなら招待不要
  const biz = await env.DB.prepare(`SELECT u.email AS owner_email, b.name AS biz_name FROM businesses b JOIN users u ON u.id=b.owner_user_id WHERE b.id = ?`)
    .bind(businessId).first<{ owner_email: string; biz_name: string }>();
  if (biz && biz.owner_email.toLowerCase() === email) return badRequest("すでにオーナーのメールアドレスです");

  const token = genId("inv") + genId("");
  const now = nowSec();
  try {
    // 既存の未承認の同一メール招待を置き換え
    await env.DB.prepare("DELETE FROM business_invites WHERE business_id = ? AND email = ? AND accepted_at IS NULL").bind(businessId, email).run();
    await env.DB.prepare(
      "INSERT INTO business_invites (id, business_id, email, token, role, created_at) VALUES (?, ?, ?, ?, 'member', ?)"
    ).bind(genId("biv"), businessId, email, token, now).run();
  } catch {
    return badRequest("この機能はまだ有効化されていません（データベースの更新 0012 の適用が必要です）。", 503);
  }

  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  const link = `${base}/join?token=${token}`;
  const bizName = biz?.biz_name || "お店";
  const html =
    `<div style="font-family:sans-serif;line-height:1.7;color:#1c1a12">` +
    `<p>${escapeHtml(bizName)} の管理メンバーに招待されました。</p>` +
    `<p>下のボタンから参加すると、受信トレイやフォームなどを一緒に管理できます。</p>` +
    `<p style="margin:18px 0"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1c1a12;color:#fff;font-weight:700;padding:12px 22px;border-radius:10px;text-decoration:none">参加する →</a></p>` +
    `<p style="color:#7c7563;font-size:12px">このメールに心当たりがない場合は破棄してください。リンク: ${escapeHtml(link)}</p></div>`;
  await sendEmailResend(env, email, `【${bizName}】管理メンバーへの招待`, html);

  return json({ ok: true, email });
};
