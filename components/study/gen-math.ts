/** Arithmetic behind the "modern image and video generators" study scenes. Self-contained so it can be run with node. */

export type P2 = [number, number];
export type Img = number[][];

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
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());

/* ---- 01 · a small picture, cut into 4×4 patches ---- */

export const IMG = 64, PS = 4, NP = IMG / PS, PD = PS * PS;

/** A hand-made grayscale scene: sky gradient, a shaded ball, a striped floor, a dark post. Values in 0..1. `shift` moves the ball to the right. */
export const pictureAt = (shift: number): Img => Array.from({ length: IMG }, (_, y) => Array.from({ length: IMG }, (_, x) => {
  let v = 0.78 - 0.3 * (y / IMG);                                          // sky, brighter at the top
  if (y > 44) v = 0.38 + 0.2 * Math.sin((x + (y - 44) * 1.5) * 0.55);      // striped floor
  const dx = x - 24 - shift, dy = y - 27, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 14) v = 0.95 - 0.5 * Math.min(1, Math.sqrt((dx + 5) ** 2 + (dy + 5) ** 2) / 18);   // ball lit from the upper left
  if (x >= 47 && x < 53 && y >= 12 && y < 46) v = 0.12;                    // post
  return Math.min(1, Math.max(0, v));
}));
export const PICTURE: Img = pictureAt(0);

/** The patches of a picture as 16-number vectors, in reading order. */
export function patchesOf(img: Img): number[][] {
  const out: number[][] = [];
  for (let py = 0; py < NP; py++) for (let px = 0; px < NP; px++) {
    const v: number[] = [];
    for (let j = 0; j < PS; j++) for (let i = 0; i < PS; i++) v.push(img[py * PS + j][px * PS + i]);
    out.push(v);
  }
  return out;
}
export const PATCHES: number[][] = patchesOf(PICTURE);

/** The one patch the chapter follows: row 5, column 11 (counting from 0). Three columns of sky, one column of the dark post. */
export const TRACK_ROW = 5, TRACK_COL = 11, TRACK = TRACK_ROW * NP + TRACK_COL;

export function fromPatches(ps: number[][]): Img {
  const img: Img = Array.from({ length: IMG }, () => new Array<number>(IMG).fill(0));
  ps.forEach((v, n) => {
    const py = Math.floor(n / NP), px = n % NP;
    for (let j = 0; j < PS; j++) for (let i = 0; i < PS; i++) img[py * PS + j][px * PS + i] = v[j * PS + i];
  });
  return img;
}

const PIC_MEAN = PICTURE.flat().reduce((a, b) => a + b, 0) / (IMG * IMG);
const PIC_VAR = PICTURE.flat().reduce((a, b) => a + (b - PIC_MEAN) ** 2, 0);
/** Share of the picture's variation that a reconstruction loses. */
export const lost = (rec: Img) => rec.reduce((s, row, y) => s + row.reduce((q, v, x) => q + (v - PICTURE[y][x]) ** 2, 0), 0) / PIC_VAR;

/** Eigenvectors of a symmetric matrix by Jacobi rotations, sorted by eigenvalue, largest first. Columns of `vec`. */
function eigSym(M: number[][]): { val: number[]; vec: number[][] } {
  const n = M.length, A = M.map((r) => [...r]);
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 80; sweep++) {
    let off = 0;
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      off += A[p][q] * A[p][q];
      if (Math.abs(A[p][q]) < 1e-15) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
      for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
    }
    if (off < 1e-24) break;
  }
  const order = A.map((_, i) => i).sort((x, y) => A[y][y] - A[x][x]);
  return { val: order.map((i) => A[i][i]), vec: V.map((row) => order.map((j) => row[j])) };
}

const PATCH_MEAN = Array.from({ length: PD }, (_, i) => PATCHES.reduce((s, p) => s + p[i], 0) / PATCHES.length);
const PCA = (() => {
  const C = Array.from({ length: PD }, () => new Array<number>(PD).fill(0));
  for (const p of PATCHES) for (let i = 0; i < PD; i++) for (let j = 0; j < PD; j++) C[i][j] += (p[i] - PATCH_MEAN[i]) * (p[j] - PATCH_MEAN[j]);
  return eigSym(C);
})();

