// コラムの共通レンダラ（SSR）。黒×黄エディトリアルで、サイト全体のトーンに合わせる。
// JSを実行しないクローラ・生成AIでも本文・JSON-LDが読めるよう全てサーバー描画する。
import type { BlogPost } from "./types";

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=3600",
    },
  });
}

export function formatDateJa(d: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) return d;
  return `${m[1]}年${Number(m[2])}月${Number(m[3])}日`;
}

function readingMinutes(html: string): number {
  const text = html.replace(/<[^>]+>/g, "");
  // 日本語は文字数ベース（約500字/分）
  return Math.max(1, Math.round(text.length / 500));
}

const STYLE = `
:root{--paper:#fffdf5;--panel:#fff;--ink:#1c1a12;--ink-soft:#413d30;--muted:#7c7563;
  --sun:#ffc62b;--sun-deep:#eaa400;--sun-soft:#ffe7a0;--mark:#ffd84d;--line:#ece3cf;--line-strong:#e0d4b6;--ok:#1c7d52;
  --disp:"Space Grotesk",system-ui,sans-serif;
  --jp:"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP",system-ui,sans-serif}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--jp);line-height:1.85;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;word-break:auto-phrase}
a{color:inherit}
.wrap{max-width:760px;margin:0 auto;padding:0 22px}
.wide{max-width:1080px}
@media(max-width:640px){.wrap{padding:0 15px}}
header{position:sticky;top:0;z-index:40;background:rgba(255,253,245,.9);
  backdrop-filter:saturate(1.3) blur(8px);border-bottom:1px solid var(--line)}
header .in{display:flex;justify-content:space-between;align-items:center;height:62px;gap:20px}
.brand{display:inline-flex;align-items:center;text-decoration:none}
.brand-logo{height:40px;width:auto;max-width:56vw;display:block}
.nav-links{display:flex;gap:24px;align-items:center}
.nav-links a{font-size:14px;font-weight:700;text-decoration:none;color:var(--ink-soft)}
.nav-links a:hover{color:var(--ink)}
@media(max-width:720px){.nav-links{display:none}}
.nav-login{font-weight:700;font-size:14px;text-decoration:none;padding:9px 16px;border-radius:999px;
  border:1.5px solid var(--ink);color:var(--ink);white-space:nowrap}
.nav-login:hover{background:var(--ink);color:#fff}
.crumbs{font-size:12.5px;color:var(--muted);margin:26px 0 0}
.crumbs a{text-decoration:none;color:var(--muted)}
.crumbs a:hover{color:var(--ink)}
.eyebrow{font-family:var(--disp);font-weight:700;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--sun-deep);margin:0}
h1.post-title{font-family:var(--disp);font-weight:700;font-size:clamp(27px,4.4vw,40px);line-height:1.22;letter-spacing:-.01em;margin:10px 0 14px}
.post-meta{display:flex;flex-wrap:wrap;gap:12px;align-items:center;font-size:13px;color:var(--muted);margin:0 0 6px}
.tags{display:flex;flex-wrap:wrap;gap:7px;margin:14px 0 0}
.tags span{font-size:12px;font-weight:700;color:var(--ink-soft);background:var(--sun-soft);border:1px solid var(--line-strong);border-radius:999px;padding:4px 11px}
.cover{width:100%;border-radius:16px;border:1px solid var(--line);margin:22px 0 0;display:block}
article.body{margin:30px 0 0;font-size:16.5px;color:var(--ink-soft)}
article.body h2{font-family:var(--disp);font-weight:700;font-size:23px;color:var(--ink);line-height:1.35;margin:42px 0 14px;padding-top:6px;border-top:2px solid var(--ink)}
article.body h3{font-weight:700;font-size:18px;color:var(--ink);margin:30px 0 10px}
article.body p{margin:0 0 18px}
article.body a{color:var(--sun-deep);font-weight:700;text-decoration:underline;text-underline-offset:2px}
article.body ul,article.body ol{margin:0 0 18px;padding-left:1.3em}
article.body li{margin:0 0 8px}
article.body strong{color:var(--ink);font-weight:700}
article.body .mark{background:linear-gradient(transparent 58%,var(--mark) 58% 92%,transparent 92%);padding:0 .08em}
article.body table{width:100%;border-collapse:collapse;margin:0 0 22px;font-size:14.5px}
article.body th,article.body td{border:1px solid var(--line-strong);padding:10px 12px;text-align:left;vertical-align:top}
article.body thead th{background:var(--ink);color:#fff;font-weight:700}
article.body tbody th{background:var(--sun-soft);font-weight:700;color:var(--ink)}
article.body blockquote{margin:0 0 20px;padding:14px 18px;background:#fff;border-left:4px solid var(--sun);border-radius:0 12px 12px 0;color:var(--ink-soft)}
.cta-box{margin:40px 0 0;padding:26px 24px;background:var(--ink);border-radius:18px;color:#fff;text-align:center}
.cta-box h3{font-family:var(--disp);font-size:20px;margin:0 0 8px;color:#fff;border:0}
.cta-box p{color:#cfc8b6;font-size:14.5px;margin:0 0 16px}
.cta-box a{display:inline-block;background:var(--sun);color:var(--ink);font-weight:800;text-decoration:none;padding:12px 26px;border-radius:999px}
.rel{margin:46px 0 0;border-top:1px solid var(--line);padding-top:22px}
.rel h2{font-family:var(--disp);font-size:16px;margin:0 0 14px}
.rel a{display:block;text-decoration:none;color:var(--ink);font-weight:700;padding:11px 0;border-bottom:1px solid var(--line)}
.rel a:hover{color:var(--sun-deep)}
.rel small{display:block;color:var(--muted);font-weight:400;font-size:12.5px;margin-top:3px}
/* 一覧 */
.list-head{margin:30px 0 4px}
.list-head h1{font-family:var(--disp);font-size:clamp(26px,4vw,36px);margin:8px 0 8px}
.list-head p{color:var(--muted);margin:0}
.cards{display:grid;gap:18px;margin:28px 0 0}
.card{display:block;text-decoration:none;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:22px 22px;transition:.15s;box-shadow:0 6px 20px rgba(60,46,12,.05)}
.card:hover{border-color:var(--line-strong);transform:translateY(-2px);box-shadow:0 12px 30px rgba(60,46,12,.09)}
.card .date{font-size:12.5px;color:var(--muted)}
.card h2{font-family:var(--disp);font-size:19px;line-height:1.35;margin:7px 0 8px}
.card p{font-size:14px;color:var(--ink-soft);margin:0}
footer{background:#1c1a12;color:#cfc8b6;border-radius:18px;display:flex;flex-direction:column;align-items:center;gap:13px;text-align:center;padding:30px 24px;margin:48px auto 32px;max-width:1080px}
footer .footer-logo{height:44px;width:auto}
footer a{color:#e7e1d0;text-decoration:none}
footer a:hover{color:#fff}
footer nav{display:flex;flex-wrap:wrap;gap:15px;justify-content:center}
footer span{color:#cfc8b6;font-size:13px}
@media(prefers-reduced-motion:reduce){.card:hover{transform:none}}
`;

