/** Arithmetic behind the diffusion study scenes.
 *  The toy data is a mixture of small Gaussian blobs, so the ideal denoiser E[x0 | x_t] has a closed form
 *  and every arrow and every sample on screen is computed exactly, with no trained network. */

export type P2 = [number, number];

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One standard normal draw (Box–Muller). */
export const normal = (r: () => number) => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());

export const normalPdf = (x: number, mu = 0, sd = 1) => Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));

/* ---- 01 · a distribution and samples from it ---- */

export type Dist1 = { name: string; pdf: (x: number) => number; draw: (r: () => number) => number; mean: number; sd: number };
export const BELL: Dist1 = { name: "bell", pdf: (x) => normalPdf(x, 0, 1), draw: (r) => normal(r), mean: 0, sd: 1 };
/** Two bumps: 40% around −1.4, 60% around +1.1. */
export const TWO_BUMPS: Dist1 = {
  name: "two",
  pdf: (x) => 0.4 * normalPdf(x, -1.4, 0.45) + 0.6 * normalPdf(x, 1.1, 0.6),
  draw: (r) => (r() < 0.4 ? -1.4 + 0.45 * normal(r) : 1.1 + 0.6 * normal(r)),
  mean: 0.4 * -1.4 + 0.6 * 1.1,
  sd: Math.sqrt(0.4 * (0.45 ** 2 + 1.4 ** 2) + 0.6 * (0.6 ** 2 + 1.1 ** 2) - (0.4 * -1.4 + 0.6 * 1.1) ** 2),
};

export function drawSamples(d: Dist1, n: number, seed: number): number[] {
  const r = mulberry(seed);
  return Array.from({ length: n }, () => d.draw(r));
}

export function stats(xs: number[]): { mean: number; sd: number } {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return { mean, sd: Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length) };
}

export function histogram(xs: number[], lo: number, hi: number, bins: number): number[] {
  const h = new Array<number>(bins).fill(0), w = (hi - lo) / bins;
  for (const x of xs) {
    const i = Math.floor((x - lo) / w);
    if (i >= 0 && i < bins) h[i]++;
  }
  return h.map((c) => c / (xs.length * w));      // density, so it can sit under the pdf curve
}

/* ---- 02 · many small random pushes add up to a bell ---- */

/** paths[p][k] = position of particle p after k pushes of ±1 (fair coin). */
export function walkPaths(particles: number, steps: number, seed: number): number[][] {
  const r = mulberry(seed);
  return Array.from({ length: particles }, () => {
    const path = [0];
    for (let k = 1; k <= steps; k++) path.push(path[k - 1] + (r() < 0.5 ? -1 : 1));
    return path;
  });
}

/* ---- 03 · guessing the cause from the observation ---- */

/** Two sources at −1 (A) and +1 (B); each emits its value plus N(0, σ²) noise. */
export function posterior(x: number, sigma: number, priorA: number): { likeA: number; likeB: number; pA: number; pB: number; mean: number } {
  const likeA = normalPdf(x, -1, sigma), likeB = normalPdf(x, 1, sigma);
  const a = priorA * likeA, b = (1 - priorA) * likeB;
  const pA = a / (a + b);
  return { likeA, likeB, pA, pB: 1 - pA, mean: pA * -1 + (1 - pA) * 1 };
}

/* ---- 04 · the forward process ---- */

export type Schedule = { T: number; beta: number[]; alpha: number[]; abar: number[] };

/** Linear β schedule. Index 0 is the clean data: beta[0] = 0, abar[0] = 1. */
export function makeSchedule(T: number, b0: number, b1: number): Schedule {
  const beta = [0], alpha = [1], abar = [1];
  for (let t = 1; t <= T; t++) {
    const b = b0 + ((b1 - b0) * (t - 1)) / (T - 1);
    beta.push(b); alpha.push(1 - b); abar.push(abar[t - 1] * (1 - b));
  }
  return { T, beta, alpha, abar };
}

