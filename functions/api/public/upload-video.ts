// POST /api/public/upload-video   投稿時の動画アップロード（認証不要・R2へストリーム保存）
// body = 動画バイナリそのもの, content-type = video/*
// Workerのリクエスト本文上限(100MB)内。メモリを使わないよう request.body をそのままR2へ流す。
import { json, badRequest, genId } from "../../../shared/util";
import type { Env } from "../../../shared/types";

const MAX_BYTES = 60 * 1024 * 1024; // 60MB（無料枠を意識した上限）
const EXT: Record<string, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const ct = (request.headers.get("content-type") || "").split(";")[0].trim();
  const ext = EXT[ct];
  if (!ct.startsWith("video/") || !ext) return badRequest("対応していない動画形式です（MP4推奨）");

  const len = Number(request.headers.get("content-length") || 0);
  if (len && len > MAX_BYTES) return badRequest("動画は60MBまでです", 413);
  if (!request.body) return badRequest("ファイルが空です");

  const key = `videos/${genId()}.${ext}`;
  await env.MEDIA.put(key, request.body, { httpMetadata: { contentType: ct } });
  return json({ ok: true, key });
};
