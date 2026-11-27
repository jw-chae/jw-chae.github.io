/** Arithmetic behind the probability chapter. One picture, the owner's Siamese cat cut into 16 × 16 cells, and one cell drawn from it,
 *  followed from a share of cells to softmax, conditioning, Bayes, mean and spread, the Gaussian, likelihood and cross-entropy.
 *  Import-free so node can run it. Every number the prose, doubts and canvas labels quote comes from here. */

/* ------------------------------------------------------------------ */
/* the picture: measured brightness and part names                     */
/* ------------------------------------------------------------------ */

/** Copied from CAT_GRAY_16 in cat-grids.ts: public/study/cat-square.png (512 × 512) cut into 16 × 16 cells of 32 px,
 *  luminance of each cell's mean colour, 0 dark to 1 bright, two decimals. Measured, not hand-set. */
export const GRAY16: number[][] = [
  [0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.88, 0.76, 0.94, 0.94, 0.94, 0.94],
  [0.94, 0.94, 0.94, 0.95, 0.94, 0.94, 0.88, 0.62, 0.9, 0.94, 0.53, 0.61, 0.94, 0.95, 0.95, 0.94],
  [0.94, 0.94, 0.94, 0.95, 0.95, 0.94, 0.91, 0.5, 0.38, 0.74, 0.54, 0.55, 0.94, 0.94, 0.95, 0.94],
  [0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.6, 0.64, 0.31, 0.25, 0.53, 0.94, 0.95, 0.95, 0.94],
  [0.94, 0.94, 0.94, 0.95, 0.95, 0.95, 0.95, 0.9, 0.51, 0.3, 0.17, 0.57, 0.95, 0.95, 0.95, 0.94],
  [0.94, 0.94, 0.94, 0.95, 0.95, 0.95, 0.94, 0.95, 0.87, 0.68, 0.47, 0.86, 0.95, 0.95, 0.94, 0.94],
  [0.94, 0.94, 0.94, 0.95, 0.95, 0.95, 0.91, 0.87, 0.84, 0.88, 0.87, 0.9, 0.95, 0.95, 0.95, 0.94],
  [0.94, 0.94, 0.94, 0.95, 0.94, 0.91, 0.88, 0.9, 0.84, 0.88, 0.9, 0.88, 0.95, 0.95, 0.95, 0.94],
  [0.94, 0.94, 0.94, 0.95, 0.95, 0.85, 0.9, 0.86, 0.82, 0.85, 0.83, 0.89, 0.95, 0.95, 0.95, 0.94],
  [0.94, 0.94, 0.94, 0.94, 0.91, 0.83, 0.87, 0.87, 0.71, 0.69, 0.75, 0.95, 0.95, 0.95, 0.95, 0.94],
  [0.94, 0.94, 0.94, 0.95, 0.86, 0.83, 0.88, 0.9, 0.6, 0.44, 0.61, 0.95, 0.95, 0.95, 0.95, 0.94],
  [0.94, 0.94, 0.94, 0.95, 0.82, 0.81, 0.88, 0.88, 0.58, 0.36, 0.52, 0.95, 0.95, 0.95, 0.95, 0.94],
  [0.94, 0.94, 0.94, 0.95, 0.79, 0.84, 0.84, 0.82, 0.64, 0.21, 0.39, 0.95, 0.95, 0.95, 0.95, 0.94],
  [0.94, 0.94, 0.94, 0.87, 0.39, 0.78, 0.66, 0.53, 0.38, 0.21, 0.24, 0.81, 0.95, 0.95, 0.95, 0.94],
  [0.94, 0.94, 0.94, 0.81, 0.2, 0.21, 0.22, 0.22, 0.22, 0.2, 0.31, 0.67, 0.94, 0.95, 0.95, 0.94],
  [0.94, 0.94, 0.95, 0.95, 0.91, 0.74, 0.63, 0.58, 0.56, 0.63, 0.92, 0.95, 0.95, 0.95, 0.95, 0.94],
];

/** Copied from CAT_PARTS_16 in cat-grids.ts, one letter per cell: . bg, c cream, P point (dark brown), e pink inner ear, E eye.
 *  These are colour-threshold labels (dominant colour class per cell; a cell is "eye" when 8% or more of it is eye-coloured). */
