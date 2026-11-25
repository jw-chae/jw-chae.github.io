/** Tiny, dependency-free CNN arithmetic used by the CNN study scenes. Everything drawn is computed here. */

export type Grid = { n: number; d: number[] };

export const grid = (n: number, f: (r: number, c: number) => number): Grid => {
  const d = new Array<number>(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) d[r * n + c] = f(r, c);
  return { n, d };
};

/** Valid 2-D cross-correlation (what deep-learning libraries call convolution), optional zero padding and stride. */
export function conv(input: Grid, kernel: number[], stride = 1, pad = 0): Grid {
  const k = Math.round(Math.sqrt(kernel.length));
  const n = input.n;
  const on = Math.floor((n + 2 * pad - k) / stride) + 1;
  return grid(on, (r, c) => {
    let acc = 0;
    for (let u = 0; u < k; u++) for (let v = 0; v < k; v++) {
      const y = r * stride + u - pad, x = c * stride + v - pad;
      if (y >= 0 && x >= 0 && y < n && x < n) acc += kernel[u * k + v] * input.d[y * n + x];
    }
    return acc;
  });
}

export const relu = (g: Grid): Grid => ({ n: g.n, d: g.d.map((v) => Math.max(0, v)) });
export const maxOf = (g: Grid) => g.d.reduce((a, b) => Math.max(a, b), -Infinity);
export const meanOf = (g: Grid) => g.d.reduce((a, b) => a + b, 0) / g.d.length;

export function pool(input: Grid, mode: "max" | "avg"): Grid {
  const on = Math.floor(input.n / 2);
  return grid(on, (r, c) => {
    const v = [0, 1].flatMap((u) => [0, 1].map((w) => input.d[(2 * r + u) * input.n + 2 * c + w]));
    return mode === "max" ? Math.max(...v) : (v[0] + v[1] + v[2] + v[3]) / 4;
  });
}

/** Shift with zero fill: positive dx moves content to the right, positive dy moves it down. */
export const shift = (g: Grid, dx: number, dy: number): Grid =>
  grid(g.n, (r, c) => {
    const y = r - dy, x = c - dx;
    return y >= 0 && x >= 0 && y < g.n && x < g.n ? g.d[y * g.n + x] : 0;
  });

export const meanAbsDiff = (a: Grid, b: Grid) => a.d.reduce((s, v, i) => s + Math.abs(v - b.d[i]), 0) / a.d.length;

/* ---- kernels ---- */

export const KERNELS = {
  vertical: [-1, 0, 1, -1, 0, 1, -1, 0, 1].map((v) => v / 3),
  horizontal: [-1, -1, -1, 0, 0, 0, 1, 1, 1].map((v) => v / 3),
  blur: new Array(9).fill(1 / 9),
  sharpen: [0, -1, 0, -1, 5, -1, 0, -1, 0],
} as const;

/* ---- a hand-built two-layer network: edges, then corners, then a 3-class readout ---- */

export const EDGE_NAMES = ["left", "right", "top", "bottom"] as const;
/** Layer 1: four 3×3 kernels. "left" fires where the image goes dark → bright moving right, and so on. */
export const EDGE_KERNELS: number[][] = [
  [-1, 0, 1, -1, 0, 1, -1, 0, 1].map((v) => v / 3),
  [1, 0, -1, 1, 0, -1, 1, 0, -1].map((v) => v / 3),
  [-1, -1, -1, 0, 0, 0, 1, 1, 1].map((v) => v / 3),
  [1, 1, 1, 0, 0, 0, -1, -1, -1].map((v) => v / 3),
];

export const CORNER_NAMES = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
/** Layer 2: each corner unit adds two edge maps at offset positions and subtracts a threshold.
 *  [vertical edge channel, dy, dx, horizontal edge channel, dy, dx] */
export const CORNER_RULES: [number, number, number, number, number, number][] = [
  [0, 1, 0, 2, 0, 1],    // top-left: left edge just below, top edge just to the right
  [1, 1, 0, 2, 0, -1],   // top-right: right edge just below, top edge just to the left
  [0, -1, 0, 3, 0, 1],   // bottom-left: left edge just above, bottom edge just to the right
  [1, -1, 0, 3, 0, -1],  // bottom-right
];
export const CORNER_BIAS = -1.2;

