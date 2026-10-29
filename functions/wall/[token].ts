// GET /wall/:token   ホスト型・声の壁ページ（SSR / SEO資産化）
// token は walls.slug（pro特典の読みやすいURL）または walls.embed_token のどちらでも解決。
// サーバー側で本文・JSON-LD・OGタグまで描画するので、JSを実行しないクローラでも内容が読める。
import { bumpMetric, escapeHtml } from "../../shared/util";
import { isPaid } from "../../shared/plan";
import type { Env } from "../../shared/types";

interface WallRow { id: string; business_id: string; name: string; }
interface Row {
  rating: number; body: string; author_label: string;
  photo_key: string | null; video_key: string | null;
  verified: number; source: string | null; at: number;
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env, params }) => {
  const token = String(params.token || "");
  const reqOrigin = new URL(request.url).origin;
  const base = (env.PUBLIC_BASE_URL || reqOrigin).replace(/\/+$/, "");

  // slug優先 → embed_token の順で解決
  const wall = await env.DB.prepare(
    "SELECT id, business_id, name FROM walls WHERE slug = ? OR embed_token = ? LIMIT 1"
  ).bind(token, token).first<WallRow>();

  if (!wall) {
    return htmlResponse(notFoundPage(base), 404);
  }

  await bumpMetric(env.DB, `wallpage_view:${wall.id}`);

  const biz = await env.DB.prepare("SELECT name, plan, plan_until FROM businesses WHERE id = ?")
    .bind(wall.business_id)
    .first<{ name: string; plan: string; plan_until: number | null }>();
  const bizName = biz?.name || wall.name || "お客様の声";
  const showCredit = !isPaid(biz);

  const { results } = await env.DB.prepare(
    `SELECT t.rating, t.body, t.author_label, t.photo_key, t.video_key, t.verified, t.source,
            COALESCE(t.approved_at, t.submitted_at) AS at
     FROM wall_testimonials wt
     JOIN testimonials t ON t.id = wt.testimonial_id
     WHERE wt.wall_id = ? AND t.status = 'approved'
     ORDER BY wt.position DESC
     LIMIT 200`
  ).bind(wall.id).all<Row>();

  const items = (results || []).map((r) => ({
    rating: Math.min(5, Math.max(0, Number(r.rating) || 0)),
    body: r.body || "",
    author: r.author_label || "匿名のお客様",
    verified: r.verified === 1,
    source: r.source || null,
    date: r.at ? new Date(r.at * 1000).toISOString().slice(0, 10) : null,
    photo_url: r.photo_key ? `${base}/api/media/${r.photo_key}` : null,
    video_url: r.video_key ? `${base}/api/media/${r.video_key}` : null,
  }));

  const count = items.length;
  const avg = count ? Math.round((items.reduce((s, i) => s + (i.rating || 0), 0) / count) * 10) / 10 : 0;
  const canonical = `${base}/wall/${encodeURIComponent(token)}`;

  return htmlResponse(renderPage({ bizName, items, count, avg, canonical, showCredit, base }), 200);
};

function htmlResponse(html: string, status: number): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=120, s-maxage=300",
    },
  });
}

function stars(n: number): string {
  const full = Math.round(n);
  let s = "";
  for (let i = 1; i <= 5; i++) s += `<span class="st${i <= full ? " on" : ""}">★</span>`;
  return `<span class="stars" aria-label="5段階中${full}">${s}</span>`;
}

function jsonLd(bizName: string, items: Array<{ rating: number; body: string; author: string; date: string | null }>, count: number, avg: number): string {
  if (!count) return "";
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: bizName,
    aggregateRating: { "@type": "AggregateRating", ratingValue: avg, reviewCount: count, bestRating: 5, worstRating: 1 },
    review: items.slice(0, 50).map((it) => {
      const r: Record<string, unknown> = {
        "@type": "Review",
        reviewRating: { "@type": "Rating", ratingValue: it.rating || 5, bestRating: 5, worstRating: 1 },
        author: { "@type": "Person", name: it.author || "匿名のお客様" },
        reviewBody: it.body || "",
      };
      if (it.date) r.datePublished = it.date;
      return r;
    }),
  };
  return `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`;
}