function head(opts: {
  title: string;
  desc: string;
  canonical: string;
  ogType: string;
  image: string;
  jsonLd: string[];
}): string {
  const { title, desc, canonical, ogType, image, jsonLd } = opts;
  return `<!doctype html><html lang="ja"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(desc)}">
<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">
<meta name="theme-color" content="#1c1a12">
<link rel="canonical" href="${escapeHtml(canonical)}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="star-reviews">
<meta property="og:locale" content="ja_JP">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${escapeHtml(canonical)}">
<meta property="og:image" content="${escapeHtml(image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${escapeHtml(image)}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>${STYLE}</style>
${jsonLd.map((j) => `<script type="application/ld+json">${j.replace(/</g, "\\u003c")}</script>`).join("\n")}
</head><body>`;
}

const HEADER = `<header><div class="wrap wide in">
  <a class="brand" href="/"><img src="/logo.png" alt="STAR REVIEWS" class="brand-logo"></a>
  <nav class="nav-links">
    <a href="/">ホーム</a>
    <a href="/blog">コラム</a>
    <a href="/plans">料金</a>
    <a href="/guide">使い方ガイド</a>
  </nav>
  <a class="nav-login" href="/#auth">無料ではじめる</a>
</div></header>`;

const FOOTER = `<footer>
  <a class="brand" href="/"><img src="/logo-white.png" alt="STAR REVIEWS" class="footer-logo"></a>
  <nav>
    <a href="/">ホーム</a><a href="/blog">コラム</a><a href="/plans">プランの詳細</a>
    <a href="/guide">使い方ガイド</a><a href="/#faq">よくある質問</a>
    <a href="/tokushoho">特定商取引法</a><a href="/privacy">プライバシー</a><a href="/terms">利用規約</a>
  </nav>
  <span>© 2026 star-reviews</span>
</footer></body></html>`;

function relatedBlock(current: BlogPost, all: BlogPost[]): string {
  const others = all.filter((p) => p.slug !== current.slug).slice(0, 3);
  if (!others.length) return "";
  return (
    `<nav class="rel"><h2>あわせて読みたい</h2>` +
    others
      .map(
        (p) =>
          `<a href="/blog/${encodeURIComponent(p.slug)}">${escapeHtml(p.title)}<small>${escapeHtml(
            p.description.slice(0, 54)
          )}…</small></a>`
      )
      .join("") +
    `</nav>`
  );
}

