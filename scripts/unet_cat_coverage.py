"""Cat silhouette by flood-filling the background from the image border, then the share of each grid cell inside the silhouette.
Writes coverage_<src>_<n>.json (rows of fractions) and a check image with the silhouette tinted."""
import json, sys
from collections import deque
from PIL import Image

REPO = 'E:/OneDrive/Documents/THU/CV/joongwon-research-website/'
BG = (253, 236, 226)
TOL = int(sys.argv[1]) if len(sys.argv) > 1 else 40

for src, path in [('square', 'public/study/cat-square.png'), ('head', 'public/study/cat-head.png')]:
    im = Image.open(REPO + path).convert('RGB')
    W, H = im.size
    px = im.load()
    bg = [[False] * W for _ in range(H)]
    q = deque()
    def near(p):
        return abs(p[0] - BG[0]) + abs(p[1] - BG[1]) + abs(p[2] - BG[2]) < TOL
    for x in range(W):
        for y in (0, H - 1):
            if near(px[x, y]) and not bg[y][x]: bg[y][x] = True; q.append((x, y))
    for y in range(H):
        for x in (0, W - 1):
            if near(px[x, y]) and not bg[y][x]: bg[y][x] = True; q.append((x, y))
    while q:
        x, y = q.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            u, v = x + dx, y + dy
            if 0 <= u < W and 0 <= v < H and not bg[v][u] and near(px[u, v]):
                bg[v][u] = True; q.append((u, v))
    for n in (8, 16, 32):
        cov = []
        for j in range(n):
            row = []
            for i in range(n):
                tot = cat = 0
                for y in range(j * H // n, (j + 1) * H // n):
                    for x in range(i * W // n, (i + 1) * W // n):
                        tot += 1; cat += 0 if bg[y][x] else 1
                row.append(round(cat / tot, 3))
            cov.append(row)
        json.dump(cov, open(f'coverage_{src}_{n}.json', 'w'))
    chk = im.copy(); cp = chk.load()
    for y in range(H):
        for x in range(W):
            if not bg[y][x]:
                r, g, b = cp[x, y]; cp[x, y] = (r // 2, g // 2 + 100, b // 2)
    chk.save(f'sil_{src}.png')
print('done')
