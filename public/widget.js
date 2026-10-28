/* star-reviews 埋め込みウィジェット
   使い方: <script src="https://<your-domain>/widget.js" data-token="pub_xxxxx" async></script>
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
  var base;
  try { base = new URL(me.src).origin; } catch (e) { base = ""; }

  var mount = document.querySelector("[data-star-reviews]");
  if (!mount) {
    mount = document.createElement("div");
    me.parentNode.insertBefore(mount, me.nextSibling);
  }

  var shadow = mount.attachShadow ? mount.attachShadow({ mode: "open" }) : mount;

  var css =
    ":host{all:initial}" +
    ".sr-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px;" +
    "font-family:'Hiragino Kaku Gothic ProN','Hiragino Sans','Noto Sans JP',system-ui,sans-serif}" +
    ".sr-card{background:#fff;border:1px solid #ece3cf;border-radius:15px;padding:17px 17px 15px;" +
    "box-shadow:0 2px 10px rgba(60,46,12,.06)}" +
    ".sr-stars{color:#eaa400;font-size:16px;letter-spacing:1.5px;line-height:1}" +
    ".sr-body{color:#413d30;font-size:14px;line-height:1.72;margin:10px 0 13px;white-space:pre-wrap}" +
    ".sr-foot{display:flex;align-items:center;gap:9px}" +
    ".sr-photo{width:36px;height:36px;border-radius:50%;object-fit:cover;flex:0 0 auto}" +
    ".sr-avatar{width:36px;height:36px;border-radius:50%;flex:0 0 auto;background:#ffe7a0;" +
    "display:flex;align-items:center;justify-content:center;color:#eaa400;font-weight:800;font-size:14px}" +
    ".sr-who{font-size:13px;color:#1c1a12;font-weight:700}" +
    ".sr-badge{font-size:10.5px;color:#1c7d52;background:#e2f3e8;border-radius:999px;padding:1px 8px;font-weight:700;margin-left:auto}" +
    ".sr-empty{color:#7c7563;font-size:13px;padding:10px}" +
    ".sr-credit{margin-top:13px;font-size:10px;color:#b3a99c;text-align:right;letter-spacing:.08em;text-transform:uppercase}";

  function esc(s){ var d=document.createElement("div"); d.textContent=s==null?"":s; return d.innerHTML; }
  function stars(n){ n=Math.max(0,Math.min(5,n|0)); return "★★★★★".slice(0,n)+"☆☆☆☆☆".slice(0,5-n); }

  function render(data){
    var items = (data && data.items) || [];
    var html = "<style>"+css+"</style>";
    if(!items.length){ html += '<div class="sr-empty">まだ口コミはありません。</div>'; }
    else{
      html += '<div class="sr-grid">';
      items.forEach(function(it){
        var who = (it.author||"").trim();
        var initial = who && who !== "匿名希望" ? who.charAt(0) : "★";
        var avatar = it.photo_url
          ? '<img class="sr-photo" src="'+esc(it.photo_url)+'" alt="">'
          : '<span class="sr-avatar">'+esc(initial)+'</span>';
        html += '<div class="sr-card">'+
          '<div class="sr-stars" aria-label="星'+ (it.rating||0) +'">'+stars(it.rating)+'</div>'+
          '<div class="sr-body">'+esc(it.body)+'</div>'+
          '<div class="sr-foot">'+
            avatar+
            '<span class="sr-who">'+esc(it.author)+'</span>'+
            (it.verified?'<span class="sr-badge">確認済み</span>':'')+
          '</div>'+
        '</div>';
      });
      html += '</div>';
    }
    html += '<div class="sr-credit">お客様の声 by star-reviews</div>';
    shadow.innerHTML = html;
  }

  fetch(base + "/api/wall/" + encodeURIComponent(token))
    .then(function(r){ return r.json(); })
    .then(render)
    .catch(function(){ render({ items: [] }); });
})();