export function renderArticle(post: BlogPost, all: BlogPost[], base: string): string {
  const canonical = `${base}/blog/${encodeURIComponent(post.slug)}`;
  const image = post.cover ? `${base}${post.cover}` : `${base}/og.png`;
  const author = post.author || "star-reviews 編集部";
  const ld = [
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      dateModified: post.updated || post.date,
      inLanguage: "ja",
      image: image,
      author: { "@type": "Organization", name: author, url: `${base}/` },
      publisher: {
        "@type": "Organization",
        name: "star-reviews",
        logo: { "@type": "ImageObject", url: `${base}/logo.png` },
      },
      mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    }),
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "ホーム", item: `${base}/` },
        { "@type": "ListItem", position: 2, name: "コラム", item: `${base}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: canonical },
      ],
    }),
  ];
  const tags = post.tags?.length
    ? `<div class="tags">${post.tags.map((t) => `<span>${escapeHtml(t)}</span>`).join("")}</div>`
    : "";
  const cover = post.cover
    ? `<img class="cover" src="${escapeHtml(post.cover)}" alt="${escapeHtml(post.title)}" loading="lazy">`
    : "";
  const updated =
    post.updated && post.updated !== post.date ? ` ・ 更新 ${formatDateJa(post.updated)}` : "";

  return (
    head({ title: `${post.title}｜star-reviews コラム`, desc: post.description, canonical, ogType: "article", image, jsonLd: ld }) +
    HEADER +
    `<main class="wrap">
      <nav class="crumbs"><a href="/">ホーム</a> › <a href="/blog">コラム</a> › ${escapeHtml(post.title)}</nav>
      <p class="eyebrow">column</p>
      <h1 class="post-title">${escapeHtml(post.title)}</h1>
      <div class="post-meta"><time datetime="${post.date}">${formatDateJa(post.date)}${updated}</time><span>${escapeHtml(
        author
      )}</span><span>約${readingMinutes(post.bodyHtml)}分で読めます</span></div>
      ${tags}
      ${cover}
      <article class="body">${post.bodyHtml}</article>
      <div class="cta-box">
        <h3>お客様の声を、集めて・貼るだけ。</h3>
        <p>匿名OK・返礼コードで集まる。無料プランはカード登録不要です。</p>
        <a href="/#auth">無料ではじめる</a>
      </div>
      ${relatedBlock(post, all)}
    </main>` +
    FOOTER
  );
}

export function renderList(posts: BlogPost[], base: string): string {
  const canonical = `${base}/blog`;
  const ld = [
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Blog",
      "@id": `${canonical}#blog`,
      name: "star-reviews コラム",
      description: "お客様の声・レビューの集め方、サイトへの掲載・埋め込み、事例づくりの実践記事。",
      url: canonical,
      inLanguage: "ja",
      publisher: { "@type": "Organization", name: "star-reviews", url: `${base}/` },
      blogPost: posts.map((p) => ({
        "@type": "BlogPosting",
        headline: p.title,
        datePublished: p.date,
        url: `${base}/blog/${encodeURIComponent(p.slug)}`,
      })),
    }),
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "ホーム", item: `${base}/` },
        { "@type": "ListItem", position: 2, name: "コラム", item: canonical },
      ],
    }),
  ];
  const cards = posts.length
    ? posts
        .map(
          (p) =>
            `<a class="card" href="/blog/${encodeURIComponent(p.slug)}">
          <span class="date">${formatDateJa(p.date)}</span>
          <h2>${escapeHtml(p.title)}</h2>
          <p>${escapeHtml(p.description)}</p>
        </a>`
        )
        .join("")
    : `<p style="color:var(--muted)">準備中です。もうすぐ最初の記事を公開します。</p>`;

  return (
    head({
      title: "コラム｜star-reviews",
      desc: "お客様の声・レビューの集め方、サイトへの掲載・埋め込み、事例づくりの実践記事をお届けします。",
      canonical,
      ogType: "website",
      image: `${base}/og.png`,
      jsonLd: ld,
    }) +
    HEADER +
    `<main class="wrap">
      <nav class="crumbs"><a href="/">ホーム</a> › コラム</nav>
      <div class="list-head">
        <p class="eyebrow">column</p>
        <h1>star-reviews コラム</h1>
        <p>お客様の声の集め方・見せ方、サイトへの埋め込み、事例づくりを実践目線で。</p>
      </div>
      <div class="cards">${cards}</div>
    </main>` +
    FOOTER
  );
}
