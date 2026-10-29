// POST /api/public/submit   お客様の声を投稿（認証不要）
// { slug, level, rating, body, author_name?, consent_display, photo_key?, token? }
// 返礼ルールがあれば検証条件を満たした投稿にクーポンコードを自動発行する。
import { json, badRequest, readJson, genId, genCode, nowSec } from "../../../shared/util";
import { notifyNewTestimonial } from "../../../shared/notify";
import type { Env } from "../../../shared/types";

function rewardText(type: string, value: string): string {
  if (type === "amount") return `${value}円分の特典`;
  if (type === "percent") return `${value}%OFF`;
  if (type === "code") return `特典コード：${value}`;
  return value;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env, waitUntil }) => {
  const b = await readJson<{
    slug?: string;
    level?: number;
    rating?: number;
    body?: string;
    author_name?: string;
    consent_display?: boolean;
    photo_key?: string;
    video_key?: string;
    token?: string;
  }>(request);
  if (!b || !b.slug) return badRequest("invalid json");

  const form = await env.DB.prepare(
    "SELECT id, business_id, title, levels_enabled, require_verified FROM forms WHERE slug = ?"
  )
    .bind(b.slug)
    .first<{ id: string; business_id: string; title: string; levels_enabled: string; require_verified: number }>();
  if (!form) return badRequest("フォームが見つかりません", 404);

  const level = Number(b.level) || 1;
  const allowed = form.levels_enabled.split(",").map((n) => parseInt(n, 10));
  if (!allowed.includes(level)) return badRequest("無効な投稿レベルです");

  const rating = Math.min(5, Math.max(1, Number(b.rating) || 0));
  if (!rating) return badRequest("評価（星）を選んでください");
  const text = (b.body || "").trim();
  if (!text) return badRequest("ひとことコメントを入力してください");
  if (level >= 2 && !b.consent_display) return badRequest("掲載の同意にチェックしてください");
  if (level >= 3 && !b.video_key) return badRequest("動画をアップロードしてください");

  // 検証トークン（購入者リンク経由か）
  let verified = 0;
  if (b.token) {
    const tok = await env.DB.prepare(
      "SELECT token, used FROM submission_tokens WHERE token = ? AND form_id = ?"
    )
      .bind(b.token, form.id)
      .first<{ token: string; used: number }>();
    if (tok && !tok.used) {
      verified = 1;
      await env.DB.prepare("UPDATE submission_tokens SET used = 1 WHERE token = ?").bind(b.token).run();
    }
  }

  const now = nowSec();
  const id = genId("tst");
  const authorName = level >= 2 ? (b.author_name || "").trim() || null : null;
  const authorLabel = authorName || "匿名のお客様";

  await env.DB.prepare(
    `INSERT INTO testimonials
       (id, business_id, form_id, level, rating, body, author_name, author_label, photo_key, video_key, verified, consent_display, status, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
  )
    .bind(
      id,
      form.business_id,
      form.id,
      level,
      rating,
      text,
      authorName,
      authorLabel,
      level >= 2 ? b.photo_key || null : null,
      level >= 3 ? b.video_key || null : null,
      verified,
      b.consent_display ? 1 : 0,
      now
    )
    .run();

  // 返礼ルール判定
  let reward: { code: string; text: string } | null = null;
  const rule = await env.DB.prepare(
    "SELECT id, reward_type, reward_value, code_prefix FROM reward_rules WHERE form_id = ? AND level = ? AND active = 1"
  )
    .bind(form.id, level)
    .first<{ id: string; reward_type: string; reward_value: string; code_prefix: string }>();

  const eligible = rule && (verified === 1 || form.require_verified === 0);
  if (eligible) {
    const code = genCode(rule!.code_prefix || "SR");
    const expires = now + 60 * 86400;
    await env.DB.prepare(
      "INSERT INTO reward_codes (id, testimonial_id, rule_id, code, status, issued_at, expires_at) VALUES (?, ?, ?, ?, 'issued', ?, ?)"
    )
      .bind(genId("cod"), id, rule!.id, code, now, expires)
      .run();
    reward = { code, text: rewardText(rule!.reward_type, rule!.reward_value) };
  }

  // 新着通知（ベストエフォート・応答はブロックしない）
  const baseUrl = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  waitUntil(
    notifyNewTestimonial(env, {
      businessId: form.business_id,
      formTitle: form.title,
      rating,
      body: text,
      authorLabel,
      level,
      baseUrl,
    })
  );

  return json({ ok: true, reward });
};