/** The schedule of the DDPM paper: 1000 steps, β from 0.0001 to 0.02. */
export const DDPM = makeSchedule(1000, 1e-4, 0.02);
/** A short schedule for the 2-D toy so every step is visible. */
export const TOY = makeSchedule(40, 0.004, 0.25);

/* ---- 05–07 · the exact denoiser of a Gaussian-blob mixture ---- */

export type Mixture = { mu: P2[]; s: number; cls?: number[] };

/** E[x0 | x_t], the implied noise, and how much each blob is "blamed" for x_t. `only` restricts to one class. */
export function denoise(x: P2, abar: number, mix: Mixture, only?: number): { x0: P2; eps: P2; w: number[] } {
  const ra = Math.sqrt(abar), v = abar * mix.s * mix.s + (1 - abar), shrink = (ra * mix.s * mix.s) / v;
  const logw = mix.mu.map((m, i) => {
    if (only !== undefined && mix.cls && mix.cls[i] !== only) return -Infinity;
    return -((x[0] - ra * m[0]) ** 2 + (x[1] - ra * m[1]) ** 2) / (2 * v);
  });
  const mx = Math.max(...logw);
  const e = logw.map((l) => Math.exp(l - mx)), sum = e.reduce((a, b) => a + b, 0);
  const w = e.map((q) => q / sum);
  let x0x = 0, x0y = 0;
  mix.mu.forEach((m, i) => {
    if (w[i] === 0) return;
    x0x += w[i] * (m[0] + shrink * (x[0] - ra * m[0]));
    x0y += w[i] * (m[1] + shrink * (x[1] - ra * m[1]));
  });
  const rn = Math.sqrt(Math.max(1 - abar, 1e-12));
  return { x0: [x0x, x0y], eps: [(x[0] - ra * x0x) / rn, (x[1] - ra * x0y) / rn], w };
}

/** x_t = √ᾱ·x0 + √(1−ᾱ)·ε : jump straight to step t. */
export const noised = (x0: P2, eps: P2, abar: number): P2 => [Math.sqrt(abar) * x0[0] + Math.sqrt(1 - abar) * eps[0], Math.sqrt(abar) * x0[1] + Math.sqrt(1 - abar) * eps[1]];

export function spiral(n = 90): P2[] {
  return Array.from({ length: n }, (_, i) => {
    const th = 1.2 * Math.PI + (i / (n - 1)) * 3.1 * Math.PI, rad = 0.1 + 0.2 * (th / Math.PI - 1.2);
    return [rad * Math.cos(th) * 1.15, rad * Math.sin(th) * 1.15] as P2;
  });
}

export function smiley(): P2[] {
  const pts: P2[] = [];
  for (let i = 0; i < 44; i++) { const a = (i / 44) * 2 * Math.PI; pts.push([0.78 * Math.cos(a), 0.78 * Math.sin(a)]); }
  for (const ex of [-0.3, 0.3]) for (let i = 0; i < 7; i++) { const a = (i / 7) * 2 * Math.PI; pts.push([ex + 0.07 * Math.cos(a), 0.26 + 0.07 * Math.sin(a)]); }
  for (let i = 0; i < 16; i++) { const a = Math.PI * (1.18 + (0.64 * i) / 15); pts.push([0.46 * Math.cos(a), 0.02 + 0.46 * Math.sin(a)]); }
  return pts;
}

/** Ancestral DDPM sampling. Returns frames[k] = particle positions after k reverse steps (frames[0] is pure noise). */
export function sampleReverse(mix: Mixture, sch: Schedule, n: number, seed: number): P2[][] {
  const r = mulberry(seed);
  let xs: P2[] = Array.from({ length: n }, () => [normal(r), normal(r)] as P2);
  const frames: P2[][] = [xs];
  for (let t = sch.T; t >= 1; t--) {
    const k = sch.beta[t] / Math.sqrt(1 - sch.abar[t]), ia = 1 / Math.sqrt(sch.alpha[t]);
    const sigma = t > 1 ? Math.sqrt((sch.beta[t] * (1 - sch.abar[t - 1])) / (1 - sch.abar[t])) : 0;
    xs = xs.map((x) => {
      const { eps } = denoise(x, sch.abar[t], mix);
      return [ia * (x[0] - k * eps[0]) + sigma * normal(r), ia * (x[1] - k * eps[1]) + sigma * normal(r)] as P2;
    });
    frames.push(xs);
  }
  return frames;
}

