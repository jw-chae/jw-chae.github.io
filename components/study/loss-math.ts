/** Arithmetic behind the loss study scenes. One 160 × 160 picture (the owner's pixel-art Siamese cat and a drawn cup,
 *  the same picture as the YOLO and DETR chapters), one detector head that writes, for the cat, three name scores and a box.
 *  Every number the chapter quotes is computed here. Import-free so node can run it directly.
 *  Measured: the answer boxes (copied from yolo-math.ts, measured from the cat image's alpha channel).
 *  Hand-set for the explanation: feature values, scores, learning rates, the five box labels, the 2-number embeddings,
 *  the mid-training probability rule of 05. Published: RetinaNet's anchor rule, π = 0.01, γ, α and Table 1 (Lin et al. 2017),
 *  label smoothing ε = 0.1 (Szegedy et al. 2016), FaceNet's margin 0.2, DETR's loss weights 5 and 2. */

export type Box = [number, number, number, number];   // x1, y1, x2, y2 in picture pixels

export const IMG = 160;
/** Copied from yolo-math.ts: the cat's answer box, measured from the alpha channel at its placement, and the drawn cup. */
export const GT_CAT: Box = [15, 32, 76, 139];
export const GT_CUP: Box = [114, 94, 148, 138];
export const CAT_W = GT_CAT[2] - GT_CAT[0];            // 61
export const CAT_H = GT_CAT[3] - GT_CAT[1];            // 107

export const area = (b: Box) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
export const iou = (a: Box, b: Box) => {
  const i = area([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]);
  return i / (area(a) + area(b) - i);
};
export function softmax(z: number[]): number[] {
  const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}
const nll = (p: number) => -Math.log(p);

/* ---- 01 · one number, one weight, one step: the cat's box width ---- */

/** The last step of the head: width = w × h. h is what the frozen layers before it computed from the picture (hand-set). */
export type StepCase = { h: number; w0: number };
export const STEP_CASES: StepCase[] = [{ h: 2, w0: 20 }, { h: 4, w0: 10 }];   // both start at width 40
export const ETAS = [0.05, 0.125, 0.2, 0.3];
export const STEPS_MAX = 8;
export type StepSnap = { w: number; width: number; err: number; loss: number; slope: number };

/** Gradient descent on L(w) = (w·h − 61)². slope = dL/dw = 2·(w·h − 61)·h. */
export function widthRun(c: StepCase, eta: number, steps = STEPS_MAX): StepSnap[] {
  const out: StepSnap[] = [];
  let w = c.w0;
  for (let t = 0; t <= steps; t++) {
    const width = w * c.h, err = width - CAT_W, slope = 2 * err * c.h;
    out.push({ w, width, err, loss: err * err, slope });
    w -= eta * slope;
  }
  return out;
}
/** Each step multiplies the error by this factor: e(t+1) = (1 − 2ηh²)·e(t). */
export const stepFactor = (h: number, eta: number) => 1 - 2 * eta * h * h;

/** Two box errors (width, height) before and after two possible changes: which is "better" depends on how they are combined. */
export const TWO_ERR = { before: [-21, 3], a: [-10, 8], b: [-12, 15] };
export const sumSq = (e: number[]) => e.reduce((s, v) => s + v * v, 0);
export const sumAbs = (e: number[]) => e.reduce((s, v) => s + Math.abs(v), 0);

/* ---- 02 · the name: three scores, −log p(answer) ---- */

/** Scores the head writes for the cat's box, for 고양이, 개, 컵 (hand-set: the head currently prefers 개). */
export const Z0 = [1, 2, 0];
export const nameLoss = (z: number[]) => { const p = softmax(z); return { p, loss: nll(p[0]) }; };
export const LOG_ROWS = [0.9, 0.5, 0.1, 0.01, 0.001].map((p) => ({ p, loss: nll(p) }));
/** Three pictures in one batch: the cat (from Z0), a cup crop the head gives 컵 0.9, a dog photo it gives 개 0.6 (hand-set). */
export const BATCH_P = [softmax(Z0)[0], 0.9, 0.6];
export const BATCH_PRODUCT = BATCH_P.reduce((a, b) => a * b, 1);
export const BATCH_SUM = BATCH_P.reduce((s, p) => s + nll(p), 0);
/** How many pictures at p = 0.5 until the plain product is exactly 0 in 64-bit and in 32-bit floating point. */
export const UNDERFLOW = (() => {
  let n64 = 0, v = 1;
  while (v > 0) { v *= 0.5; n64++; }
  let n32 = 0, f = 1;
  while (f > 0) { f = Math.fround(f * 0.5); n32++; }
  return { n64, n32 };
})();

