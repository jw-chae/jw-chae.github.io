/** Arithmetic behind the LoRA study scenes: sizes, a small SVD, and a tiny LoRA trained by gradient descent. */

export type Mat = number[][];

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

export const zeros = (n: number, m: number): Mat => Array.from({ length: n }, () => new Array<number>(m).fill(0));
export const matMul = (A: Mat, B: Mat): Mat => A.map((row) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
export const transpose = (A: Mat): Mat => A[0].map((_, j) => A.map((row) => row[j]));
export const addScaled = (A: Mat, B: Mat, k = 1): Mat => A.map((row, i) => row.map((v, j) => v + k * B[i][j]));
export const frob2 = (A: Mat) => A.reduce((s, row) => s + row.reduce((q, v) => q + v * v, 0), 0);
export const matVec = (A: Mat, x: number[]) => A.map((row) => row.reduce((s, v, j) => s + v * x[j], 0));
export const outer = (u: number[], v: number[]): Mat => u.map((a) => v.map((b) => a * b));

/* ---- 01 · storage: one full copy per task, or one base plus small adapters ---- */

export type ModelSize = { name: string; params: number; d: number; layers: number };
export const MODELS: ModelSize[] = [
  { name: "BERT-large", params: 340e6, d: 1024, layers: 24 },
  { name: "GPT-2", params: 1.5e9, d: 1600, layers: 48 },
  { name: "GPT-3", params: 175e9, d: 12288, layers: 96 },
];
export const BYTES_FP16 = 2;

/** LoRA on the query and value matrices of every layer: 2 matrices × (A: r×d, B: d×r). */
export const adapterParams = (m: ModelSize, r: number) => m.layers * 2 * 2 * m.d * r;
export const gb = (bytes: number) => bytes / 1e9;

/* ---- 03 · singular value decomposition of a small matrix (one-sided Jacobi) ---- */

export type Svd = { U: Mat; S: number[]; V: Mat };

/** A = U·diag(S)·Vᵀ with singular values sorted from largest to smallest. Intended for matrices up to about 12×12. */
export function svd(A: Mat): Svd {
  const n = A.length, m = A[0].length;
  const U = A.map((row) => [...row]);                     // columns are rotated until mutually orthogonal
  const V: Mat = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < m - 1; p++) for (let q = p + 1; q < m; q++) {
      let a = 0, b = 0, c = 0;
      for (let i = 0; i < n; i++) { a += U[i][p] * U[i][p]; b += U[i][q] * U[i][q]; c += U[i][p] * U[i][q]; }
      off += c * c;
      if (Math.abs(c) < 1e-14) continue;
      const zeta = (b - a) / (2 * c), t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
      const cs = 1 / Math.sqrt(1 + t * t), sn = cs * t;
      for (let i = 0; i < n; i++) { const up = U[i][p], uq = U[i][q]; U[i][p] = cs * up - sn * uq; U[i][q] = sn * up + cs * uq; }
      for (let i = 0; i < m; i++) { const vp = V[i][p], vq = V[i][q]; V[i][p] = cs * vp - sn * vq; V[i][q] = sn * vp + cs * vq; }
    }
    if (off < 1e-22) break;
  }
  const S = Array.from({ length: m }, (_, j) => Math.sqrt(U.reduce((s, row) => s + row[j] * row[j], 0)));
  const order = S.map((_, j) => j).sort((x, y) => S[y] - S[x]);
  return {
    S: order.map((j) => S[j]),
    U: U.map((row) => order.map((j) => (S[j] > 1e-12 ? row[j] / S[j] : 0))),
    V: V.map((row) => order.map((j) => row[j])),
  };
}

/** Sum of the first r rank-one layers σ_i·u_i·v_iᵀ. */
export function truncate(d: Svd, r: number): Mat {
  const n = d.U.length, m = d.V.length, out = zeros(n, m);
  for (let k = 0; k < r; k++) for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) out[i][j] += d.S[k] * d.U[i][k] * d.V[j][k];
  return out;
}

/** One rank-one layer on its own. */
export const layer = (d: Svd, k: number): Mat => outer(d.U.map((row) => row[k] * d.S[k]), d.V.map((row) => row[k]));

export const RN = 9;
/** Three 9×9 tables: a multiplication table (rank 1), a smooth pattern (a few strong layers), and noise (no structure). */
export const TABLES: Record<"times" | "pattern" | "noise", Mat> = (() => {
  const r = mulberry(17);
  const times = Array.from({ length: RN }, (_, i) => Array.from({ length: RN }, (_, j) => (i + 1) * (j + 1)));
  const pattern = Array.from({ length: RN }, (_, i) => Array.from({ length: RN }, (_, j) => {
    const y = i / (RN - 1), x = j / (RN - 1);
    return 3 * Math.sin(Math.PI * y) * Math.sin(Math.PI * x) + 1.6 * (y - 0.5) * (x - 0.5) * 4 + 0.7 * Math.cos(3 * Math.PI * x) * Math.sin(2 * Math.PI * y) + 0.12 * gauss(r);
  }));
  const noise = Array.from({ length: RN }, () => Array.from({ length: RN }, () => gauss(r)));
  return { times, pattern, noise };
})();
export const TABLE_SVD = { times: svd(TABLES.times), pattern: svd(TABLES.pattern), noise: svd(TABLES.noise) };

