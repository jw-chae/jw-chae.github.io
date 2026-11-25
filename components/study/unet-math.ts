/** Arithmetic behind the U-Net study scenes. Every picture is computed from these functions. No imports, so node can run it. */

export type Grid = { n: number; d: number[] };
const grid = (n: number, f: (r: number, c: number) => number): Grid => {
  const d = new Array<number>(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) d[r * n + c] = f(r, c);
  return { n, d };
};

export const UN = 24;

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ground truth: a round "cell" with a thin arm, on a 24×24 grid. */
export const TRUTH: Grid = grid(UN, (r, c) => {
  const body = ((r - 11.5) / 6.2) ** 2 + ((c - 9.5) / 5.4) ** 2 <= 1;
  const arm = r >= 10 && r <= 11 && c >= 14 && c <= 21;
  return body || arm ? 1 : 0;
});

/** Isolated bright specks in the background: at most one per 4×4 block, never touching the cell. */
export const SPECKS: [number, number][] = [[1, 2], [2, 13], [1, 21], [2, 17], [6, 1], [17, 20], [21, 3], [22, 12], [19, 17], [17, 1], [21, 22], [3, 7]];

/** The noisy photograph the network would see. */
export const PHOTO: Grid = (() => {
  const r = mulberry(31);
  const g = grid(UN, (y, x) => Math.min(1, Math.max(0, 0.14 + 0.72 * TRUTH.d[y * UN + x] + (r() - 0.5) * 0.14)));
  for (const [y, x] of SPECKS) g.d[y * UN + x] = 0.92;
  return g;
})();

export const threshold = (g: Grid, t = 0.5): Grid => ({ n: g.n, d: g.d.map((v) => (v > t ? 1 : 0)) });

/** Intersection over union of two binary masks. */
export function iou(a: Grid, b: Grid): number {
  let inter = 0, uni = 0;
  for (let i = 0; i < a.d.length; i++) {
    if (a.d[i] && b.d[i]) inter++;
    if (a.d[i] || b.d[i]) uni++;
  }
  return uni ? inter / uni : 1;
}

/** Mean brightness of the k×k patch centred on (r, c), clipped at the picture's edge. */
export function patchMean(img: Grid, k: number, r: number, c: number): number {
  const h = (k - 1) / 2, n = img.n;
  let s = 0, m = 0;
  for (let u = -h; u <= h; u++) for (let v = -h; v <= h; v++) {
    const y = r + u, x = c + v;
    if (y >= 0 && x >= 0 && y < n && x < n) { s += img.d[y * n + x]; m++; }
  }
  return s / m;
}

/** Scene 1: classify every pixel from the mean brightness of the k×k patch around it. */
export const patchPredict = (img: Grid, k: number): Grid => grid(img.n, (r, c) => (patchMean(img, k, r, c) > 0.5 ? 1 : 0));

/** The two pixels the patch scene follows: one on the thin arm (cell) and one noise speck (background). */
export const PATCH_PICKS: { arm: [number, number]; speck: [number, number] } = { arm: [10, 18], speck: [2, 13] };

export function avgPool(g: Grid): Grid {
  const n = g.n / 2;
  return grid(n, (r, c) => (g.d[2 * r * g.n + 2 * c] + g.d[2 * r * g.n + 2 * c + 1] + g.d[(2 * r + 1) * g.n + 2 * c] + g.d[(2 * r + 1) * g.n + 2 * c + 1]) / 4);
}

export const nearestUp = (g: Grid, factor: number): Grid => grid(g.n * factor, (r, c) => g.d[Math.floor(r / factor) * g.n + Math.floor(c / factor)]);

/** Scene 2: shrink `depth` times by 2×2 averaging, then blow straight back up. */
export function downThenUp(mask: Grid, depth: number): { small: Grid; back: Grid } {
  let small = mask;
  for (let i = 0; i < depth; i++) small = avgPool(small);
  return { small, back: threshold(nearestUp(small, 2 ** depth)) };
}

/** Scene 3: three ways to double the size of a small map. */
export function bilinearUp(g: Grid): Grid {
  const n = g.n, at = (r: number, c: number) => g.d[Math.min(n - 1, Math.max(0, r)) * n + Math.min(n - 1, Math.max(0, c))];
  return grid(2 * n, (r, c) => {
    const y = (r + 0.5) / 2 - 0.5, x = (c + 0.5) / 2 - 0.5;
    const y0 = Math.floor(y), x0 = Math.floor(x), fy = y - y0, fx = x - x0;
    return at(y0, x0) * (1 - fy) * (1 - fx) + at(y0, x0 + 1) * (1 - fy) * fx + at(y0 + 1, x0) * fy * (1 - fx) + at(y0 + 1, x0 + 1) * fy * fx;
  });
}

/** Transposed convolution, kernel 2×2, stride 2: every input cell stamps value × kernel into its own 2×2 block. */
export const transposedUp = (g: Grid, kernel: number[]): Grid =>
  grid(2 * g.n, (r, c) => g.d[Math.floor(r / 2) * g.n + Math.floor(c / 2)] * kernel[(r % 2) * 2 + (c % 2)]);

