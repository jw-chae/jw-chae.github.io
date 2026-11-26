"""Measure, for the YOLO chapter's 160 x 160 picture (cat-pixel.webp at CAT_AT, cup drawn in GT_CUP), the share of each
token cell covered by the cat (and, in the two-cat picture, by the visible part of the cat behind) and by the cup.
Cells of 32 px (5 x 5, DETR's stride 32) and 16 px (10 x 10). Same method as the YOLO agent's cover.py (10x supersampling)."""
import numpy as np
from PIL import Image, ImageDraw

SRC = r"E:/OneDrive/Documents/THU/CV/joongwon-research-website/public/study/cat-pixel.webp"
SS = 10
cat = Image.open(SRC).convert("RGBA")


def place(k, ox, oy):
    w, h = round(658 * k * SS), round(720 * k * SS)
    c = cat.resize((w, h), Image.LANCZOS)
    layer = Image.new("RGBA", (160 * SS, 160 * SS), (0, 0, 0, 0))
    layer.paste(c, (round(ox * SS), round(oy * SS)))
    a = np.array(layer)[:, :, 3].astype(np.float64) / 255.0
    return a  # 1600 x 1600


def cup_mask():
    x1, y1, x2, y2 = 114, 94, 148, 138
    rimY, bodyR = y1 + 3, x2 - 8
    im = Image.new("L", (160 * SS, 160 * SS), 0)
    d = ImageDraw.Draw(im)
    s = lambda v: v * SS
    d.polygon([(s(x1), s(rimY)), (s(bodyR), s(rimY)), (s(bodyR - 3), s(y2)), (s(x1 + 3), s(y2))], fill=255)
    cx, cy, rx, ry = (x1 + bodyR) / 2, rimY, (bodyR - x1) / 2, 3
    d.ellipse([s(cx - rx), s(cy - ry), s(cx + rx), s(cy + ry)], fill=255)
    hx, hy, r = bodyR, (rimY + y2) / 2 - 3.5, x2 - bodyR - 0.8
    lw = 1.6
    d.arc([s(hx - r - lw / 2), s(hy - r - lw / 2), s(hx + r + lw / 2), s(hy + r + lw / 2)], start=-90, end=90, fill=255, width=round(lw * SS))
    return np.array(im).astype(np.float64) / 255.0


def cells(a, n):
    step = a.shape[0] // n
    return a.reshape(n, step, n, step).mean(axis=(1, 3))


a1 = place(0.15, 0.3, 30.8)
a2 = place(0.138, 14.3, 29.8)
cup = cup_mask()
vis2 = a2 * (1 - a1) * (1 - cup)  # cat 2 seen behind cat 1 (and the cup, which does not overlap)
np.set_printoptions(precision=4, suppress=True, linewidth=160)
print("check 4x4 cat1 (YOLO CAT_COVER):\n", cells(a1, 4))
for n in (5, 10):
    print(f"--- {n}x{n} ---")
    print("cat1\n", np.round(cells(a1, n), 4).tolist())
    print("cat2 visible\n", np.round(cells(vis2, n), 4).tolist())
    print("cup\n", np.round(cells(cup, n), 4).tolist())
print("cup area px", cup.sum() / SS / SS, " cup box share", cup[94 * SS:138 * SS, 114 * SS:148 * SS].mean())
