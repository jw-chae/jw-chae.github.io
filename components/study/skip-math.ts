/** Arithmetic behind the "skip" chapter: one token through a four-expert MoE layer, the counts, the balancing loss,
 *  MaskMoE, CartesianMoE and DSMoE on the same token, and one point walking a straight diffusion path with and without caching.
 *  Import-free so node can run it directly. Every toy number here is hand-set for the explanation. */

export type Vec = number[];
export type Mat = number[][];

export const matVec = (A: Mat, x: Vec): Vec => A.map((row) => row.reduce((s, v, j) => s + v * x[j], 0));
export const dot = (a: Vec, b: Vec) => a.reduce((s, v, i) => s + v * b[i], 0);
export const add = (a: Vec, b: Vec): Vec => a.map((v, i) => v + b[i]);
export const sub = (a: Vec, b: Vec): Vec => a.map((v, i) => v - b[i]);
export const scale = (a: Vec, k: number): Vec => a.map((v) => v * k);
export const norm = (a: Vec) => Math.sqrt(dot(a, a));
export const cosine = (a: Vec, b: Vec) => (norm(a) < 1e-12 || norm(b) < 1e-12 ? 0 : dot(a, b) / (norm(a) * norm(b)));
export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
export const relu = (z: number) => Math.max(0, z);
export function softmax(z: Vec): Vec {
  const m = Math.max(...z.filter((v) => Number.isFinite(v)));
  const e = z.map((v) => (Number.isFinite(v) ? Math.exp(v - m) : 0));
  const s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}

/* ------------------------------------------------------------------ */
/* 01 · one token, four experts, a router                               */
/* ------------------------------------------------------------------ */

/** The router: one row per expert. A token's score for expert i is row i times the token vector. */
export const ROUTER: Mat = [[1, 0.5], [-1, 0.5], [0.5, 1], [0, -1]];
/** Four experts. A real expert is a whole FFN; here each is one 2×2 table so the products can be done in the head. */
export const EXPERTS: Mat[] = [
  [[1, 0], [0, -1]],
  [[0.5, 0.5], [0.5, -0.5]],
  [[0, 1], [1, 0]],
  [[-1, 0.5], [0, 1]],
];
export const N_EXP = EXPERTS.length;
/** The token the chapter follows ("고양이"), and a second token used to ask "what if the token changes" ("달린다"). */
export const X_CAT: Vec = [1, 2];
export const X_RUN: Vec = [2, -2];

export type Route = {
  logits: Vec;        // router score per expert
  shares: Vec;        // softmax over all four: the router's share, sums to 1
  chosen: number[];   // top-k experts, highest score first
  weights: Vec;       // softmax over the chosen scores only (Softmax(TopK)), sums to 1 over the chosen
  outs: Vec[];        // every expert's output, as if all four were computed
  y: Vec;             // the layer output: weighted sum over the chosen experts only
  yAll: Vec;          // what the four would give with their full shares (the dense mixture)
};

/** Shazeer et al. 2017 and Mixtral: keep the top-k scores, softmax over those, add the chosen experts' outputs with those weights. */
export function route(x: Vec, k = 2, bias: Vec = [0, 0, 0, 0], mask: Vec = [0, 0, 0, 0]): Route {
  const logits = matVec(ROUTER, x).map((v, i) => v + bias[i] + mask[i]);
  const shares = softmax(logits);
  const order = logits.map((_, i) => i).filter((i) => Number.isFinite(logits[i])).sort((a, b) => logits[b] - logits[a]);
  const chosen = order.slice(0, k);
  const w = softmax(chosen.map((i) => logits[i]));
  const weights = logits.map((_, i) => (chosen.includes(i) ? w[chosen.indexOf(i)] : 0));
  const outs = EXPERTS.map((E) => matVec(E, x));
  const y = outs.reduce((s, o, i) => add(s, scale(o, weights[i])), [0, 0]);
  const yAll = outs.reduce((s, o, i) => add(s, scale(o, shares[i])), [0, 0]);
  return { logits, shares, chosen, weights, outs, y, yAll };
}

/* ------------------------------------------------------------------ */
/* 02 · stored versus computed                                          */
/* ------------------------------------------------------------------ */

