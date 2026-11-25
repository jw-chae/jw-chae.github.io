/** Arithmetic behind the compression chapter: one photo with a three-class output followed through distillation,
 *  then one small weight table written in fewer bits. Import-free so node can run it. Every number the prose quotes comes from here. */

export type Mat = number[][];

/* ------------------------------------------------------------------ */
/* basic pieces                                                         */
/* ------------------------------------------------------------------ */

/** Probabilities from scores: divide by the temperature, exponentiate, normalise so the three add up to 1. */
export function softmax(z: number[], T = 1): number[] {
  const m = Math.max(...z.map((v) => v / T));
  const e = z.map((v) => Math.exp(v / T - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}
/** Cross entropy of prediction q against target t (t may be a one-hot label or a soft distribution). Natural log. */
export const crossEntropy = (t: number[], q: number[]) => -t.reduce((s, ti, i) => s + (ti > 0 ? ti * Math.log(q[i]) : 0), 0);
/** KL(p || q): cross entropy minus the target's own entropy. Zero exactly when q equals p. */
export const kl = (p: number[], q: number[]) => p.reduce((s, pi, i) => s + (pi > 0 ? pi * Math.log(pi / q[i]) : 0), 0);
export const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
export const norm = (a: number[]) => Math.sqrt(dot(a, a));
export const matVec = (A: Mat, x: number[]) => A.map((row) => dot(row, x));

/* ------------------------------------------------------------------ */
/* 01 · one photo, a hard label, and the teacher's three probabilities  */
/* ------------------------------------------------------------------ */

/** Classes in order: cat, dog, car. The label of both photos is "cat". */
export const HARD = [1, 0, 0];
/** Teacher scores (logits) for the two photos. Hand-set: A is a cat that looks a little like a dog, B a cat that looks like nothing else. */
export const Z_A = [3, 2, -1];
export const Z_B = [4, 1, 0];
export const P_A = softmax(Z_A);
export const P_B = softmax(Z_B);

/* ------------------------------------------------------------------ */
/* 02 · temperature                                                     */
/* ------------------------------------------------------------------ */

export const T_MAX = 10;
/** Ratio of two probabilities at temperature T. Equals exp((z_i − z_j)/T): the softmax denominator cancels. */
export const ratioAt = (z: number[], i: number, j: number, T: number) => Math.exp((z[i] - z[j]) / T);

/* ------------------------------------------------------------------ */
/* 03 · what the student receives from each loss                        */
/* ------------------------------------------------------------------ */

/** The student's three scores before training on this photo. Hand-set to zero, so it starts at one third each. */
export const Z_S0 = [0, 0, 0];
export const T_STUDY = 2;
export const ALPHA_MIX = 0.5;

/** Gradient of each loss with respect to the student's three scores.
 *  hard: CE(y, softmax(z))                       ⇒ q₁ − y
 *  soft: T²·KL(p_T || softmax(z/T))              ⇒ T·(q_T − p_T)       (the T² undoes the 1/T² shrink)
 *  softRaw: KL without T²                        ⇒ (1/T)·(q_T − p_T)
 *  mix: (1 − α)·hard + α·soft                                                                     */
export function gradOf(mode: "hard" | "soft" | "softRaw" | "mix", z: number[], zTeacher = Z_A, T = T_STUDY, alpha = ALPHA_MIX): number[] {
  const q1 = softmax(z), qT = softmax(z, T), pT = softmax(zTeacher, T);
  const gh = q1.map((v, i) => v - HARD[i]);
  const gs = qT.map((v, i) => T * (v - pT[i]));
  if (mode === "hard") return gh;
  if (mode === "softRaw") return qT.map((v, i) => (v - pT[i]) / T);
  if (mode === "soft") return gs;
  return gh.map((v, i) => (1 - alpha) * v + alpha * gs[i]);
}
export function lossOf(mode: "hard" | "soft" | "mix", z: number[], zTeacher = Z_A, T = T_STUDY, alpha = ALPHA_MIX): number {
  const lh = crossEntropy(HARD, softmax(z));
  const ls = T * T * kl(softmax(zTeacher, T), softmax(z, T));
  return mode === "hard" ? lh : mode === "soft" ? ls : (1 - alpha) * lh + alpha * ls;
}

export type LogitSnap = { z: number[]; q: number[]; grad: number[]; loss: number };
export const LOGIT_STEPS = 80;
export const LOGIT_LR = 0.5;
/** Gradient descent on the student's three scores for this one photo. A simplification: in a real student the scores
 *  come out of its weights, and it is the weights that move. One snapshot per step; q is read at T = 1, as the student is used. */
export function trainLogits(mode: "hard" | "soft" | "mix", T = T_STUDY, steps = LOGIT_STEPS, lr = LOGIT_LR, zTeacher = Z_A): LogitSnap[] {
  let z = [...Z_S0];
  const out: LogitSnap[] = [];
  for (let t = 0; t <= steps; t++) {
    const g = gradOf(mode, z, zTeacher, T);
    out.push({ z: [...z], q: softmax(z), grad: g, loss: lossOf(mode, z, zTeacher, T) });
    z = z.map((v, i) => v - lr * g[i]);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 04 · matching a middle vector instead of the output                  */
/* ------------------------------------------------------------------ */

/** Teacher's middle vector for photo A (4 numbers) and the student's (2 numbers). Hand-set. */
export const FEAT_T = [0.8, -0.4, 0.2, 0.6];
export const FEAT_S = [0.5, 1.0];
/** The small table that maps the student's 2 numbers to 4, trained together with the student (FitNets calls it a regressor). Hand-set here. */
export const FEAT_P: Mat = [[1.0, 0.2], [-0.6, 0.1], [0.0, 0.3], [0.4, 0.4]];
export const sqDist = (a: number[], b: number[]) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0);
export const cosine = (a: number[], b: number[]) => dot(a, b) / (norm(a) * norm(b));
export function featCheck(scale = 1) {
  const s = FEAT_S.map((v) => v * scale), ps = matVec(FEAT_P, s);
  return { s, ps, diff: ps.map((v, i) => v - FEAT_T[i]), l2: sqDist(ps, FEAT_T), cos: cosine(ps, FEAT_T) };
}

/* ------------------------------------------------------------------ */
/* 06 · CAIT: score channels, keep heads the same width, merge          */
/* ------------------------------------------------------------------ */

/** Two heads, three channel positions each. Lengths of the compactor columns for the query and key at each position. Hand-set. */
export const CAIT_Q: number[][] = [[0.9, 0.1, 0.4], [0.6, 0.8, 0.7]];
export const CAIT_K: number[][] = [[0.8, 0.3, 0.3], [0.4, 0.9, 0.5]];
/** The query and key channels at the same position share one score: the mean of their two lengths (as the paper does). */
export const CAIT_SCORE: number[][] = CAIT_Q.map((row, h) => row.map((v, c) => (v + CAIT_K[h][c]) / 2));
/** Prune one channel position per head: the global lowest score first, then the lowest inside every other head. */
export function caitPrune(): { head: number; ch: number }[] {
  let best = { head: 0, ch: 0 };
  CAIT_SCORE.forEach((row, h) => row.forEach((v, c) => { if (v < CAIT_SCORE[best.head][best.ch]) best = { head: h, ch: c }; }));
  const out = [best];
  CAIT_SCORE.forEach((row, h) => {
    if (h === best.head) return;
    let c0 = 0;
    row.forEach((v, c) => { if (v < row[c0]) c0 = c; });
    out.push({ head: h, ch: c0 });
  });
  return out;
}
/** Published numbers, CAIT Table III (ImageNet-1K, speed on one RTX 3090, batch 256). */
export const CAIT_TABLE = [
  { name: "DeiT-Tiny", params: [5.7, 5.1], flops: [1.3, 0.6], speed: 1.7, top1: [72.2, 72.3] },
  { name: "DeiT-Small", params: [22.1, 18.4], flops: [4.6, 2.1], speed: 1.9, top1: [79.8, 80.2] },
  { name: "DeiT-Base", params: [86.4, 71.3], flops: [17.6, 7.4], speed: 2.1, top1: [81.8, 81.6] },
];

/* ------------------------------------------------------------------ */
/* 07–09 · the student's last table written in fewer bits               */
/* ------------------------------------------------------------------ */

/** The student's last table: one row per class (cat, dog, car), six columns, one per feature. Hand-set.
 *  The car row carries one large weight in column 3, the outlier of section 08. */
export const W_LAST: Mat = [
  [0.42, -0.17, 0.08, 0.61, 0.88, -0.32],
  [0.35, 0.22, -0.05, 0.40, 0.51, 0.12],
  [-0.25, 0.10, 2.40, -0.36, -0.20, 0.05],
];
/** The six features the student computed for photo A. Hand-set; non-negative, as after a ReLU. Column 3 is 0 for this photo. */
export const X_A = [1, 0.5, 0, 2, 1.5, 0.5];

export type Scheme = "sym" | "zp";
export type Quant = { scale: number; zero: number; q: number[]; deq: number[]; err: number[]; lo: number; hi: number; levels: number };

/** Symmetric: zero sits in the middle, codes −(2^(b−1)−1)..2^(b−1)−1, scale = max|w| / that. Stored: the codes and one scale.
 *  Zero-point (affine, Jacob et al.): codes 0..2^b−1 spread over [min, max], r = S·(q − Z). Stored: the codes, S and Z. */
export function quantize(w: number[], bits: number, scheme: Scheme = "sym", range?: { lo: number; hi: number }): Quant {
  if (scheme === "sym") {
    const qmax = 2 ** (bits - 1) - 1;
    const m = range ? Math.max(Math.abs(range.lo), Math.abs(range.hi)) : Math.max(...w.map(Math.abs));
    const scale = m / qmax;
    const q = w.map((v) => Math.max(-qmax, Math.min(qmax, Math.round(v / scale))));
    const deq = q.map((k) => k * scale);
    return { scale, zero: 0, q, deq, err: deq.map((v, i) => v - w[i]), lo: -m, hi: m, levels: 2 * qmax + 1 };
  }
  const n = 2 ** bits - 1;
  const lo = range ? range.lo : Math.min(...w), hi = range ? range.hi : Math.max(...w);
  const scale = (hi - lo) / n, zero = Math.round(-lo / scale);
  const q = w.map((v) => Math.max(0, Math.min(n, Math.round(v / scale) + zero)));
  const deq = q.map((k) => scale * (k - zero));
  return { scale, zero, q, deq, err: deq.map((v, i) => v - w[i]), lo, hi, levels: n + 1 };
}

/** The whole table at once: one scale for everything (per-tensor) or one scale per row (per-channel). Symmetric. */
export function quantizeTable(W: Mat, bits: number, perChannel: boolean): { rows: Quant[]; deq: Mat } {
  const all = W.flat(), m = Math.max(...all.map(Math.abs));
  const rows = W.map((row) => quantize(row, bits, "sym", perChannel ? undefined : { lo: -m, hi: m }));
  return { rows, deq: rows.map((r) => r.deq) };
}

export const maxAbs = (a: number[]) => Math.max(...a.map(Math.abs));
export const LOGITS_A = matVec(W_LAST, X_A);
export const PROBS_A = softmax(LOGITS_A);

/* ---- 09 · PTQ versus QAT on the same table ---- */

/** Eight photos' features (photo A first). Hand-set non-negative values, as after a ReLU. */
export const X_SET: number[][] = [
  X_A,
  [0.2, 1.4, 0.6, 0.3, 0.1, 1.2],
  [1.5, 0.0, 0.1, 0.4, 2.2, 0.0],
  [0.0, 0.8, 1.1, 0.2, 0.3, 0.9],
  [0.9, 0.3, 0.0, 1.6, 0.4, 1.1],
  [0.4, 1.9, 0.2, 0.0, 0.7, 0.3],
  [1.1, 0.6, 0.4, 0.9, 1.0, 0.0],
  [0.3, 0.2, 0.9, 1.2, 0.0, 1.5],
];
/** What the quantized table should keep: the float table's own probabilities on these photos. */
export const P_SET = X_SET.map((x) => softmax(matVec(W_LAST, x)));
export const QAT_BITS = 4;
/** One scale for the whole table, fixed from the float table: the per-tensor case of section 08. */
export const QAT_SCALE = maxAbs(W_LAST.flat()) / (2 ** (QAT_BITS - 1) - 1);
const QMAX = 2 ** (QAT_BITS - 1) - 1;
export const roundTable = (W: Mat): Mat => W.map((row) => row.map((v) => Math.max(-QMAX, Math.min(QMAX, Math.round(v / QAT_SCALE)))));
export const deqTable = (Q: Mat): Mat => Q.map((row) => row.map((k) => k * QAT_SCALE));
/** Average KL from the float table's probabilities to the given table's, over the eight photos. */
export const setLoss = (W: Mat) => X_SET.reduce((s, x, n) => s + kl(P_SET[n], softmax(matVec(W, x))), 0) / X_SET.length;

export type QatSnap = { master: Mat; codes: Mat; loss: number; probsA: number[] };
export const QAT_STEPS = 60;
export const QAT_LR = 0.1;
/** QAT: the forward pass uses the rounded-and-restored table; the gradient computed there is applied to the float master copy
 *  as if rounding were not there (straight-through). The step size shrinks along a cosine so the codes settle at the end.
 *  Step 0 is plain PTQ: round the trained float table once. */
export function trainQat(steps = QAT_STEPS, lr0 = QAT_LR): QatSnap[] {
  let M = W_LAST.map((r) => [...r]);
  const snaps: QatSnap[] = [];
  for (let t = 0; t <= steps; t++) {
    const codes = roundTable(M), D = deqTable(codes);
    snaps.push({ master: M.map((r) => [...r]), codes, loss: setLoss(D), probsA: softmax(matVec(D, X_A)) });
    const G = W_LAST.map((r) => r.map(() => 0));
    X_SET.forEach((x, n) => {
      const q = softmax(matVec(D, x));
      q.forEach((qi, i) => x.forEach((xj, j) => { G[i][j] += ((qi - P_SET[n][i]) * xj) / X_SET.length; }));
    });
    const lr = lr0 * 0.5 * (1 + Math.cos((Math.PI * t) / steps));
    M = M.map((row, i) => row.map((v, j) => v - lr * G[i][j]));
  }
  return snaps;
}

/* ---- side calculations quoted in the text and the doubts ---- */

/** Label smoothing with ε spread evenly over the K classes: what a hand-made "soft label" looks like. */
export const labelSmooth = (eps: number, K = 3) => HARD.map((y) => (1 - eps) * y + eps / K);

/** Clipping instead of a wide grid: cut the outlier down to the largest of the other weights, and see what it costs on a photo
 *  whose column-3 feature is not zero. */
export const CLIP_TO = 0.88;
export const clipCost = (x: number[]) => (CLIP_TO - W_LAST[2][2]) * x[2];
export const W_CLIPPED: Mat = W_LAST.map((row, i) => row.map((v, j) => (i === 2 && j === 2 ? CLIP_TO : v)));

/** A fourth name in the list changes every share but not the ratios between the old ones. Hand-set logit 2.5 for "fox". */
export const Z_A_FOX = [...Z_A, 2.5];

/** One-dimensional K-Means with 2^b centres, as the quantized-prompt paper uses on normalised prompt weights. */
export function kmeans1d(v: number[], k: number, iters = 50): { centers: number[]; assign: number[] } {
  const sorted = [...v].sort((a, b) => a - b);
  let centers = Array.from({ length: k }, (_, i) => sorted[Math.round(((i + 0.5) * (sorted.length - 1)) / k)]);
  let assign: number[] = [];
  for (let it = 0; it < iters; it++) {
    assign = v.map((x) => centers.reduce((best, c, j) => (Math.abs(x - c) < Math.abs(x - centers[best]) ? j : best), 0));
    centers = centers.map((c, j) => { const mem = v.filter((_, i) => assign[i] === j); return mem.length ? mem.reduce((a, b) => a + b, 0) / mem.length : c; });
  }
  return { centers, assign };
}
/** The cat row through the paper's recipe: normalise with the row's mean and standard deviation, cluster, restore. */
export function promptStyle(w: number[], bits: number) {
  const mu = w.reduce((a, b) => a + b, 0) / w.length;
  const sd = Math.sqrt(w.reduce((a, b) => a + (b - mu) ** 2, 0) / w.length);
  const norm = w.map((v) => (v - mu) / sd);
  const { centers, assign } = kmeans1d(norm, 2 ** bits);
  const deq = assign.map((j) => sd * centers[j] + mu);
  return { mu, sd, centers, assign, deq, err: deq.map((v, i) => v - w[i]) };
}

/** Storage, in bytes, of n weights at a given bit width, plus the scales kept beside them (32-bit floats). */
export const storeBytes = (n: number, bits: number, scales = 0) => (n * bits) / 8 + scales * 4;
/** A model with 6.74 billion weights (the size the LoRA chapter counts with), in GB at 16, 8 and 4 bits. */
export const MODEL7 = 6.74e9;
export const modelGB = (bits: number) => (MODEL7 * bits) / 8 / 1e9;