const COLOR16 = [
  "................",
  "..........Pe....",
  ".......ePcPP....",
  "........cPPE....",
  "........PEPP....",
  ".........cP.....",
  ".......cccc.....",
  "......cccccc....",
  ".....cccccc.....",
  ".....cccccc.....",
  ".....cccePP.....",
  "....ccccPPP.....",
  ".....ccccPP.....",
  "....PcccPPP.....",
  "....PPPPPPPc....",
  "........P.......",
];

/** The answer a cell carries: which part of the cat it is. */
export type Part = "bg" | "body" | "leg" | "face" | "ear" | "eye";
export const PARTS: Part[] = ["bg", "body", "leg", "face", "ear", "eye"];

/** Part names. Background and eye follow the colour rule of cat-grids.ts. The head rows 0..5 were split into ear and face by looking
 *  at the drawing (hand labels, listed here). Below the head, a dark-brown cell is leg-or-tail and any other cat cell is body, except
 *  cell (14, 11), the edge of the front paw over its shadow, which the colour rule calls cream and which is labelled leg-or-tail by hand. */
const HEAD: Record<string, Part> = {
  "1,10": "ear", "1,11": "ear", "2,7": "ear", "2,8": "ear", "2,10": "ear", "2,11": "ear",
  "2,9": "face", "3,8": "face", "3,9": "face", "3,10": "face", "4,8": "face", "4,10": "face", "4,11": "face", "5,9": "face", "5,10": "face",
};
function partOf(r: number, c: number): Part {
  const k = COLOR16[r][c];
  if (k === ".") return "bg";
  if (k === "E") return "eye";
  const h = HEAD[`${r},${c}`];
  if (h) return h;
  if (r === 14 && c === 11) return "leg";
  return k === "P" ? "leg" : "body";
}
export const PART16: Part[][] = GRAY16.map((row, r) => row.map((_, c) => partOf(r, c)));

export const N = 16;
export const N_CELLS = N * N;
export type Cell = { r: number; c: number; x: number; part: Part };
export const CELLS: Cell[] = GRAY16.flatMap((row, r) => row.map((x, c) => ({ r, c, x, part: PART16[r][c] })));
export const countOf = (p: Part, cells: Cell[] = CELLS) => cells.filter((k) => k.part === p).length;
export const PART_COUNT: Record<Part, number> = Object.fromEntries(PARTS.map((p) => [p, countOf(p)])) as Record<Part, number>;

/** The one cell the chapter follows: row 2, column 8, the dark base of the left ear. Brightness 0.38, part "ear".
 *  The prose keeps its part hidden until section 03. */
export const TRACK = { r: 2, c: 8 };
export const TRACK_X = GRAY16[TRACK.r][TRACK.c];
export const TRACK_PART = PART16[TRACK.r][TRACK.c];

/** "Dark" means brightness below this. Hand-set; section 03 lets the reader move it. */
export const DARK = 0.55;
export const isDark = (x: number, th = DARK) => x < th;

/* ------------------------------------------------------------------ */
/* 01 · a distribution: shares of the cells                             */
/* ------------------------------------------------------------------ */

export const CAT_CELLS = CELLS.filter((k) => k.part !== "bg");
export const shares = (cells: Cell[]) => PARTS.map((p) => countOf(p, cells) / cells.length);
export const SHARE_ALL = shares(CELLS);
export const SHARE_CAT = shares(CAT_CELLS);

/** A small seeded generator, so every visit and every screenshot shows the same draws. */
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const DRAW_MAX = 1000;
/** The same picture cut into 32 × 32 cells: background and eye cells by the same colour rule. Counted from CAT_PARTS_32 in
 *  cat-grids.ts by check.mjs in the chapter's scratch folder and pasted here; that script asserts the two numbers. */
export const GRID32 = { n: 1024, bg: 719, eye: 5 };

