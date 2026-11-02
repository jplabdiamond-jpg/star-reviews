// GET  /api/followups          自分のフォローアップ状況（件数＋直近一覧）
// POST /api/followups          レビュー依頼を予約（指定日後に自動送信）
//   body: { form_id, delay_days, recipients: [{email, name?}] }
import { json, badRequest, readJson, genId, nowSec } from "../../../shared/util";
import type { Env, AppData } from "../../../shared/types";

const DELAY_OK = [0, 1, 3, 7, 14, 30];
const MAX_RECIPIENTS = 500;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ env, data }) => {
  const { businessId } = data.session!;
  try {
    const counts = await env.DB.prepare(
      `SELECT
         SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
         SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) AS sent,
         COUNT(*) AS total
       FROM followups WHERE business_id = ?`
    ).bind(businessId).first<{ pending: number; sent: number; total: number }>();

    const { results } = await env.DB.prepare(
      `SELECT id, to_email, to_name, send_at, status, sent_at
         FROM followups WHERE business_id = ? ORDER BY created_at DESC LIMIT 50`
    ).bind(businessId).all();

    return json({
      enabled: true,
      counts: { pending: counts?.pending || 0, sent: counts?.sent || 0, total: counts?.total || 0 },
      items: results || [],
    });
  } catch {
    // 0009 未適用
    return json({ enabled: false, counts: { pending: 0, sent: 0, total: 0 }, items: [] });
  }
};

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const body = await readJson<{ form_id?: string; delay_days?: number; recipients?: Array<{ email?: string; name?: string }> }>(request);
  if (!body) return badRequest("invalid json");

  const delay = DELAY_OK.includes(Number(body.delay_days)) ? Number(body.delay_days) : 3;
  const list = Array.isArray(body.recipients) ? body.recipients : [];
  if (list.length === 0) return badRequest("送信先を1件以上入力してください");
  if (list.length > MAX_RECIPIENTS) return badRequest(`一度に登録できるのは${MAX_RECIPIENTS}件までです`);

  // フォームの所有確認
  const form = await env.DB.prepare("SELECT id FROM forms WHERE id = ? AND business_id = ?")
    .bind(body.form_id || "", businessId)
    .first<{ id: string }>();
  if (!form) return badRequest("送信するフォームを選んでください");

  const now = nowSec();
  const sendAt = now + delay * 86400;

  let queued = 0, skipped = 0;
  const seen = new Set<string>();
  const stmts: D1PreparedStatement[] = [];
  for (const r of list) {
    const email = (r.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email) || seen.has(email)) { skipped++; continue; }
    seen.add(email);
    const name = (r.name || "").trim() || null;
    stmts.push(
      env.DB.prepare(
        "INSERT INTO followups (id, business_id, form_id, to_email, to_name, send_at, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)"
      ).bind(genId("fup"), businessId, form.id, email, name, sendAt, now)
    );
    queued++;
  }
  if (stmts.length === 0) return badRequest("有効なメールアドレスがありませんでした");

  try {
    // D1 batch は最大件数制限があるため分割
    for (let i = 0; i < stmts.length; i += 50) {
      await env.DB.batch(stmts.slice(i, i + 50));
    }
  } catch {
    return badRequest("この機能はまだ有効化されていません（管理者がデータベースの更新を適用してください）。", 503);
  }

  return json({ ok: true, queued, skipped, send_at: sendAt, delay_days: delay });
};
