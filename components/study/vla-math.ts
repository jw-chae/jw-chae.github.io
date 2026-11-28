/** Arithmetic behind the VLA study scenes. One table seen from above, one two-finger gripper,
 *  a red cup, a blue cup, a vase in the way and a plate. Every number is hand-set for illustration
 *  (centimetres, one step = 0.1 s) and computed here; nothing is measured on a robot. */

export type P = [number, number];
/** One action: how far the gripper moves this step, and whether it should be closed (1) or open (0) after it. */
export type Act = { dx: number; dy: number; g: 0 | 1 };
/** One recorded step: where the gripper was when the camera took the picture, and the action taken from there. */
export type Step = { p: P; a: Act };
export type Run = { steps: Step[]; end: P };
export type Seg = { to: P } | { grip: 0 | 1 };

export const HZ = 10;          // decisions per second in the toy
export const STEP = 2;         // the gripper moves at most 2 cm per step
export const TABLE = { w: 60, h: 40 };
export const START: P = [8, 20];
export const VASE = { x: 30, y: 20, r: 5 };
export const GRIP_R = 2;
export const CLEAR = VASE.r + GRIP_R;   // the gripper's centre must stay this far from the vase's centre
export const RED: P = [50, 20];
export const BLUE: P = [46, 6];
export const PLATE: P = [38, 34];
export const CUP_R = 2.5;
export const PLATE_R = 4.5;

const mirror = (p: P): P => [p[0], TABLE.h - p[1]];
/** The demonstrator's two ways around the vase: over it (y up) and under it. */
export const WAY_OVER: P[] = [[16, 20], [28, 29], [32, 29], [44, 20]];
export const WAY_UNDER: P[] = WAY_OVER.map(mirror);
export const taskSegs = (way: P[], cup: P): Seg[] => [...way.map((to) => ({ to })), { to: cup }, { grip: 1 }, { to: PLATE }, { grip: 0 }];

/** Execute a list of targets at no more than STEP cm per step, recording the picture-time position and the action. */
export function rollout(start: P, segs: Seg[], g0: 0 | 1 = 0): Run {
  const steps: Step[] = [];
  let p: P = [start[0], start[1]];
  let g = g0;
  for (const s of segs) {
    if ("grip" in s) {
      g = s.grip;
      steps.push({ p: [p[0], p[1]], a: { dx: 0, dy: 0, g } });
      continue;
    }
    for (;;) {
      const ex = s.to[0] - p[0], ey = s.to[1] - p[1], d = Math.hypot(ex, ey);
      if (d < 1e-6) break;
      const k = Math.min(1, STEP / d);
      const a: Act = { dx: ex * k, dy: ey * k, g };
      steps.push({ p: [p[0], p[1]], a });
      p = [p[0] + a.dx, p[1] + a.dy];
    }
  }
  return { steps, end: p };
}

export const positions = (r: Run): P[] => [...r.steps.map((s) => s.p), r.end];
export const distVase = (p: P) => Math.hypot(p[0] - VASE.x, p[1] - VASE.y);
export const hitsVase = (p: P) => distVase(p) < CLEAR;

export const OVER = rollout(START, taskSegs(WAY_OVER, RED));
export const UNDER = rollout(START, taskSegs(WAY_UNDER, RED));
export const BLUE_RUN = rollout(START, taskSegs([], BLUE));

/* ---- 01 · one step of the loop, and one training example ---- */

export const sqErr = (a: Act, b: Act) => (a.dx - b.dx) ** 2 + (a.dy - b.dy) ** 2;
/** What an untrained model might say at the first picture (hand-set), against the demonstrator's answer. */
export const PRED0: Act = { dx: 1.8, dy: 0.3, g: 0 };
export const LOSS0 = sqErr(PRED0, OVER.steps[0].a);
export const seconds = (r: Run) => r.steps.length / HZ;

/* ---- 02 · two demonstrations part at the vase; the squared error prefers their average ---- */

/** The step index at which the two demonstrations take different actions from the same picture. */
export const BRANCH_AT = OVER.steps.findIndex((s, i) => s.a.dy !== UNDER.steps[i].a.dy);
export const BRANCH: P = OVER.steps[BRANCH_AT].p;
export const A_OVER = OVER.steps[BRANCH_AT].a;
export const A_UNDER = UNDER.steps[BRANCH_AT].a;
export const meanAct = (a: Act, b: Act): Act => ({ dx: (a.dx + b.dx) / 2, dy: (a.dy + b.dy) / 2, g: a.g });
export const A_MEAN = meanAct(A_OVER, A_UNDER);
/** Average squared error of one prediction over the two demonstrations at the fork. */
export const mseVsDemos = (pred: Act) => (sqErr(pred, A_OVER) + sqErr(pred, A_UNDER)) / 2;