/** Numbers kept in memory for this toy layer, and numbers a token multiplies with when k experts are called. */
export const TOY_STORED = ROUTER.length * ROUTER[0].length + EXPERTS.length * 4;
export const toyComputed = (k: number) => ROUTER.length * ROUTER[0].length + k * 4;

/** Mixtral 8x7B, Table 1 of the paper: dim 4096, 32 layers, hidden 14336, 8 experts, top-2. The paper reports 47B total and 13B active. */
export const MIXTRAL = { dim: 4096, layers: 32, hidden: 14336, experts: 8, topK: 2, reportedTotal: 47e9, reportedActive: 13e9 };
/** One SwiGLU expert holds three dim×hidden matrices. */
export const MIX_EXPERT = 3 * MIXTRAL.dim * MIXTRAL.hidden;
export const mixExperts = (k: number) => MIX_EXPERT * k * MIXTRAL.layers;
export const BYTES_16 = 2;

/* ------------------------------------------------------------------ */
/* 03 · eight tokens, top-1, and the balancing loss                     */
/* ------------------------------------------------------------------ */

/** Eight tokens of one batch. With no extra push each expert is the top choice of exactly two of them. */
export const TOKENS8: Vec[] = [X_CAT, X_RUN, [1.5, 0.5], [-2, 1], [0, 1.5], [-1, -2], [2, 0], [-1.5, 0]];
export const CAPACITY_FACTOR = 1;
export const CAPACITY = (TOKENS8.length / N_EXP) * CAPACITY_FACTOR;
export const ALPHA = 0.01;

export type Balance = { shares: Vec[]; pick: number[]; kept: boolean[]; f: Vec; P: Vec; loss: number; dropped: number; grad: number };

/** Switch Transformer: top-1, f_i = share of tokens whose top choice is i, P_i = mean router share for i, loss = N·Σ f_i·P_i (times α).
 *  `push` is an extra score added to expert 1 for every token: it stands for a router that has drifted towards one expert. */
export function balanceAt(push: number): Balance {
  const bias = [push, 0, 0, 0];
  const shares = TOKENS8.map((x) => softmax(matVec(ROUTER, x).map((v, i) => v + bias[i])));
  const pick = shares.map((p) => p.indexOf(Math.max(...p)));
  const used = new Array<number>(N_EXP).fill(0);
  const kept = pick.map((e) => (used[e]++ < CAPACITY));
  const T = TOKENS8.length;
  const f = Array.from({ length: N_EXP }, (_, i) => pick.filter((e) => e === i).length / T);
  const P = Array.from({ length: N_EXP }, (_, i) => shares.reduce((s, p) => s + p[i], 0) / T);
  const loss = N_EXP * f.reduce((s, v, i) => s + v * P[i], 0);
  // d loss / d push: only P depends on the push (f counts argmax and has no gradient). dp_i/dpush = p_i (δ_i0 − p_0).
  const grad = N_EXP * f.reduce((s, fi, i) => s + fi * shares.reduce((q, p) => q + p[i] * ((i === 0 ? 1 : 0) - p[0]), 0) / T, 0);
  return { shares, pick, kept, f, P, loss, dropped: kept.filter((k) => !k).length, grad };
}
export const PUSHES = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4];

/* ------------------------------------------------------------------ */
/* 04 · MaskMoE: where the occurrences of one token go during training  */
/* ------------------------------------------------------------------ */

/** A rare token ("삵") and the frequent one ("고양이"). */
export const X_RARE: Vec = [0.5, 1.5];
/** Which expert each occurrence went to during training, hand-set to show routing fluctuation under a learned router. */
export const OCC: Record<"rare" | "freq", Record<"learned" | "hash" | "mask", number[]>> = {
  rare: { learned: [2, 0, 2, 1], hash: [1, 1, 1, 1], mask: [1, 1, 1, 1] },
  freq: { learned: [2, 0, 2, 2, 1, 0, 2, 3, 0, 2, 0, 2], hash: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3], mask: [2, 0, 2, 2, 0, 0, 2, 2, 0, 2, 0, 2] },
};
/** The fixed masks drawn before training: 0 for a visible expert, −∞ for a hidden one. Rare: one visible expert. Frequent: two of four. */
export const MASKS: Record<"rare" | "freq", Vec> = { rare: [-Infinity, 0, -Infinity, -Infinity], freq: [0, -Infinity, 0, -Infinity] };
export const countOcc = (occ: number[]) => Array.from({ length: N_EXP }, (_, i) => occ.filter((e) => e === i).length);