/** Mean distance from each particle to its nearest blob centre. */
export function meanNearest(xs: P2[], mix: Mixture): number {
  let s = 0;
  for (const x of xs) {
    let best = Infinity;
    for (const m of mix.mu) best = Math.min(best, Math.hypot(x[0] - m[0], x[1] - m[1]));
    s += best;
  }
  return s / xs.length;
}

/* ---- 07 · classifier-free guidance on a two-class toy ---- */

/** Class 0: a ring up-left. Class 1: a bar down-right. */
export const TWO_CLASSES: Mixture = (() => {
  const mu: P2[] = [], cls: number[] = [];
  for (let i = 0; i < 30; i++) { const a = (i / 30) * 2 * Math.PI; mu.push([-0.5 + 0.3 * Math.cos(a), 0.32 + 0.3 * Math.sin(a)]); cls.push(0); }
  for (let i = 0; i < 30; i++) { mu.push([0.18 + (0.66 * i) / 29, -0.52 + (0.42 * i) / 29]); cls.push(1); }
  return { mu, cls, s: 0.035 };
})();

/** Deterministic (DDIM) sampling with guided noise ε = ε_u + w·(ε_c − ε_u). Same start noise for every w. */
export function sampleGuided(mix: Mixture, sch: Schedule, n: number, seed: number, cls: number, w: number): P2[] {
  const r = mulberry(seed);
  let xs: P2[] = Array.from({ length: n }, () => [normal(r), normal(r)] as P2);
  const clip = (v: number) => Math.max(-1.6, Math.min(1.6, v));
  for (let t = sch.T; t >= 1; t--) {
    const ab = sch.abar[t], abPrev = sch.abar[t - 1];
    xs = xs.map((x) => {
      const u = denoise(x, ab, mix).eps, c = denoise(x, ab, mix, cls).eps;
      const e: P2 = [u[0] + w * (c[0] - u[0]), u[1] + w * (c[1] - u[1])];
      const x0: P2 = [clip((x[0] - Math.sqrt(1 - ab) * e[0]) / Math.sqrt(ab)), clip((x[1] - Math.sqrt(1 - ab) * e[1]) / Math.sqrt(ab))];
      return [Math.sqrt(abPrev) * x0[0] + Math.sqrt(1 - abPrev) * e[0], Math.sqrt(abPrev) * x0[1] + Math.sqrt(1 - abPrev) * e[1]] as P2;
    });
  }
  return xs;
}

/** How many samples landed on the asked class, and how spread out they are. */
export function guidedStats(xs: P2[], mix: Mixture, cls: number): { hit: number; spread: number } {
  let hit = 0;
  const own: P2[] = [];
  for (const x of xs) {
    let best = Infinity, bc = 0;
    mix.mu.forEach((m, i) => { const d = Math.hypot(x[0] - m[0], x[1] - m[1]); if (d < best) { best = d; bc = mix.cls![i]; } });
    if (bc === cls && best < 0.2) { hit++; own.push(x); }
  }
  const cx = own.reduce((a, p) => a + p[0], 0) / Math.max(1, own.length), cy = own.reduce((a, p) => a + p[1], 0) / Math.max(1, own.length);
  const spread = Math.sqrt(own.reduce((a, p) => a + (p[0] - cx) ** 2 + (p[1] - cy) ** 2, 0) / Math.max(1, own.length));
  return { hit: hit / xs.length, spread };
}