/* ---- 03 · squared error on probabilities versus cross-entropy: the gradient on the cat's score ---- */

export const MSE_OTHERS = [2, 0];               // 개 and 컵 scores, held fixed (hand-set)
export const ZC_RANGE = [-6, 6];
export const WRONG_ZC = -3;                     // the confidently wrong moment the prose works out by hand
export type Push = { p: number[]; ce: number; mse: number; gCe: number; gMse: number };
/** Both losses and their gradients with respect to the cat score z_cat (others fixed). */
export function pushAt(zc: number): Push {
  const p = softmax([zc, ...MSE_OTHERS]), y = [1, 0, 0];
  const mse = p.reduce((s, v, i) => s + (v - y[i]) ** 2, 0);
  // dCE/dz_cat = p_cat − 1.  dMSE/dz_cat = Σ_i 2(p_i − y_i)·∂p_i/∂z_cat = 2 p_cat [ −(1 − p_cat)² − Σ_{j≠cat} p_j² ]
  const gMse = 2 * p[0] * (-((1 - p[0]) ** 2) - p[1] ** 2 - p[2] ** 2);
  return { p, ce: nll(p[0]), mse, gCe: p[0] - 1, gMse };
}
/** Where on the range the squared-error gradient is strongest (grid search, step 0.01). */
export const MSE_PEAK = (() => {
  let best = { zc: 0, g: 0 };
  for (let zc = ZC_RANGE[0]; zc <= ZC_RANGE[1] + 1e-9; zc += 0.01) {
    const g = pushAt(zc).gMse;
    if (Math.abs(g) > Math.abs(best.g)) best = { zc, g };
  }
  return best;
})();
/** The same comparison with one sigmoid output ("물체인가"), at z = −4. */
export const SIG = (() => {
  const z = -4, p = 1 / (1 + Math.exp(-z));
  return { z, p, gCe: p - 1, gMse: 2 * (p - 1) * p * (1 - p) };
})();

/* ---- 04 · regression: five labels for the cat's width, one of them mistyped ---- */

/** Five people drew the cat's box; four widths are close to the measured 61, the fifth typed 16 (hand-set). */
export const GOOD_LABELS = [60, 61, 61, 62];
export const BAD_LABEL = 16;
export const HUBER_D = 5;                       // δ in pixels, hand-set
export type RegKind = "sq" | "abs" | "huber";
export const lossOf = (k: RegKind, r: number, d = HUBER_D) =>
  k === "sq" ? r * r : k === "abs" ? Math.abs(r) : Math.abs(r) <= d ? 0.5 * r * r : d * Math.abs(r) - 0.5 * d * d;
/** dℓ/dŵ for one label at the estimate ŵ (r = ŵ − y). L1 at r = 0 takes 0. */
export const gradOf = (k: RegKind, r: number, d = HUBER_D) =>
  k === "sq" ? 2 * r : k === "abs" ? Math.sign(r) : Math.max(-d, Math.min(d, r));
