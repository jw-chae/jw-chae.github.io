/** Arithmetic behind the re-parameterization study scenes: one 5×5 one-channel image, a three-branch block,
 *  its merge into one 3×3 kernel, BatchNorm folding, one gradient step, small off-centre kernels, and a toy
 *  position-dependent kernel. Import-free so node can run it. Every toy number below is hand-set. */

export type Grid = number[][];

export const zeros = (n: number, m: number): Grid => Array.from({ length: n }, () => new Array<number>(m).fill(0));
export const addG = (a: Grid, b: Grid, k = 1): Grid => a.map((row, i) => row.map((v, j) => v + k * b[i][j]));
export const scaleG = (a: Grid, k: number): Grid => a.map((row) => row.map((v) => v * k));
export const maxAbs = (a: Grid) => a.reduce((m, row) => row.reduce((q, v) => Math.max(q, Math.abs(v)), m), 0);
const dotG = (a: Grid, b: Grid) => a.reduce((s, row, i) => s + row.reduce((q, v, j) => q + v * b[i][j], 0), 0);

/* ---- the running example: one 5×5 one-channel image and one block with three branches ---- */

export const N = 5;
/** The image. Hand-set small integers so every product can be done in the head. */
export const X: Grid = [
  [1, 0, 2, 1, 0],
  [2, 1, 3, 0, 1],
  [0, 2, 2, 1, 3],
  [1, 3, 0, 2, 1],
  [2, 0, 1, 1, 0],
];
/** Branch 1: a 3×3 kernel (zero padding 1). Hand-set; the centre weight is negative on purpose. */
export const K3: Grid = [
  [0, 1, 0],
  [1, -1, 2],
  [0, -1, 1],
];
/** Branch 2: a 1×1 kernel. With one channel it is a single number. */
export const K1 = 2;
/** The output positions the scenes let the reader pick: centre, top edge, corner. */
export const SPOTS: [number, number][] = [[2, 2], [0, 2], [4, 4]];
export const CENTER: [number, number] = [2, 2];

/** Value at (r, c) of a kh×kw kernel whose window starts pt rows above and pl columns left of (r, c). Outside the image is 0. */
export function convAt(x: Grid, k: Grid, pt: number, pl: number, r: number, c: number): number {
  let s = 0;
  k.forEach((row, u) => row.forEach((w, v) => {
    const y = r - pt + u, xx = c - pl + v;
    if (y >= 0 && xx >= 0 && y < x.length && xx < x[0].length) s += w * x[y][xx];
  }));
  return s;
}
export const convMap = (x: Grid, k: Grid, pt: number, pl: number): Grid => x.map((row, r) => row.map((_, c) => convAt(x, k, pt, pl, r, c)));

/** The 3×3 window the big kernel sees at (r, c), zeros outside the image. */
export const window3 = (x: Grid, r: number, c: number): Grid =>
  [0, 1, 2].map((u) => [0, 1, 2].map((v) => {
    const y = r - 1 + u, xx = c - 1 + v;
    return y >= 0 && xx >= 0 && y < x.length && xx < x[0].length ? x[y][xx] : 0;
  }));

/** Writes a small kernel into a 3×3 grid at the place its window covers inside the 3×3 window. */
export function padTo3(k: Grid, pt: number, pl: number): Grid {
  const out = zeros(3, 3);
  k.forEach((row, u) => row.forEach((w, v) => { out[1 - pt + u][1 - pl + v] += w; }));
  return out;
}

/** The three branches, computed separately, at every position. */
export const B3_MAP = convMap(X, K3, 1, 1);
export const B1_MAP = convMap(X, [[K1]], 0, 0);
export const B0_MAP = X.map((row) => [...row]);
export const SUM_MAP = addG(addG(B3_MAP, B1_MAP), B0_MAP);

/** The merge: pad the 1×1 kernel to 3×3, write the identity as a 3×3 kernel with a single 1 in the centre, add. */
export const K1_PAD = padTo3([[K1]], 0, 0);
export const ID_PAD = padTo3([[1]], 0, 0);
export const K_MERGED = addG(addG(K3, K1_PAD), ID_PAD);
export const MERGED_MAP = convMap(X, K_MERGED, 1, 1);
/** Largest difference between "three branches added" and "one merged kernel" over all 25 positions. Must be 0. */
export const MERGE_GAP = maxAbs(addG(MERGED_MAP, SUM_MAP, -1));