/** Draws with replacement: each draw picks one of the cells, every cell equally likely. Indices into the given list. */
function drawSeq(n: number, size: number, seed: number) {
  const r = mulberry(seed);
  return Array.from({ length: size }, () => Math.floor(r() * n));
}
export const DRAWS_ALL = drawSeq(CELLS.length, DRAW_MAX, 7);
export const DRAWS_CAT = drawSeq(CAT_CELLS.length, DRAW_MAX, 11);
/** How often each part came up in the first k draws. */
export function tally(k: number, catOnly: boolean): number[] {
  const cells = catOnly ? CAT_CELLS : CELLS, seq = catOnly ? DRAWS_CAT : DRAWS_ALL;
  const out = PARTS.map(() => 0);
  for (let i = 0; i < k; i++) out[PARTS.indexOf(cells[seq[i]].part)]++;
  return out;
}

/* ------------------------------------------------------------------ */
/* 02 · softmax: six scores become six shares                            */
/* ------------------------------------------------------------------ */

/** The toy model knows one thing about a cell: whether it is dark. Its last layer gives these six scores to every dark cell,
 *  in the order of PARTS. Hand-set, not learned. */
export const Z_DARK = [-1, 0, 2, 0.5, 0, -0.5];

export function softmax(z: number[]): number[] {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}
export const expOf = (z: number[]) => z.map((v) => Math.exp(v));
export const Q_HAND = softmax(Z_DARK);

export type Tweak = "none" | "plus" | "double" | "half" | "ear";
export const TWEAKS: Tweak[] = ["none", "plus", "double", "half", "ear"];
/** One change to the six scores at a time: add 1 to all, multiply all by 2, multiply all by 0.5, add 1 to the ear score only. */
export function tweak(z: number[], t: Tweak): number[] {
  if (t === "plus") return z.map((v) => v + 1);
  if (t === "double") return z.map((v) => v * 2);
  if (t === "half") return z.map((v) => v * 0.5);
  if (t === "ear") return z.map((v, i) => (PARTS[i] === "ear" ? v + 1 : v));
  return [...z];
}
/** Ratio of two shares: exp of the score difference, the denominator cancels. */
export const shareRatio = (z: number[], i: number, j: number) => Math.exp(z[i] - z[j]);

/* ------------------------------------------------------------------ */
/* 03 · joint and conditional: the same four cells, three denominators  */
/* ------------------------------------------------------------------ */

export type Joint = { dark: number[]; bright: number[]; nDark: number };
export function joint(th = DARK): Joint {
  const dark = PARTS.map((p) => CELLS.filter((k) => k.part === p && isDark(k.x, th)).length);
  const bright = PARTS.map((p, i) => PART_COUNT[p] - dark[i]);
  return { dark, bright, nDark: dark.reduce((a, b) => a + b, 0) };
}
export type Cond = { both: number; nPart: number; nDark: number; pJoint: number; pDarkGivenPart: number; pPartGivenDark: number; pDark: number; pPart: number };
/** P(dark ∩ part), P(dark | part), P(part | dark) as counts and shares. */
export function cond(part: Part, th = DARK): Cond {
  const j = joint(th), i = PARTS.indexOf(part);
  const both = j.dark[i], nPart = PART_COUNT[part], nDark = j.nDark;
  return {
    both, nPart, nDark,
    pJoint: both / N_CELLS, pDarkGivenPart: nPart ? both / nPart : 0, pPartGivenDark: nDark ? both / nDark : 0,
    pDark: nDark / N_CELLS, pPart: nPart / N_CELLS,
  };
}
/** What P(dark ∩ ear) would be if darkness and being an ear had nothing to do with each other: P(dark) · P(ear). */
export const INDEP_EAR = (() => { const c = cond("ear"); return { joint: c.pDark * c.pPart, darkEars: c.pDark * c.nPart }; })();
/** Thresholds the slider offers. */
export const TH_STEPS = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8];

/* ------------------------------------------------------------------ */
/* 04 · Bayes: flip the condition with the base rate                     */
/* ------------------------------------------------------------------ */

