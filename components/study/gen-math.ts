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

/** A hand-made grayscale scene: sky gradient, a shaded ball, a striped floor, a dark post. Values in 0..1. */
export const PICTURE: Img = Array.from({ length: IMG }, (_, y) => Array.from({ length: IMG }, (_, x) => {
  let v = 0.78 - 0.3 * (y / IMG);                                          // sky, brighter at the top
  if (y > 44) v = 0.38 + 0.2 * Math.sin((x + (y - 44) * 1.5) * 0.55);      // striped floor
  const dx = x - 24, dy = y - 27, d = Math.sqrt(dx * dx + dy * dy);
  if (d < 14) v = 0.95 - 0.5 * Math.min(1, Math.sqrt((dx + 5) ** 2 + (dy + 5) ** 2) / 18);   // ball lit from the upper left
  if (x >= 47 && x < 53 && y >= 12 && y < 46) v = 0.12;                    // post
  return Math.min(1, Math.max(0, v));
}));

/** The 256 patches as 16-number vectors, in reading order. */
export const PATCHES: number[][] = (() => {
  const out: number[][] = [];
  for (let py = 0; py < NP; py++) for (let px = 0; px < NP; px++) {
    const v: number[] = [];
    for (let j = 0; j < PS; j++) for (let i = 0; i < PS; i++) v.push(PICTURE[py * PS + j][px * PS + i]);
    out.push(v);
  }
  return out;
})();

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

/** Learned compression: keep the k most useful directions of each patch (a linear encoder and decoder fitted to this picture). */
export function learnedRecon(k: number): Img {
  return fromPatches(PATCHES.map((p) => {
    const out = [...PATCH_MEAN];
    for (let c = 0; c < k; c++) {
      let code = 0;
      for (let i = 0; i < PD; i++) code += (p[i] - PATCH_MEAN[i]) * PCA.vec[i][c];
      for (let i = 0; i < PD; i++) out[i] += code * PCA.vec[i][c];
    }
    return out;
  }));
}

/** Plain shrinking with the same budget: average over blocks so each patch keeps k numbers. k ∈ {1, 2, 4, 8}. */
export function shrinkRecon(k: number): Img {
  const [bh, bw] = k === 1 ? [4, 4] : k === 2 ? [4, 2] : k === 4 ? [2, 2] : [1, 2];
  return fromPatches(PATCHES.map((p) => {
    const out = new Array<number>(PD).fill(0);
    for (let j0 = 0; j0 < PS; j0 += bh) for (let i0 = 0; i0 < PS; i0 += bw) {
      let s = 0;
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) s += p[(j0 + j) * PS + i0 + i];
      for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) out[(j0 + j) * PS + i0 + i] = s / (bh * bw);
    }
    return out;
  }));
}

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

/** Walk n particles from noise to data in `steps` equal steps of t. Each path has steps+1 points. */
export function walk(kind: Road, steps: number, n: number, seed: number, mix: Mix = BLOBS): P2[][] {
  const r = mulberry(seed);
  return Array.from({ length: n }, () => {
    const e: P2 = [gauss(r), gauss(r)];
    const [a1, b1] = road(kind, 1);
    let x: P2 = [a1 * 0 + b1 * e[0], a1 * 0 + b1 * e[1]];
    const path: P2[] = [x];
    for (let i = 0; i < steps; i++) {
      const [a, b] = road(kind, 1 - i / steps), [an, bn] = road(kind, 1 - (i + 1) / steps);
      const p = posterior(x, a, b, mix);
      x = [an * p.x0[0] + bn * p.eps[0], an * p.x0[1] + bn * p.eps[1]];
      path.push(x);
    }
    return path;
  });
}

/** Mean distance from each end point to the nearest blob centre. A perfect sampler gives about 1.25·s. */
export function nearest(ends: P2[], mix: Mix = BLOBS): number {
  return ends.reduce((s, x) => s + Math.min(...mix.mu.map((m) => Math.hypot(x[0] - m[0], x[1] - m[1]))), 0) / ends.length;
}
/** Mean distance between two sets of end points that started from the same noise. */
export const apart = (a: P2[], b: P2[]) => a.reduce((s, x, i) => s + Math.hypot(x[0] - b[i][0], x[1] - b[i][1]), 0) / a.length;
/* ---- 04 · binding a colour to the right object ---- */

export const WORDS = ["red", "ball", "blue", "box"] as const;
/** Cross-attention from an object's region to the four prompt tokens. `context` is how much each noun has absorbed its adjective. */
export function bind(context: number, beta = 3): { w: number[]; red: number }[] {
  const colour: [number, number][] = [[1, 0], [context, 0], [0, 1], [0, context]];      // (red, blue) carried by each token
  const object = [[0, 0], [1, 0], [0, 0], [0, 1]];                                       // (ball, box) named by each token
  return [0, 1].map((obj) => {
    const sc = object.map((o) => beta * o[obj]), mx = Math.max(...sc), e = sc.map((s) => Math.exp(s - mx)), sum = e.reduce((a, b) => a + b, 0);
    const w = e.map((v) => v / sum);
    const red = w.reduce((s, wi, i) => s + wi * colour[i][0], 0), blue = w.reduce((s, wi, i) => s + wi * colour[i][1], 0);
    return { w, red: red / (red + blue) };
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

/* ---- 06 · how many tokens a video becomes ---- */

export const VIDEO_SIZES = [{ name: "480p", w: 848, h: 480 }, { name: "720p", w: 1280, h: 720 }, { name: "1080p", w: 1920, h: 1080 }];
export const FPS = 24;
/** Typical published settings: the autoencoder shrinks 8× per side and 4× in time, then 2×2 patches. */
export function videoTokens(w: number, h: number, seconds: number, fs = 8, ft = 4, p = 2): { frames: number; numbers: number; tokens: number; grid: [number, number, number] } {
  const frames = seconds * FPS, gw = Math.round(w / fs / p), gh = Math.round(h / fs / p), gt = Math.round(frames / ft);
  return { frames, numbers: w * h * frames * 3, tokens: gw * gh * gt, grid: [gw, gh, gt] };
}

/* ---- 07 · frames denoised separately, or as one clip ---- */

export type Clip = { pts: P2[]; look: number[]; steady: number };
/** Each frame's "look" is a point that must sit on one of five blobs, the same one for the whole clip. */
export function sampleClip(joint: boolean, frames: number, seed: number, steps = 40, mix: Mix = BLOBS): Clip {
  const r = mulberry(seed);
  let xs: P2[] = Array.from({ length: frames }, (): P2 => [gauss(r), gauss(r)]);
  for (let i = 0; i < steps; i++) {
    const [a, b] = road("straight", 1 - i / steps), [an, bn] = road("straight", 1 - (i + 1) / steps);
    // a joint model weighs "which look is this clip?" with the evidence of every frame at once
    const shared = joint ? xs.map((x) => posterior(x, a, b, mix).logw).reduce((s, l) => s.map((v, k) => v + l[k])) : undefined;
    xs = xs.map((x) => { const p = posterior(x, a, b, mix, shared); return [an * p.x0[0] + bn * p.eps[0], an * p.x0[1] + bn * p.eps[1]] as P2; });
  }
  const look = xs.map((x) => { let bi = 0, bd = Infinity; mix.mu.forEach((m, k) => { const d = Math.hypot(x[0] - m[0], x[1] - m[1]); if (d < bd) { bd = d; bi = k; } }); return bi; });
  let same = 0;
  for (let i = 1; i < frames; i++) if (look[i] === look[i - 1]) same++;
  return { pts: xs, look, steady: same / (frames - 1) };
}