/** The single width that makes the summed loss smallest: mean, median, or the Huber point (bisection on the summed gradient). */
export function bestWidth(k: RegKind, ys: number[]): number {
  if (k === "sq") return ys.reduce((a, b) => a + b, 0) / ys.length;
  if (k === "abs") { const s = [...ys].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; }
  let lo = Math.min(...ys), hi = Math.max(...ys);
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, g = ys.reduce((s, y) => s + gradOf("huber", mid - y), 0);
    if (g > 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}
export const labelsWith = (bad: number) => [...GOOD_LABELS, bad];
/** −log of a Gaussian (σ = 1 px) and a Laplace (b = 1 px) density, at a residual r. */
export const gaussNll = (r: number, s = 1) => (r * r) / (2 * s * s) + 0.5 * Math.log(2 * Math.PI * s * s);
export const laplaceNll = (r: number, b = 1) => Math.abs(r) / b + Math.log(2 * b);

/* ---- 05 · dense detection: RetinaNet's anchors on the picture scaled to 800 px ---- */

export const RN_K = 5;                          // 160 → 800 px
export type Anchor = { lv: number; b: Box; iou: number; gt: number };   // b in 160-picture pixels; gt: 0 cat, 1 cup, −1 none
/** RetinaNet's rule (Lin et al. 2017, Section 4): levels P3..P7 (stride 2^l), base area (4·stride)², three sizes
 *  2^0, 2^(1/3), 2^(2/3), three aspect ratios 1:2, 1:1, 2:1, nine anchors per position. Positions at cell centres. */
export const ANCHORS: Anchor[] = (() => {
  const S = IMG * RN_K, gts = [GT_CAT, GT_CUP].map((g) => g.map((v) => v * RN_K) as Box), out: Anchor[] = [];
  for (let lv = 3; lv <= 7; lv++) {
    const st = 2 ** lv, base = 4 * st, n = Math.ceil(S / st);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const cx = (c + 0.5) * st, cy = (r + 0.5) * st;
      for (const sc of [1, 2 ** (1 / 3), 2 ** (2 / 3)]) for (const ar of [0.5, 1, 2]) {
        const a = base * sc, w = a / Math.sqrt(ar), h = a * Math.sqrt(ar);
        const b: Box = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
        const ious = gts.map((g) => iou(b, g)), best = ious[0] >= ious[1] ? 0 : 1;
        out.push({ lv, b: b.map((v) => v / RN_K) as Box, iou: ious[best], gt: ious[best] > 0 ? best : -1 });
      }
    }
  }
  return out;
})();
export const POS_IOU = 0.5, NEG_IOU = 0.4;
export const isPos = (a: Anchor) => a.iou >= POS_IOU;
export const isIgnored = (a: Anchor) => a.iou >= NEG_IOU && a.iou < POS_IOU;
export const ANCHOR_COUNT = ANCHORS.length;
export const POS = ANCHORS.filter(isPos);
export const POS_CAT = POS.filter((a) => a.gt === 0).length;
export const POS_CUP = POS.filter((a) => a.gt === 1).length;
export const IGNORED = ANCHORS.filter(isIgnored).length;
export const NEG = ANCHOR_COUNT - POS.length - IGNORED;
export const NEG_ZERO = ANCHORS.filter((a) => a.iou === 0).length;
/** The cat's best anchor: the one the chapter tracks. */
export const CAT_BEST: Anchor = ANCHORS.filter((a) => a.gt === 0).reduce((m, a) => (a.iou > m.iou ? a : m));
const insidePic = (a: Anchor) => a.b[0] >= 0 && a.b[1] >= 0 && a.b[2] <= IMG && a.b[3] <= IMG;
/** A partly overlapping negative on the cat (inside the picture, IoU closest to 0.3), and a square wall anchor
 *  of level P5 (IoU 0, inside the picture, closest to the point (125, 40) of the empty upper right). */
export const CAT_HARD: Anchor = ANCHORS.filter((a) => a.gt === 0 && a.iou < NEG_IOU && insidePic(a)).reduce((m, a) => (Math.abs(a.iou - 0.3) < Math.abs(m.iou - 0.3) ? a : m));
export const WALL: Anchor = (() => {
  const near = (a: Anchor) => Math.hypot((a.b[0] + a.b[2]) / 2 - 125, (a.b[1] + a.b[3]) / 2 - 40);
  const cand = ANCHORS.filter((a) => a.iou === 0 && a.lv === 5 && insidePic(a) && Math.abs((a.b[2] - a.b[0]) - (a.b[3] - a.b[1])) < 1e-6);
  return cand.reduce((m, a) => (near(a) < near(m) ? a : m));
})();

/** The model's probability "물체" for an anchor at two moments.
 *  init: every anchor at π = 0.01, the paper's prior initialization of the last bias.
 *  mid: hand-set rule for a moment during training, higher where the anchor overlaps an answer more: 0.01 + 0.6 × IoU. */
export type Moment = "init" | "mid";
export const PI0 = 0.01;
export const pObj = (a: Anchor, m: Moment) => (m === "init" ? PI0 : 0.01 + 0.6 * a.iou);
export const pT = (a: Anchor, m: Moment) => (isPos(a) ? pObj(a, m) : 1 - pObj(a, m));

