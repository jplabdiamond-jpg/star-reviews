// AIモデレーション（ベストエフォート）。Workers AI で投稿本文の不適切さを判定し、
// 疑わしければ testimonials.flagged=1 を立てる。ブロックはしない（オーナーが確認）。
// AI未バインド/失敗/列未適用でも本処理に影響させない。
import type { Env } from "./types";

const MODEL = "@cf/meta/llama-3.1-8b-instruct";

// 返り値: フラグを立てたら true
export async function applyModeration(env: Env, testimonialId: string, text: string): Promise<boolean> {
  try {
    if (!env.AI || !text || text.length < 2) return false;
    const sys =
      "あなたはレビュー投稿のモデレーターです。次の口コミ本文が、ヘイト・差別・暴力的・性的・個人情報の暴露・誹謗中傷・明らかなスパムのいずれかに該当するか判定します。" +
      "該当するなら FLAG、問題なければ SAFE とだけ返してください。該当する場合は FLAG の後に半角コロンと短い理由を日本語で添えてください。例: 'FLAG: 誹謗中傷' または 'SAFE'";
    const res: unknown = await env.AI.run(MODEL, {
      messages: [
        { role: "system", content: sys },
        { role: "user", content: text.slice(0, 1500) },
      ],
      max_tokens: 20,
      temperature: 0,
    } as Record<string, unknown>);
    const out = String((res as { response?: string })?.response || "").trim();
    if (!/^\s*FLAG/i.test(out)) return false;
    const reason = (out.split(":")[1] || "要確認").trim().slice(0, 100);
    try {
      await env.DB.prepare("UPDATE testimonials SET flagged = 1, flag_reason = ? WHERE id = ?")
        .bind(reason, testimonialId)
        .run();
    } catch {
      return false; // 列未適用
    }
    return true;
  } catch (e) {
    console.error("moderation error", e);
    return false;
  }
}