export type TinyNet = { input: Grid; edges: Grid[]; corners: Grid[]; features: number[]; scores: number[]; probs: number[] };

export const CLASS_WEIGHTS: number[][] = [
  // features: [left, right, top, bottom, 4 corners]     (global averages × 10)
  [1, 1, -1, -1, -4, -4, -4, -4],   // vertical stripes
  [-1, -1, 1, 1, -4, -4, -4, -4],   // horizontal stripes
  [-0.4, -0.4, -0.4, -0.4, 14, 14, 14, 14], // box
];

export function softmax(z: number[]): number[] {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

export function runTinyNet(input: Grid): TinyNet {
  const edges = EDGE_KERNELS.map((k) => relu(conv(input, k)));
  const n = edges[0].n;
  const at = (g: Grid, r: number, c: number) => (r >= 0 && c >= 0 && r < n && c < n ? g.d[r * n + c] : 0);
  const corners = CORNER_RULES.map(([a, ay, ax, b, by, bx]) =>
    grid(n, (r, c) => Math.max(0, at(edges[a], r + ay, c + ax) + at(edges[b], r + by, c + bx) + CORNER_BIAS)));
  const features = [...edges, ...corners].map((g) => meanOf(g) * 10);
  const scores = CLASS_WEIGHTS.map((w) => w.reduce((s, v, i) => s + v * features[i], 0));
  return { input, edges, corners, features, scores, probs: softmax(scores) };
}

/* ---- inputs ---- */

export const N_IN = 12;
export const SHAPES = {
  vstripes: grid(N_IN, (_, c) => (c % 4 < 2 ? 1 : 0)),
  hstripes: grid(N_IN, (r) => (r % 4 < 2 ? 1 : 0)),
  box: grid(N_IN, (r, c) => (r >= 3 && r <= 7 && c >= 2 && c <= 6 ? 1 : 0)),
  boxMoved: grid(N_IN, (r, c) => (r >= 5 && r <= 9 && c >= 5 && c <= 9 ? 1 : 0)),
} as const;

/** Receptive field of one unit after `layers` 3×3 convolutions; `strides[l]` is the stride of layer l. */
export function receptiveField(strides: number[]): { r: number; jump: number }[] {
  let r = 1, j = 1;
  return strides.map((s) => {
    r = r + 2 * j;
    j = j * s;
    return { r, jump: j };
  });
}

/* ================================================================== */
/* Walk sections: one output cell, a learned kernel, a poked pixel     */
/* ================================================================== */

/* ---- 01–02 · one clean picture, one hand-set kernel, one output cell ---- */

export const DARK = 0.1;
export const BRIGHT = 0.9;
/** 9×9 picture: a bright 4×4 square (rows 2..5, cols 2..5) on a dark background. Hand-set values. */
export const WALK_IMG: Grid = grid(9, (r, c) => (r >= 2 && r <= 5 && c >= 2 && c <= 5 ? BRIGHT : DARK));
/** Left column −1, right column +1: the hand-set kernel followed through sections 01 and 02. */
export const WALK_KERNEL: number[] = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
export const WALK_KERNEL_H: number[] = [-1, -1, -1, 0, 0, 0, 1, 1, 1];
/** Add the same amount to every pixel. */
export const brighten = (g: Grid, d: number): Grid => ({ n: g.n, d: g.d.map((v) => v + d) });

/** Window top-left corners used in section 01: left edge, bright inside, right edge, dark outside, top edge. */
export const WALK_SPOTS: [number, number][] = [[3, 1], [3, 3], [3, 4], [3, 6], [1, 3]];

/** Everything behind one output cell: the nine pixels under the window, the nine products, their sum. */
export function oneCell(img: Grid, kernel: number[], r: number, c: number): { win: number[]; prod: number[]; sum: number } {
  const win = Array.from({ length: 9 }, (_, i) => img.d[(r + Math.floor(i / 3)) * img.n + c + (i % 3)]);
  const prod = win.map((v, i) => v * kernel[i]);
  return { win, prod, sum: prod.reduce((a, b) => a + b, 0) };
}

/* ---- 03 · nine numbers learned from whole-picture labels ---- */

export const BAR_N = 8;
/** 8×8 picture with one bright bar: columns (vertical) or rows (horizontal) start..start+width−1. */
export const barImage = (vertical: boolean, start: number, width: number, dark: number, bright: number): Grid =>
  grid(BAR_N, (r, c) => { const t = vertical ? c : r; return t >= start && t < start + width ? bright : dark; });

export type Labeled = { x: Grid; y: 0 | 1 };   // y = 1: vertical bar, y = 0: horizontal bar
const BAR_LEVELS: [number, number][] = [[0.1, 0.9], [0.3, 0.7]];
/** 16 training pictures. Every bar starts at row or column 1 or 2, so vertical bars never reach the right half. */
export const BAR_TRAIN: Labeled[] = [true, false].flatMap((vertical) =>
  [1, 2].flatMap((start) => [2, 3].flatMap((width) =>
    BAR_LEVELS.map(([d, b]): Labeled => ({ x: barImage(vertical, start, width, d, b), y: vertical ? 1 : 0 })))));

/** The three pictures shown in the figure. Training bars cover columns (or rows) 1..4 only. */
export const BAR_SHOW: Labeled[] = [
  { x: barImage(true, 2, 2, 0.1, 0.9), y: 1 },    // in the training set: columns 2..3
  { x: barImage(false, 2, 2, 0.1, 0.9), y: 0 },   // in the training set: rows 2..3
  { x: barImage(true, 5, 2, 0.1, 0.9), y: 1 },    // the first bar moved three columns right: never trained on
];

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** Slide the kernel, keep the largest response m and where it came from. */
export function maxResponse(x: Grid, k: number[]): { map: Grid; m: number; at: number } {
  const map = conv(x, k);
  let at = 0;
  for (let i = 1; i < map.d.length; i++) if (map.d[i] > map.d[at]) at = i;
  return { map, m: map.d[at], at };
}

export type KernelSnap = { k: number[]; a: number; b: number; loss: number };

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

export const KERNEL_STEPS = 80;
/** Full-batch gradient descent on p = sigmoid(a·m + b), m = max over the map. Trains the nine kernel numbers, a and b.
 *  The only supervision is the label of the whole picture. Returns one snapshot per step, step 0 = before training.
 *  `data` defaults to the 16 bar pictures; any square pictures of 3×3 or larger work. */
export function trainKernel(seed: number, steps = KERNEL_STEPS, lr = 1, data: Labeled[] = BAR_TRAIN): KernelSnap[] {
  const rnd = lcg(seed);
  let k = Array.from({ length: 9 }, () => (rnd() - 0.5) * 0.6);
  let a = 1, b = 0;
  const hist: KernelSnap[] = [];
  const n = data.length;
  for (let t = 0; t <= steps; t++) {
    let loss = 0, ga = 0, gb = 0;
    const gk = new Array<number>(9).fill(0);
    for (const { x, y } of data) {
      const { m, at } = maxResponse(x, k);
      const p = sigmoid(a * m + b);
      loss += -(y ? Math.log(p) : Math.log(1 - p));
      const on = x.n - 2, dz = p - y, r = Math.floor(at / on), c = at % on;
      // only the window that produced the largest response passes the error back to the kernel
      for (let i = 0; i < 9; i++) gk[i] += dz * a * x.d[(r + Math.floor(i / 3)) * x.n + c + (i % 3)];
      ga += dz * m;
      gb += dz;
    }
    hist.push({ k: [...k], a, b, loss: loss / n });
    k = k.map((v, i) => v - (lr * gk[i]) / n);
    a -= (lr * ga) / n;
    b -= (lr * gb) / n;
  }
  return hist;
}
/** Two starting points for the same training (the two choices of the "start" control in the figure). */
export const KERNEL_SEEDS = [3, 5] as const;

export const predictBar = (x: Grid, s: KernelSnap) => { const r = maxResponse(x, s.k); return { ...r, p: sigmoid(s.a * r.m + s.b) }; };

/** Same pictures, same labels, but one neuron with its own weight for each of the 64 pixels (no sliding, no sharing). */
export function trainDense(steps = KERNEL_STEPS, lr = 1): { w: number[]; b: number; loss: number } {
  let w = new Array<number>(BAR_N * BAR_N).fill(0), b = 0, loss = 0;
  const n = BAR_TRAIN.length;
  for (let t = 0; t <= steps; t++) {
    const gw = new Array<number>(w.length).fill(0);
    let gb = 0;
    loss = 0;
    for (const { x, y } of BAR_TRAIN) {
      const p = sigmoid(x.d.reduce((s, v, i) => s + v * w[i], b));
      loss += -(y ? Math.log(p) : Math.log(1 - p));
      for (let i = 0; i < w.length; i++) gw[i] += (p - y) * x.d[i];
      gb += p - y;
    }
    loss /= n;
    if (t === steps) break;
    w = w.map((v, i) => v - (lr * gw[i]) / n);
    b -= (lr * gb) / n;
  }
  return { w, b, loss };
}
export const predictDense = (x: Grid, m: { w: number[]; b: number }) => sigmoid(x.d.reduce((s, v, i) => s + v * m.w[i], m.b));

/* ---- 04 · a "+" pattern against a copy of itself moved by (dr, dc): what a position-bound neuron outputs ---- */

export const PLUS: number[] = [0, 1, 0, 1, 1, 1, 0, 1, 0];
export function plusOverlap(dr: number, dc: number): number {
  let s = 0;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const y = r - dr, x = c - dc;
    if (PLUS[r * 3 + c] && y >= 0 && x >= 0 && y < 3 && x < 3 && PLUS[y * 3 + x]) s += 1;
  }
  return s;
}