/** The average patch of this picture: what the learned decoder starts from. */
export const MEAN_PATCH = PATCH_MEAN;
/** The learned directions, most useful first, each as 16 weights. The sign is arbitrary; it is fixed so the weights sum to a positive number. */
export const DIRS: number[][] = Array.from({ length: PD }, (_, c) => {
  const d = PCA.vec.map((row) => row[c]);
  return d.reduce((a, b) => a + b, 0) < 0 ? d.map((v) => -v) : d;
});
/** Learned encoder: subtract the average patch, then one weighted sum per kept number. */
export const encodeLearned = (p: number[], k: number): number[] => DIRS.slice(0, k).map((d) => d.reduce((s, w, i) => s + w * (p[i] - PATCH_MEAN[i]), 0));
/** Learned decoder: the average patch plus each kept number times its direction. */
export const decodeLearned = (z: number[]): number[] => PATCH_MEAN.map((m, i) => m + z.reduce((s, c, j) => s + c * DIRS[j][i], 0));

/** The blocks plain shrinking averages over when a patch keeps k numbers: [rows, columns] of one block. k ∈ {1, 2, 4, 8}. */
export const shrinkBlock = (k: number): [number, number] => (k === 1 ? [4, 4] : k === 2 ? [4, 2] : k === 4 ? [2, 2] : [1, 2]);
/** Plain encoder: the mean of each block, blocks in reading order. */
export function encodeShrink(p: number[], k: number): number[] {
  const [bh, bw] = shrinkBlock(k), out: number[] = [];
  for (let j0 = 0; j0 < PS; j0 += bh) for (let i0 = 0; i0 < PS; i0 += bw) {
    let s = 0;
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) s += p[(j0 + j) * PS + i0 + i];
    out.push(s / (bh * bw));
  }
  return out;
}
/** Plain decoder: every cell of a block gets the block's mean. */
export function decodeShrink(z: number[]): number[] {
  const [bh, bw] = shrinkBlock(z.length), out = new Array<number>(PD).fill(0);
  let n = 0;
  for (let j0 = 0; j0 < PS; j0 += bh) for (let i0 = 0; i0 < PS; i0 += bw) {
    for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) out[(j0 + j) * PS + i0 + i] = z[n];
    n++;
  }
  return out;
}
/** Mean absolute difference per cell between two patches. */
export const cellError = (a: number[], b: number[]) => a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0) / a.length;

/** Learned compression: keep the k most useful directions of each patch (a linear encoder and decoder fitted to this picture). */
export const learnedRecon = (k: number): Img => fromPatches(PATCHES.map((p) => decodeLearned(encodeLearned(p, k))));

/** Plain shrinking with the same budget: average over blocks so each patch keeps k numbers. k ∈ {1, 2, 4, 8}. */
export const shrinkRecon = (k: number): Img => fromPatches(PATCHES.map((p) => decodeShrink(encodeShrink(p, k))));

/* ---- 02 · how many tokens a picture becomes ---- */

/** Tokens for a square image: `f` is the autoencoder's shrink per side (1 = raw pixels), `p` the patch side. */
export const imageTokens = (side: number, f: number, p: number) => (side / f / p) ** 2;

/* ---- 03 · the same exact denoiser, walked along two different roads ---- */

export type Mix = { mu: P2[]; s: number };
export const BLOBS: Mix = { mu: Array.from({ length: 5 }, (_, i): P2 => [1.5 * Math.cos((2 * Math.PI * i) / 5 + 0.3), 1.5 * Math.sin((2 * Math.PI * i) / 5 + 0.3)]), s: 0.12 };

/** x = a·x0 + b·ε with x0 from the blob mixture: the exact E[x0 | x] and the implied noise. `logw` may be shared. */
function posterior(x: P2, a: number, b: number, mix: Mix, shared?: number[]): { x0: P2; eps: P2; logw: number[] } {
  const v = a * a * mix.s * mix.s + b * b, gain = (a * mix.s * mix.s) / v;
  const logw = mix.mu.map((m) => -((x[0] - a * m[0]) ** 2 + (x[1] - a * m[1]) ** 2) / (2 * v));
  const use = shared ?? logw, mx = Math.max(...use), e = use.map((l) => Math.exp(l - mx)), sum = e.reduce((p, q) => p + q, 0);
  let x0x = 0, x0y = 0;
  mix.mu.forEach((m, i) => { const w = e[i] / sum; x0x += w * (m[0] + gain * (x[0] - a * m[0])); x0y += w * (m[1] + gain * (x[1] - a * m[1])); });
  const bb = Math.max(b, 1e-9);
  return { x0: [x0x, x0y], eps: [(x[0] - a * x0x) / bb, (x[1] - a * x0y) / bb], logw };
}

