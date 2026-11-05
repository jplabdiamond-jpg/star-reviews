#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
star-reviews コラムのアイキャッチ（タイトル入りサムネイル）自動生成。
黒×黄エディトリアルのブランドに統一（AIっぽいテンプレ背景は使わない）。
  python3 scripts/gen-eyecatch.py <slug> "<title>" [out_png]
出力: public/blog/assets/<slug>.png（1200x630・og:image兼用）
フォントは scripts/fonts/NotoSansJP.ttf（無ければ system Noto CJK）。
"""
import sys, os, hashlib, random
from PIL import Image, ImageDraw, ImageFont

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
MUTED = (178, 170, 150)

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


img = Image.new("RGB", (W, H), INK)
d = ImageDraw.Draw(img)

# 背景の薄いドット（控えめなテクスチャ）
for _ in range(38):
    x = rnd.randint(40, W - 40)
    y = rnd.randint(150, H - 40)
    r = rnd.choice([2, 2, 3])
    d.ellipse([x, y, x + r, y + r], fill=(44, 41, 30))

# 上下の黄色ルール
d.rectangle([0, 0, W, 12], fill=SUN)
d.rectangle([0, H - 12, W, H], fill=SUN)

PADX = 84
# ロゴ（白版）
logo_p = os.path.join(ROOT, "public", "logo-white.png")
top = 70
if os.path.exists(logo_p):
    logo = Image.open(logo_p).convert("RGBA")
    lw = 300
    lh = int(logo.height * lw / logo.width)
    logo = logo.resize((lw, lh), Image.LANCZOS)
    img.paste(logo, (PADX, top), logo)
    eyebrow_y = top + lh + 26
else:
    eyebrow_y = top

# アイブロー
d.text((PADX, eyebrow_y), "star-reviews コラム", font=font(26, 600), fill=MUTED)

# タイトル（幅で自動折返し・最大4行・サイズ自動）
def wrap(text, fnt, maxw):
    lines, cur = [], ""
    for ch in text:
        test = cur + ch
        if d.textlength(test, font=fnt) <= maxw or not cur:
            cur = test
        else:
            lines.append(cur)
            cur = ch
    if cur:
        lines.append(cur)
    return lines

maxw = W - PADX * 2
size = 66
while size >= 40:
    tf = font(size, 900)
    lines = wrap(title, tf, maxw)
    lh = int(size * 1.34)
    block_h = lh * len(lines)
    if len(lines) <= 4 and block_h <= 300:
        break
    size -= 4

ty = eyebrow_y + 54
# タイトル最終行の一部に黄色マーカー（エディトリアルの蛍光ペン表現）
for i, ln in enumerate(lines):
    y = ty + i * lh
    if i == len(lines) - 1:
        # 最終行は黄色の全高ハイライト（黒文字がしっかり読める“付箋”表現）
        tw = d.textlength(ln, font=tf)
        d.rectangle([PADX - 10, y - 2, PADX + tw + 14, y + size + 16], fill=SUN)
        d.text((PADX, y), ln, font=tf, fill=INK)
    else:
        d.text((PADX, y), ln, font=tf, fill=PAPER)

# 下部: URL と ★
d.text((PADX, H - 74), "star-reviews.net", font=font(28, 700), fill=SUN)
stars = "★★★★★"
sf = font(30, 700)
sw = d.textlength(stars, font=sf)
d.text((W - PADX - sw, H - 76), stars, font=sf, fill=SUN_DEEP)

os.makedirs(os.path.dirname(out), exist_ok=True)
img.save(out, "PNG")
print("eyecatch:", out, img.size)
