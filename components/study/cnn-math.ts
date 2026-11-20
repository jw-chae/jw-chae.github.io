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