/* ---- 06 · change one far pixel: does the centre cell change after 1, 2, 3 layers? ---- */

export const POKE_N = 11;
export const POKE_MID = 5;
/** 11×11 picture: a bright block left of the centre. The poked pixel lies to the right of the centre, on dark background. */
export const POKE_IMG: Grid = grid(POKE_N, (r, c) => (r >= 3 && r <= 7 && c >= 1 && c <= 4 ? BRIGHT : DARK));
const AVG9: number[] = new Array<number>(9).fill(1 / 9);

/** Three 3×3 layers (every kernel number 1/9, padding 1, stride 1). `dist` = 0 leaves the picture alone,
 *  otherwise the pixel `dist` cells to the right of the centre is switched from dark to bright. */
export function pokeRun(dist: number): { layers: Grid[] } {
  const input: Grid = { n: POKE_N, d: [...POKE_IMG.d] };
  if (dist > 0) input.d[POKE_MID * POKE_N + POKE_MID + dist] = BRIGHT;
  const layers = [input];
  for (let l = 0; l < 3; l++) layers.push(conv(layers[l], AVG9, 1, 1));
  return { layers };
}

/* ================================================================== */
/* The owner's Siamese cat: the running picture of sections 01–06      */
/* ================================================================== */

/** Copied from cat-grids.ts (CAT_HEAD_GRAY_9): the head drawing public/study/cat-head.png (512×512) cut into 9×9 blocks,
 *  each block's mean luminance, 0 dark to 1 bright. Measured from the drawing, not hand-set. */