export type Road = "curved" | "straight";
/** DDPM's road (ᾱ from a linear β schedule, 1000 steps) and the straight road x = (1−t)·x0 + t·ε. Returns [a, b] at time t∈[0,1]. */
const ABAR = (() => { const out: number[] = []; let p = 1; for (let i = 0; i < 1000; i++) { p *= 1 - (1e-4 + ((0.02 - 1e-4) * i) / 999); out.push(p); } return out; })();
export function road(kind: Road, t: number): [number, number] {
  if (kind === "straight") return [1 - t, t];
  if (t <= 0) return [1, 0];
  const ab = ABAR[Math.min(999, Math.max(0, Math.ceil(t * 1000) - 1))];
  return [Math.sqrt(ab), Math.sqrt(1 - ab)];
}

/** Walk one particle from the noise point e to data in `steps` equal steps of t. The path has steps+1 points. */
export function walkFrom(e: P2, kind: Road, steps: number, mix: Mix = BLOBS): P2[] {
  const b1 = road(kind, 1)[1];
  let x: P2 = [b1 * e[0], b1 * e[1]];
  const path: P2[] = [x];
  for (let i = 0; i < steps; i++) {
    const [a, b] = road(kind, 1 - i / steps), [an, bn] = road(kind, 1 - (i + 1) / steps);
    const p = posterior(x, a, b, mix);
    x = [an * p.x0[0] + bn * p.eps[0], an * p.x0[1] + bn * p.eps[1]];
    path.push(x);
  }
  return path;
}
/** Walk n particles from noise to data in `steps` equal steps of t. Each path has steps+1 points. */
export function walk(kind: Road, steps: number, n: number, seed: number, mix: Mix = BLOBS): P2[][] {
  const r = mulberry(seed);
  return Array.from({ length: n }, () => walkFrom([gauss(r), gauss(r)], kind, steps, mix));
}
/** The particle the chapter follows, among those drawn with WALK_SEED: it starts between the right and the top blob. */
export const WALK_SEED = 7, FOLLOW = 5;

/** At point x and time t on a road: the share of each blob among the training pairs that pass here, and where the exact denoiser aims. */
export function aimAt(x: P2, kind: Road, t: number, mix: Mix = BLOBS): { w: number[]; aim: P2 } {
  const [a, b] = road(kind, t), p = posterior(x, a, b, mix);
  const mx = Math.max(...p.logw), e = p.logw.map((l) => Math.exp(l - mx)), sum = e.reduce((q, r) => q + r, 0);
  return { w: e.map((v) => v / sum), aim: p.x0 };
}

export type Pair = { x0: P2; eps: P2; blob: number };
/** Training pairs for the straight road: a data point and a noise point drawn independently of each other. */
export function trainPairs(n: number, seed: number, mix: Mix = BLOBS): Pair[] {
  const r = mulberry(seed);
  return Array.from({ length: n }, (): Pair => {
    const blob = Math.min(mix.mu.length - 1, Math.floor(r() * mix.mu.length)), m = mix.mu[blob];
    return { x0: [m[0] + mix.s * gauss(r), m[1] + mix.s * gauss(r)], eps: [gauss(r), gauss(r)], blob };
  });
}
/** Index of the blob centre nearest to x. */
export const nearestBlob = (x: P2, mix: Mix = BLOBS) => mix.mu.reduce((best, m, k) => (Math.hypot(x[0] - m[0], x[1] - m[1]) < Math.hypot(x[0] - mix.mu[best][0], x[1] - mix.mu[best][1]) ? k : best), 0);

/** Mean distance from each end point to the nearest blob centre. A perfect sampler gives about 1.25·s. */
export function nearest(ends: P2[], mix: Mix = BLOBS): number {
  return ends.reduce((s, x) => s + Math.min(...mix.mu.map((m) => Math.hypot(x[0] - m[0], x[1] - m[1]))), 0) / ends.length;
}
/** Mean distance between two sets of end points that started from the same noise. */
export const apart = (a: P2[], b: P2[]) => a.reduce((s, x, i) => s + Math.hypot(x[0] - b[i][0], x[1] - b[i][1]), 0) / a.length;
/* ---- 04 · binding a colour to the right object ---- */