/* ------------------------------------------------------------------ */
/* 05 · CartesianMoE: two sub-expert sets in sequence                   */
/* ------------------------------------------------------------------ */

export const SUB_A: Mat[] = [[[2, 0], [0, 0]], [[0, 0], [0, 1]]];
export const SUB_B: Mat[] = [[[0.5, 0], [0, -0.5]], [[0, 0.5], [0.5, 0]]];
export const ROUTER_A: Mat = [[1, 0], [0, 1]];
export const ROUTER_B: Mat = [[1, -1], [-1, 1]];
const top1 = (R: Mat, x: Vec) => { const l = matVec(R, x); return l[0] >= l[1] ? 0 : 1; };

export type Cart = { a: number; b: number; aOut: Vec; mid: Vec; bIn: Vec; bOut: Vec; y: Vec };
/** Flat fine-grained experts (DeepSeekMoE form, Eq. 13 of the paper): both groups read the same input x and their outputs are added.
 *  CartesianMoE (Eq. 6 to 10): the B group reads the A group's result h̄ = x + A(x), has its own router, and adds on top of h̄.
 *  `forceA` fixes the A choice so the reader can see what changes downstream. One expert per group, weight 1. */
export function cartesian(x: Vec, kind: "flat" | "cart", forceA?: number, forceB?: number): Cart {
  const a = forceA ?? top1(ROUTER_A, x);
  const aOut = matVec(SUB_A[a], x);
  const mid = add(x, aOut);
  const bIn = kind === "flat" ? x : mid;
  const b = forceB ?? top1(ROUTER_B, bIn);
  const bOut = matVec(SUB_B[b], bIn);
  return { a, b, aOut, mid, bIn, bOut, y: add(mid, bOut) };
}
/** The paper's setting: 16 sub-experts in each of the two groups. */
export const CART_PAPER = { perGroup: 16, stored: 32, combos: 16 * 16 };

/* ------------------------------------------------------------------ */
/* 06 · DSMoE: cutting one trained FFN into blocks                      */
/* ------------------------------------------------------------------ */

/** A trained dense FFN: 2 numbers in, 4 hidden units with ReLU, 2 numbers out. LLaMA uses SwiGLU; the cut along the hidden units is the same. */
export const FFN_W: Mat = [[1, 0], [0, 0.5], [-0.5, 0.5], [1, -1]];
export const FFN_V: Mat = [[1, 0.5, 0.4, -0.5], [0.5, 1, -0.4, 0.5]];
/** Two blocks of two hidden units each, and the gate that scores each block from the token. */
export const BLOCKS = [[0, 1], [2, 3]];
export const GATE_Y: Mat = [[0.5, 0.25], [1, -1]];
export const TAU = 0.5;

export type Dense = { hidden: Vec; full: Vec; blockOut: Vec[]; gate: Vec; on: boolean[]; y: Vec; scaleBy: number };
/** Eq. 6: the block outputs add up to the dense output exactly. Eq. 7 and 8: keep a block only when its sigmoid gate exceeds τ,
 *  multiply it by the gate, then scale the sum by (number of blocks) / (number kept). */
export function dsmoe(x: Vec): Dense {
  const hidden = matVec(FFN_W, x).map(relu);
  const colPart = (cols: number[]) => FFN_V.map((row) => cols.reduce((s, j) => s + row[j] * hidden[j], 0));
  const full = colPart([0, 1, 2, 3]);
  const blockOut = BLOCKS.map(colPart);
  const gate = matVec(GATE_Y, x).map(sigmoid);
  const on = gate.map((g) => g > TAU);
  const kept = on.filter(Boolean).length;
  const scaleBy = kept > 0 ? BLOCKS.length / kept : 0;
  const y = scale(blockOut.reduce((s, o, i) => (on[i] ? add(s, scale(o, gate[i])) : s), [0, 0]), scaleBy);
  return { hidden, full, blockOut, gate, on, y, scaleBy };
}

/* ------------------------------------------------------------------ */
/* 07 to 09 · one point on a straight diffusion path                    */
/* ------------------------------------------------------------------ */