/** A two-branch tree: of `total` items, `nA` are A; of those a share `hitA` raise the signal; of the rest a share `hitB` raise it too. */
export type Tree = { total: number; nA: number; nB: number; hitA: number; hitB: number; aSig: number; bSig: number; sig: number; pSigGivenA: number; pAGivenSig: number };
export function tree(total: number, nA: number, hitA: number, hitB: number): Tree {
  const nB = total - nA, aSig = nA * hitA, bSig = nB * hitB, sig = aSig + bSig;
  return { total, nA, nB, hitA, hitB, aSig, bSig, sig, pSigGivenA: hitA, pAGivenSig: sig ? aSig / sig : 0 };
}
/** The cat: A is one part, the signal is "dark". */
export function catTree(part: Part, th = DARK): Tree {
  const c = cond(part, th), nB = N_CELLS - c.nPart;
  return tree(N_CELLS, c.nPart, c.nPart ? c.both / c.nPart : 0, nB ? (c.nDark - c.both) / nB : 0);
}
/** The factory: per 10,000 parts. Defect rate, share of defects the detector catches, share of good parts it flags. Hand-set rates. */
export const FACTORY_N = 10000;
export const RATE_STEPS = [0.001, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5];
export const RECALL_STEPS = [0.5, 0.8, 0.9, 0.95, 0.99];
export const FA_STEPS = [0.001, 0.005, 0.01, 0.02, 0.05, 0.1];
export const FACTORY_DEFAULT = { rate: 0.01, recall: 0.95, fa: 0.05 };
export const factory = (rate: number, recall: number, fa: number) => tree(FACTORY_N, FACTORY_N * rate, recall, fa);
/** Bayes' rule written out: P(A | S) = P(S | A) P(A) / P(S). */
export const bayes = (pSgA: number, pA: number, pS: number) => (pSgA * pA) / pS;

/* ------------------------------------------------------------------ */
/* 05 · expectation and variance of the brightness                      */
/* ------------------------------------------------------------------ */

export const ALL_X = CELLS.map((k) => k.x);
export const meanOf = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
export const varOf = (v: number[]) => { const m = meanOf(v); return v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length; };
export const MEAN_ALL = meanOf(ALL_X);
export const VAR_ALL = varOf(ALL_X);
export const SD_ALL = Math.sqrt(VAR_ALL);
export const PART_MEAN = PARTS.map((p) => meanOf(CELLS.filter((k) => k.part === p).map((k) => k.x)));
/** E[x] = Σ P(part) · E[x | part]. */
export const MEAN_BY_PARTS = PARTS.reduce((s, _, i) => s + SHARE_ALL[i] * PART_MEAN[i], 0);
/** E[x²] − E[x]². */
export const VAR_BY_SQUARES = meanOf(ALL_X.map((v) => v * v)) - MEAN_ALL ** 2;

export const N_STEPS = [1, 4, 16];
export const REPS = 200;
/** REPS repetitions of: draw n cells with replacement and average their brightness. Seeded per n. */
export function sampleMeans(n: number, reps = REPS): { picks: number[][]; means: number[] } {
  const r = mulberry(100 + n);
  const picks = Array.from({ length: reps }, () => Array.from({ length: n }, () => Math.floor(r() * N_CELLS)));
  return { picks, means: picks.map((idx) => meanOf(idx.map((i) => ALL_X[i]))) };
}
export const SAMPLES: Record<number, { picks: number[][]; means: number[] }> = Object.fromEntries(N_STEPS.map((n) => [n, sampleMeans(n)]));
/** Spread of the sample mean in theory, σ/√n, and as measured over the REPS repetitions above. */
export const sdTheory = (n: number) => SD_ALL / Math.sqrt(n);
export const sdMeasured = (n: number) => Math.sqrt(varOf(SAMPLES[n].means));
/** Without putting cells back the spread shrinks by √((N − n)/(N − 1)). */
export const noReplaceFactor = (n: number) => Math.sqrt((N_CELLS - n) / (N_CELLS - 1));
/** Cells whose brightness is within 0.02 of the mean. */
export const NEAR_MEAN = ALL_X.filter((x) => Math.abs(x - MEAN_ALL) <= 0.02).length;

/* ------------------------------------------------------------------ */
/* 06 · the Gaussian on the body fur                                    */
/* ------------------------------------------------------------------ */

export const BODY_X = CELLS.filter((k) => k.part === "body").map((k) => k.x);
export const MU_BODY = meanOf(BODY_X);
export const SD_BODY = Math.sqrt(varOf(BODY_X));
export const gaussPdf = (x: number, mu: number, sd: number) => Math.exp(-((x - mu) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI));
export const zOf = (x: number, mu = MU_BODY, sd = SD_BODY) => (x - mu) / sd;
/** Height relative to the peak: exp(−z²/2). */
export const relHeight = (z: number) => Math.exp(-(z * z) / 2);

