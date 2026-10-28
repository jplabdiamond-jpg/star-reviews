// GET  /api/rewards?form_id=...   フォームの返礼ルール一覧
// POST /api/rewards                返礼ルールを設定（form_id+level を上書き）
import { json, badRequest, readJson, genId } from "../../../shared/util";
import type { Env, AppData } from "../../../shared/types";

async function ownsForm(env: Env, businessId: string, formId: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT business_id FROM forms WHERE id = ?")
    .bind(formId)
    .first<{ business_id: string }>();
  return !!row && row.business_id === businessId;
}

export const onRequestGet: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const formId = new URL(request.url).searchParams.get("form_id") || "";
  if (!(await ownsForm(env, data.session!.businessId, formId))) return badRequest("form not found", 404);
  const { results } = await env.DB.prepare(
    "SELECT * FROM reward_rules WHERE form_id = ? ORDER BY level"
  )
    .bind(formId)
    .all();
  return json({ rules: results });
};

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const body = await readJson<{
    form_id?: string;
    level?: number;
    reward_type?: string;
    reward_value?: string;
    code_prefix?: string;
    active?: boolean;
  }>(request);
  if (!body || !body.form_id || !body.level) return badRequest("form_id と level は必須です");
  if (!(await ownsForm(env, data.session!.businessId, body.form_id))) return badRequest("form not found", 404);

  const validTypes = ["amount", "percent", "code", "content"];
  const rewardType = validTypes.includes(body.reward_type || "") ? body.reward_type! : "amount";

  // 同じ form+level の既存ルールを置き換える
  await env.DB.prepare("DELETE FROM reward_rules WHERE form_id = ? AND level = ?")
    .bind(body.form_id, body.level)
    .run();
  await env.DB.prepare(
    "INSERT INTO reward_rules (id, form_id, level, reward_type, reward_value, code_prefix, active) VALUES (?, ?, ?, ?, ?, ?, ?)"
  )
    .bind(
      genId("rwd"),
      body.form_id,
      body.level,
      rewardType,
      String(body.reward_value ?? ""),
      body.code_prefix || "SR",
      body.active === false ? 0 : 1
    )
    .run();

  return json({ ok: true });
};