/** The training pictures as two blobs in the plane: group A upper left, group B lower right, each a Gaussian of spread BLOB_SD. */
export const BLOBS: Vec[] = [[-0.8, 0.7], [0.75, -0.65]];
export const BLOB_SD = 0.22;
export const STEPS = 20;
export const DT = 1 / STEPS;
/** t at the start of step k: 1, 0.95, ..., 0.05. */
export const tAt = (k: number) => 1 - k * DT;

/** Straight path x_t = (1 − t)·x0 + t·ε (the generative chapter's straight path). With the blobs known, the best guess of x0 has a closed
 *  form: each blob's own guess, mixed by the blob's share. The best velocity is v = (x_t − x0̂)/t. `only` keeps one blob (the conditional branch). */
export function velocity(x: Vec, t: number, only?: number): { x0: Vec; v: Vec; shares: Vec } {
  const s2 = (1 - t) ** 2 * BLOB_SD ** 2 + t * t;
  const logw = BLOBS.map((m, g) => (only === undefined || only === g ? -(norm(sub(x, scale(m, 1 - t))) ** 2) / (2 * s2) : -Infinity));
  const shares = softmax(logw);
  const gain = ((1 - t) * BLOB_SD ** 2) / s2;
  const x0 = BLOBS.reduce((acc, m, g) => add(acc, scale(add(m, scale(sub(x, scale(m, 1 - t)), gain)), shares[g])), [0, 0]);
  return { x0, v: scale(sub(x, x0), 1 / t), shares };
}

/** The starting point the chapter follows, as if drawn from the Gaussian; fixed so the figures are the same on every visit. */
export const START: Vec = [0.35, 0.3];
/** 200 more starting points from a seeded Gaussian, used only for the averages quoted in the text. */
export const MANY: Vec[] = (() => {
  let a = 12345;
  const rnd = () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; };
  const g = () => Math.sqrt(-2 * Math.log(Math.max(rnd(), 1e-12))) * Math.cos(2 * Math.PI * rnd());
  return Array.from({ length: 200 }, () => [g(), g()]);
})();

export type Walk = { xs: Vec[]; us: Vec[]; fresh: boolean[]; calls: number };
/** Euler steps x_{k+1} = x_k − Δt·u_k. `full[k]` says whether the network is called at step k; otherwise the last computed u is reused. */
export function walk(x0: Vec, full: boolean[], guide?: { s: number; group: number }): Walk {
  let x = [...x0];
  const xs: Vec[] = [[...x]], us: Vec[] = [], fresh: boolean[] = [];
  let last: Vec = [0, 0];
  let calls = 0;
  for (let k = 0; k < STEPS; k++) {
    const t = tAt(k);
    if (full[k] || k === 0) { last = predict(x, t, guide); calls += guide ? 2 : 1; fresh.push(true); } else fresh.push(false);
    us.push(last);
    x = sub(x, scale(last, DT));
    xs.push([...x]);
  }
  return { xs, us, fresh, calls };
}

/** The prediction the sampler consumes: plain velocity, or under classifier-free guidance p = u + s·(c − u). */
export function predict(x: Vec, t: number, guide?: { s: number; group: number }): Vec {
  const u = velocity(x, t).v;
  if (!guide) return u;
  const c = velocity(x, t, guide.group).v;
  return add(u, scale(sub(c, u), guide.s));
}

const at = (list: number[]) => Array.from({ length: STEPS }, (_, k) => list.includes(k));
export type SchedKey = "all" | "two" | "three" | "early" | "late";
/** Which steps call the network. "three", "early" and "late" all call it 7 times; they differ only in where the 7 calls go. */
export const SCHEDULES: Record<SchedKey, boolean[]> = {
  all: at(Array.from({ length: STEPS }, (_, k) => k)),
  two: at(Array.from({ length: STEPS }, (_, k) => k).filter((k) => k % 2 === 0)),
  three: at([0, 3, 6, 9, 12, 15, 18]),
  early: at([0, 1, 2, 3, 4, 5, 6]),
  late: at([0, 7, 10, 12, 13, 15, 18]),
};

const endDev = (w: { xs: Vec[] }, ref: { xs: Vec[] }) => norm(sub(w.xs[STEPS], ref.xs[STEPS]));
/** Over the 200 extra starts: mean distance between where the cached walk and the full walk end, and how often they end in different blobs. */
export function scheduleStudy(key: SchedKey): { calls: number; meanDev: number; flips: number } {
  let s = 0, flips = 0, calls = 0;
  MANY.forEach((x) => {
    const ref = walk(x, SCHEDULES.all), w = walk(x, SCHEDULES[key]);
    s += endDev(w, ref); calls = w.calls;
    if (blobOf(w.xs[STEPS]) !== blobOf(ref.xs[STEPS])) flips++;
  });
  return { calls, meanDev: s / MANY.length, flips };
}