export type BranchAt = { win: Grid; b3: number; b1: number; b0: number; sum: number; merged: number };
export function branchesAt(r: number, c: number, x: Grid = X): BranchAt {
  const b3 = convAt(x, K3, 1, 1, r, c), b1 = K1 * x[r][c], b0 = x[r][c];
  return { win: window3(x, r, c), b3, b1, b0, sum: b3 + b1 + b0, merged: convAt(x, K_MERGED, 1, 1, r, c) };
}

/** "Change one input and predict": raise one pixel by 1 and list which outputs move, branch by branch. */
export function poke(r: number, c: number, by = 1): { x: Grid; moved3: number; moved1: number; moved0: number; movedMerged: number; centreDelta: number } {
  const x = X.map((row) => [...row]);
  x[r][c] += by;
  const count = (a: Grid, b: Grid) => a.reduce((s, row, i) => s + row.filter((v, j) => Math.abs(v - b[i][j]) > 1e-12).length, 0);
  const m3 = convMap(x, K3, 1, 1), m1 = convMap(x, [[K1]], 0, 0), mm = convMap(x, K_MERGED, 1, 1);
  return { x, moved3: count(m3, B3_MAP), moved1: count(m1, B1_MAP), moved0: count(x, B0_MAP), movedMerged: count(mm, MERGED_MAP), centreDelta: mm[r][c] - MERGED_MAP[r][c] };
}

/* ---- BatchNorm on each branch, at inference: fixed numbers, folded into weight and bias ---- */

/** σ here already includes ε: σ = √(running variance + ε). All four numbers per branch are hand-set. */
export type Bn = { mu: number; sigma: number; gamma: number; beta: number };
export const BN3: Bn = { mu: 3, sigma: 2, gamma: 1, beta: 0.5 };
export const BN1: Bn = { mu: 2, sigma: 4, gamma: 2, beta: 0 };
export const BN0: Bn = { mu: 1, sigma: 1, gamma: 1, beta: 1 };
export const bnApply = (z: number, b: Bn) => (b.gamma * (z - b.mu)) / b.sigma + b.beta;
/** Folding: BN(k * x) = (γ/σ)·(k * x) + (β − γμ/σ). */
export const foldScale = (b: Bn) => b.gamma / b.sigma;
export const foldBias = (b: Bn) => b.beta - (b.gamma * b.mu) / b.sigma;

export const K3_F = scaleG(K3, foldScale(BN3));
export const K1_F = K1 * foldScale(BN1);
export const ID_F = foldScale(BN0);
export const K_BN = addG(addG(K3_F, padTo3([[K1_F]], 0, 0)), padTo3([[ID_F]], 0, 0));
export const BIAS_BN = foldBias(BN3) + foldBias(BN1) + foldBias(BN0);

export type BnAt = { z3: number; z1: number; z0: number; y3: number; y1: number; y0: number; sum: number; folded3: number; folded1: number; folded0: number; merged: number };
export function bnAt(r: number, c: number, x: Grid = X): BnAt {
  const z3 = convAt(x, K3, 1, 1, r, c), z1 = K1 * x[r][c], z0 = x[r][c];
  const y3 = bnApply(z3, BN3), y1 = bnApply(z1, BN1), y0 = bnApply(z0, BN0);
  return {
    z3, z1, z0, y3, y1, y0, sum: y3 + y1 + y0,
    folded3: foldScale(BN3) * z3 + foldBias(BN3), folded1: K1_F * x[r][c] + foldBias(BN1), folded0: ID_F * x[r][c] + foldBias(BN0),
    merged: convAt(x, K_BN, 1, 1, r, c) + BIAS_BN,
  };
}
export const BN_GAP = maxAbs(X.map((row, r) => row.map((_, c) => { const v = bnAt(r, c); return v.merged - v.sum; })));

