/** Small transformer arithmetic for the study scenes: attention, layer norm, a one-block toy model. */

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

/* ---- scene 3: two heads that read different parts of the same embedding ---- */

export const HEAD_TOKENS: { type: 0 | 1 }[] = [0, 0, 1, 0, 1, 1, 0, 1].map((t) => ({ type: t as 0 | 1 }));

/** Embedding = [cos, sin of position angle | one-hot type]. Four numbers, two meanings. */
export function headEmbedding(i: number): Vec {
  const a = (i / HEAD_TOKENS.length) * Math.PI * 1.5;
  const ty = HEAD_TOKENS[i].type;
  return [Math.cos(a), Math.sin(a), ty === 0 ? 1 : 0, ty === 1 ? 1 : 0];
}

const pick = (dims: number[], gain: number): Mat => dims.map((d) => [0, 1, 2, 3].map((j) => (j === d ? gain : 0)));
const I4: Mat = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => (i === j ? 1 : 0)));
/** Head A reads only the position half, head B only the type half. */
export const HEAD_A: Head = { WQ: pick([0, 1], 3.2), WK: pick([0, 1], 3.2), WV: I4 };
export const HEAD_B: Head = { WQ: pick([2, 3], 2.6), WK: pick([2, 3], 2.6), WV: I4 };

/* ---- scenes 4 and 5: a one-block toy transformer with fixed random weights ---- */

export const D = 8;
const r0 = seeded(20260917);
export const TOKEN_EMB: Record<string, Vec> = Object.fromEntries(["A", "B", "C", "D", "E"].map((k) => [k, Array.from({ length: D }, () => randn(r0))]));
export const TOY_HEAD: Head = { WQ: randMat(D, D, r0, 0.6), WK: randMat(D, D, r0, 0.6), WV: randMat(D, D, r0, 0.5) };
export const MLP_W1: Mat = randMat(16, D, r0, 0.5);
export const MLP_W2: Mat = randMat(D, 16, r0, 0.35);

export function embed(seq: string[], usePos: boolean): Vec[] {
  return seq.map((k, i) => (usePos ? add(TOKEN_EMB[k], sinusoid(i, D)) : TOKEN_EMB[k]));
}

/** Attention output per token, keyed by token name, so the same token can be compared across orderings. */
export function attendByName(seq: string[], usePos: boolean): Record<string, Vec> {
  const { out } = attention(embed(seq, usePos), TOY_HEAD);
  return Object.fromEntries(seq.map((k, i) => [k, out[i]]));
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
