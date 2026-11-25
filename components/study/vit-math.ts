/** Small hand-set models behind the ViT chapter. Every number quoted in the prose is computed here. No imports, so node can run it directly. */

export const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
export function softmax(z: number[]): number[] {
  const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}
const apply = (W: number[][], x: number[]) => W.map((row) => dot(row, x));
const plus = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);
const mixOf = (w: number[], vs: number[][]) => vs[0].map((_, d) => w.reduce((s, wi, i) => s + wi * vs[i][d], 0));

/** Deterministic PRNG (mulberry32) and a normal sample, for stand-in weights that are not quoted in the prose. */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const randn = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-9))) * Math.cos(2 * Math.PI * r());
export const randMat = (rows: number, cols: number, r: () => number, scale = 1): number[][] =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => randn(r) * scale));

/** Sinusoidal position vector of the 2017 Transformer paper: d numbers for position `pos`. */
export function sinusoid(pos: number, d: number): number[] {
  return Array.from({ length: d }, (_, i) => {
    const freq = 1 / Math.pow(10000, (2 * Math.floor(i / 2)) / d);
    return i % 2 === 0 ? Math.sin(pos * freq) : Math.cos(pos * freq);
  });
}

/* ---- 01 · counting tokens, and one tiny patch turned into a vector ---- */

export const COUNTS = {
  pixels224: 224 * 224,                 // 50,176 pixels if every pixel were a token
  pixelPairs: (224 * 224) ** 2,         // 2,517,630,976 pairs
  perPatch: 14 * 14 * 3,                // 588 numbers in one 14 px patch
  side: 392 / 14,                       // 28 patches per side
  tokens: (392 / 14) ** 2,              // 784
  pairs: ((392 / 14) ** 2) ** 2,        // 614,656
  weights: 768 * 588,                   // 451,584 numbers in the patch-embedding matrix
};

/** A 2 × 2 grey patch written row by row: bright on the left, dark on the right. Hand-set. */
export const TINY_PATCH = [0.9, 0.1, 0.8, 0.2];
/** The same patch with one pixel changed (top right 0.1 → 0.9). */
export const TINY_PATCH_B = [0.9, 0.9, 0.8, 0.2];
/** A 2 × 4 embedding matrix: each row holds one weight per pixel. Hand-set. */
export const TINY_E = [[1, -1, 1, -1], [1, 1, -1, -1]];
export const tinyEmbed = (pixels: number[]) => apply(TINY_E, pixels);

/* ---- the 2 × 2 cat photo: same vectors and the same W_K as walk-math.ts (ViT 02–03) ---- */

export type Kind = "ear" | "eye" | "wall";
export const KIND_VEC: Record<Kind, number[]> = { ear: [1, 2], eye: [2, 1], wall: [0, -1] };
export const STANDARD: Kind[] = ["ear", "eye", "wall", "wall"];
/** ② turned into bare wall (the experiment of section 03). */
export const NO_EYE: Kind[] = ["ear", "wall", "wall", "wall"];
/** ① and ③ exchanged: the ear now sits below the wall. */
export const SWAPPED: Kind[] = ["wall", "eye", "ear", "wall"];
const WK = [[0, 0.5], [0.5, 0]];

export type Read = { q: number[]; keys: number[][]; vals: number[][]; scores: number[]; weights: number[]; parts: number[][]; read: number[]; out: number[] };
/** Token `owner` reads every token in `xs` once: Q and V are the token vectors themselves, K = W_K x. */
export function readBy(owner: number, xs: number[][]): Read {
  const q = xs[owner], keys = xs.map((x) => apply(WK, x)), vals = xs;
  const scores = keys.map((k) => dot(q, k)), weights = softmax(scores);
  const parts = vals.map((v, i) => v.map((n) => n * weights[i])), read = mixOf(weights, vals);
  return { q, keys, vals, scores, weights, parts, read, out: plus(q, read) };
}

/* ---- 04 · an extra token with no pixels reads the four patches ---- */

/** Starting vector of [CLS]: the same for every photo. Hand-set here, learned in a real model. */
export const CLS0 = [0.9, 0.9];
export const CLASSES = ["고양이", "개", "빈 벽"];
/** Output layer: one row per class. Hand-set. */
export const W_OUT = [[1.2, 0.7], [0.2, 1.0], [-1.0, 0.2]];