export const CAT9_ROWS: number[][] = [
  [0.94, 0.95, 0.95, 0.95, 0.95, 0.95, 0.79, 0.54, 0.94],
  [0.8, 0.82, 0.94, 0.95, 0.94, 0.93, 0.39, 0.52, 0.87],
  [0.56, 0.38, 0.53, 0.92, 0.93, 0.64, 0.32, 0.53, 0.81],
  [0.69, 0.53, 0.33, 0.32, 0.79, 0.59, 0.71, 0.51, 0.73],
  [0.9, 0.46, 0.47, 0.79, 0.43, 0.27, 0.35, 0.54, 0.78],
  [0.94, 0.6, 0.56, 0.51, 0.21, 0.18, 0.28, 0.41, 0.82],
  [0.94, 0.92, 0.58, 0.34, 0.38, 0.15, 0.2, 0.39, 0.9],
  [0.94, 0.94, 0.91, 0.64, 0.43, 0.2, 0.16, 0.65, 0.95],
  [0.95, 0.94, 0.92, 0.83, 0.76, 0.64, 0.65, 0.87, 0.94],
];
export const CAT_IMG: Grid = { n: 9, d: CAT9_ROWS.flat() };
export const CAT_SRC_HEAD = "/study/cat-head.png";

/** Window top-left corners of section 01, checked against the drawing:
 *  0 right edge of the face (mask and nose | eye and cheek | background), 1 middle of the mask between the eyes,
 *  2 left edge of the face below the left ear (background | ear base | cheek), 3 forehead (cream above, mask below). */