export const WORDS = ["red", "ball", "blue", "box"] as const;
/** Cross-attention from an object's region to the four prompt tokens. `context` is how much each noun has absorbed its adjective. */
export type Bound = { scores: number[]; w: number[]; colour: [number, number][]; mixed: [number, number]; red: number };
export function bind(context: number, beta = 3): Bound[] {
  const colour: [number, number][] = [[1, 0], [context, 0], [0, 1], [0, context]];      // (red, blue) carried by each token
  const object = [[0, 0], [1, 0], [0, 0], [0, 1]];                                       // (ball, box) named by each token
  return [0, 1].map((obj) => {
    const sc = object.map((o) => beta * o[obj]), mx = Math.max(...sc), e = sc.map((s) => Math.exp(s - mx)), sum = e.reduce((a, b) => a + b, 0);
    const w = e.map((v) => v / sum);
    const red = w.reduce((s, wi, i) => s + wi * colour[i][0], 0), blue = w.reduce((s, wi, i) => s + wi * colour[i][1], 0);
    return { scores: sc, w, colour, mixed: [red, blue], red: red / (red + blue) };
  });
}

/* ---- 05 · a picture as a sequence of code numbers ---- */

export type Codes = { book: number[][]; ids: number[]; recon: Img; lost: number };
/** k-means over the 256 patches: a codebook of K typical patches, and for each patch the number of its nearest code. */
export function quantize(K: number): Codes {
  const d2 = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
  const book: number[][] = [[...PATCHES[0]]];
  const far = PATCHES.map((p) => d2(p, book[0]));
  while (book.length < K) {                                                              // farthest-point start
    let best = 0;
    for (let i = 1; i < far.length; i++) if (far[i] > far[best]) best = i;
    book.push([...PATCHES[best]]);
    PATCHES.forEach((p, i) => { far[i] = Math.min(far[i], d2(p, book[book.length - 1])); });
  }
  let ids = new Array<number>(PATCHES.length).fill(0);
  for (let it = 0; it < 25; it++) {
    ids = PATCHES.map((p) => { let b = 0, bd = Infinity; book.forEach((c, k) => { const d = d2(p, c); if (d < bd) { bd = d; b = k; } }); return b; });
    book.forEach((c, k) => {
      const mine = PATCHES.filter((_, i) => ids[i] === k);
      if (mine.length) for (let i = 0; i < PD; i++) c[i] = mine.reduce((s, p) => s + p[i], 0) / mine.length;
    });
  }
  const recon = fromPatches(ids.map((k) => book[k]));
  return { book, ids, recon, lost: lost(recon) };
}

/** Distance from one patch to every code, nearest first: [code number, distance]. */
export const codeDistances = (p: number[], book: number[][]): [number, number][] =>
  book.map((c, k): [number, number] => [k, Math.sqrt(c.reduce((s, v, i) => s + (v - p[i]) ** 2, 0))]).sort((a, b) => a[1] - b[1]);

/* ---- 06 · how many tokens a video becomes ---- */

export const VIDEO_SIZES = [{ name: "480p", w: 848, h: 480 }, { name: "720p", w: 1280, h: 720 }, { name: "1080p", w: 1920, h: 1080 }];
export const FPS = 24;
/** Typical published settings: the autoencoder shrinks 8× per side and 4× in time, then 2×2 patches. */
export function videoTokens(w: number, h: number, seconds: number, fs = 8, ft = 4, p = 2): { frames: number; numbers: number; tokens: number; grid: [number, number, number] } {
  const frames = seconds * FPS, gw = Math.round(w / fs / p), gh = Math.round(h / fs / p), gt = Math.round(frames / ft);
  return { frames, numbers: w * h * frames * 3, tokens: gw * gh * gt, grid: [gw, gh, gt] };
}

/**
 * Four frames of the small picture with the ball moving one pixel per frame, cut into 4×4×4 space-time patches (64 numbers each).
 * `apart(k)`: every frame's patch keeps k numbers along directions fitted to single-frame patches, so a space-time patch keeps 4k.
 * `joint(m)`: the 64 numbers are compressed in one go to m numbers along directions fitted to the space-time patches.
 * Both return the share of the clip's variation that is lost.
 */
