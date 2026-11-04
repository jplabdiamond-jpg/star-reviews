// POST /api/walls/asset?kind=cover|logo   レビューページのカバー画像・ロゴ画像をアップロード（要ログイン）
// body = 画像バイナリそのもの, content-type = image/*。R2の brand/ 配下に保存し key を返す。
// 返ってきた key を /api/walls/settings の cover / logo に入れて保存するとページに反映される。
import { json, badRequest, genId } from "../../../shared/util";
import type { Env, AppData } from "../../../shared/types";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export const onRequestPost: PagesFunction<Env, string, AppData> = async ({ request, env, data }) => {
  const { businessId } = data.session!;
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") === "logo" ? "logo" : "cover";

  const ct = (request.headers.get("content-type") || "").split(";")[0].trim();
  // ロゴは透過PNG/SVGも想定、カバーは写真想定。どちらも image/* のみ許可。
  if (!ct.startsWith("image/") || !EXT[ct]) return badRequest("対応していない画像形式です（JPEG/PNG/WebP/GIF/SVG）");

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return badRequest("ファイルが空です");
  if (bytes.byteLength > MAX_BYTES) return badRequest("画像は5MBまでです", 413);

  const key = `brand/${businessId}/${kind}-${genId()}.${EXT[ct]}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: ct } });
  return json({ ok: true, key });
};