/** While training, BN uses the mean and variance of the batch that came in. Our image shares the batch with one other image. */
export const OTHER_A: Grid = [
  [0, 1, 0, 0, 1],
  [1, 0, 1, 1, 0],
  [0, 1, 0, 1, 0],
  [1, 0, 0, 0, 1],
  [0, 1, 1, 0, 0],
];
export const OTHER_B: Grid = OTHER_A.map((row) => row.map((v) => v + 2));
export const EPS = 1e-5;
/** The 3×3 branch at the centre of our image, normalized with the batch's own statistics (γ, β as in BN3). */
export function trainModeCentre(other: Grid): { mean: number; std: number; value: number } {
  const vals = [...B3_MAP.flat(), ...convMap(other, K3, 1, 1).flat()];
  const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
  const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length;
  const std = Math.sqrt(variance + EPS);
  return { mean, std, value: (BN3.gamma * (B3_MAP[2][2] - mean)) / std + BN3.beta };
}

/* ---- 05 · the same reachable kernels, different steps: one gradient step on branches versus on the merged kernel ---- */

/** The kernel the block should end up computing, hand-set. The data is the 25 outputs it gives on X. */
export const K_TARGET: Grid = [
  [0, 1, 0],
  [1, 1, 1],
  [0, 1, 0],
];
export const T_MAP = convMap(X, K_TARGET, 1, 1);
export const LR = 0.05;
/** The steps the scene lets the reader stop at. */
export const CHECKPOINTS = [0, 1, 2, 5, 10, 20, 50, 100, 200, 400, 800];

/** ½·mean of squared errors over the 25 outputs, and its gradient with respect to the effective 3×3 kernel. */
export function lossGrad(k: Grid): { loss: number; g: Grid } {
  const g = zeros(3, 3);
  let loss = 0;
  X.forEach((row, r) => row.forEach((_, c) => {
    const e = convAt(X, k, 1, 1, r, c) - T_MAP[r][c];
    loss += (0.5 * e * e) / 25;
    const w = window3(X, r, c);
    w.forEach((wr, u) => wr.forEach((v, j) => { g[u][j] += (e * v) / 25; }));
  }));
  return { loss, g };
}

export type StepSnap = { k: Grid; loss: number };
/** Gradient descent directly on the nine numbers of the merged kernel. */
export function trainMerged(steps = 800, lr = LR): StepSnap[] {
  let k = K_MERGED.map((row) => [...row]);
  const out: StepSnap[] = [];
  for (let t = 0; t <= steps; t++) {
    const { loss, g } = lossGrad(k);
    out.push({ k: k.map((row) => [...row]), loss });
    k = addG(k, g, -lr);
  }
  return out;
}
/** Gradient descent on the branches: nine numbers of the 3×3 kernel and the one 1×1 number. The identity has no number to learn. */
export function trainBranches(steps = 800, lr = LR): (StepSnap & { k3: Grid; k1: number })[] {
  let k3 = K3.map((row) => [...row]), k1 = K1;
  const out: (StepSnap & { k3: Grid; k1: number })[] = [];
  for (let t = 0; t <= steps; t++) {
    const eff = addG(addG(k3, padTo3([[k1]], 0, 0)), ID_PAD);
    const { loss, g } = lossGrad(eff);
    out.push({ k: eff, loss, k3: k3.map((row) => [...row]), k1 });
    // ∂L/∂k3 = g (all nine cells), ∂L/∂k1 = g at the centre: the centre cell of the effective kernel gets two pushes.
    k3 = addG(k3, g, -lr);
    k1 -= lr * g[1][1];
  }
  return out;
}

/* ---- 06 · depthwise: the same merge, once per channel ---- */

/** Three channels of a depthwise layer. Channel 1 is the running example; the other two are hand-set. */
export const DW_K3: Grid[] = [
  K3,
  [[1, 0, 1], [0, 0.5, 0], [-1, 0, 1]],
  [[0, -1, 0], [-1, 3, -1], [0, -1, 0]],
];
export const DW_K1 = [K1, -1, 0.5];
export const DW_MERGED: Grid[] = DW_K3.map((k, c) => addG(addG(k, padTo3([[DW_K1[c]]], 0, 0)), ID_PAD));

