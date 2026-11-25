"""Numbers for the tokens chapter, measured from public/study/cat-square.png.

Crop: x 158..318, y 79..239 (160 px), cut 4 x 4 into 40 px cells; the cat's left-hand eye (viewer's left) sits in cell 7 (row 2, column 4).
Per cell: block mean of R, G, B (0..1); brightness = 0.299 R + 0.587 G + 0.114 B; blueness = B - R. Both rounded to two decimals.
Closed eye: the eye ellipse (centre 296.5, 131.5; radii 17.5, 11.5) painted in the mean colour of the fur ring around it,
with a dark lid line, then cell 7 measured the same way.
"""
import json
import numpy as np
from PIL import Image, ImageDraw

REPO = 'E:/OneDrive/Documents/THU/CV/joongwon-research-website/'
base = Image.open(REPO + 'public/study/cat-square.png').convert('RGB')
X0, Y0, C = 158, 79, 40
EYE = dict(cx=296.5, cy=131.5, rx=17.5, ry=11.5)
LINE = (38, 22, 18)

def ring_colour():
    a = np.asarray(base).astype(float)
    yy, xx = np.mgrid[0:512, 0:512]
    e = ((xx - EYE['cx']) / EYE['rx']) ** 2 + ((yy - EYE['cy']) / EYE['ry']) ** 2
    return tuple(int(round(v)) for v in a[(e > 1.15) & (e < 1.8)].mean(0))

def closed(fill):
    im = base.copy(); d = ImageDraw.Draw(im)
    cx, cy, rx, ry = EYE['cx'], EYE['cy'], EYE['rx'], EYE['ry']
    d.ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=fill)
    d.arc([cx - rx + 3, cy - 7, cx + rx - 3, cy + 4], 15, 165, fill=LINE, width=2)
    return im

def measure(img):
    a = np.asarray(img).astype(float) / 255
    lum, blue = [], []
    for j in range(4):
        for i in range(4):
            blk = a[Y0 + j * C:Y0 + (j + 1) * C, X0 + i * C:X0 + (i + 1) * C]
            r, g, b = [blk[..., k].mean() for k in range(3)]
            lum.append(round(0.299 * r + 0.587 * g + 0.114 * b, 2)); blue.append(round(b - r, 2))
    return lum, blue

fill = ring_colour()
lum, blue = measure(base)
clum, cblue = measure(closed(fill))
print(json.dumps(dict(crop=[X0, Y0, 4 * C], lum=lum, blue=blue, closed_cell7=[clum[7], cblue[7]], fill=fill, line=LINE, eye=EYE)))
assert all(clum[i] == lum[i] and cblue[i] == blue[i] for i in range(16) if i != 7)
z = lambda im: im.crop((X0, Y0, X0 + 4 * C, Y0 + 4 * C)).resize((480, 480), Image.LANCZOS)
s = Image.new('RGB', (970, 480), (255, 255, 255)); s.paste(z(base), (0, 0)); s.paste(z(closed(fill)), (490, 0))
s.save('C:/Users/User/AppData/Local/Temp/claude/da2c927bf01b5a0d/80bed2e2-2b80-4ecb-9c5f-07f49d9ab705/scratchpad/cat_tok/final_crop.png')