/** Share of the table's squared size that the first r layers leave unexplained. */
export function residual(d: Svd, r: number): number {
  const total = d.S.reduce((s, v) => s + v * v, 0);
  return d.S.slice(r).reduce((s, v) => s + v * v, 0) / total;
}

/* ---- 05 · a tiny LoRA trained by gradient descent ---- */

export const TN = 8;
/** The change full fine-tuning would have made: two strong directions, a weak third, and a faint tail. */
export const TARGET: Mat = (() => {
  const r = mulberry(5), raw = Array.from({ length: TN }, () => Array.from({ length: TN }, () => gauss(r)));
  const d = svd(raw);
  return truncate({ U: d.U, V: d.V, S: [2.0, 1.3, 0.45, 0.14, 0.08, 0.05, 0.03, 0.02] }, TN);
})();
export const TARGET_S = svd(TARGET).S;
export const TARGET_NORM2 = frob2(TARGET);

/** Best possible leftover for rank r (Eckart–Young): the squared singular values that do not fit. */
export const bestError = (r: number) => TARGET_S.slice(r).reduce((s, v) => s + v * v, 0) / TARGET_NORM2;

export type Run = { loss: number[]; delta: Mat; diverged: boolean };

/** Train ΔW = (α/r)·B·A to match TARGET. B starts at zero, A at small random values, exactly as LoRA does. */
export function trainLora(r: number, scale: number, steps = 240, lr = 0.06): Run {
  const rnd = mulberry(100 + r);
  let B = zeros(TN, r), A: Mat = Array.from({ length: r }, () => Array.from({ length: TN }, () => 0.35 * gauss(rnd)));
  const loss: number[] = [];
  let delta = zeros(TN, TN), diverged = false;
  for (let t = 0; t <= steps; t++) {
    delta = matMul(B, A).map((row) => row.map((v) => v * scale));
    const E = addScaled(delta, TARGET, -1), l = frob2(E) / TARGET_NORM2;
    if (!Number.isFinite(l) || l > 50) { diverged = true; loss.push(50); break; }
    loss.push(l);
    // L = ½‖s·BA − T‖²  ⇒  ∂L/∂B = s·E·Aᵀ,  ∂L/∂A = s·Bᵀ·E
    const gB = matMul(E, transpose(A)), gA = matMul(transpose(B), E);
    B = addScaled(B, gB, -lr * scale); A = addScaled(A, gA, -lr * scale);
  }
  return { loss, delta, diverged };
}

/* ---- 06 · merging and swapping ---- */

export const MN = 6;
export const BASE_W: Mat = (() => { const r = mulberry(61); return Array.from({ length: MN }, () => Array.from({ length: MN }, () => 0.8 * gauss(r))); })();
export type Adapter = { B: Mat; A: Mat };
const makeAdapter = (seed: number): Adapter => {
  const r = mulberry(seed);
  return { B: Array.from({ length: MN }, () => [0.7 * gauss(r), 0.7 * gauss(r)]), A: Array.from({ length: 2 }, () => Array.from({ length: MN }, () => 0.7 * gauss(r))) };
};
export const ADAPTERS: Adapter[] = [makeAdapter(71), makeAdapter(83)];
export const PROBE_X = [0.9, -0.4, 0.3, 1.1, -0.7, 0.2];

/** Output through the two separate paths, and through the single merged matrix. They must agree. */
export function mergeCheck(w1: number, w2: number): { merged: Mat; twoPath: number[]; onePath: number[]; gap: number } {
  let merged = BASE_W;
  let twoPath = matVec(BASE_W, PROBE_X);
  [w1, w2].forEach((wt, i) => {
    const ad = ADAPTERS[i];
    merged = addScaled(merged, matMul(ad.B, ad.A), wt);
    const through = matVec(ad.B, matVec(ad.A, PROBE_X));
    twoPath = twoPath.map((v, k) => v + wt * through[k]);
  });
  const onePath = matVec(merged, PROBE_X);
  return { merged, twoPath, onePath, gap: Math.sqrt(onePath.reduce((s, v, k) => s + (v - twoPath[k]) ** 2, 0)) };
}

/* ---- 07 · where the adapters go: counting on a 7-billion-parameter model ---- */

export const LLM7 = { params: 6.74e9, d: 4096, layers: 32, mlp: 11008 };
export type ModuleKey = "q" | "k" | "v" | "o" | "mlp";
/** Trainable numbers one layer gains when a rank-r adapter is attached to that module. */
export function moduleParams(key: ModuleKey, r: number): number {
  const { d, mlp } = LLM7;
  if (key === "mlp") return 3 * r * (d + mlp);           // three d↔mlp matrices in the feed-forward part
  return 2 * d * r;                                      // one d×d attention matrix
}

/* ---- 08 · memory while training ---- */

export const SIZES_B = [7, 13, 33, 65];
export type Mode = "full" | "lora" | "qlora";
/** GB needed for weights, gradients and optimizer state. Activations are left out. */
export function trainMemory(paramsB: number, mode: Mode): { weights: number; extra: number } {
  const p = paramsB * 1e9;
  if (mode === "full") return { weights: gb(p * 2), extra: gb(p * 10) };     // 16-bit weights, 16-bit gradients, two 32-bit Adam moments
  const adapter = 0.005 * p;                                                  // about half a percent of the model is trained
  const extra = gb(adapter * 12);
  return mode === "lora" ? { weights: gb(p * 2), extra } : { weights: gb(p * 0.5), extra };   // 4-bit base for QLoRA
}