/* ---- 07 · small kernels placed off the centre (the idea PBConv builds on) ---- */

export type Small = { key: string; k: Grid; pt: number; pl: number };
/** Each small kernel is hand-set. pt, pl say where its window starts relative to the output position. */
export const SMALLS: Small[] = [
  { key: "1x1", k: [[2]], pt: 0, pl: 0 },
  { key: "1x3", k: [[1, -1, 1]], pt: 0, pl: 1 },
  { key: "3x1", k: [[1], [1], [-1]], pt: 1, pl: 0 },
  { key: "2x2", k: [[1, 1], [-1, 1]], pt: 0, pl: 0 },
];
export function smallCheck(s: Small, r = CENTER[0], c = CENTER[1]): { padded: Grid; merged: Grid; base: number; branch: number; sum: number; onePath: number; gap: number } {
  const padded = padTo3(s.k, s.pt, s.pl), merged = addG(K3, padded);
  const base = convAt(X, K3, 1, 1, r, c), branch = convAt(X, s.k, s.pt, s.pl, r, c);
  const gap = maxAbs(addG(convMap(X, merged, 1, 1), addG(B3_MAP, convMap(X, s.k, s.pt, s.pl)), -1));
  return { padded, merged, base, branch, sum: base + branch, onePath: convAt(X, merged, 1, 1, r, c), gap };
}

/* ---- 08 · a toy kernel that depends on the input around it (the idea LS convolution builds on) ---- */

/** Wide look: the mean of the 5×5 window around a position (zeros outside). Stands in for the large-kernel step. */
export function wideMean(x: Grid, r: number, c: number): number {
  let s = 0;
  for (let u = -2; u <= 2; u++) for (let v = -2; v <= 2; v++) {
    const y = r + u, xx = c + v;
    if (y >= 0 && xx >= 0 && y < x.length && xx < x[0].length) s += x[y][xx];
  }
  return s / 25;
}
/** The 3×3 weights used at a position: a fixed part plus the wide look times a fixed pattern. Both hand-set. */
export const LS_BASE = K3;
export const LS_DIR: Grid = [
  [0, 2, 0],
  [0, 0, 0],
  [0, 0, 0],
];
export const lsWeights = (x: Grid, r: number, c: number): Grid => addG(LS_BASE, LS_DIR, wideMean(x, r, c));
export const lsAt = (x: Grid, r: number, c: number) => dotG(lsWeights(x, r, c), window3(x, r, c));
/** The far pixel: inside the 5×5 wide look of the centre, outside its 3×3 window. */
export const FAR: [number, number] = [0, 0];
export const FAR_TO = 6;
export const X_FAR: Grid = X.map((row, r) => row.map((v, c) => (r === FAR[0] && c === FAR[1] ? FAR_TO : v)));
/** The weight the scene maps over all 25 positions: top middle of the 3×3 weights. */
export const LS_CELL: [number, number] = [0, 1];
export const lsWeightMap = (x: Grid): Grid => x.map((row, r) => row.map((_, c) => lsWeights(x, r, c)[LS_CELL[0]][LS_CELL[1]]));
/** Linearity test: every pixel doubled. */
export const X_DOUBLE: Grid = scaleG(X, 2);

/* ---- published numbers, quoted in the text exactly as the papers give them ---- */

