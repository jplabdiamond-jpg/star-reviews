/* star-reviews 埋め込みウィジェット
   使い方: <script src="https://<your-domain>/widget.js" data-token="pub_xxxxx" async></script>
   任意属性:
     data-layout="grid|carousel|list"  表示レイアウト（未指定なら管理画面の設定を使用）
     data-summary="off"                 平均★サマリーを隠す
     data-schema="off"                  Google構造化データ(JSON-LD)の出力を止める
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
  var layoutAttr = (me.getAttribute("data-layout") || "").toLowerCase();
  var summaryOff = (me.getAttribute("data-summary") || "").toLowerCase() === "off";
  var schemaOff = (me.getAttribute("data-schema") || "").toLowerCase() === "off";
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
    /* summary */
    ".sr-sum{display:flex;align-items:center;gap:12px;margin:0 0 16px;flex-wrap:wrap}" +
    ".sr-sum-avg{font-size:30px;font-weight:800;line-height:1;letter-spacing:-.02em}" +
    ".sr-sum-stars{color:#eaa400;font-size:18px;letter-spacing:2px;line-height:1}" +
    ".sr-sum-count{font-size:13px;color:#7c7563;font-weight:700}" +
    /* layouts */
    ".sr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}" +
    ".sr-list{display:flex;flex-direction:column;gap:14px}" +
    ".sr-carousel{display:flex;gap:14px;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:10px;-webkit-overflow-scrolling:touch}" +
    ".sr-carousel::-webkit-scrollbar{height:7px}" +
    ".sr-carousel::-webkit-scrollbar-thumb{background:#e0d4b6;border-radius:999px}" +
    ".sr-carousel .sr-card{flex:0 0 clamp(240px,80%,320px);scroll-snap-align:start}" +
    /* card */
    ".sr-card{background:#fff;border:1px solid #ece3cf;border-radius:15px;padding:17px 17px 15px;" +
    "box-shadow:0 2px 10px rgba(60,46,12,.06)}" +
    ".sr-top{display:flex;align-items:center;justify-content:space-between;gap:8px}" +
    ".sr-stars{color:#eaa400;font-size:16px;letter-spacing:1.5px;line-height:1}" +
    ".sr-src{font-size:10px;color:#9a917c;font-weight:700;letter-spacing:.04em}" +
    ".sr-body{color:#413d30;font-size:14px;line-height:1.72;margin:10px 0 13px;white-space:pre-wrap}" +
    ".sr-foot{display:flex;align-items:center;gap:9px}" +
    ".sr-photo{width:36px;height:36px;border-radius:50%;object-fit:cover;flex:0 0 auto}" +
    ".sr-avatar{width:36px;height:36px;border-radius:50%;flex:0 0 auto;background:#ffe7a0;" +
    "display:flex;align-items:center;justify-content:center;color:#eaa400;font-weight:800;font-size:14px}" +
    ".sr-who{font-size:13px;color:#1c1a12;font-weight:700}" +
    ".sr-badge{font-size:10.5px;color:#1c7d52;background:#e2f3e8;border-radius:999px;padding:1px 8px;font-weight:700;margin-left:auto}" +
    ".sr-empty{color:#7c7563;font-size:13px;padding:10px}" +
    ".sr-credit{margin-top:13px;font-size:10px;color:#b3a99c;text-align:right;letter-spacing:.08em;text-transform:uppercase}";

  function esc(s) { var d = document.createElement("div"); d.textContent = s == null ? "" : s; return d.innerHTML; }
  function stars(n) { n = Math.max(0, Math.min(5, Math.round(n || 0))); return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n); }

  function layoutClass(layout) {
    if (layout === "carousel") return "sr-carousel";
    if (layout === "list") return "sr-list";
    return "sr-grid";
  }

  function render(data) {
    var items = (data && data.items) || [];
    var layout = layoutClass(layoutAttr || (data && data.layout) || "grid");
    var summary = (data && data.summary) || { count: 0, avg: 0 };

    var html = "<style>" + css + "</style><div class='sr-root'>";

    if (!summaryOff && summary.count > 0) {
      html +=
        "<div class='sr-sum'>" +
        "<span class='sr-sum-avg'>" + (summary.avg || 0).toFixed(1) + "</span>" +
        "<span><span class='sr-sum-stars'>" + stars(summary.avg) + "</span><br>" +
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
          "<div class='sr-top'>" +
          "<span class='sr-stars' aria-label='星" + (it.rating || 0) + "'>" + stars(it.rating) + "</span>" +
          (it.source ? "<span class='sr-src'>via " + esc(it.source) + "</span>" : "") +
          "</div>" +
          "<div class='sr-body'>" + esc(it.body) + "</div>" +
          "<div class='sr-foot'>" +
          avatar +
          "<span class='sr-who'>" + esc(it.author) + "</span>" +
          (it.verified ? "<span class='sr-badge'>確認済み</span>" : "") +
          "</div>" +
          "</div>";
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
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: summary.avg,
          reviewCount: summary.count,
          bestRating: 5,
          worstRating: 1,
        },
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
    } catch (e) {
      /* 構造化データは本体描画に影響させない */
    }
  }

  fetch(base + "/api/wall/" + encodeURIComponent(token))
    .then(function (r) { return r.json(); })
    .then(render)
    .catch(function () { render({ items: [] }); });
})();