/** Three cells to place on the curve: the followed cell, the darkest body cell (shade at the haunch, row 13 column 7), a common body cell. */
export const SHADE_X = GRAY16[13][7];
export const COMMON_X = GRAY16[7][6];
export const PICKS = [TRACK_X, SHADE_X, COMMON_X];
export type Look = "same" | "darker" | "contrast";
export const LOOKS: Look[] = ["same", "darker", "contrast"];
/** The whole picture changed in one way: every cell 0.1 darker, or every brightness multiplied by 0.8. */
export const lookAt = (x: number, l: Look) => (l === "darker" ? x - 0.1 : l === "contrast" ? 0.8 * x : x);
export function looked(l: Look) {
  const xs = BODY_X.map((x) => lookAt(x, l));
  return { xs, mu: meanOf(xs), sd: Math.sqrt(varOf(xs)) };
}
/** The ear cells' own Gaussian, for the doubt "what if it were an ear". */
export const EAR_X = CELLS.filter((k) => k.part === "ear").map((k) => k.x);
export const MU_EAR = meanOf(EAR_X);
export const SD_EAR = Math.sqrt(varOf(EAR_X));
/** Share of the body Gaussian above the brightest body cell: mass the curve puts where the drawing has none. */
export const erf = (x: number) => {
  // Abramowitz and Stegun 7.1.26, error below 1.5e-7
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
export const normCdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
export const BODY_MAX = Math.max(...BODY_X);
export const MASS_ABOVE_MAX = 1 - normCdf(zOf(BODY_MAX));
/** What the bell promises below z = −3, and what the body cells do. */
export const TAIL3 = normCdf(-3);
export const BODY_BELOW = (z: number) => BODY_X.filter((x) => zOf(x) < z).length;

/* ------------------------------------------------------------------ */
/* 07 · likelihood and maximum likelihood                               */
/* ------------------------------------------------------------------ */

/** Five body cells in the middle of the body: row 8, columns 5..9. */
export const ROW8 = [5, 6, 7, 8, 9].map((c) => GRAY16[8][c]);
/** The same five with the fourth replaced by the followed ear cell, as if it had been labelled body by mistake. */
export const SWAP_AT = 3;
export const ROW8_SWAP = ROW8.map((v, i) => (i === SWAP_AT ? TRACK_X : v));
/** σ is held at 0.1 in this section. Hand-set, close to SD_BODY and easy to compute with. */
export const SIG7 = 0.1;
export const logLik = (xs: number[], mu: number, sd = SIG7) => xs.reduce((s, x) => s + Math.log(gaussPdf(x, mu, sd)), 0);
export const lik = (xs: number[], mu: number, sd = SIG7) => xs.reduce((s, x) => s * gaussPdf(x, mu, sd), 1);
/** The μ with the highest likelihood, found by a fine search, to show that it lands on the mean. */
export function argmaxMu(xs: number[], sd = SIG7, lo = 0, hi = 1.2, step = 0.0001) {
  let best = lo, bv = -Infinity;
  for (let m = lo; m <= hi + 1e-12; m += step) { const v = logLik(xs, m, sd); if (v > bv) { bv = v; best = m; } }
  return best;
}
/** Area under the likelihood as a function of μ (the data held fixed). Not 1 in general. Trapezoid rule. */
export function likArea(xs: number[], sd = SIG7, lo = -1, hi = 3, steps = 40000) {
  const h = (hi - lo) / steps;
  let s = 0;
  for (let i = 0; i <= steps; i++) { const m = lo + i * h; s += (i === 0 || i === steps ? 0.5 : 1) * lik(xs, m, sd); }
  return s * h;
}
/** Area under one density as a function of x (μ held fixed): 1. */
export function pdfArea(mu: number, sd = SIG7, lo = -2, hi = 3, steps = 40000) {
  const h = (hi - lo) / steps;
  let s = 0;
  for (let i = 0; i <= steps; i++) { const x = lo + i * h; s += (i === 0 || i === steps ? 0.5 : 1) * gaussPdf(x, mu, sd); }
  return s * h;
}
/** Maximum-likelihood σ when μ is set to the mean: the root mean squared gap (divide by n). */
export const sdML = (xs: number[]) => Math.sqrt(varOf(xs));
export const sdUnbiased = (xs: number[]) => Math.sqrt((varOf(xs) * xs.length) / (xs.length - 1));
/** The slider's μ values: 0.600 to 1.000 in steps of 0.002, so both 0.856 and 0.768 are on it. */
export const MU_STEPS = Array.from({ length: 201 }, (_, i) => Math.round((0.6 + i * 0.002) * 1000) / 1000);
/** Likelihood at the mean against likelihood at μ = 0.80: the same data, two μ. */
export const LIK_RATIO = lik(ROW8, meanOf(ROW8)) / lik(ROW8, 0.8);
/** Squared gaps: one cell 0.44 away weighs more than a hundred cells 0.04 away. */
export const SQ_ONE_FAR = (TRACK_X - ROW8[SWAP_AT]) ** 2;
export const SQ_HUNDRED_NEAR = 100 * 0.04 ** 2;

/* ------------------------------------------------------------------ */
/* 08 · surprise, entropy, cross-entropy, KL                            */
/* ------------------------------------------------------------------ */

/** The true shares among the dark cells, counted from the picture, in the order of PARTS. */
export const P_DARK = (() => { const j = joint(DARK); return j.dark.map((v) => v / j.nDark); })();
export const surprise = (q: number) => -Math.log(q);
export const entropy = (p: number[]) => -p.reduce((s, v) => s + (v > 0 ? v * Math.log(v) : 0), 0);
export const crossEntropy = (p: number[], q: number[]) => -p.reduce((s, v, i) => s + (v > 0 ? v * Math.log(q[i]) : 0), 0);
export const kl = (p: number[], q: number[]) => p.reduce((s, v, i) => s + (v > 0 ? v * Math.log(v / q[i]) : 0), 0);
/** Three models for dark cells: the hand-set scores of section 02, the counted shares themselves, and one sure of leg-or-tail. */
export const Z_SURE = [-4, -4, 4, -4, -4, -4];
export const Q_SURE = softmax(Z_SURE);
export type ModelKey = "hand" | "counted" | "sure";
export const MODELS: ModelKey[] = ["hand", "counted", "sure"];
export const qOf = (m: ModelKey, earScore = Z_DARK[4]): number[] =>
  m === "counted" ? P_DARK : m === "sure" ? Q_SURE : softmax(Z_DARK.map((v, i) => (PARTS[i] === "ear" ? earScore : v)));
/** The ear score that makes the model's ear share equal the counted one, the other five scores held: ln(p/(1−p) · Σ_others e^z). */
export const EAR_BEST = (() => {
  const pe = P_DARK[4], others = Z_DARK.reduce((s, v, i) => s + (i === 4 ? 0 : Math.exp(v)), 0);
  return Math.log((pe / (1 - pe)) * others);
})();
export const EAR_STEPS = Array.from({ length: 41 }, (_, i) => Math.round((-2 + i * 0.1) * 10) / 10);
/** Average surprise over the dark cells, cell by cell: the same number as the cross-entropy with the counted shares. */
export const avgSurpriseOverDark = (q: number[], th = DARK) => {
  const dark = CELLS.filter((k) => isDark(k.x, th));
  return meanOf(dark.map((k) => surprise(q[PARTS.indexOf(k.part)])));
};
/** If the model knew a little more: the dark cells split at 0.3 into very dark and dark. Shares and entropy in each, and their weighted mean. */
export const SPLIT = 0.3;
export function splitEntropy() {
  const dark = CELLS.filter((k) => isDark(k.x));
  const lo = dark.filter((k) => k.x < SPLIT), hi = dark.filter((k) => k.x >= SPLIT);
  const sh = (cs: Cell[]) => PARTS.map((p) => cs.filter((k) => k.part === p).length / cs.length);
  const hLo = entropy(sh(lo)), hHi = entropy(sh(hi));
  return { nLo: lo.length, nHi: hi.length, pLo: sh(lo), pHi: sh(hi), hLo, hHi, h: (lo.length * hLo + hi.length * hHi) / dark.length };
}
export const LOG2E = Math.LOG2E;
