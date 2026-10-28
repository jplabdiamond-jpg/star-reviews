// GET /api/media/<key>   R2に保存した画像を配信（公開）
import type { Env } from "../../../shared/types";

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const raw = params.key;
  const key = Array.isArray(raw) ? raw.join("/") : String(raw || "");
  if (!key) return new Response("not found", { status: 404 });

  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response("not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");
  return new Response(obj.body, { headers });
};
