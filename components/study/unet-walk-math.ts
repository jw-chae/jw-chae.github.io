/** The 8×8 crop of the owner's cat and the one-channel miniature U behind U-Net 01–04. Every number in those sections is computed here. No imports, so node can run it. */

export type Map2 = { n: number; d: number[] };
export type RC = [number, number];

export const WN = 8;

/**
 * Where the crop comes from. public/study/cat-square.png (512×512) cut into 32×32 blocks of 16×16 px; the crop is block rows 0–7,
 * block columns 11–18, i.e. x 176–304, y 0–128 of the square: the tip of the ear on the left of the drawing, the background around it
 * and the cream fur where the ear meets the head.
 */
export const CROP = { grid: 32, row: 0, col: 11, x: 176, y: 0, size: 128, src: 512 };

/**
 * Brightness of the 8×10 block rows 0–7, columns 10–19 (one spare column on each side, for the shifted crops in the reader doubts).
 * Copied from cat-grids.ts (CAT_GRAY_32): luminance 0 dark to 1 bright, mean over each 16×16 px block.
 */
const GRAY_BLOCK: number[][] = [
  [0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.94, 0.94],
  [0.94, 0.94, 0.94, 0.94, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95],
  [0.94, 0.95, 0.94, 0.93, 0.79, 0.94, 0.95, 0.95, 0.94, 0.94],
  [0.94, 0.94, 0.94, 0.71, 0.39, 0.37, 0.77, 0.94, 0.94, 0.94],
  [0.94, 0.94, 0.94, 0.79, 0.51, 0.43, 0.26, 0.56, 0.88, 0.87],
  [0.94, 0.94, 0.94, 0.94, 0.52, 0.52, 0.34, 0.35, 0.60, 0.61],
  [0.94, 0.94, 0.94, 0.94, 0.70, 0.42, 0.52, 0.83, 0.55, 0.27],
  [0.94, 0.94, 0.94, 0.94, 0.91, 0.36, 0.61, 0.61, 0.26, 0.17],
];
/**
 * The answer, measured from the same drawing: the share of each 16×16 px block that lies inside the cat's outline. The outside is
 * found by flood-filling from the border of cat-square.png over pixels within 40 (sum of |R−r|+|G−g|+|B−b|, 0–255 scale) of the
 * background colour (253, 236, 226); everything the fill cannot reach is cat. A block is "cat" when more than half of it is inside.
 */
const COVER_BLOCK: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0.04, 0.23, 0.02, 0, 0, 0, 0],
  [0, 0, 0, 0.36, 1, 0.86, 0.25, 0, 0, 0],
  [0, 0, 0, 0.23, 1, 1, 0.99, 0.54, 0.37, 0.69],
  [0, 0, 0, 0.02, 0.89, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0.41, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0.06, 0.84, 1, 1, 1, 1],
];
/** Colour of ③'s cell and of a pure background cell (R, G, B, 0–1). Copied from cat-grids.ts (CAT_RGB_32 rows 6 and 0, columns 17 and 11). */
export const RGB = { p3: [0.95, 0.81, 0.67], bg: [0.99, 0.93, 0.89] };

const make = (n: number, f: (r: number, c: number) => number): Map2 => {
  const d = new Array<number>(n * n);
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) d[r * n + c] = f(r, c);
  return { n, d };
};

/** The 8×8 crop starting `shift` columns right of the one in the text (shift −1, 0 or +1). */
export const photoAt = (shift = 0): Map2 => make(WN, (r, c) => GRAY_BLOCK[r][c + 1 + shift]);
export const coverAt = (shift = 0): Map2 => make(WN, (r, c) => COVER_BLOCK[r][c + 1 + shift]);
export const truthAt = (shift = 0): Map2 => ({ n: WN, d: coverAt(shift).d.map((v) => (v > 0.5 ? 1 : 0)) });

export const PHOTO8 = photoAt(0);
export const COVER8 = coverAt(0);
export const TRUTH8 = truthAt(0);

/** The three pixels the text follows. ① the ear tip (cat), ② the cell just above it (mostly background), ③ cream fur where the ear meets the head (cat). */
export const P1: RC = [3, 3], P2: RC = [2, 3], P3: RC = [6, 6];
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

/** Round half up to `d` decimals, the way every number on the page is shown. */
export const round = (v: number, d = 2) => Math.round(v * 10 ** d + 1e-9) / 10 ** d;

export const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/** What the last computation is given at each pixel: only the value from below, only the bridge value, or both. */
export type Source = "below" | "bridge" | "both";
export type Rule = { a: number; b: number; c: number };   // score = a · (from below) + b · (across the bridge) + c
/**
 * Hand-set weights, one rule per source. With one input the other weight is 0 because that number is not there.
 * The weights are negative because darker means more likely cat: the score rises as a brightness falls.
 * "below" says cat when the quarter mean is under 0.7, "bridge" when the pixel itself is under 0.65; both cuts give the fewest wrong cells.
 */
export const RULES: Record<Source, Rule> = {
  below: { a: -10, b: 0, c: 7 },
  bridge: { a: 0, b: -20, c: 13 },
  both: { a: -10, b: -20, c: 22 },
};

export type Verdict = { z: number[]; p: number[]; mask: Map2; wrong: number };
/** Score, cat probability and thresholded answer at all 64 pixels. */
export function decide(rule: Rule, photo: Map2 = PHOTO8, truth: Map2 = TRUTH8): Verdict {
  const t = trace(photo);
  const z = photo.d.map((s, i) => rule.a * t.up.d[i] + rule.b * s + rule.c), p = z.map(sigmoid);
  const mask = { n: WN, d: p.map((v) => (v > 0.5 ? 1 : 0)) };
  return { z, p, mask, wrong: mask.d.filter((v, i) => v !== truth.d[i]).length };
}

/** 01 · answering from one number alone: own brightness, or the mean of the pixel's 4×4 quarter. Cat when darker than the cut. */
export const CUT = { own: 0.65, wide: 0.7 };
export function oneNumber(kind: "own" | "wide", photo: Map2 = PHOTO8, truth: Map2 = TRUTH8): { value: Map2; mask: Map2; wrong: number } {
  const value = kind === "own" ? photo : trace(photo).up;
  const mask = { n: WN, d: value.d.map((v) => (v < CUT[kind] ? 1 : 0)) };
  return { value, mask, wrong: mask.d.filter((v, i) => v !== truth.d[i]).length };
}
/** Fewest wrong cells any single cut on this number can reach (used to check that CUT is a best cut). */
export function bestCut(values: number[], truth: number[]): number {
  let best = values.length;
  for (const t of [...new Set(values)].map((v) => v + 1e-6).concat([0])) {
    best = Math.min(best, values.filter((v, i) => (v < t ? 1 : 0) !== truth[i]).length);
  }
  return best;
}

/* ---- 04 · the three weights learned from zero ---- */

export type Snap = { step: number; rule: Rule; p: number[]; loss: number; wrong: number };
/** Plain gradient descent on the mean per-pixel cross-entropy of this one picture. Returns the state at each requested step. */
export function train(steps: number[], lr = LR, photo: Map2 = PHOTO8, truth: Map2 = TRUTH8): Snap[] {
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
export const LR = 2;
export const TRAIN_STEPS = [0, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 3000, 5000];