export const SMALL_MAP: Grid = grid(4, (r, c) => [0.1, 0.2, 0.1, 0.0, 0.3, 0.9, 0.8, 0.1, 0.2, 1.0, 0.7, 0.1, 0.0, 0.3, 0.2, 0.0][r * 4 + c]);
export const STAMP_COPY = [1, 1, 1, 1];
export const STAMP_LEARNED = [1.0, 0.7, 0.7, 0.4];

/** Scene 4: what the decoder gets from below (coarse) and across the bridge (fine), and their combination. */
export function skipFusion(img: Grid): { coarseSmall: Grid; coarse: Grid; fine: Grid; fused: Grid } {
  const coarseSmall = avgPool(avgPool(img));                       // 24 → 6: knows "cell region", not the border
  const coarse = threshold(nearestUp(coarseSmall, 4), 0.26);
  const fine = threshold(img, 0.5);                                 // full resolution: exact border, but specks too
  const n = img.n;
  // a pixel survives if the fine map says "bright" and the coarse map says "cell region" here or in a touching block
  const near = grid(n, (r, c) => {
    for (const [dr, dc] of [[0, 0], [-4, 0], [4, 0], [0, -4], [0, 4]]) {
      const y = r + dr, x = c + dc;
      if (y >= 0 && x >= 0 && y < n && x < n && coarse.d[y * n + x]) return 1;
    }
    return 0;
  });
  return { coarseSmall, coarse, fine, fused: grid(n, (r, c) => (fine.d[r * n + c] && near.d[r * n + c] ? 1 : 0)) };
}

/** Scene 6: elastic deformation. A coarse grid of random pushes, smoothly interpolated, moves image and mask together. */
export const DN = 28;
export const CELLS_TRUTH: Grid = grid(DN, (r, c) => {
  const a = ((r - 9) / 5.5) ** 2 + ((c - 9) / 6.5) ** 2 <= 1;
  const b = ((r - 19) / 5) ** 2 + ((c - 19) / 5.5) ** 2 <= 1;
  return a || b ? 1 : 0;
});
export const CELLS_PHOTO: Grid = (() => {
  const r = mulberry(5);
  return grid(DN, (y, x) => {
    const m = CELLS_TRUTH.d[y * DN + x];
    const lines = y % 7 === 3 || x % 7 === 3 ? 0.1 : 0;            // faint texture so the warp is visible
    return Math.min(1, 0.16 + 0.62 * m + lines + (r() - 0.5) * 0.1);
  });
})();

export type Warp = { pushes: [number, number][]; k: number };
export function makeWarp(seed: number, strength: number): Warp {
  const r = mulberry(seed * 977 + 13), k = 5;
  return { k, pushes: Array.from({ length: k * k }, () => [(r() - 0.5) * 2 * strength, (r() - 0.5) * 2 * strength] as [number, number]) };
}

function pushAt(w: Warp, y: number, x: number, n: number): [number, number] {
  const gy = (y / (n - 1)) * (w.k - 1), gx = (x / (n - 1)) * (w.k - 1);
  const y0 = Math.min(w.k - 2, Math.floor(gy)), x0 = Math.min(w.k - 2, Math.floor(gx)), fy = gy - y0, fx = gx - x0;
  const p = (a: number, b: number) => w.pushes[a * w.k + b];
  const mix = (i: 0 | 1) => p(y0, x0)[i] * (1 - fy) * (1 - fx) + p(y0, x0 + 1)[i] * (1 - fy) * fx + p(y0 + 1, x0)[i] * fy * (1 - fx) + p(y0 + 1, x0 + 1)[i] * fy * fx;
  return [mix(0), mix(1)];
}

/** Sample `src` at positions pulled back by the smooth displacement field (bilinear sampling, edge clamp). */
export function warp(src: Grid, w: Warp): Grid {
  const n = src.n, at = (r: number, c: number) => src.d[Math.min(n - 1, Math.max(0, r)) * n + Math.min(n - 1, Math.max(0, c))];
  return grid(n, (r, c) => {
    const [dy, dx] = pushAt(w, r, c, n);
    const y = r - dy, x = c - dx, y0 = Math.floor(y), x0 = Math.floor(x), fy = y - y0, fx = x - x0;
    return at(y0, x0) * (1 - fy) * (1 - fx) + at(y0, x0 + 1) * (1 - fy) * fx + at(y0 + 1, x0) * fy * (1 - fx) + at(y0 + 1, x0 + 1) * fy * fx;
  });
}

/* ---- scene 5: the U, with padded convolutions and a 256×256 input ---- */

export type UNode = { side: "down" | "bottom" | "up" | "out"; level: number; res: number; ch: number };
export const U_NODES: UNode[] = [
  { side: "down", level: 0, res: 256, ch: 64 },
  { side: "down", level: 1, res: 128, ch: 128 },
  { side: "down", level: 2, res: 64, ch: 256 },
  { side: "down", level: 3, res: 32, ch: 512 },
  { side: "bottom", level: 4, res: 16, ch: 1024 },
  { side: "up", level: 3, res: 32, ch: 512 },
  { side: "up", level: 2, res: 64, ch: 256 },
  { side: "up", level: 1, res: 128, ch: 128 },
  { side: "up", level: 0, res: 256, ch: 64 },
  { side: "out", level: 0, res: 256, ch: 2 },
];
