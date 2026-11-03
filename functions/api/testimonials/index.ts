// GET  /api/testimonials?status=pending|approved|rejected|all&form_id=...   事業者用の一覧
import { json } from "../../../shared/util";
import type { Env, AppData } from "../../../shared/types";

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";
  const formId = url.searchParams.get("form_id");

  const cols =
    "id, form_id, level, rating, body, author_name, author_label, photo_key, video_key, verified, consent_display, status, submitted_at, source";
  const where = (() => {
    let s = " FROM testimonials WHERE business_id = ?";
    const binds: unknown[] = [businessId];
    if (status !== "all") { s += " AND status = ?"; binds.push(status); }
    if (formId) { s += " AND form_id = ?"; binds.push(formId); }
    s += " ORDER BY submitted_at DESC LIMIT 300";
    return { s, binds };
  })();

  // reply(0010)・flagged(0013) 列があれば含める。未適用でも段階的にフォールバック。
  try {
    const { results } = await env.DB.prepare("SELECT " + cols + ", reply, reply_at, flagged, flag_reason" + where.s).bind(...where.binds).all();
    return json({ testimonials: results });
  } catch { /* 0013未適用 */ }
  try {
    const { results } = await env.DB.prepare("SELECT " + cols + ", reply, reply_at" + where.s).bind(...where.binds).all();
    return json({ testimonials: results });
  } catch { /* 0010未適用 */ }
  const { results } = await env.DB.prepare("SELECT " + cols + where.s).bind(...where.binds).all();
  return json({ testimonials: results });
};