export function spaceTimeToy(): { apart: (k: number) => number; joint: (m: number) => number } {
  const frames = [0, 1, 2, 3].map((f) => patchesOf(pictureAt(f)));
  const fit = (rows: number[][]) => {
    const d = rows[0].length, mean = Array.from({ length: d }, (_, i) => rows.reduce((s, p) => s + p[i], 0) / rows.length);
    const C = Array.from({ length: d }, () => new Array<number>(d).fill(0));
    for (const p of rows) for (let i = 0; i < d; i++) for (let j = i; j < d; j++) C[i][j] += (p[i] - mean[i]) * (p[j] - mean[j]);
    for (let i = 0; i < d; i++) for (let j = 0; j < i; j++) C[i][j] = C[j][i];
    return { mean, vec: eigSym(C).vec };
  };
  const residual = (rows: number[][], k: number, model: { mean: number[]; vec: number[][] }) => rows.reduce((tot, p) => {
    const d = p.length, out = [...model.mean];
    for (let c = 0; c < k; c++) {
      let code = 0;
      for (let i = 0; i < d; i++) code += (p[i] - model.mean[i]) * model.vec[i][c];
      for (let i = 0; i < d; i++) out[i] += code * model.vec[i][c];
    }
    return tot + p.reduce((s, v, i) => s + (v - out[i]) ** 2, 0);
  }, 0);
  const single = frames.flat(), cubes = frames[0].map((_, n) => frames.flatMap((fr) => fr[n]));
  const all = single.flat(), mu = all.reduce((a, b) => a + b, 0) / all.length, total = all.reduce((s, v) => s + (v - mu) ** 2, 0);
  const one = fit(single), four = fit(cubes);
  return { apart: (k) => residual(single, k, one) / total, joint: (m) => residual(cubes, m, four) / total };
}

/* ---- 07 · frames denoised separately, or as one clip ---- */

const softmax = (l: number[]) => { const mx = Math.max(...l), e = l.map((v) => Math.exp(v - mx)), sum = e.reduce((p, q) => p + q, 0); return e.map((v) => v / sum); };

/**
 * One moment of the walk. `own[f]`: frame f's five shares computed from its own point alone.
 * `pooled`: the five shares after the eight frames' log evidence is added look by look (what a joint model uses for every frame).
 */
export type ClipStep = { pts: P2[]; own: number[][]; pooled: number[] };
/** Each frame's "look" is a point that must sit on one of five blobs, the same one for the whole clip. Returns steps+1 moments. */
export function clipHistory(joint: boolean, frames: number, seed: number, steps = 40, mix: Mix = BLOBS): ClipStep[] {
  const r = mulberry(seed);
  let xs: P2[] = Array.from({ length: frames }, (): P2 => [gauss(r), gauss(r)]);
  const out: ClipStep[] = [];
  for (let i = 0; i <= steps; i++) {
    const [a, b] = road("straight", 1 - i / steps);
    const logs = xs.map((x) => posterior(x, a, b, mix).logw);
    // a joint model weighs "which look is this clip?" with the evidence of every frame at once: add the logs, then one softmax
    const sum = logs.reduce((s, l) => s.map((v, k) => v + l[k]));
    out.push({ pts: xs, own: logs.map(softmax), pooled: softmax(sum) });
    if (i === steps) break;
    const [an, bn] = road("straight", 1 - (i + 1) / steps), shared = joint ? sum : undefined;
    xs = xs.map((x) => { const p = posterior(x, a, b, mix, shared); return [an * p.x0[0] + bn * p.eps[0], an * p.x0[1] + bn * p.eps[1]] as P2; });
  }
  return out;
}
/** Where a point aims at time t on the straight road when the five blobs are weighed by `w` (its own shares, or the pooled ones). */
export function aimWith(x: P2, t: number, w: number[], mix: Mix = BLOBS): P2 {
  const [a, b] = road("straight", t), v = a * a * mix.s * mix.s + b * b, gain = (a * mix.s * mix.s) / v;
  return mix.mu.reduce<P2>((s, m, k) => [s[0] + w[k] * (m[0] + gain * (x[0] - a * m[0])), s[1] + w[k] * (m[1] + gain * (x[1] - a * m[1]))], [0, 0]);
}
/** The look each point is nearest to, and the share of neighbouring frames that agree. */
export function looksOf(pts: P2[], mix: Mix = BLOBS): { look: number[]; steady: number } {
  const look = pts.map((x) => nearestBlob(x, mix));
  let same = 0;
  for (let i = 1; i < pts.length; i++) if (look[i] === look[i - 1]) same++;
  return { look, steady: same / (pts.length - 1) };
}

export type Clip = { pts: P2[]; look: number[]; steady: number };
export function sampleClip(joint: boolean, frames: number, seed: number, steps = 40, mix: Mix = BLOBS): Clip {
  const h = clipHistory(joint, frames, seed, steps, mix), pts = h[h.length - 1].pts;
  return { pts, ...looksOf(pts, mix) };
}
