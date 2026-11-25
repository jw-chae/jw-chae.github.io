/** The 8×8 picture and the one-channel miniature U behind U-Net 01–04. Every number in those sections is computed here. No imports, so node can run it. */

export type Map2 = { n: number; d: number[] };
export type RC = [number, number];

export const WN = 8;
/** Hand-set brightness: every cell pixel 0.9, every background pixel 0.1. */
export const BRIGHT = 0.9, DARK = 0.1;

const make = (n: number, f: (r: number, c: number) => number): Map2 => {
  const d = new Array<number>(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) d[r * n + c] = f(r, c);
  return { n, d };
};

/** Answer mask: one 3×3 cell inside the top-left quarter. `shift` slides it to the right (used by one reader doubt). */
export const truthAt = (shift = 0): Map2 => make(WN, (r, c) => (r >= 1 && r <= 3 && c >= 1 + shift && c <= 3 + shift ? 1 : 0));
/** A bright speck of dust in the bottom-right quarter: as bright as the cell, but background. */
export const SPECK: RC = [5, 6];
export const photoFrom = (truth: Map2, speck = true): Map2 =>
  make(WN, (r, c) => (truth.d[r * WN + c] || (speck && r === SPECK[0] && c === SPECK[1]) ? BRIGHT : DARK));

export const TRUTH8 = truthAt(0);
export const PHOTO8 = photoFrom(TRUTH8);

/** The three pixels the text follows. ① a cell pixel on the border, ② its left neighbour (background), ③ the speck. */
export const P1: RC = [2, 1], P2: RC = [2, 0], P3: RC = SPECK;
export const TRACKED: RC[] = [P1, P2, P3];
export const at = (m: Map2, [r, c]: RC, scale = 1) => m.d[Math.floor(r / scale) * m.n + Math.floor(c / scale)];

/** 2×2 average pooling (the real U-Net uses convolutions followed by max pooling). */
export const pool = (m: Map2): Map2 => {
  const n = m.n / 2;
  return make(n, (r, c) => (m.d[2 * r * m.n + 2 * c] + m.d[2 * r * m.n + 2 * c + 1] + m.d[(2 * r + 1) * m.n + 2 * c] + m.d[(2 * r + 1) * m.n + 2 * c + 1]) / 4);
};
/** Grow by plain copying: every cell becomes a factor × factor block of itself. */
export const grow = (m: Map2, factor: number): Map2 => make(m.n * factor, (r, c) => m.d[Math.floor(r / factor) * m.n + Math.floor(c / factor)]);

export type Trace = { x: Map2; d1: Map2; d2: Map2; up: Map2 };
/** Down twice (8 → 4 → 2), then straight back up (2 → 8) with nothing added. */
export function trace(photo: Map2 = PHOTO8): Trace {
  const d1 = pool(photo), d2 = pool(d1);
  return { x: photo, d1, d2, up: grow(d2, 4) };
}

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** What the last computation is given at each pixel: only the value from below, only the bridge value, or both. */
export type Source = "below" | "bridge" | "both";
export type Rule = { a: number; b: number; c: number };   // score = a · (from below) + b · (across the bridge) + c
/** Hand-set weights, one rule per source. With one input the other weight is 0 because that number is not there. */
export const RULES: Record<Source, Rule> = {
  below: { a: 10, b: 0, c: -3.5 },
  bridge: { a: 0, b: 5, c: -2.5 },
  both: { a: 10, b: 5, c: -8 },
};

export type Verdict = { z: number[]; p: number[]; mask: Map2; wrong: number };
/** Score, cell probability and thresholded answer at all 64 pixels. */
export function decide(rule: Rule, photo: Map2 = PHOTO8, truth: Map2 = TRUTH8): Verdict {
  const t = trace(photo);
  const z = photo.d.map((s, i) => rule.a * t.up.d[i] + rule.b * s + rule.c), p = z.map(sigmoid);
  const mask = { n: WN, d: p.map((v) => (v > 0.5 ? 1 : 0)) };
  return { z, p, mask, wrong: mask.d.filter((v, i) => v !== truth.d[i]).length };
}

/** 01 · answering from one number alone: own brightness, or the mean of the pixel's 4×4 quarter. Threshold 0.5. */
export function oneNumber(kind: "own" | "wide", photo: Map2 = PHOTO8, truth: Map2 = TRUTH8): { value: Map2; mask: Map2; wrong: number } {
  const value = kind === "own" ? photo : trace(photo).up;
  const mask = { n: WN, d: value.d.map((v) => (v > 0.5 ? 1 : 0)) };
  return { value, mask, wrong: mask.d.filter((v, i) => v !== truth.d[i]).length };
}

/* ---- 04 · the three weights learned from zero ---- */

export type Snap = { step: number; rule: Rule; p: number[]; loss: number; wrong: number };
/** Plain gradient descent on the mean per-pixel cross-entropy of this one picture. Returns the state at each requested step. */
export function train(steps: number[], lr = 4, photo: Map2 = PHOTO8, truth: Map2 = TRUTH8): Snap[] {
  const t = trace(photo), n = photo.d.length, want = new Set(steps), last = Math.max(...steps);
  let a = 0, b = 0, c = 0;
  const out: Snap[] = [];
  for (let k = 0; k <= last; k++) {
    let ga = 0, gb = 0, gc = 0, loss = 0, wrong = 0;
    const p = photo.d.map((s, i) => sigmoid(a * t.up.d[i] + b * s + c));
    p.forEach((pi, i) => {
      const y = truth.d[i], e = (pi - y) / n;               // error at this pixel's score
      ga += e * t.up.d[i]; gb += e * photo.d[i]; gc += e;   // the same three weights collect it from all 64 pixels
      loss += -Math.log(y ? pi : 1 - pi) / n;
      if ((pi > 0.5 ? 1 : 0) !== y) wrong++;
    });
    if (want.has(k)) out.push({ step: k, rule: { a, b, c }, p, loss, wrong });
    a -= lr * ga; b -= lr * gb; c -= lr * gc;
  }
  return out;
}
export const TRAIN_STEPS = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
