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
    "font-family:'Hiragino Kaku Gothic ProN','Noto Sans JP',system-ui,sans-serif}" +
    ".sr-card{background:#fff;border:1px solid #ece2d4;border-radius:14px;padding:16px 16px 14px;" +
    "box-shadow:0 1px 2px rgba(40,30,20,.04)}" +
    ".sr-stars{color:#f3a712;font-size:16px;letter-spacing:1px;line-height:1}" +
    ".sr-body{color:#2b2838;font-size:14px;line-height:1.7;margin:9px 0 12px;white-space:pre-wrap}" +
    ".sr-foot{display:flex;align-items:center;gap:9px}" +
    ".sr-photo{width:34px;height:34px;border-radius:50%;object-fit:cover;flex:0 0 auto}" +
    ".sr-who{font-size:13px;color:#6f6a7d;font-weight:700}" +
    ".sr-badge{font-size:10.5px;color:#1d8a5f;background:#e4f5ec;border-radius:999px;padding:1px 7px;font-weight:700}" +
    ".sr-empty{color:#9b9488;font-size:13px;padding:10px}" +
    ".sr-credit{margin-top:12px;font-size:10.5px;color:#b3a99c;text-align:right;letter-spacing:.05em}";

  function esc(s){ var d=document.createElement("div"); d.textContent=s==null?"":s; return d.innerHTML; }
  function stars(n){ n=Math.max(0,Math.min(5,n|0)); return "★★★★★".slice(0,n)+"☆☆☆☆☆".slice(0,5-n); }

  function render(data){
    var items = (data && data.items) || [];
    var html = "<style>"+css+"</style>";
    if(!items.length){ html += '<div class="sr-empty">まだ口コミはありません。</div>'; }
    else{
      html += '<div class="sr-grid">';
      items.forEach(function(it){
        html += '<div class="sr-card">'+
          '<div class="sr-stars" aria-label="星'+ (it.rating||0) +'">'+stars(it.rating)+'</div>'+
          '<div class="sr-body">'+esc(it.body)+'</div>'+
          '<div class="sr-foot">'+
            (it.photo_url?'<img class="sr-photo" src="'+esc(it.photo_url)+'" alt="">':'')+
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
