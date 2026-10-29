// GET /api/media/<key>   R2に保存した画像・動画を配信（公開・Rangeリクエスト対応）
import type { Env } from "../../../shared/types";

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const raw = params.key;
  const key = Array.isArray(raw) ? raw.join("/") : String(raw || "");
  if (!key) return new Response("not found", { status: 404 });

  const rangeHeader = request.headers.get("range");

  // Rangeリクエスト（動画シーク用）
  if (rangeHeader) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (m) {
      const head = await env.MEDIA.head(key);
      if (!head) return new Response("not found", { status: 404 });
      const size = head.size;
      let start = m[1] ? parseInt(m[1], 10) : 0;
      let end = m[2] ? parseInt(m[2], 10) : size - 1;
      if (isNaN(start)) start = 0;
      if (isNaN(end) || end >= size) end = size - 1;
      if (start > end || start >= size) {
        return new Response("range not satisfiable", { status: 416, headers: { "content-range": `bytes */${size}` } });
      }
      const obj = await env.MEDIA.get(key, { range: { offset: start, length: end - start + 1 } });
      if (!obj) return new Response("not found", { status: 404 });
      const headers = new Headers();
      obj.writeHttpMetadata(headers);
      headers.set("etag", obj.httpEtag);
      headers.set("accept-ranges", "bytes");
      headers.set("content-range", `bytes ${start}-${end}/${size}`);
      headers.set("content-length", String(end - start + 1));
      headers.set("cache-control", "public, max-age=31536000, immutable");
      headers.set("access-control-allow-origin", "*");
      return new Response(obj.body, { status: 206, headers });
    }
  }

  const obj = await env.MEDIA.get(key);
  if (!obj) return new Response("not found", { status: 404 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("etag", obj.httpEtag);
  headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("access-control-allow-origin", "*");
  return new Response(obj.body, { headers });
};