/** Which blob a point ended in (by distance to the blob centre). */
export const blobOf = (p: Vec) => (norm(sub(p, BLOBS[0])) <= norm(sub(p, BLOBS[1])) ? 0 : 1);

/* ---- 08 · PoSTCache: revise the skipped predictions once the next anchor is computed ---- */

export type Smooth = { xs: Vec[]; us: Vec[]; fresh: boolean[]; calls: number; forward: Walk };
/** Anchors every `gap` steps. Between anchors a and b the forward pass reuses u_a (the default proposal). At b the network gives ū_b at
 *  the forward state; the anchor innovation r_b = ū_b − u_a is spread back with weight (k − a)/(b − a), the corrected predictions are
 *  re-integrated from x_a, and ū_b is kept for step b without calling the network again. */
export function smoothWalk(x0: Vec, gap: number): Smooth {
  const forward = walk(x0, Array.from({ length: STEPS }, (_, k) => k % gap === 0));
  let x = [...x0];
  const xs: Vec[] = [[...x]], us: Vec[] = [], fresh: boolean[] = [];
  let calls = 0;
  let a = 0, ua = predict(x, tAt(0));
  calls += 1;
  us.push(ua); fresh.push(true);
  // walk interval by interval
  while (a < STEPS) {
    const b = Math.min(a + gap, STEPS);
    // forward proposals from the anchor a: reuse u_a, which carries the state to x_b
    let xf = [...xs[a]];
    for (let j = a; j < b; j++) xf = sub(xf, scale(ua, DT));
    if (b >= STEPS) {
      // no future anchor: the last interval keeps the forward proposal
      for (let j = a; j < b; j++) { if (j > a) { us.push(ua); fresh.push(false); } x = sub(x, scale(ua, DT)); xs.push([...x]); }
      break;
    }
    const ub = predict(xf, tAt(b));
    calls += 1;
    const innov = sub(ub, ua);
    // re-integrate from x_a with corrected predictions for a < j < b; step a keeps its computed prediction
    x = [...xs[a]];
    for (let j = a; j < b; j++) {
      const w = (j - a) / (b - a);
      const uj = j === a ? ua : add(ua, scale(innov, w));
      if (j > a) { us.push(uj); fresh.push(false); }
      x = sub(x, scale(uj, DT));
      xs.push([...x]);
    }
    us.push(ub); fresh.push(true);
    a = b; ua = ub;
  }
  return { xs, us: us.slice(0, STEPS), fresh: fresh.slice(0, STEPS), calls, forward };
}

/** Over the 200 extra starts: mean end deviation with plain reuse and with the smoothing correction, same anchors, same calls. */
export function smoothStudy(gap: number): { calls: number; reuse: number; smooth: number; better: number } {
  let r = 0, m = 0, better = 0, calls = 0;
  MANY.forEach((x) => {
    const ref = walk(x, SCHEDULES.all), sm = smoothWalk(x, gap);
    const a = endDev(sm.forward, ref), b = endDev(sm, ref);
    r += a; m += b; if (b < a) better++; calls = sm.calls;
  });
  return { calls, reuse: r / MANY.length, smooth: m / MANY.length, better };
}

/* ---- 09 · RA-CFGCache: two branches, one guided prediction ---- */

export const GUIDE = { s: 3, group: 0 };

export type BranchErr = { du: Vec; dc: Vec; dp: Vec; rho: number; branch: number; guided: number };
/** Reuse both branches from step k−1 at step k, at the same current point: δu, δc, and the guided error δp = (1 − s)·δu + s·δc. */
export function branchError(xs: Vec[], k: number, s = GUIDE.s): BranchErr {
  const x = xs[k], t = tAt(k), tp = tAt(k - 1), xp = xs[k - 1];
  const u = velocity(x, t).v, c = velocity(x, t, GUIDE.group).v;
  const uOld = velocity(xp, tp).v, cOld = velocity(xp, tp, GUIDE.group).v;
  const du = sub(uOld, u), dc = sub(cOld, c);
  const dp = add(scale(du, 1 - s), scale(dc, s));
  return { du, dc, dp, rho: cosine(du, dc), branch: (norm(du) + norm(dc)) / 2, guided: norm(dp) };
}

