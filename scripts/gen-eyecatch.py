#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
star-reviews コラムのアイキャッチ（タイトル入りサムネイル）自動生成。
タイトルに関連するAI背景画像（Pollinations・無料/APIキー不要）に、黒×黄ブランドの
暗幕グラデ＋白ロゴ＋タイトル（最終行に黄色マーカー）＋★ を重ねる。
背景取得に失敗したら黒×黄の無地背景にフォールバック（必ず画像は出力される）。
  python3 scripts/gen-eyecatch.py <slug> "<title>" [out_png]
  環境変数 EYECATCH_BG=solid で背景画像を使わず無地にできる。
出力: public/blog/assets/<slug>.png（1200x630・og:image兼用）
"""
import sys, os, io, hashlib, random, time, urllib.parse, urllib.request
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

slug = sys.argv[1]
title = sys.argv[2]
out = sys.argv[3] if len(sys.argv) > 3 else os.path.join("public", "blog", "assets", slug + ".png")

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
W, H = 1200, 630
INK = (28, 26, 18)
SUN = (255, 198, 43)
SUN_DEEP = (234, 164, 0)
PAPER = (255, 253, 245)
MUTED = (188, 180, 160)

seed = int(hashlib.md5(slug.encode("utf-8")).hexdigest(), 16)
rnd = random.Random(seed)

FONT_PATH = os.path.join(HERE, "fonts", "NotoSansJP.ttf")
SYS_FONTS = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
]


def font(size, weight=800):
    if os.path.exists(FONT_PATH):
        try:
            f = ImageFont.truetype(FONT_PATH, size)
            try:
                f.set_variation_by_axes([weight])
            except Exception:
                pass
            return f
        except Exception:
            pass
    for p in SYS_FONTS:
        if os.path.exists(p):
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                pass
    return ImageFont.load_default()


# ---- タイトルから背景の題材を決める（キーワード一致・無ければ汎用） ----
SUBJECTS = [
    (("google", "グーグル"), "a smartphone showing Google Maps star reviews next to a small shop storefront"),
    (("video", "動画", "ugc"), "a person recording a short video testimonial on a smartphone on a tripod"),
    (("salon", "美容", "サロン", "hair"), "a bright modern hair salon interior with a styling chair"),
    (("restaurant", "飲食", "cafe", "カフェ"), "a cozy modern restaurant interior with tables"),
    (("clinic", "整体", "治療", "院"), "a clean bright wellness clinic reception desk"),
    (("ec", "ecommerce", "通販"), "an online shop product page on a laptop with five star ratings"),
    (("template", "テンプレート", "質問"), "a questionnaire form on a clipboard and a pen on a bright desk"),
    (("case", "事例", "導入"), "two people in a friendly business interview with a laptop"),
    (("structured", "構造化", "seo"), "a laptop showing search results with star ratings, clean desk"),
    (("stealth", "ステマ", "規制"), "a magnifying glass over review documents on a bright desk"),
    (("anonymous", "匿名"), "a smartphone showing a review form with five gold stars"),
    (("studio", "wordpress", "ペライチ", "embed", "埋め込み"), "a laptop on a bright desk showing a website with customer testimonial cards"),
    (("senja", "testimonial", "比較", "ツール"), "a laptop on a bright desk showing a reviews dashboard with star ratings"),
]


def pick_subject():
    low = (slug + " " + title).lower()
    for keys, subj in SUBJECTS:
        if any(k.lower() in low for k in keys):
            return subj
    return "five star customer reviews on a smartphone and laptop on a bright modern desk"


def fetch_bg():
    if os.environ.get("EYECATCH_BG", "").strip() == "solid":
        return None
    # 記事が EYECATCH_PROMPT で題材を具体指定していれば最優先（よりタイトルに寄せられる）
    subj = os.environ.get("EYECATCH_PROMPT", "").strip() or pick_subject()
    prompt = (
        "straight-on eye-level photo of " + subj + ", soft natural daylight, "
        "hyperrealistic photograph, ultra detailed, bright and airy, clean composition, "
        "no text, no words, no letters, no watermark"
    )
    for model, to in [("flux", 70), ("turbo", 45), ("flux", 70)]:
        try:
            url = (
                "https://image.pollinations.ai/prompt/" + urllib.parse.quote(prompt)
                + "?width=1200&height=630&seed=%d&nologo=true&model=%s" % (seed % 100000, model)
            )
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            data = urllib.request.urlopen(req, timeout=to).read()
            im = Image.open(io.BytesIO(data)).convert("RGB")
            if im.width < 400:
                raise ValueError("too small")
            # 右下に入る Pollinations の透かしを下端クロップで除去
            im = im.crop((0, 0, im.width, int(im.height * 0.92)))
            return im.resize((W, H), Image.LANCZOS)
        except Exception as e:
            sys.stderr.write("pollinations %s fail: %s\n" % (model, e))
            time.sleep(2)
    return None


# ---- 背景を作る ----
bg = fetch_bg()
img = Image.new("RGB", (W, H), INK)
if bg is not None:
    # 少し落ち着かせる（彩度↓・明度やや↓）＝写真くさすぎない編集的トーン
    bg = ImageEnhance.Color(bg).enhance(0.72)
    bg = ImageEnhance.Brightness(bg).enhance(0.92)
    img.paste(bg, (0, 0))
    # 左→右の暗幕グラデ（左側ほど暗く＝左寄せの文字が読める）
    grad = Image.new("L", (W, 1))
    for x in range(W):
        t = x / W
        a = int(232 - t * 150)  # 左232 → 右82
        grad.putpixel((x, 0), max(0, min(255, a)))
    grad = grad.resize((W, H))
    dark = Image.new("RGB", (W, H), INK)
    img = Image.composite(dark, img, grad)
    # 下側も軽く暗く
    gb = Image.new("L", (1, H))
    for y in range(H):
        t = y / H
        gb.putpixel((0, y), int(120 * max(0, (t - 0.55) / 0.45)) if t > 0.55 else 0)
    gb = gb.resize((W, H))
    img = Image.composite(Image.new("RGB", (W, H), INK), img, gb)
else:
    # フォールバック: 無地＋微細ドット
    d0 = ImageDraw.Draw(img)
    for _ in range(38):
        x = rnd.randint(40, W - 40); y = rnd.randint(150, H - 40)
        r = rnd.choice([2, 2, 3])
        d0.ellipse([x, y, x + r, y + r], fill=(44, 41, 30))

d = ImageDraw.Draw(img)
# 上下の黄色ルール
d.rectangle([0, 0, W, 12], fill=SUN)
d.rectangle([0, H - 12, W, H], fill=SUN)

PADX = 84
top = 70
logo_p = os.path.join(ROOT, "public", "logo-white.png")
if os.path.exists(logo_p):
    logo = Image.open(logo_p).convert("RGBA")
    lw = 300
    lh = int(logo.height * lw / logo.width)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    img.paste(logo, (PADX, top), logo)
    eyebrow_y = top + lh + 26
else:
    eyebrow_y = top

d.text((PADX, eyebrow_y), "star-reviews コラム", font=font(26, 600), fill=MUTED)


def wrap(text, fnt, maxw):
    """折返した各行を (行テキスト, title内の開始index) で返す。"""
    lines, cur, start = [], "", 0
    for i, ch in enumerate(text):
        test = cur + ch
        if d.textlength(test, font=fnt) <= maxw or not cur:
            cur = test
        else:
            lines.append((cur, start)); cur = ch; start = i
    if cur:
        lines.append((cur, start))
    return lines


# 強調フレーズ emph を決める: 明示指定 > 【】内 > 「」内 > なし
import re as _re
emph = os.environ.get("EYECATCH_EMPH", "").strip()
if not emph:
    m = _re.search(r"[【「](.+?)[】」]", title)
    if m:
        emph = m.group(1)
# emph の title内の範囲 [es, ee)
es = ee = -1
if emph and emph in title:
    es = title.index(emph)
    ee = es + len(emph)

maxw = W - PADX * 2
size = 66
while size >= 40:
    tf = font(size, 900)
    lines = wrap(title, tf, maxw)
    lh = int(size * 1.34)
    if len(lines) <= 4 and lh * len(lines) <= 300:
        break
    size -= 4

ty = eyebrow_y + 54
for ln, lstart in lines:
    y = ty + (lines.index((ln, lstart))) * lh
    lend = lstart + len(ln)
    # この行と emph 範囲の重なり
    hs = max(lstart, es) if es >= 0 else -1
    he = min(lend, ee) if es >= 0 else -1
    # まず行全体を白（写真上でも読めるよう薄い影）
    d.text((PADX + 2, y + 2), ln, font=tf, fill=(0, 0, 0))
    d.text((PADX, y), ln, font=tf, fill=PAPER)
    if hs >= 0 and he > hs:
        # 強調セグメントだけ黄色マーカー＋黒文字で上書き
        pre = title[lstart:hs]
        seg = title[hs:he]
        x0 = PADX + d.textlength(pre, font=tf)
        segw = d.textlength(seg, font=tf)
        d.rectangle([x0 - 8, y - 2, x0 + segw + 8, y + size + 16], fill=SUN)
        d.text((x0, y), seg, font=tf, fill=INK)

d.text((PADX, H - 74), "star-reviews.net", font=font(28, 700), fill=SUN)
stars = "★★★★★"
sf = font(30, 700)
sw = d.textlength(stars, font=sf)
d.text((W - PADX - sw, H - 76), stars, font=sf, fill=SUN_DEEP)

os.makedirs(os.path.dirname(out), exist_ok=True)
img.save(out, "PNG")
print("eyecatch:", out, img.size, "bg=" + ("photo" if bg is not None else "solid"))
