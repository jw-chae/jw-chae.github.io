/** Arithmetic behind the linear-algebra study scenes. Import-free so node can run it: the measured cat grids live in la-cat.ts and are
 *  passed in as arguments. Every number the chapter quotes is computed here and checked by a node script. */

export type Vec = number[];
export type Mat = number[][];

/* ---- vectors ---- */

export const dot = (a: Vec, b: Vec) => a.reduce((s, v, i) => s + v * b[i], 0);
export const norm = (a: Vec) => Math.sqrt(dot(a, a));
export const scale = (a: Vec, k: number) => a.map((v) => v * k);
export const add = (a: Vec, b: Vec) => a.map((v, i) => v + b[i]);
export const sub = (a: Vec, b: Vec) => a.map((v, i) => v - b[i]);
export const dist = (a: Vec, b: Vec) => norm(sub(a, b));
export const cosine = (a: Vec, b: Vec) => dot(a, b) / (norm(a) * norm(b));
export const angleDeg = (a: Vec, b: Vec) => (Math.acos(Math.min(1, Math.max(-1, cosine(a, b)))) * 180) / Math.PI;
export const unit = (a: Vec) => scale(a, 1 / norm(a));
export const mean = (vs: Vec[]) => scale(vs.reduce((s, v) => add(s, v), vs[0].map(() => 0)), 1 / vs.length);

/* ---- matrices ---- */

