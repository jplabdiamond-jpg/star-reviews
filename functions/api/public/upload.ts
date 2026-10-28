// POST /api/public/upload   投稿時の写真アップロード（認証不要・R2へ保存）
// body = 画像バイナリそのもの, content-type = image/*
import { json, badRequest, genId } from "../../../shared/util";
import type { Env } from "../../../shared/types";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const ct = request.headers.get("content-type") || "";
  if (!ct.startsWith("image/") || !EXT[ct]) return badRequest("対応していない画像形式です");

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength === 0) return badRequest("ファイルが空です");
  if (bytes.byteLength > MAX_BYTES) return badRequest("画像は8MBまでです", 413);

  const key = `photos/${genId()}.${EXT[ct]}`;
  await env.MEDIA.put(key, bytes, { httpMetadata: { contentType: ct } });
  return json({ ok: true, key });
};
