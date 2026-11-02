// POST /api/walls/settings  声の壁の表示設定を保存（要ログイン）
// body: { accent, layout, star, theme, summary, count, autoplay }
// walls.theme(JSON) に保存し、walls.layout 列も後方互換で同期。ウィジェットA・ホスト型ページB 両方に反映。
import { json, badRequest, readJson } from "../../../shared/util";
import { parseWallSettings } from "../../../shared/wallsettings";
import type { Env, AppData } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const body = await readJson<Record<string, unknown>>(request);
  if (!body) return badRequest("invalid json");

  // 入力を正規化（不正値は既定にフォールバック）
  const s = parseWallSettings(body);

  const wall = await env.DB.prepare(
    "SELECT id FROM walls WHERE business_id = ? ORDER BY created_at LIMIT 1"
  )
    .bind(businessId)
    .first<{ id: string }>();
  if (!wall) return badRequest("先にフォームを作成してください", 404);

  await env.DB.prepare("UPDATE walls SET theme = ?, layout = ? WHERE id = ?")
    .bind(JSON.stringify(s), s.layout, wall.id)
    .run();

  return json({ ok: true, settings: s });
};