export const matVec = (A: Mat, x: Vec) => A.map((row) => dot(row, x));
export const transpose = (A: Mat): Mat => A[0].map((_, j) => A.map((row) => row[j]));
export const matMul = (A: Mat, B: Mat): Mat => A.map((row) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
export const zeros = (n: number, m: number): Mat => Array.from({ length: n }, () => new Array<number>(m).fill(0));
export const frob2 = (A: Mat) => A.reduce((s, row) => s + row.reduce((q, v) => q + v * v, 0), 0);
/** Multiply-adds of an (m × n) times (n × k) product: every one of the m·k outputs is a dot product of length n. */
export const macs = (m: number, n: number, k: number) => m * n * k;

/** Rank by Gaussian elimination with partial pivoting: the number of rows that are not mixes of the rows before them. */
export function rankOf(A: Mat, tol = 1e-9): number {
  const M = A.map((r) => [...r]);
  const rows = M.length, cols = M[0].length;
  let rank = 0;
  for (let c = 0; c < cols && rank < rows; c++) {
    let p = rank;
    for (let r = rank + 1; r < rows; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < tol) continue;
    [M[rank], M[p]] = [M[p], M[rank]];
    for (let r = rank + 1; r < rows; r++) {
      const f = M[r][c] / M[rank][c];
      for (let j = c; j < cols; j++) M[r][j] -= f * M[rank][j];
    }
    rank++;
  }
  return rank;
}

/* ---- the running scene: cells of the cat head (32 × 32 grid of LA_RGB32), [row, col] counted from 0 ---- */

export type CellKey = "eyeL" | "eyeR" | "ear" | "bg" | "mask" | "cream" | "twin";
/** eyeL is the tracked cell: the iris of the picture's left eye. twin is a cream forehead cell picked because its gray value equals the eye's. */
export const CELLS: Record<CellKey, [number, number]> = {
  eyeL: [22, 14], eyeR: [19, 25], ear: [13, 4], bg: [1, 8], mask: [24, 18], cream: [12, 16], twin: [14, 14],
};
export const COMPARE: CellKey[] = ["eyeR", "ear", "bg", "mask", "cream"];
export const cell = (rgb: number[][][], k: CellKey): Vec => { const [r, c] = CELLS[k]; return rgb[r][c]; };
/** The four fine cells that make up one cell of the coarser 16 × 16 grid around the eye. */
export const QUAD: [number, number][] = [[22, 14], [22, 15], [23, 14], [23, 15]];
export const allCells = (rgb: number[][][]): Vec[] => rgb.flat();
export const BG_RGB = [253 / 255, 236 / 255, 226 / 255];
/** A cell counts as background when its colour is within 0.08 (sum over channels) of the drawing's flat background. */
export const isBg = (v: Vec) => Math.abs(v[0] - BG_RGB[0]) + Math.abs(v[1] - BG_RGB[1]) + Math.abs(v[2] - BG_RGB[2]) < 0.08;

/** Nearest compared cell under each measure, for the tracked eye dimmed by `shade`. */
export function compareTable(rgb: number[][][], shade: number) {
  const e = scale(cell(rgb, "eyeL"), shade);
  return COMPARE.map((k) => {
    const v = cell(rgb, k);
    return { key: k, v, dot: dot(e, v), len: norm(v), cos: cosine(e, v), angle: angleDeg(e, v), dist: dist(e, v), unitDist: dist(unit(e), unit(v)) };
  });
}

/* ---- 03 · a real 3 × 3 matrix: RGB to Y, Cb, Cr as JPEG (JFIF, ITU-T T.871) writes it, offsets of 128 left out ---- */

export const YCC: Mat = [
  [0.299, 0.587, 0.114],
  [-0.168736, -0.331264, 0.5],
  [0.5, -0.418688, -0.081312],
];
/** The decoder's matrix from the same standard. */
export const YCC_INV: Mat = [
  [1, 0, 1.402],
  [1, -0.344136, -0.714136],
  [1, 1.772, 0],
];
export const AVG_ROW = [1 / 3, 1 / 3, 1 / 3];
export const relu = (v: Vec) => v.map((x) => Math.max(0, x));

/** Encode, optionally ReLU, decode. Without ReLU the two matrices collapse into YCC_INV·YCC, which is the identity up to rounding. */
export const roundTrip = (x: Vec, withRelu: boolean) => matVec(YCC_INV, withRelu ? relu(matVec(YCC, x)) : matVec(YCC, x));

/* ---- 05 · what a layer cannot see ---- */

export type LayerKey = "y" | "cc" | "ycc" | "ycc4";
export const LAYERS: Record<LayerKey, Mat> = {
  y: [YCC[0]],
  cc: [YCC[1], YCC[2]],
  ycc: YCC,
  ycc4: [...YCC, add(YCC[0], YCC[1])],
};

/** Part of b that the row vector r does not see: b minus its projection on r. */
const reject = (b: Vec, r: Vec) => sub(b, scale(r, dot(b, r) / dot(r, r)));

/** The invisible change used by the figure, scaled by t in 0..1:
 *  for the Y layer, the step from the eye to the cream twin with its brightness component removed (so Y stays exactly the same);
 *  for the Cb, Cr layer, darkening every channel by the same 0.5; for rank 3 there is nothing invisible. */
export function invisibleStep(rgb: number[][][], key: LayerKey): Vec | null {
  if (key === "y") return reject(sub(cell(rgb, "twin"), cell(rgb, "eyeL")), YCC[0]);
  if (key === "cc") return [-0.5, -0.5, -0.5];
  return null;
}

/* ---- 06 · singular value decomposition (one-sided Jacobi), for tables up to 64 × 64 ---- */

export type Svd = { U: Mat; S: number[]; V: Mat };

export function svd(A: Mat): Svd {
  const n = A.length, m = A[0].length;
  const W = A.map((row) => [...row]);                   // columns are rotated until mutually orthogonal
  const V: Mat = Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 80; sweep++) {
    let worst = 0;
    for (let p = 0; p < m - 1; p++) for (let q = p + 1; q < m; q++) {
      let a = 0, b = 0, c = 0;
      for (let i = 0; i < n; i++) { a += W[i][p] * W[i][p]; b += W[i][q] * W[i][q]; c += W[i][p] * W[i][q]; }
      if (a < 1e-300 || b < 1e-300) continue;
      const rel = Math.abs(c) / Math.sqrt(a * b);
      if (rel > worst) worst = rel;
      if (rel < 1e-15) continue;
      const zeta = (b - a) / (2 * c), t = Math.sign(zeta || 1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta));
      const cs = 1 / Math.sqrt(1 + t * t), sn = cs * t;
      for (let i = 0; i < n; i++) { const wp = W[i][p], wq = W[i][q]; W[i][p] = cs * wp - sn * wq; W[i][q] = sn * wp + cs * wq; }
      for (let i = 0; i < m; i++) { const vp = V[i][p], vq = V[i][q]; V[i][p] = cs * vp - sn * vq; V[i][q] = sn * vp + cs * vq; }
    }
    if (worst < 1e-13) break;
  }
  const S = Array.from({ length: m }, (_, j) => Math.sqrt(W.reduce((s, row) => s + row[j] * row[j], 0)));
  const order = S.map((_, j) => j).sort((x, y) => S[y] - S[x]);
  // sign convention: the larger half of each right vector points positive, so the first sheet is drawn bright, not inverted
  const sgn = order.map((j) => (V.reduce((s, row) => s + row[j], 0) < 0 ? -1 : 1));
  return {
    S: order.map((j) => S[j]),
    U: W.map((row) => order.map((j, k) => (S[j] > 1e-12 ? (sgn[k] * row[j]) / S[j] : 0))),
    V: V.map((row) => order.map((j, k) => sgn[k] * row[j])),
  };
}