function renderPage(d: {
  bizName: string;
  items: Array<{ rating: number; body: string; author: string; verified: boolean; source: string | null; date: string | null; photo_url: string | null; video_url: string | null }>;
  count: number; avg: number; canonical: string; showCredit: boolean; base: string;
}): string {
  const title = `${d.bizName}のお客様の声${d.count ? `（★${d.avg} / ${d.count}件）` : ""}`;
  const desc = d.count
    ? `${d.bizName}に寄せられた${d.count}件のお客様の声。平均評価★${d.avg}。実際のご利用者の口コミをご覧いただけます。`
    : `${d.bizName}のお客様の声ページ。`;
  const cards = d.items.map((it) => {
    const who = (it.author || "").trim();
    const initial = who && who !== "匿名希望" && who !== "匿名のお客様" ? escapeHtml(who.charAt(0)) : "★";
    const avatar = it.photo_url
      ? `<img class="ph" src="${escapeHtml(it.photo_url)}" alt="" loading="lazy">`
      : `<span class="av">${initial}</span>`;
    return (
      `<article class="card">` +
      `<div class="ctop">${stars(it.rating)}${it.source ? `<span class="src">via ${escapeHtml(it.source)}</span>` : ""}</div>` +
      (it.video_url ? `<video class="vid" controls playsinline preload="metadata" crossorigin="anonymous" src="${escapeHtml(it.video_url)}"><track kind="captions" srclang="ja" label="日本語" default src="${escapeHtml(it.video_url)}.vtt"></video>` : "") +
      `<p class="body">${escapeHtml(it.body)}</p>` +
      `<footer class="cfoot">${avatar}<span class="who">${escapeHtml(it.author)}</span>${it.verified ? `<span class="badge">確認済み</span>` : ""}${it.date ? `<time class="dt">${escapeHtml(it.date)}</time>` : ""}</footer>` +
      `</article>`
    );
  }).join("");

  const summary = d.count
    ? `<div class="sum"><span class="sum-avg">${d.avg.toFixed(1)}</span>${stars(d.avg)}<span class="sum-n">${d.count}件のお客様の声</span></div>`
    : "";

  return `<!doctype html><html lang="ja"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<link rel="canonical" href="${escapeHtml(d.canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${escapeHtml(d.canonical)}">
<meta name="twitter:card" content="summary">
<meta name="robots" content="index,follow">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
${jsonLd(d.bizName, d.items, d.count, d.avg)}
<style>
:root{--sun:#ffc62b;--ink:#1c1a12;--paper:#fffdf5;--line:#e7e0cc;--muted:#8a8166}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Hiragino Kaku Gothic ProN","Hiragino Sans",-apple-system,"Noto Sans JP",sans-serif;line-height:1.75;-webkit-font-smoothing:antialiased}
.wrap{max-width:1000px;margin:0 auto;padding:0 15px}
header.hd{padding:46px 0 10px;text-align:center}
.eyebrow{font-family:"Space Grotesk",sans-serif;font-weight:700;letter-spacing:.14em;text-transform:uppercase;font-size:12px;color:var(--muted)}
h1{font-size:clamp(26px,5vw,40px);margin:.3em 0 .1em;line-height:1.25}
h1 .mk{background:linear-gradient(transparent 62%,var(--sun) 62%);padding:0 .08em}
.sum{display:inline-flex;align-items:center;gap:10px;margin:18px 0 4px;padding:10px 18px;background:#fff;border:1.5px solid var(--ink);border-radius:999px;box-shadow:3px 3px 0 var(--ink)}
.sum-avg{font-family:"Space Grotesk",sans-serif;font-weight:700;font-size:26px;line-height:1}
.sum-n{font-size:13px;color:var(--muted)}
.stars{white-space:nowrap;font-size:16px;letter-spacing:1px}
.stars .st{color:#d9d2bf}.stars .st.on{color:var(--sun)}
.grid{columns:3 300px;column-gap:16px;padding:28px 0 10px}
.card{break-inside:avoid;background:#fff;border:1.5px solid var(--ink);border-radius:14px;padding:16px 16px 13px;margin:0 0 16px;box-shadow:4px 4px 0 var(--ink)}
.ctop{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.src{font-size:11px;color:var(--muted)}
.vid{width:100%;border-radius:10px;margin-bottom:10px;background:#000;display:block}
.body{margin:0 0 12px;font-size:15px;white-space:pre-wrap;word-break:break-word}
.cfoot{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.av{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--sun);color:var(--ink);font-weight:700;font-size:14px;flex:none}
.ph{width:30px;height:30px;border-radius:50%;object-fit:cover;flex:none}
.who{font-weight:700;font-size:13px}
.badge{font-size:10px;background:var(--ink);color:#fff;padding:2px 7px;border-radius:999px;letter-spacing:.04em}
.dt{font-size:11px;color:var(--muted);margin-left:auto}
.empty{text-align:center;color:var(--muted);padding:60px 0}
footer.ft{text-align:center;padding:30px 0 50px;color:var(--muted);font-size:12px}
footer.ft a{color:var(--ink);font-weight:700;text-decoration:none;border-bottom:2px solid var(--sun)}
@media(prefers-color-scheme:dark){:root{--paper:#17150e;--ink:#f3ecda;--line:#38331f;--muted:#9c927a}.sum,.card{background:#201d12}.stars .st{color:#4a442e}}
</style></head>
<body><div class="wrap">
<header class="hd">
<div class="eyebrow">Customer Voices</div>
<h1><span class="mk">${escapeHtml(d.bizName)}</span><br>お客様の声</h1>
${summary}
</header>
${d.count ? `<main class="grid">${cards}</main>` : `<p class="empty">まだお客様の声はありません。</p>`}
<footer class="ft">
${d.showCredit ? `このページは <a href="${escapeHtml(d.base)}/" rel="nofollow">star-reviews</a> で作られています` : ``}
</footer>
</div></body></html>`;
}

function notFoundPage(base: string): string {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>ページが見つかりません</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#fffdf5;color:#1c1a12;font-family:-apple-system,"Hiragino Sans","Noto Sans JP",sans-serif;text-align:center;padding:20px}a{color:#1c1a12;border-bottom:2px solid #ffc62b;text-decoration:none;font-weight:700}</style>
</head><body><div><h1 style="font-size:22px">お客様の声ページが見つかりません</h1><p style="color:#8a8166">URLをご確認ください。</p><p><a href="${escapeHtml(base)}/">star-reviews トップへ</a></p></div></body></html>`;
}
