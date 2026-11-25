/** Hand-set toy models behind the ResNet-50 chapter. Every number quoted in the prose is computed here.
 *  No imports, so node can run this file directly. */

/* ---- 01 · one number through one added layer ---- */

/** The number we follow: one value at one position of a feature map. Hand-set. */
export const X_IN = 2;
/** What the layer body computes. The real body is three convolutions; here it is one multiplication. */
export const bodyOut = (w: number, x: number) => w * x;
/** Without the shortcut the body's result is the output; with it, the input is added back. */
export const layerOut = (w: number, x: number, shortcut: boolean) => (shortcut ? x + w * x : w * x);
/** The weight at which the layer passes its input through unchanged. */
export const passWeight = (shortcut: boolean) => (shortcut ? 0 : 1);

/** A k×k conv from c to c channels that copies its input: one 1 per output channel (kernel centre, same channel), 0 elsewhere. */
export function identityPattern(k: number, c: number) {
  const perKernel = k * k * c, total = perKernel * c;
  return { perKernel, total, ones: c, zeros: total - c };
}

/* ---- 02 · eight layers: values forward, error signal backward ---- */

/** Hand-set small weights near 0, mixed signs: what a stack looks like before it has learned anything. */
export const CHAIN_W = [0.1, 0.1, -0.1, -0.1, 0.1, -0.1, 0.1, -0.1];
export type Preset = "near0" | "zero" | "one";
export const presetWeights = (p: Preset): number[] => (p === "near0" ? CHAIN_W : CHAIN_W.map(() => (p === "zero" ? 0 : 1)));
/** The number a layer multiplies by, forward and backward alike. */
export const factorOf = (w: number, shortcut: boolean) => (shortcut ? 1 + w : w);

export type Chain = { h: number[]; d: number[]; upd: number[] };
/** h[l]: value after layer l (h[0] is the input). d[l]: how much the final output moves per unit change of h[l] (d[n] = 1).
 *  upd[l-1] = h[l-1] · d[l]: how much the final output moves per unit change of layer l's weight. */
export function chain(ws: number[], x: number, shortcut: boolean): Chain {
  const n = ws.length, h = [x], d = new Array<number>(n + 1).fill(1);
  for (let l = 1; l <= n; l++) h.push(factorOf(ws[l - 1], shortcut) * h[l - 1]);
  for (let l = n; l >= 1; l--) d[l - 1] = factorOf(ws[l - 1], shortcut) * d[l];
  const upd = ws.map((_, i) => h[i] * d[i + 1]);
  return { h, d, upd };
}

/* ---- 03 · the same stacks, actually trained by gradient descent ---- */

export type NetKind = "plain2" | "plain8" | "res8";
export const netDepth = (k: NetKind) => (k === "plain2" ? 2 : 8);
export const netShortcut = (k: NetKind) => k === "res8";
export const TRAIN_LR = 0.02;
export const TRAIN_STEPS = 80;
export type TrainSnap = { w: number[]; out: number; loss: number };
/** Input 2, target = mul × 2. Loss = ½(out − target)². Starts from the first weights of CHAIN_W. */
export function trainChain(kind: NetKind, mul: number, steps = TRAIN_STEPS, lr = TRAIN_LR, start?: number[]): TrainSnap[] {
  const short = netShortcut(kind), target = mul * X_IN;
  let w = start ? start.slice() : CHAIN_W.slice(0, netDepth(kind));
  const hist: TrainSnap[] = [];
  for (let t = 0; t <= steps; t++) {
    const c = chain(w, X_IN, short), out = c.h[w.length], err = out - target;
    hist.push({ w: w.slice(), out, loss: 0.5 * err * err });
    w = w.map((v, i) => v - lr * err * c.upd[i]);
  }
  return hist;
}
/** First step at which the loss falls below `tol`, or -1 if it never does within `cap` steps. */
export function stepsToLearn(kind: NetKind, mul: number, tol = 0.01, cap = 2_000_000, start?: number[]): number {
  const short = netShortcut(kind), target = mul * X_IN;
  let w = start ? start.slice() : CHAIN_W.slice(0, netDepth(kind));
  for (let t = 0; t <= cap; t++) {
    const c = chain(w, X_IN, short), err = c.h[w.length] - target;
    if (0.5 * err * err < tol) return t;
    w = w.map((v, i) => v - TRAIN_LR * err * c.upd[i]);
  }
  return -1;
}

/* ---- 06 · bottleneck cost ---- */

export const convParams = (k: number, cin: number, cout: number) => k * k * cin * cout;
export function bottleneckCost(c: number, r = 4) {
  const m = c / r, reduce = convParams(1, c, m), mid = convParams(3, m, m), expand = convParams(1, m, c);
  const total = reduce + mid + expand, naive = convParams(3, c, c);
  return { m, reduce, mid, expand, total, naive, saving: naive / total };
}

/* ---- 08 · one position through one bottleneck block: wide trunk, narrow work space ---- */

/** Two inputs at one position (four channel values). B is A with its third and fourth values swapped. Hand-set. */
export const TRUNK_A = [2, 1, 0, 3];
export const TRUNK_B = [2, 1, 3, 0];
/** Block 1: reduce 4 → 1, a stand-in for the 3×3 (one multiplication, then ReLU), expand 1 → 4. Hand-set. */
export const REDUCE_1 = [0.5, 0, 0.5, 0.5];
export const MID_1 = 0.8;
export const EXPAND_1 = [0.2, -0.1, 0.1, 0];
/** Block 2 reduces with different weights: third minus fourth. */
export const REDUCE_2 = [0, 0, 1, -1];

const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
export type BlockWalk = { trunk: number[]; r: number; m: number; F: number[]; y: number[]; next: number };
/** wide = true: the trunk keeps all four values and the block only adds a correction.
 *  wide = false: the trunk is one channel from the start, so only the reduced value exists. */
export function blockWalk(x: number[], wide: boolean): BlockWalk {
  const r = dot(REDUCE_1, x), m = Math.max(0, MID_1 * r);
  if (wide) {
    const F = EXPAND_1.map((u) => u * m), y = x.map((v, i) => v + F[i]);
    return { trunk: x, r, m, F, y, next: dot(REDUCE_2, y) };
  }
  const F = [EXPAND_1[0] * m], y = [r + F[0]];
  return { trunk: [r], r, m, F, y, next: y[0] };
}

/* ---- 10 · why the size still needs watching ---- */

/** Size of a value after n blocks if every block multiplies it by (1 + w). */
export const growth = (w: number, n: number) => Math.pow(1 + w, n);