export type Control = { xs: Vec[]; fresh: boolean[]; calls: number; risk: number[] };
/** An accumulate-and-refresh controller under CFG (the shape of RA-CFGCache's Eq. 14 and 15). At each step the risk of reusing the anchor's
 *  two branches is measured, added to R, and both branches are recomputed when R would pass τ. Here the risk is measured with the true
 *  branch errors (an oracle the real method does not have): "branch" uses the mean of the two branch errors, "guided" uses ‖δp‖ times the
 *  propagation gain of that step. */
export function controlWalk(x0: Vec, crit: "branch" | "guided", tau: number, gains: number[]): Control {
  const s = GUIDE.s, grp = GUIDE.group;
  let x = [...x0];
  const xs: Vec[] = [[...x]], fresh: boolean[] = [], risk: number[] = [];
  let cu: Vec = [0, 0], cc: Vec = [0, 0], R = 0, calls = 0;
  for (let k = 0; k < STEPS; k++) {
    const t = tAt(k);
    const u = velocity(x, t).v, c = velocity(x, t, grp).v;
    let use: Vec;
    if (k === 0) { cu = u; cc = c; use = add(u, scale(sub(c, u), s)); fresh.push(true); calls += 2; risk.push(0); }
    else {
      const du = sub(cu, u), dc = sub(cc, c);
      const d = crit === "branch" ? (norm(du) + norm(dc)) / 2 : norm(add(scale(du, 1 - s), scale(dc, s))) * gains[k];
      if (R + d > tau) { cu = u; cc = c; R = 0; fresh.push(true); calls += 2; risk.push(d); }
      else { R += d; fresh.push(false); risk.push(d); }
      use = add(cu, scale(sub(cc, cu), s));
    }
    x = sub(x, scale(use, DT));
    xs.push([...x]);
  }
  return { xs, fresh, calls, risk };
}

/** Mean propagation gain per step over the first `n` extra starts (step 0 is always computed and gets 0). */
export function meanGains(n = 40): number[] {
  return Array.from({ length: STEPS }, (_, k) => (k === 0 ? 0 : MANY.slice(0, n).reduce((s, x) => s + gainAt(x, k).gain, 0) / n));
}

/** τ that makes the controller refresh exactly `refreshes` times on one start (bisection on τ; more τ, fewer refreshes). */
export function tauFor(x0: Vec, crit: "branch" | "guided", refreshes: number, gains: number[]): number {
  let lo = 0, hi = 10;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (controlWalk(x0, crit, mid, gains).calls / 2 > refreshes) lo = mid; else hi = mid;
  }
  return hi;
}

/** Over the 200 extra starts: mean network calls and mean end deviation from the fully computed guided walk. */
export function cfgStudy(crit: "branch" | "guided", tau: number, gains: number[]): { calls: number; dev: number } {
  let c = 0, d = 0;
  MANY.forEach((x) => { const ref = walk(x, SCHEDULES.all, GUIDE), w = controlWalk(x, crit, tau, gains); c += w.calls; d += endDev(w, ref); });
  return { calls: c / MANY.length, dev: d / MANY.length };
}

/** τ that makes the mean number of calls over the 200 starts equal `calls` (bisection). */
export function tauForMean(crit: "branch" | "guided", calls: number, gains: number[]): number {
  let lo = 0, hi = 10;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (cfgStudy(crit, mid, gains).calls > calls) lo = mid; else hi = mid;
  }
  return hi;
}

/** Isolated one-step perturbation (the paper's probe): reuse both branches only at step k, compute every other step fully.
 *  Gain = final deviation / local guided error. */
export function gainAt(x0: Vec, k: number): { local: number; final: number; gain: number } {
  const ref = walk(x0, SCHEDULES.all, GUIDE);
  const full = SCHEDULES.all.map((_, j) => j !== k);
  const per = walk(x0, full, GUIDE);
  const local = branchError(ref.xs, k).guided;
  const fin = norm(sub(per.xs[STEPS], ref.xs[STEPS]));
  return { local, final: fin, gain: local > 1e-12 ? fin / local : 0 };
}