/** Sum of the first k sheets σ_i·u_i·v_iᵀ. */
export function truncate(d: Svd, k: number): Mat {
  const n = d.U.length, m = d.V.length, out = zeros(n, m);
  for (let s = 0; s < k; s++) for (let i = 0; i < n; i++) {
    const a = d.S[s] * d.U[i][s];
    for (let j = 0; j < m; j++) out[i][j] += a * d.V[j][s];
  }
  return out;
}

/** Root-mean-square difference per cell, in brightness units, over the whole table or a block [r0, r1) × [c0, c1). */
export function rms(A: Mat, B: Mat, r0 = 0, r1 = A.length, c0 = 0, c1 = A[0].length): number {
  let s = 0, n = 0;
  for (let i = r0; i < r1; i++) for (let j = c0; j < c1; j++) { s += (A[i][j] - B[i][j]) ** 2; n++; }
  return Math.sqrt(s / n);
}
/** Share of the table's squared size left out by the first k sheets: Σ_{i>k} σ_i² / Σ σ_i². */
export const leftShare = (S: number[], k: number) => S.slice(k).reduce((s, v) => s + v * v, 0) / S.reduce((s, v) => s + v * v, 0);
/** Numbers kept for k sheets of an n × m table: k column profiles, k row profiles and k strengths. */
export const stored = (k: number, n = 64, m = 64) => k * (n + m + 1);
/** The block of LA_GRAY64 around the picture's left eye (rows 40..46, columns 26..34). */
export const EYE64 = { r0: 40, r1: 47, c0: 26, c1: 35 };
export const KS = [1, 2, 4, 8, 16, 32, 64];

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
/** A fixed shuffle of the row order (Fisher–Yates with seed 7). */
export function rowOrder(n: number, seed = 7): number[] {
  const r = mulberry(seed), p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return p;
}

/* ---- 07 · covariance and its eigenvectors (Jacobi eigenvalue method for small symmetric matrices) ---- */

export function eigSym(A: Mat): { vals: number[]; vecs: Mat } {
  const n = A.length, M = A.map((r) => [...r]);
  const V: Mat = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += M[p][q] ** 2;
    if (off < 1e-30) break;
    for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(M[p][q]) < 1e-300) continue;
      const theta = (M[q][q] - M[p][p]) / (2 * M[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const kp = M[k][p], kq = M[k][q]; M[k][p] = c * kp - s * kq; M[k][q] = s * kp + c * kq; }
      for (let k = 0; k < n; k++) { const pk = M[p][k], qk = M[q][k]; M[p][k] = c * pk - s * qk; M[q][k] = s * pk + c * qk; }
      for (let k = 0; k < n; k++) { const kp = V[k][p], kq = V[k][q]; V[k][p] = c * kp - s * kq; V[k][q] = s * kp + c * kq; }
    }
  }
  const order = M.map((_, i) => i).sort((a, b) => M[b][b] - M[a][a]);
  return { vals: order.map((i) => M[i][i]), vecs: order.map((i) => V.map((row) => row[i])) };   // vecs[k] is the k-th eigenvector
}

export type Pca = { n: number; mean: Vec; cov: Mat; vals: number[]; dirs: Vec[]; share: number[] };

/** Mean, covariance (dividing by n) and its eigenvectors. Signs: the first direction has a positive sum, the second a positive blue
 *  channel, the third a positive blue channel too; a direction and its negative are the same line. */
export function pca(vs: Vec[]): Pca {
  const n = vs.length, mu = mean(vs), d = mu.length;
  const cov = zeros(d, d);
  vs.forEach((v) => { const c = sub(v, mu); for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) cov[i][j] += (c[i] * c[j]) / n; });
  const { vals, vecs } = eigSym(cov);
  const dirs = vecs.map((v, k) => ((k === 0 ? v.reduce((s, x) => s + x, 0) : v[2]) < 0 ? scale(v, -1) : v));
  const tot = vals.reduce((s, v) => s + v, 0);
  return { n, mean: mu, cov, vals, dirs, share: vals.map((v) => v / tot) };
}
/** Coordinates of v along the directions, measured from the mean. */
export const coords = (p: Pca, v: Vec) => p.dirs.map((u) => dot(sub(v, p.mean), u));
/** Keep only the first k directions: mean plus the parts of v along them. */
export const keepK = (p: Pca, v: Vec, k: number) => coords(p, v).slice(0, k).reduce((s, c, i) => add(s, scale(p.dirs[i], c)), [...p.mean]);