/** Loss rows. Plain CE; α-balanced CE with the best α of Table 1(a); focal with the (γ, α) pairs of Table 1(b).
 *  ap: COCO AP the paper reports for that row (ResNet-50-FPN, 600 px, trainval35k → minival). CE is reported as α = 0.5,
 *  which is plain CE times 0.5: the same shares. */
export type LossRow = { key: string; gamma: number; alpha: number | null; ap: number };
export const LOSS_ROWS: LossRow[] = [
  { key: "ce", gamma: 0, alpha: null, ap: 30.2 },
  { key: "a75", gamma: 0, alpha: 0.75, ap: 31.1 },
  { key: "g1", gamma: 1, alpha: 0.25, ap: 33.7 },
  { key: "g2", gamma: 2, alpha: 0.25, ap: 34.0 },
  { key: "g5", gamma: 5, alpha: 0.25, ap: 32.2 },
];
/** Loss of one anchor: −α_t (1 − p_t)^γ log p_t, with α_t = α for positives and 1 − α for negatives (1 for plain CE). */
export function anchorLoss(pt: number, pos: boolean, row: LossRow): number {
  const at = row.alpha === null ? 1 : pos ? row.alpha : 1 - row.alpha;
  return -at * (1 - pt) ** row.gamma * Math.log(pt);
}
export const EASY_PT = 0.9;
export type Shares = { n: [number, number, number]; sum: [number, number, number]; total: number; share: [number, number, number] };
/** Totals over all anchors in three groups: positives, hard negatives (p_t < 0.9), easy negatives (p_t ≥ 0.9). Ignored anchors add nothing. */
export function shares(row: LossRow, m: Moment): Shares {
  const n: [number, number, number] = [0, 0, 0], sum: [number, number, number] = [0, 0, 0];
  for (const a of ANCHORS) {
    if (isIgnored(a)) continue;
    const pos = isPos(a), pt = pT(a, m), g = pos ? 0 : pt < EASY_PT ? 1 : 2;
    n[g]++; sum[g] += anchorLoss(pt, pos, row);
  }
  const total = sum[0] + sum[1] + sum[2];
  return { n, sum, total, share: sum.map((v) => v / total) as [number, number, number] };
}
/** With the usual 0.5 start instead of π: every anchor costs ln 2, so the negatives' share is their head count. */
export const HALF_START_NEG_SHARE = NEG / (NEG + POS.length);

/* ---- 06 · label smoothing: what the target does to the score gap ---- */

export const SMOOTH_EPS = [0, 0.1, 0.2];
export const SMOOTH_K = 3;
export const SMOOTH_LR = 0.5;
export const SMOOTH_STEPS = 300;
export const smoothTarget = (eps: number, K = SMOOTH_K) => Array.from({ length: K }, (_, i) => (i === 0 ? 1 - eps + eps / K : eps / K));
/** The score gap at which p equals the smoothed target (and the gradient p − q is zero). Infinite for ε = 0. */
export const gapStar = (eps: number, K = SMOOTH_K) => Math.log((1 - eps + eps / K) / (eps / K));
export type SmoothSnap = { z: number[]; p: number[]; gap: number; g0: number; loss: number };
/** Gradient descent on the three scores themselves (a simplification: a real head moves weights that make the scores). */
export function smoothRun(eps: number, steps = SMOOTH_STEPS, lr = SMOOTH_LR): SmoothSnap[] {
  const q = smoothTarget(eps), out: SmoothSnap[] = [];
  let z = [0, 0, 0];
  for (let t = 0; t <= steps; t++) {
    const p = softmax(z), g = p.map((v, i) => v - q[i]);
    out.push({ z: [...z], p, gap: z[0] - z[1], g0: g[0], loss: -q.reduce((s, qi, i) => s + qi * Math.log(p[i]), 0) });
    z = z.map((v, i) => v - lr * g[i]);
  }
  return out;
}

/* ---- 07 · learning by comparison: one triplet of two-number embeddings ---- */

