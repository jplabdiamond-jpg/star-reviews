// レビューページの表示設定（ウィジェットA・ホスト型ページB 共通）
// walls.theme 列に JSON で保存し、配信時に両方がこの設定を読む。
export interface WallSettings {
  accent: string;   // アクセント色（★・マーカー・アバター） #rrggbb
  layout: string;   // grid | masonry | carousel | list | chips
  star: string;     // ★スタイル
  theme: string;    // light | minimal | quote | dark
  summary: boolean; // 平均★サマリーの表示
  count: number;    // 表示枚数（0=すべて, 1..100）
  autoplay: boolean;// カルーセルの自動スライド
}

export const LAYOUTS = ["grid", "masonry", "carousel", "list", "chips"];
export const STARS = ["gold", "mono", "emoji", "heart", "number", "big", "glow", "shine", "metal", "mini"];
export const THEMES = ["light", "minimal", "quote", "dark"];

export const DEFAULT_SETTINGS: WallSettings = {
  accent: "#eaa400",
  layout: "grid",
  star: "gold",
  theme: "light",
  summary: true,
  count: 0,
  autoplay: false,
};

function cleanHex(v: unknown, fallback: string): string {
  const s = String(v ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : fallback;
}
function oneOf(v: unknown, allowed: string[], fallback: string): string {
  const s = String(v ?? "").toLowerCase();
  return allowed.includes(s) ? s : fallback;
}
function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// 任意の入力（JSON文字列 or オブジェクト）を正規化。fallbackLayout は walls.layout 列からの既定。
export function parseWallSettings(raw: unknown, fallbackLayout?: string): WallSettings {
  let o: Record<string, unknown> = {};
  if (typeof raw === "string" && raw.trim()) {
    try { o = JSON.parse(raw) as Record<string, unknown>; } catch { o = {}; }
  } else if (raw && typeof raw === "object") {
    o = raw as Record<string, unknown>;
  }
  const d = DEFAULT_SETTINGS;
  return {
    accent: cleanHex(o.accent, d.accent),
    layout: oneOf(o.layout, LAYOUTS, oneOf(fallbackLayout, LAYOUTS, d.layout)),
    star: oneOf(o.star, STARS, d.star),
    theme: oneOf(o.theme, THEMES, d.theme),
    summary: o.summary == null ? d.summary : !!o.summary,
    count: clampInt(o.count, 0, 100, d.count),
    autoplay: o.autoplay == null ? d.autoplay : !!o.autoplay,
  };
}
