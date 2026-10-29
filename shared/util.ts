// 汎用ユーティリティ

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

export function genId(prefix = ""): string {
  const uuid = crypto.randomUUID().replace(/-/g, "");
  return prefix ? `${prefix}_${uuid}` : uuid;
}

// 返礼クーポンコード: 例 "SR-7FK3Q9"
export function genCode(prefix = "SR"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい文字を除外
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let s = "";
  for (const b of bytes) s += chars[b % chars.length];
  return `${prefix}-${s}`;
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export function badRequest(message: string, status = 400): Response {
  return json({ error: message }, status);
}

export async function readJson<T = Record<string, unknown>>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

// slug生成（英数字 + ハイフン）
export function slugify(input: string): string {
  const base = (input || "")
    .toLowerCase()
    .replace(/[^a-z0-9ぁ-んァ-ヶ一-龠]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const suffix = crypto.randomUUID().slice(0, 6);
  return base ? `${base}-${suffix}` : suffix;
}

// 簡易メトリクス加算（ベストエフォート。失敗しても本処理は止めない）
export async function bumpMetric(db: D1Database, key: string): Promise<void> {
  try {
    const t = nowSec();
    await db
      .prepare(
        "INSERT INTO metrics (key, count, updated_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1, updated_at = ?"
      )
      .bind(key, t, t)
      .run();
  } catch {
    /* metrics は本処理に影響させない */
  }
}

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
