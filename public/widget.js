/* star-reviews 埋め込みウィジェット
   使い方: <script src="https://<your-domain>/widget.js" data-token="pub_xxxxx" async></script>
   任意属性:
     data-layout="grid|carousel|list"        表示レイアウト（未指定なら管理画面の設定）
     data-star="gold|mono|emoji|heart|number" ★マークの種類
     data-theme="light|minimal|quote|dark"    カードの見せ方
     data-summary="off"                        平均★サマリーを隠す
     data-schema="off"                         Google構造化データ(JSON-LD)を止める
   任意で <div data-star-reviews></div> を置くとそこに描画。なければスクリプト直後に描画。 */
(function () {
  var me =
    document.currentScript ||
    (function () {
      var s = document.querySelectorAll("script[data-token]");
      return s[s.length - 1];
    })();
  if (!me) return;
  var token = me.getAttribute("data-token");
  if (!token) return;
  var A = function (k, d) { return (me.getAttribute(k) || d || "").toLowerCase(); };
  var layoutAttr = A("data-layout");
  var starStyle = A("data-star", "gold");
  var theme = A("data-theme", "light");
  var summaryOff = A("data-summary") === "off";
  var schemaOff = A("data-schema") === "off";
  var base;
  try { base = new URL(me.src).origin; } catch (e) { base = ""; }

  var mount = document.querySelector("[data-star-reviews]");
  if (!mount) {
    mount = document.createElement("div");
    me.parentNode.insertBefore(mount, me.nextSibling);
  }
  var shadow = mount.attachShadow ? mount.attachShadow({ mode: "open" }) : mount;

  var css =
    ":host{all:initial;display:block}" +
    "*{box-sizing:border-box}" +
    ".sr-root{font-family:'Hiragino Kaku Gothic ProN','Hiragino Sans','Noto Sans JP',system-ui,sans-serif;color:#1c1a12}" +
    /* stars */
    ".sr-stars{font-size:16px;letter-spacing:1.5px;line-height:1;white-space:nowrap}" +
    ".sr-s-gold .sr-f{color:#eaa400}.sr-s-gold .sr-e{color:#e4dcc8}" +
    ".sr-s-mono .sr-f{color:#1c1a12}.sr-s-mono .sr-e{color:#d8cfbb}" +
    ".sr-s-heart .sr-f{color:#e5484d}.sr-s-heart .sr-e{color:#f0cfd0}" +
    ".sr-s-emoji{letter-spacing:1px}" +
    ".sr-num{display:inline-flex;align-items:center;gap:5px;font-weight:800}" +
    ".sr-num b{font-size:1.05em}.sr-num .sr-f{color:#eaa400}" +
    /* summary */
    ".sr-sum{display:flex;align-items:center;gap:12px;margin:0 0 16px;flex-wrap:wrap}" +
    ".sr-sum-avg{font-size:30px;font-weight:800;line-height:1;letter-spacing:-.02em}" +
    ".sr-sum .sr-stars{font-size:18px}" +
    ".sr-sum-count{font-size:13px;color:#7c7563;font-weight:700}" +
    /* layouts */
    ".sr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}" +
    ".sr-list{display:flex;flex-direction:column;gap:14px}" +
    ".sr-carousel{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:10px;-webkit-overflow-scrolling:touch}" +
    ".sr-carousel::-webkit-scrollbar{height:7px}.sr-carousel::-webkit-scrollbar-thumb{background:#e0d4b6;border-radius:999px}" +
    ".sr-carousel .sr-card{flex:0 0 clamp(240px,80%,320px);scroll-snap-align:start}" +
    /* base card */
    ".sr-card{background:#fff;border:1px solid #ece3cf;border-radius:15px;padding:17px 17px 15px;box-shadow:0 2px 10px rgba(60,46,12,.06)}" +
    ".sr-top{display:flex;align-items:center;justify-content:space-between;gap:8px}" +
    ".sr-src{font-size:10px;color:#9a917c;font-weight:700;letter-spacing:.04em}" +
    ".sr-body{color:#413d30;font-size:14px;line-height:1.72;margin:10px 0 13px;white-space:pre-wrap}" +
    ".sr-video{width:100%;border-radius:10px;margin:10px 0;background:#000;display:block}" +
    ".sr-foot{display:flex;align-items:center;gap:9px}" +
    ".sr-photo{width:36px;height:36px;border-radius:50%;object-fit:cover;flex:0 0 auto}" +
    ".sr-avatar{width:36px;height:36px;border-radius:50%;flex:0 0 auto;background:#ffe7a0;display:flex;align-items:center;justify-content:center;color:#eaa400;font-weight:800;font-size:14px}" +
    ".sr-who{font-size:13px;color:#1c1a12;font-weight:700}" +
    ".sr-badge{font-size:10.5px;color:#1c7d52;background:#e2f3e8;border-radius:999px;padding:1px 8px;font-weight:700;margin-left:auto}" +
    ".sr-empty{color:#7c7563;font-size:13px;padding:10px}" +
    ".sr-credit{margin-top:13px;font-size:10px;color:#b3a99c;text-align:right;letter-spacing:.08em;text-transform:uppercase}" +
    /* theme: minimal */
    ".sr-theme-minimal .sr-card{background:transparent;border:0;border-bottom:1px solid #ece3cf;border-radius:0;box-shadow:none;padding:16px 2px}" +
    ".sr-theme-minimal .sr-grid{gap:0}.sr-theme-minimal .sr-list{gap:0}" +
    /* theme: quote */
    ".sr-theme-quote .sr-card{background:#fff;border:0;box-shadow:0 2px 14px rgba(60,46,12,.07);position:relative;padding:30px 20px 18px}" +
    ".sr-theme-quote .sr-card::before{content:'\\201C';position:absolute;top:2px;left:14px;font-family:Georgia,serif;font-size:52px;color:#ffcf4a;line-height:1}" +
    ".sr-theme-quote .sr-body{font-size:15px;font-style:italic;color:#2a2720}" +
    /* theme: dark */
    ".sr-theme-dark .sr-card{background:#1c1a12;border-color:#3a3626;box-shadow:none}" +
    ".sr-theme-dark .sr-body{color:#e7e1d0}.sr-theme-dark .sr-who{color:#fff}" +
    ".sr-theme-dark .sr-s-mono .sr-f{color:#fff}.sr-theme-dark .sr-s-mono .sr-e{color:#4a4636}" +
    ".sr-theme-dark .sr-avatar{background:#3a3626;color:#ffca45}" +
    ".sr-theme-dark.sr-root .sr-sum-avg{color:#1c1a12}" +
    /* 追加★スタイル（サイズ・質感・アニメ） */
    ".sr-s-big{font-size:26px;letter-spacing:3px}.sr-s-big .sr-f{color:#eaa400}.sr-s-big .sr-e{color:#e8dcc0}" +
    ".sr-s-glow .sr-f{color:#ffbe00;animation:srGlow 1.8s ease-in-out infinite}.sr-s-glow .sr-e{color:#eadfbf}" +
    "@keyframes srGlow{0%,100%{text-shadow:0 0 2px rgba(255,190,0,.25)}50%{text-shadow:0 0 10px rgba(255,185,0,.95),0 0 20px rgba(255,185,0,.55)}}" +
    ".sr-s-shine .sr-f{background:linear-gradient(100deg,#c57f00 0%,#ffd34d 22%,#fff7d6 34%,#ffd34d 48%,#c57f00 72%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:srShine 2.6s linear infinite}.sr-s-shine .sr-e{color:#e6d9b6}" +
    "@keyframes srShine{0%{background-position:180% 0}100%{background-position:-70% 0}}" +
    ".sr-s-metal .sr-f{background:linear-gradient(180deg,#ffe9a3 0%,#f3b808 46%,#a86f09 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 1px 0 rgba(255,255,255,.45))}.sr-s-metal .sr-e{color:#e2d4b0}" +
    ".sr-s-mini{font-size:12px;letter-spacing:1px}.sr-s-mini .sr-f{color:#eaa400}.sr-s-mini .sr-e{color:#e4dcc8}" +
    ".sr-chips{display:flex;flex-wrap:wrap;gap:14px}.sr-chips .sr-card{flex:0 1 260px;padding:13px 15px}" +
    "@media(prefers-reduced-motion:reduce){.sr-s-glow .sr-f,.sr-s-shine .sr-f{animation:none}}";

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
  function rep(ch, n) { var o = ""; for (var i = 0; i < n; i++) o += ch; return o; }

  // ★マーク描画（style別）。value は数値（整数または平均）。
  function starHTML(value) {
    var v = Math.max(0, Math.min(5, value || 0));
    if (starStyle === "number") {
      return "<span class='sr-stars sr-num'><span class='sr-f'>★</span><b>" + v.toFixed(1) + "</b><span style='color:#9a917c;font-weight:700'>/5</span></span>";
    }
    var n = Math.round(v);
    if (starStyle === "emoji") {
      return "<span class='sr-stars sr-s-emoji'>" + rep("⭐", n) + "</span>";
    }
    var g = { gold: ["★", "☆"], mono: ["★", "☆"], heart: ["❤", "♡"] }[starStyle] || ["★", "☆"];
    var KNOWN = { gold: 1, mono: 1, heart: 1, big: 1, glow: 1, shine: 1, metal: 1, mini: 1 };
    var cls = KNOWN[starStyle] ? starStyle : "gold";
    return "<span class='sr-stars sr-s-" + cls + "'>" +
      "<span class='sr-f'>" + rep(g[0], n) + "</span><span class='sr-e'>" + rep(g[1], 5 - n) + "</span></span>";
  }

  function layoutClass(l) { return l === "carousel" ? "sr-carousel" : l === "list" ? "sr-list" : l === "chips" ? "sr-chips" : "sr-grid"; }
  var THEMES = { light: 1, minimal: 1, quote: 1, dark: 1 };

  function render(data) {
    var items = (data && data.items) || [];
    var layout = layoutClass(layoutAttr || (data && data.layout) || "grid");
    var summary = (data && data.summary) || { count: 0, avg: 0 };
    var th = THEMES[theme] ? theme : "light";

    var html = "<style>" + css + "</style><div class='sr-root sr-theme-" + th + "'>";

    if (!summaryOff && summary.count > 0) {
      html +=
        "<div class='sr-sum'>" +
        (starStyle === "number" ? "" : "<span class='sr-sum-avg'>" + (summary.avg || 0).toFixed(1) + "</span>") +
        "<span>" + starHTML(summary.avg) + "<br>" +
        "<span class='sr-sum-count'>" + summary.count + "件のお客様の声</span></span>" +
        "</div>";
    }

    if (!items.length) {
      html += "<div class='sr-empty'>まだ口コミはありません。</div>";
    } else {
      html += "<div class='" + layout + "'>";
      items.forEach(function (it) {
        var who = (it.author || "").trim();
        var initial = who && who !== "匿名希望" && who !== "匿名のお客様" ? who.charAt(0) : "★";
        var avatar = it.photo_url
          ? "<img class='sr-photo' src='" + esc(it.photo_url) + "' alt=''>"
          : "<span class='sr-avatar'>" + esc(initial) + "</span>";
        html +=
          "<div class='sr-card'>" +
          "<div class='sr-top'>" + starHTML(it.rating) +
          (it.source ? "<span class='sr-src'>via " + esc(it.source) + "</span>" : "") +
          "</div>" +
          (it.video_url ? "<video class='sr-video' controls playsinline preload='metadata' src='" + esc(it.video_url) + "'></video>" : "") +
          "<div class='sr-body'>" + esc(it.body) + "</div>" +
          "<div class='sr-foot'>" + avatar +
          "<span class='sr-who'>" + esc(it.author) + "</span>" +
          (it.verified ? "<span class='sr-badge'>確認済み</span>" : "") +
          "</div></div>";
      });
      html += "</div>";
    }
    html += "<div class='sr-credit'>お客様の声 by star-reviews</div></div>";
    shadow.innerHTML = html;

    if (!schemaOff) injectSchema(data);
  }

  // Google リッチスニペット用の構造化データ（JSON-LD）をライトDOMに注入
  function injectSchema(data) {
    try {
      var items = (data && data.items) || [];
      var summary = (data && data.summary) || { count: 0, avg: 0 };
      var name = (data && data.business_name) || "";
      if (!name || !summary.count) return;
      var id = "sr-jsonld-" + token;
      var old = document.getElementById(id);
      if (old) old.parentNode.removeChild(old);
      var ld = {
        "@context": "https://schema.org",
        "@type": "Organization",
        name: name,
        aggregateRating: { "@type": "AggregateRating", ratingValue: summary.avg, reviewCount: summary.count, bestRating: 5, worstRating: 1 },
        review: items.slice(0, 50).map(function (it) {
          var r = {
            "@type": "Review",
            reviewRating: { "@type": "Rating", ratingValue: it.rating || 5, bestRating: 5, worstRating: 1 },
            author: { "@type": "Person", name: it.author || "匿名のお客様" },
            reviewBody: it.body || "",
          };
          if (it.date) r.datePublished = it.date;
          return r;
        }),
      };
      var s = document.createElement("script");
      s.type = "application/ld+json";
      s.id = id;
      s.textContent = JSON.stringify(ld);
      document.head.appendChild(s);
    } catch (e) { /* 構造化データは本体描画に影響させない */ }
  }

  fetch(base + "/api/wall/" + encodeURIComponent(token))
    .then(function (r) { return r.json(); })
    .then(render)
    .catch(function () { render({ items: [] }); });
})();
