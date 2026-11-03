// GET /robots.txt
import type { Env } from "../shared/types";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  const body =
    `User-agent: *\n` +
    `Allow: /\n` +
    `Disallow: /app\n` +
    `Disallow: /api/\n` +
    `Disallow: /reset\n` +
    `Disallow: /verify\n` +
    `Disallow: /join\n` +
    `Disallow: /delete-request\n` +
    `Sitemap: ${base}/sitemap.xml\n`;
  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
};