export const PAPER = {
  repvgg: {
    // RepVGG, arXiv 2101.03697v3, Table 4: ImageNet, 120 epochs, simple augmentation; speed on a 1080Ti, batch 128, fp32, examples/second.
    pairs: [
      { a: "RepVGG-A0", accA: 72.41, spA: 3256, b: "ResNet-18", accB: 71.16, spB: 2442 },
      { a: "RepVGG-A1", accA: 74.46, spA: 2339, b: "ResNet-34", accB: 74.17, spB: 1419 },
      { a: "RepVGG-A2", accA: 76.48, spA: 1322, b: "ResNet-50", accB: 76.31, spB: 719 },
      { a: "RepVGG-B1g4", accA: 77.58, spA: 868, b: "ResNet-101", accB: 77.21, spB: 430 },
    ],
    vgg16: { acc: 72.21, speed: 415 },
    b0: { acc: 75.14, converted: 1817 },
    // Table 6: RepVGG-B0, 120 epochs; speed is the model before conversion (examples/second, batch 128).
    ablation: [
      { id: false, one: false, acc: 72.39, speed: 1810 },
      { id: true, one: false, acc: 74.79, speed: 1569 },
      { id: false, one: true, acc: 73.15, speed: 1230 },
      { id: true, one: true, acc: 75.14, speed: 1061 },
    ],
    // Table 7: variants on RepVGG-B0, 120 epochs.
    variants: { identityNoBn: 74.18, postAddBn: 73.52, full: 75.14, reluInBranch: 75.69, diracNet: 73.97, trivial: 73.51, acb: 73.58, residualReorg: 74.56 },
    resnet50WithBlocks: 76.34,
    b3_200ep: 80.52,
    // Table 1: one conv layer, batch 32, 2048 → 2048 channels, 56×56, stride 1, 1080Ti: theoretical TFLOPS.
    tflops: { k1: 9.96, k3: 38.1, k5: 10.57, k7: 9.38 },
  },
  repvit: {
    // RepViT, arXiv 2307.09283v8 (14 Mar 2024, CVPR 2024 camera-ready). iPhone 12, iOS 16, Core ML Tools, batch 1. Figure 2, no distillation.
    roadmap: [
      { key: "start", ms: 1.01, acc: 71.5 },
      { key: "mixer", ms: 0.81, acc: 68.3 },
      { key: "width", ms: 0.89, acc: 73.5 },
      { key: "stem", ms: 0.86, acc: 73.9 },
      { key: "down", ms: 0.96, acc: 75.4 },
      { key: "head", ms: 0.77, acc: 74.8 },
      { key: "ratio", ms: 0.91, acc: 76.9 },
      { key: "kernel", ms: 0.89, acc: 76.9 },
      { key: "se", ms: 0.87, acc: 77.4 },
    ],
    expRatioOnlyMs: 0.65,
    // Table 1 (distillation, 300 / 450 epochs) and Table 2 (no distillation, 300 epochs).
    m10: { ms: 1.0, kd300: 80.0, kd450: 80.3, noKd: 78.6, params: 6.8 },
    m23: { ms: 2.3, kd450: 83.7, noKd: 82.5 },
    // Table 6: top-1 without and with structural re-parameterization.
    sr: [
      { model: "M0.9", off: 78.47, on: 78.74 },
      { model: "M1.5", off: 82.09, on: 82.29 },
      { model: "M2.3", off: 83.1, on: 83.3 },
    ],
  },
  lsnet: {
    // LSNet, arXiv 2503.23135v1 (CVPR 2025). Table 1: ImageNet-1K; throughput on an RTX3090, images/second.
    rows: [
      { model: "LSNet-T", flops: 0.3, tput: 14708, acc: 74.9 },
      { model: "LSNet-S", flops: 0.5, tput: 9023, acc: 77.8 },
      { model: "LSNet-B", flops: 1.3, tput: 3996, acc: 80.3 },
      { model: "RepViT-M1.1", flops: 1.3, tput: 3604, acc: 79.4 },
    ],
    kd: { b: 81.6 },
    // Tables 5 and 7: LSNet-T, 100 epochs.
    ablation: { noLs: 69.3, ls: 71.6, noSka: 70.1, noLkp: 70.5, kl3: 70.9, kl5: 71.2, kl9: 71.5, ks1: 69.6, ks5: 71.6 },
    kl: 7, ks: 3,
  },
  pbconv: {
    // PBConv, IJCAI 2025, pp. 1080–1088, Table 1: ImageNet top-1.
    resnet18: { base: 70.75, acb: 71.36, dbb: 71.77, pb: 72.08 },
    // Table 2: combined with RepVGG-A0 (architecture-level re-parameterization), CIFAR.
    repvggA0: { base: 87.03, pb: 87.75 },
    searchShare: [1, 10],
  },
} as const;
