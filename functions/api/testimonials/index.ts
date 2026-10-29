// GET  /api/testimonials?status=pending|approved|rejected|all&form_id=...   事業者用の一覧
import { json } from "../../../shared/util";
import type { Env, AppData } from "../../../shared/types";

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "pending";
  const formId = url.searchParams.get("form_id");

  let sql =
    "SELECT id, form_id, level, rating, body, author_name, author_label, photo_key, video_key, verified, consent_display, status, submitted_at, source " +
    "FROM testimonials WHERE business_id = ?";
  const binds: unknown[] = [businessId];
  if (status !== "all") {
    sql += " AND status = ?";
    binds.push(status);
  }
  if (formId) {
    sql += " AND form_id = ?";
    binds.push(formId);
  }
  sql += " ORDER BY submitted_at DESC LIMIT 300";

  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  return json({ testimonials: results });
};