/** Follow the average of the two demonstrations step by step until the gripper hits the vase. */
export function meanRollout(): { path: P[]; hit: number } {
  const path: P[] = [[START[0], START[1]]];
  let p: P = [START[0], START[1]];
  for (let t = 0; t < OVER.steps.length; t++) {
    const a = meanAct(OVER.steps[t].a, UNDER.steps[t].a);
    p = [p[0] + a.dx, p[1] + a.dy];
    path.push(p);
    if (hitsVase(p)) return { path, hit: t };
  }
  return { path, hit: -1 };
}
export const MEAN_RUN = meanRollout();

/* ---- 03 · actions as tokens: 256 bins per number ---- */

export const BIN_LO = -2.5, BIN_HI = 2.5, BINS = 256;
export const binOf = (v: number, n = BINS, lo = BIN_LO, hi = BIN_HI) => Math.min(n - 1, Math.max(0, Math.floor(((v - lo) / (hi - lo)) * n)));
export const binCenter = (i: number, n = BINS, lo = BIN_LO, hi = BIN_HI) => lo + ((i + 0.5) * (hi - lo)) / n;
export const binWidth = (n = BINS, lo = BIN_LO, hi = BIN_HI) => (hi - lo) / n;
/** Three tokens per action: Δx, Δy, then the gripper (open = the lowest bin, closed = the highest). */
export const tokensOf = (a: Act, n = BINS) => [binOf(a.dx, n), binOf(a.dy, n), a.g ? n - 1 : 0];
/** Cross-entropy averaged over the two demonstrations at the fork, if the model puts pOver on the "over" bin. */
export const ceAtFork = (pOver: number) => (-Math.log(pOver) - Math.log(1 - pOver)) / 2;

/* ---- 04 · action chunking: decide every k steps, and what happens when the cup is pushed ---- */

export const CHUNKS = [1, 5, 10, 20];
export const P_OFF = 0.02;   // hand-set chance that one decision leaves the demonstrations
export const decisions = (n: number, k: number) => Math.ceil(n / k);
export const stayOn = (n: number) => (1 - P_OFF) ** n;
export const PUSH_T = 21;           // the cup is pushed just before the picture of step 21
export const PUSHED: P = [50, 12];

type World = { p: P; g: 0 | 1; holding: boolean; cup: P };
/** The demonstrator's plan from wherever the gripper is: around the vase if not past it, then the cup, the plate. */
function planFrom(w: World): Seg[] {
  if (w.holding) return [{ to: PLATE }, { grip: 0 }];
  const segs: Seg[] = [];
  if (w.g === 1) segs.push({ grip: 0 });
  if (w.p[0] < WAY_OVER[2][0]) for (const q of WAY_OVER) if (q[0] > w.p[0] + 1e-6) segs.push({ to: q });
  segs.push({ to: w.cup }, { grip: 1 }, { to: PLATE }, { grip: 0 });
  return segs;
}

export type ChunkStep = { p: P; a: Act; t: number; blind: boolean };
export type ChunkRun = { steps: ChunkStep[]; end: P; decided: number[]; airGrasp: number[]; done: number; cupEnd: P };

/** Run the demonstrator's plan, but only look at the picture every k steps; in between, play the stored actions. */
export function chunkRun(k: number, push: boolean, maxT = 90): ChunkRun {
  const w: World = { p: [START[0], START[1]], g: 0, holding: false, cup: [RED[0], RED[1]] };
  let queue: Act[] = [];
  let last = -1;
  const steps: ChunkStep[] = [], decided: number[] = [], airGrasp: number[] = [];
  let done = -1;
  for (let t = 0; t < maxT; t++) {
    if (push && t === PUSH_T && !w.holding) w.cup = [PUSHED[0], PUSHED[1]];
    if (t % k === 0) {
      queue = rollout(w.p, planFrom(w), w.g).steps.slice(0, k).map((s) => s.a);
      decided.push(t);
      last = t;
    }
    const a = queue.shift() ?? { dx: 0, dy: 0, g: w.g };
    steps.push({ p: [w.p[0], w.p[1]], a, t, blind: push && t >= PUSH_T && last < PUSH_T });
    const before = w.g;
    w.p = [w.p[0] + a.dx, w.p[1] + a.dy];
    w.g = a.g;
    if (w.holding) w.cup = [w.p[0], w.p[1]];
    if (before === 0 && w.g === 1) {
      if (Math.hypot(w.p[0] - w.cup[0], w.p[1] - w.cup[1]) < 0.5) w.holding = true;
      else airGrasp.push(t);
    }
    if (before === 1 && w.g === 0 && w.holding) {
      w.holding = false;
      if (Math.hypot(w.p[0] - PLATE[0], w.p[1] - PLATE[1]) < 0.5) { done = t + 1; break; }
    }
  }
  return { steps, end: w.p, decided, airGrasp, done, cupEnd: w.cup };
}

/* ---- 05 · flow matching: noise becomes one whole chunk of 16 actions ---- */

