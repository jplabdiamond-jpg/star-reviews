// GET  /api/testimonials?status=pending&form_id=...   受信トレイ（事業者）
// POST /api/testimonials   既存の声を手動インポート（事業者が過去のクチコミを登録）
import { json, badRequest, readJson, genId, nowSec } from "../../../shared/util";
import type { Env, AppData } from "../../../shared/types";

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";
  const formId = url.searchParams.get("form_id");

  let sql =
    "SELECT id, form_id, level, rating, body, author_name, author_label, photo_key, verified, consent_display, status, submitted_at " +
    "FROM testimonials WHERE business_id = ? AND status = ?";
  const binds: unknown[] = [businessId, status];
  if (formId) {
    sql += " AND form_id = ?";
    binds.push(formId);
  }
  sql += " ORDER BY submitted_at DESC LIMIT 200";

  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return json({ testimonials: results });
};

// 既存の声を手動インポート（Google・手書きアンケート・SNS等から転記）。即「掲載中」で壁に載る。
export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const b = await readJson<{
    form_id?: string;
    author_name?: string;
    rating?: number;
    body?: string;
    source?: string;
    date?: string; // YYYY-MM-DD（任意・元のレビュー日）
  }>(request);
  if (!b) return badRequest("invalid json");

  // インポート先フォーム（自分のもの）を確認
  const form = await env.DB.prepare("SELECT id FROM forms WHERE id = ? AND business_id = ?")
    .bind(b.form_id || "", businessId)
    .first<{ id: string }>();
  if (!form) return badRequest("インポート先のフォームを選択してください");

  const rating = Math.min(5, Math.max(1, Number(b.rating) || 0));
  if (!rating) return badRequest("評価（星）を選んでください");
  const text = (b.body || "").trim();
  if (!text) return badRequest("声の本文を入力してください");

  const authorName = (b.author_name || "").trim() || null;
  const level = authorName ? 2 : 1;
  const authorLabel = authorName || "匿名のお客様";
  const source = (b.source || "").trim() || "手動";

  // 日付（任意）。不正ならnow。
  let at = nowSec();
  if (b.date && /^\d{4}-\d{2}-\d{2}$/.test(b.date)) {
    const ms = Date.parse(b.date + "T00:00:00Z");
    if (!Number.isNaN(ms)) at = Math.floor(ms / 1000);
  }

  const id = genId("tst");
  await env.DB.prepare(
    `INSERT INTO testimonials
       (id, business_id, form_id, level, rating, body, author_name, author_label, photo_key, verified, consent_display, status, submitted_at, approved_at, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 1, 'approved', ?, ?, ?)`
  )
    .bind(id, businessId, form.id, level, rating, text, authorName, authorLabel, at, nowSec(), source)
    .run();

  // 既定の壁に載せる
  const wall = await env.DB.prepare("SELECT id FROM walls WHERE business_id = ? ORDER BY created_at LIMIT 1")
    .bind(businessId)
    .first<{ id: string }>();
  if (wall) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO wall_testimonials (wall_id, testimonial_id, position) VALUES (?, ?, ?)"
    )
      .bind(wall.id, id, nowSec())
      .run();
  }

  return json({ ok: true, id });
};
