// POST /api/walls/slug  声の壁ページの独自URL(slug)を設定（要ログイン・Pro特典）
// body: { slug }  3〜40字 [a-z0-9-]。重複不可。freeプランは不可(402)。
// 認証必須: パスが /api/wall/ で始まらない(=/api/walls/)ため _middleware が認証を要求する。
import { json, badRequest } from "../../../shared/util";
import { isPaid } from "../../../shared/plan";
import type { Env, AppData } from "../../../shared/types";

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;

  const biz = await env.DB.prepare("SELECT plan, plan_until FROM businesses WHERE id = ?")
    .bind(businessId)
    .first<{ plan: string; plan_until: number | null }>();
  if (!isPaid(biz)) {
    return json({ error: "独自URLはProプランの機能です。アップグレードするとご利用いただけます。", upgrade_required: true }, 402);
  }

  const b = await (async () => { try { return (await request.json()) as { slug?: string }; } catch { return null; } })();
  if (!b) return badRequest("invalid json");

  const slug = (b.slug || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(slug)) {
    return badRequest("URLは半角英数字とハイフンで3〜40字にしてください（先頭・末尾はハイフン不可）");
  }
  // 予約語（他のルートと衝突しないように）
  if (["api", "app", "f", "wall", "widget", "submit", "assets"].includes(slug)) {
    return badRequest("このURLは使用できません");
  }

  // 自分の壁を取得
  const wall = await env.DB.prepare("SELECT id FROM walls WHERE business_id = ? ORDER BY created_at LIMIT 1")
    .bind(businessId)
    .first<{ id: string }>();
  if (!wall) return badRequest("先にフォームを作成してください");

  // 重複チェック（他の壁が同じslugを使っていないか）
  const dup = await env.DB.prepare("SELECT id FROM walls WHERE slug = ? AND id <> ? LIMIT 1")
    .bind(slug, wall.id)
    .first<{ id: string }>();
  if (dup) return json({ error: "このURLは既に使われています。別のURLをお試しください。" }, 409);

  await env.DB.prepare("UPDATE walls SET slug = ? WHERE id = ?").bind(slug, wall.id).run();
  return json({ ok: true, slug });
};
