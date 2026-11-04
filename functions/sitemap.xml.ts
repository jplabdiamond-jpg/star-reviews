// GET /sitemap.xml  公開ページ（静的ページ＋各店舗のレビューページ）のサイトマップ
import type { Env } from "../shared/types";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const base = (env.PUBLIC_BASE_URL || new URL(request.url).origin).replace(/\/+$/, "");
  const today = new Date().toISOString().slice(0, 10);

  type Entry = { loc: string; changefreq?: string; priority?: string; lastmod?: string };

  // インデックスさせたい静的な公開ページ。
  const staticPages: Entry[] = [
    { loc: `${base}/`, changefreq: "weekly", priority: "1.0", lastmod: today },
    { loc: `${base}/plans`, changefreq: "weekly", priority: "0.9", lastmod: today },
    { loc: `${base}/guide`, changefreq: "monthly", priority: "0.7", lastmod: today },
    { loc: `${base}/tokushoho`, changefreq: "yearly", priority: "0.2" },
    { loc: `${base}/privacy`, changefreq: "yearly", priority: "0.2" },
    { loc: `${base}/terms`, changefreq: "yearly", priority: "0.2" },
  ];

  const entries: Entry[] = [...staticPages];

  // 各店舗のレビューページ（ホスト型公開ページ /wall/:token）を動的に追加。
  try {
    const { results } = await env.DB.prepare(
      "SELECT slug, embed_token FROM walls ORDER BY created_at DESC LIMIT 5000"
    ).all<{ slug: string | null; embed_token: string }>();
    for (const w of results || []) {
      const id = w.slug || w.embed_token;
      if (id) entries.push({ loc: `${base}/wall/${encodeURIComponent(id)}`, changefreq: "weekly", priority: "0.6" });
    }
  } catch {
    /* DB未準備でも静的ページは返す */
  }

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    entries
      .map((e) => {
        let s = `  <url><loc>${esc(e.loc)}</loc>`;
        if (e.lastmod) s += `<lastmod>${e.lastmod}</lastmod>`;
        if (e.changefreq) s += `<changefreq>${e.changefreq}</changefreq>`;
        if (e.priority) s += `<priority>${e.priority}</priority>`;
        s += `</url>`;
        return s;
      })
      .join("\n") +
    `\n</urlset>\n`;

  return new Response(xml, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
};