/** Position vectors, one per slot of the 2 × 2 grid. Hand-set. */
export const POS = [[0.5, 0], [0, 0.5], [-0.5, 0], [0, -0.5]];

export type Pass = { x: number[][]; ear: number; eye: number; earRead: Read; cls: Read; logits: number[]; probs: number[]; mean: number[] };
/**
 * One layer over a layout of the four cells.
 * The ear patch reads the four patches (as in sections 02–03); [CLS] reads the four patches and itself.
 * `pos` adds the slot's position vector to each patch vector before the layer.
 */
export function pass(layout: Kind[], pos = false): Pass {
  const x = layout.map((k, i) => (pos ? plus(KIND_VEC[k], POS[i]) : KIND_VEC[k]));
  const ear = layout.indexOf("ear"), eye = layout.indexOf("eye");
  const earRead = readBy(ear, x), cls = readBy(4, [...x, CLS0]);
  const logits = W_OUT.map((row) => dot(row, cls.out)), probs = softmax(logits);
  const mean = x[0].map((_, d) => x.reduce((s, v) => s + v[d], 0) / x.length);
  return { x, ear, eye, earRead, cls, logits, probs, mean };
}

/* ---- 08 · DINO: one photo, two crops, two networks ---- */

/** Teacher scores for the large crop, after the running mean c has been subtracted. Six unnamed bins. Hand-set. */
export const Z_T = [0.22, 0.1, 0.02, -0.06, 0.0, -0.12];
/** Student scores for the small crop of the same photo. Hand-set. */
export const Z_S = [0.16, 0.12, 0.05, -0.02, 0.03, -0.1];
export const TAU_S = 0.1;
export const TAU_T = 0.04;

export type Dino = { pt: number[]; ps: number[]; loss: number; zsNext: number[]; psNext: number[]; lossNext: number; floor: number };
/** Cross-entropy between the teacher's distribution and the student's, and one gradient step on the student's scores only. */
export function dino(tauT = TAU_T, lr = 0.005): Dino {
  const pt = softmax(Z_T.map((v) => v / tauT)), ps = softmax(Z_S.map((v) => v / TAU_S));
  const ce = (p: number[]) => -pt.reduce((s, t, k) => s + t * Math.log(p[k]), 0);
  // dL/dz_s = (p_s − p_t) / τ_s ; the teacher's side receives no gradient
  const zsNext = Z_S.map((z, k) => z - (lr * (ps[k] - pt[k])) / TAU_S), psNext = softmax(zsNext.map((v) => v / TAU_S));
  const floor = -pt.reduce((s, t) => s + (t > 0 ? t * Math.log(t) : 0), 0);
  return { pt, ps, loss: ce(ps), zsNext, psNext, lossNext: ce(psNext), floor };
}

/** θ_t ← m θ_t + (1 − m) θ_s for one weight. */
export const ema = (teacher: number, student: number, m = 0.996) => m * teacher + (1 - m) * student;

/** Centering on two photos and two bins: a bin that is high for every photo disappears once the mean is subtracted. Hand-set. */
export const CENTER_A = [0.9, 0.2], CENTER_B = [0.8, 0.3];
export function centering() {
  const c = CENTER_A.map((v, k) => (v + CENTER_B[k]) / 2);
  return { c, a: CENTER_A.map((v, k) => v - c[k]), b: CENTER_B.map((v, k) => v - c[k]) };
}

/* ---- 09 · nearest normal token ---- */

/** Three stored normal tokens and two test tokens, two numbers each. Hand-set. */
export const BANK = [[1, 2], [2, 1], [0, -1]];
export const TEST_NEAR = [1.2, 1.9];
export const TEST_FAR = [-2, 2];
export const distance = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
/** s(p) = min over the memory of ‖z_p − m‖. Returns every distance and the index of the nearest. */
export function nearest(z: number[], bank: number[][] = BANK) {
  const d = bank.map((m) => distance(z, m)), score = Math.min(...d);
  return { d, score, index: d.indexOf(score) };
}