export type V2 = [number, number];
/** a: the cat's head crop, p: the cat's legs-and-tail crop (same cat), n: the cup crop. Hand-set. */
export const EMB: { a: V2; p: V2; n: V2 } = { a: [-0.3, 0.2], p: [0, 0.1], n: [0.1, 0.4] };
export const MARGIN = 0.2;                       // FaceNet's α
export type TripletState = "base" | "shift" | "double" | "far" | "point";
export const SHIFT: V2 = [0.4, -0.3];
export const FAR_N: V2 = [0.5, 0.6];
export function tripletPoints(s: TripletState): { a: V2; p: V2; n: V2 } {
  const { a, p, n } = EMB;
  if (s === "shift") return { a: [a[0] + SHIFT[0], a[1] + SHIFT[1]], p: [p[0] + SHIFT[0], p[1] + SHIFT[1]], n: [n[0] + SHIFT[0], n[1] + SHIFT[1]] };
  if (s === "double") return { a: [2 * a[0], 2 * a[1]], p: [2 * p[0], 2 * p[1]], n: [2 * n[0], 2 * n[1]] };
  if (s === "far") return { a, p, n: FAR_N };
  if (s === "point") return { a: [0, 0.2], p: [0, 0.2], n: [0, 0.2] };
  return { a, p, n };
}
const d2 = (u: V2, v: V2) => (u[0] - v[0]) ** 2 + (u[1] - v[1]) ** 2;
/** FaceNet's triplet loss [‖a − p‖² − ‖a − n‖² + α]₊ and its gradients; also the pull-only loss ‖a − p‖². */
export function triplet(s: TripletState) {
  const { a, p, n } = tripletPoints(s), dap = d2(a, p), dan = d2(a, n), raw = dap - dan + MARGIN, on = raw > 0;
  const k = on ? 2 : 0;
  return {
    a, p, n, dap, dan, raw, loss: Math.max(0, raw), pull: dap,
    ga: [k * (n[0] - p[0]), k * (n[1] - p[1])] as V2,
    gp: [k * (p[0] - a[0]), k * (p[1] - a[1])] as V2,
    gn: [k * (a[0] - n[0]), k * (a[1] - n[1])] as V2,
  };
}

/* ---- 08 · several losses in one sum: units, weights, and why IoU does not care about size ---- */

export const LAMBDA_L1 = 5, LAMBDA_IOU = 2;      // DETR, appendix A.4
/** Name losses of the two objects: the cat from Z0, the cup from the batch of 02 (p = 0.9). */
export const NAME_LOSS = { cat: nll(softmax(Z0)[0]), cup: nll(0.9) };
export const SHIFTS = { near: 0.1, apart: 1.2 };  // the predicted box is the answer moved sideways by this share of its width (cat right, cup left)
const cxcywh = (b: Box) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2, b[2] - b[0], b[3] - b[1]];
export const shifted = (b: Box, f: number): Box => { const dx = f * (b[2] - b[0]); return [b[0] + dx, b[1], b[2] + dx, b[3]]; };
export function giou(a: Box, b: Box): number {
  const c = area([Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
  const i = area([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]);
  const u = area(a) + area(b) - i;
  return i / u - (c - u) / c;
}
export type BoxStats = { gt: Box; pred: Box; l1px: number; l1n: number; iou: number; giou: number; name: number; total: number; totalPx: number };
/** One object's terms at a picture scale k (1 = 160 px, 2 = 320 px). L1 on (cx, cy, w, h); normalized by the picture size as in DETR. */
export function boxStats(obj: "cat" | "cup", f: number, k = 1): BoxStats {
  const g0 = obj === "cat" ? GT_CAT : GT_CUP, gt = g0.map((v) => v * k) as Box, pred = shifted(gt, obj === "cat" ? f : -f);
  const a = cxcywh(gt), b = cxcywh(pred), l1px = a.reduce((s, v, i) => s + Math.abs(v - b[i]), 0), l1n = l1px / (IMG * k);
  const io = iou(gt, pred), gi = giou(gt, pred), name = NAME_LOSS[obj];
  return { gt, pred, l1px, l1n, iou: io, giou: gi, name, total: name + LAMBDA_L1 * l1n + LAMBDA_IOU * (1 - gi), totalPx: name + LAMBDA_L1 * l1px + LAMBDA_IOU * (1 - gi) };
}