export const H = 16;
const chunkOf = (r: Run) => r.steps.slice(BRANCH_AT, BRANCH_AT + H).flatMap((s) => [s.a.dx, s.a.dy]);
export const MU_OVER = chunkOf(OVER);
export const MU_UNDER = chunkOf(UNDER);
export const MU_MEAN = MU_OVER.map((v, i) => (v + MU_UNDER[i]) / 2);
export const S_DATA = 0.05;     // spread of the demonstrations around each way, hand-set
export const FLOW_STEPS = 10;

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
export const noiseChunk = (seed: number) => { const r = mulberry(seed * 7919 + 17); return Array.from({ length: 2 * H }, () => gauss(r)); };

/** The exact velocity for x_τ = (1 − τ)·ε + τ·A with A from two equally likely ways (each with spread S_DATA):
 *  the average of (A − ε) over everything that could have produced x at time τ. A trained network approximates this. */
export function velocity(x: number[], tau: number): { v: number[]; wOver: number } {
  const s2 = S_DATA * S_DATA, V = (1 - tau) ** 2 + tau * tau * s2, c = (tau * s2 - (1 - tau)) / V;
  const d2 = (mu: number[]) => x.reduce((s, xi, i) => s + (xi - tau * mu[i]) ** 2, 0);
  const lo = -d2(MU_OVER) / (2 * V), lu = -d2(MU_UNDER) / (2 * V), m = Math.max(lo, lu);
  const wo = Math.exp(lo - m), wu = Math.exp(lu - m), wOver = wo / (wo + wu);
  const v = x.map((xi, i) => wOver * (MU_OVER[i] + c * (xi - tau * MU_OVER[i])) + (1 - wOver) * (MU_UNDER[i] + c * (xi - tau * MU_UNDER[i])));
  return { v, wOver };
}

export type FlowSample = { xs: number[][]; w: number[]; over: boolean };
/** Ten Euler steps from noise at τ = 0 to a chunk at τ = 1. xs[j] is the chunk after j steps. */
export function flowSample(seed: number): FlowSample {
  let x = noiseChunk(seed);
  const xs = [x], w: number[] = [];
  for (let j = 0; j < FLOW_STEPS; j++) {
    const { v, wOver } = velocity(x, j / FLOW_STEPS);
    w.push(wOver);
    x = x.map((xi, i) => xi + v[i] / FLOW_STEPS);
    xs.push(x);
  }
  const dySum = x.reduce((s, v, i) => (i % 2 ? s + v : s), 0);
  return { xs, w, over: dySum > 0 };
}
export const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];
export const FLOWS = SEEDS.map(flowSample);
/** A chunk of actions drawn as the path it would drive from the fork. */
export function chunkPath(x: number[], from: P = BRANCH): P[] {
  const out: P[] = [[from[0], from[1]]];
  for (let i = 0; i < H; i++) { const q = out[out.length - 1]; out.push([q[0] + x[2 * i], q[1] + x[2 * i + 1]]); }
  return out;
}
export const firstHit = (path: P[]) => path.findIndex(hitsVase);

/* ---- 06 · FAST: a chunk of one action number, rewritten as cosine coefficients ---- */

/** Δy over eight steps of a smooth turn at a high control rate, hand-set. */
export const SIG = [0, 0.15, 0.4, 0.7, 0.95, 1.1, 1.18, 1.2];
export function dct(x: number[]) {
  const n = x.length;
  return x.map((_, k) => Math.sqrt((k === 0 ? 1 : 2) / n) * x.reduce((s, v, i) => s + v * Math.cos((Math.PI * (2 * i + 1) * k) / (2 * n)), 0));
}
export function idct(c: number[]) {
  const n = c.length;
  return c.map((_, i) => c.reduce((s, v, k) => s + Math.sqrt((k === 0 ? 1 : 2) / n) * v * Math.cos((Math.PI * (2 * i + 1) * k) / (2 * n)), 0));
}
export const GAMMAS = [1, 10, 100];   // FAST uses 10 by default
export const SIG_DCT = dct(SIG);
export function fastQuant(gamma: number) {
  const q = SIG_DCT.map((v) => Math.round(v * gamma));
  const rec = idct(q.map((v) => v / gamma));
  const err = Math.max(...rec.map((v, i) => Math.abs(v - SIG[i])));
  return { q, rec, err, nonzero: q.filter((v) => v !== 0).length };
}
export const NAIVE_TOK = SIG.map((v) => binOf(v));
export const NAIVE_DIFF = NAIVE_TOK.slice(1).map((v, i) => v - NAIVE_TOK[i]);

/* ---- 07 · what each way of writing actions costs for one second of control in the toy ---- */

export type Method = { key: "reg" | "tok" | "flow" | "fast"; reads: number; calls: number };
/** reads: times per second the big model reads a new picture; calls: further passes per second (token steps or flow steps). */
export const METHODS: Method[] = [
  { key: "reg", reads: HZ, calls: 0 },
  { key: "tok", reads: HZ, calls: HZ * 3 },
  { key: "flow", reads: 1, calls: FLOW_STEPS },
  { key: "fast", reads: 1, calls: 3 * fastQuant(10).nonzero },
];
