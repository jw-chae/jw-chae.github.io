/** Small transformer arithmetic for the study scenes (Transformer 05–14, shared helpers for ViT).
 *  Free of imports so node can run it directly. Every number quoted in the chapter text is computed here. */

export type Vec = number[];
export type Mat = number[][];

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
export const randMat = (rows: number, cols: number, r: () => number, scale = 1): Mat =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => randn(r) * scale));

export const dot = (a: Vec, b: Vec) => a.reduce((s, v, i) => s + v * b[i], 0);
export const add = (a: Vec, b: Vec): Vec => a.map((v, i) => v + b[i]);
export const scale = (a: Vec, k: number): Vec => a.map((v) => v * k);
export const norm = (a: Vec) => Math.sqrt(dot(a, a));
export const matVec = (m: Mat, v: Vec): Vec => m.map((row) => dot(row, v));
export const cosine = (a: Vec, b: Vec) => dot(a, b) / (norm(a) * norm(b));
const mixOf = (w: Vec, vs: Vec[]): Vec => vs[0].map((_, d) => w.reduce((s, wi, i) => s + wi * vs[i][d], 0));

export function softmax(z: Vec): Vec {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

export function layerNorm(x: Vec): Vec {
  const mean = x.reduce((a, b) => a + b, 0) / x.length;
  const sd = Math.sqrt(x.reduce((a, b) => a + (b - mean) ** 2, 0) / x.length + 1e-6);
  return x.map((v) => (v - mean) / sd);
}

export type Head = { WQ: Mat; WK: Mat; WV: Mat };

/** Single-head self-attention. Returns the N×N weight matrix (rows sum to 1) and the N output vectors. */
export function attention(X: Vec[], head: Head, beta = 1): { scores: Mat; weights: Mat; out: Vec[] } {
  const Q = X.map((x) => matVec(head.WQ, x));
  const K = X.map((x) => matVec(head.WK, x));
  const V = X.map((x) => matVec(head.WV, x));
  const dk = Q[0].length;
  const scores = Q.map((q) => K.map((k) => (beta * dot(q, k)) / Math.sqrt(dk)));
  const weights = scores.map(softmax);
  const out = weights.map((w) => V[0].map((_, d) => w.reduce((s, wj, j) => s + wj * V[j][d], 0)));
  return { scores, weights, out };
}

/** Sinusoidal positional encoding from "Attention Is All You Need". */
export function sinusoid(pos: number, d: number): Vec {
  return Array.from({ length: d }, (_, i) => {
    const freq = 1 / Math.pow(10000, (2 * Math.floor(i / 2)) / d);
    return i % 2 === 0 ? Math.sin(pos * freq) : Math.cos(pos * freq);
  });
}

/* ---- 05 · what is left of one word in a memo that is overwritten word by word ---- */

/** Toy memo: each later word keeps `keep` of what was there. The share is relative to the word read last (= 1). */
export const memoShare = (keep: number, wordsAfter: number) => Math.pow(keep, wordsAfter);

/* ---- 06 · the embedding table: eight source words, two numbers each, set by hand ---- */

export const VOCAB = ["I", "love", "cats", "apples", "chase", "dogs", "like", "tigers"] as const;
export type Word = (typeof VOCAB)[number];
export const TABLE: Vec[] = [[-1, -0.3], [0.2, -0.8], [0.6, 0.7], [-0.7, 0.6], [-0.5, -0.5], [0.9, 0.5], [0.5, -0.6], [0.3, 0.9]];
export const idOf = (w: Word) => VOCAB.indexOf(w);
export const rowOf = (w: Word): Vec => TABLE[idOf(w)];

/* ---- 07–09 · one row of tokens reading itself ---- */

/** Hand-set query matrix of the one head drawn in 08 and 09. W_K and W_V are left as the identity. */
export const W_Q: Mat = [[0, 2], [-2, 0]];

export type RowRead = { x: Vec[]; q: Vec[]; scores: Mat; weights: Mat; read: Vec[]; out: Vec[] };
/** Self-attention on one row. K and V are the token vectors themselves; Q is the vector itself, or W_Q times it.
 *  `usePos` adds the two-number sinusoid of each position to the token vector first. */
export function readRow(words: Word[], useMatrix: boolean, usePos = false): RowRead {
  const x = words.map((w, i) => (usePos ? add(rowOf(w), sinusoid(i, 2)) : rowOf(w)));
  const q = x.map((v) => (useMatrix ? matVec(W_Q, v) : v));
  const scores = q.map((qi) => x.map((k) => dot(qi, k)));
  const weights = scores.map(softmax);
  const read = weights.map((w) => mixOf(w, x));
  return { x, q, scores, weights, read, out: x.map((v, i) => add(v, read[i])) };
}

/** Weights and multiplications when a d-number vector is split across `heads` heads. */
export function headCost(d: number, heads: number) {
  const dh = d / heads;
  return { dh, qkv: 3 * heads * dh * d, out: d * d, perPair: heads * dh };
}

export const ORDER_A: Word[] = ["dogs", "chase", "cats"];
export const ORDER_B: Word[] = ["cats", "chase", "dogs"];
/** The same three words in two orders, read by the head of 08. `delta[w]` = distance between word w's outputs in the two sentences. */
export function orderPair(usePos: boolean) {
  const a = readRow(ORDER_A, true, usePos), b = readRow(ORDER_B, true, usePos);
  const delta = Object.fromEntries(ORDER_A.map((w, i) => {
    const j = ORDER_B.indexOf(w);
    return [w, norm(a.out[i].map((v, d) => v - b.out[j][d]))];
  })) as Record<string, number>;
  return { a, b, delta };
}

/* ---- 10 · how alike two position vectors are (1 = identical) ---- */

export const posSim = (p: number, q: number, d = 16) => dot(sinusoid(p, d), sinusoid(q, d)) / (d / 2);

/* ---- 11 · a one-block toy transformer with fixed random weights, traced on "cats" in "I love cats" ---- */

export const D = 8;
const r0 = seeded(20260917);
export const BLOCK_WORDS = ["I", "love", "cats"];
export const TOKEN_EMB: Record<string, Vec> = Object.fromEntries(BLOCK_WORDS.map((k) => [k, Array.from({ length: D }, () => randn(r0))]));
export const TOY_HEAD: Head = { WQ: randMat(D, D, r0, 0.6), WK: randMat(D, D, r0, 0.6), WV: randMat(D, D, r0, 0.5) };
export const MLP_W1: Mat = randMat(16, D, r0, 0.5);
export const MLP_W2: Mat = randMat(D, 16, r0, 0.35);

export function embed(seq: string[], usePos: boolean): Vec[] {
  return seq.map((k, i) => (usePos ? add(TOKEN_EMB[k], sinusoid(i, D)) : TOKEN_EMB[k]));
}

export type BlockTrace = { x: Vec; n1: Vec; attn: Vec; mid: Vec; n2: Vec; mlp: Vec; out: Vec; weights: Vec };

/** One pre-norm block (LN → attention → add, LN → MLP → add), traced for token `index`. */
export function traceBlock(seq: string[], index: number): BlockTrace {
  const X = embed(seq, true);
  const N1 = X.map(layerNorm);
  const { out, weights } = attention(N1, TOY_HEAD);
  const mid = add(X[index], out[index]);
  const n2 = layerNorm(mid);
  const hidden = matVec(MLP_W1, n2).map((v) => Math.max(0, v));
  const mlp = matVec(MLP_W2, hidden);
  return { x: X[index], n1: N1[index], attn: out[index], mid, n2, mlp, out: add(mid, mlp), weights: weights[index] };
}

/* ---- 12 · the causal mask on the Korean answer line ---- */

/** Hand-set scores for the four slots of the answer line: <start>, 나는, 고양이를, 사랑한다. Row = the slot that reads. */
export const MASK_SCORES: Mat = [[1.0, 0.2, 0.5, -0.3], [0.3, 0.8, 1.7, 0.1], [0.0, 1.0, 0.6, 1.5], [-0.2, 0.7, 1.2, 0.5]];
export const maskedWeights = (on: boolean): Mat => MASK_SCORES.map((s, i) => softmax(s.map((v, j) => (on && j > i ? -Infinity : v))));

/* ---- 13 · cross-attention of the query slots <start> and 고양이를 (the 나는 slot reuses the blank of 02) ---- */

/** Hand-set scores over I, love, cats for the query slots <start> (which puts out 나는) and 고양이를 (which puts out 사랑한다). */
export const CROSS_OTHER: Mat = [[2.4, 0.4, -0.5], [-0.4, 2.2, 0.6]];

/* ---- 14 · candidate scores, cross-entropy, one step down the gradient ---- */

export const OUT_Z0: Vec = [0.2, 1.0, 0.1, 0.4, 0.6, -0.6];
export const OUT_ANSWER = 0;
/** dL/dz_k = p_k − 1[k = answer]; one step of size 1 down that gradient. */
export const outStep = (z: Vec): Vec => {
  const p = softmax(z);
  return z.map((v, k) => v - (p[k] - (k === OUT_ANSWER ? 1 : 0)));
};
