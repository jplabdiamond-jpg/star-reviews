// GET /sitemap.xml  公開ページ（トップ＋各店舗の声の壁）のサイトマップ
import type { Env } from "../shared/types";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  const urls: string[] = [`${base}/`, `${base}/guide`];

  try {
    const { results } = await env.DB.prepare(
      "SELECT slug, embed_token FROM walls ORDER BY created_at DESC LIMIT 5000"
    ).all<{ slug: string | null; embed_token: string }>();
    for (const w of results || []) {
      const id = w.slug || w.embed_token;
      if (id) urls.push(`${base}/wall/${encodeURIComponent(id)}`);
    }
  } catch {
    /* DB未準備でもトップだけは返す */
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls.map((u) => `  <url><loc>${u.replace(/&/g, "&amp;")}</loc></url>`).join("\n") +
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
};