export const CAT_SPOTS: [number, number][] = [[5, 6], [4, 4], [4, 0], [3, 4]];
/** Section 01 dims the whole picture by this much. The darkest cell is 0.15, so nothing drops below 0. */
export const CAT_DIM = -0.1;
/** Add d to every pixel but keep each inside 0..1, as a real pixel must. */
export const brightenClip = (g: Grid, d: number): Grid => ({ n: g.n, d: g.d.map((v) => Math.min(1, Math.max(0, v + d))) });

/** Row-by-row "right column minus left column" of one window: the three numbers the vertical kernel adds up. */
export function rowDiffs(img: Grid, r: number, c: number): number[] {
  return [0, 1, 2].map((u) => img.d[(r + u) * img.n + c + 2] - img.d[(r + u) * img.n + c]);
}

/* ---- 03 · the trained kernels laid on the cat, and why the cat itself is not the training set ---- */

/** The three bar pictures of the figure plus the cat head, which has no label and was never trained on. */
export const LEARN_SHOW: { x: Grid; y: 0 | 1 | null }[] = [...BAR_SHOW, { x: CAT_IMG, y: null }];

/** size×size crops of a measured cat grid, `step` cells apart. Label 1 when at least half of the cells are dark points,
 *  0 when at least half are cream fur; other crops are skipped. Used to test "train on the cat instead of bars". */
export function catCrops(gray: number[][], parts: string[][], size = 8, step = 2): Labeled[] {
  const out: Labeled[] = [];
  const n = gray.length, half = (size * size) / 2;
  for (let r = 0; r + size <= n; r += step) for (let c = 0; c + size <= n; c += step) {
    let point = 0, cream = 0;
    const d: number[] = [];
    for (let u = 0; u < size; u++) for (let v = 0; v < size; v++) {
      d.push(gray[r + u][c + v]);
      if (parts[r + u][c + v] === "point") point++;
      if (parts[r + u][c + v] === "cream") cream++;
    }
    if (point >= half) out.push({ x: { n: size, d }, y: 1 });
    else if (cream >= half) out.push({ x: { n: size, d }, y: 0 });
  }
  return out;
}

/* ---- 06 · poke one pixel of the cat ---- */

export const REACH_MID = 4;
/** The poked pixel is brightened by this much. The brightest pixel it can hit is 0.78, so it stays at or below 1. */
export const REACH_DELTA = 0.2;
/** Three 3×3 averaging layers (padding 1) on the cat head. `dist` = 0 leaves the picture alone, otherwise the pixel
 *  `dist` cells right of the centre is brightened by REACH_DELTA. */
export function catPokeRun(dist: number): { layers: Grid[] } {
  const input: Grid = { n: 9, d: [...CAT_IMG.d] };
  if (dist > 0) input.d[REACH_MID * 9 + REACH_MID + dist] += REACH_DELTA;
  const layers = [input];
  for (let l = 0; l < 3; l++) layers.push(conv(layers[l], AVG9, 1, 1));
  return { layers };
}

/* ---- 09 · the hand-built corner units on the cat ---- */

/** For each corner unit, the largest "edge map + edge map" sum before the threshold is subtracted. */
export function cornerPeaks(input: Grid): number[] {
  const edges = EDGE_KERNELS.map((k) => relu(conv(input, k)));
  const n = edges[0].n;
  const at = (g: Grid, r: number, c: number) => (r >= 0 && c >= 0 && r < n && c < n ? g.d[r * n + c] : 0);
  return CORNER_RULES.map(([a, ay, ax, b, by, bx]) => {
    let best = -Infinity;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) best = Math.max(best, at(edges[a], r + ay, c + ax) + at(edges[b], r + by, c + bx));
    return best;
  });
}
