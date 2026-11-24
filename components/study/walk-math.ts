/** Small hand-set models behind the question-led walkthroughs (Transformer 01–04, ViT 02–03). Every number shown is computed here. */

export const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
export function softmax(z: number[]): number[] {
  const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}
const mixOf = (w: number[], vs: number[][]) => vs[0].map((_, d) => w.reduce((s, wi, i) => s + wi * vs[i][d], 0));

/* ---- Transformer 02 · one blank, one head: "나는 ____" reading "I love cats" ---- */

export type Animal = "cats" | "dogs";
/** Query the decoder forms from what it has written so far ("나는"). Nothing in it says cat or dog. */
export const Q_BLANK = [1.6, 0.6];
/** Keys of the three source positions. Position 3 gets the same key for cats and dogs: where to read does not depend on which animal it is. */
export const KEYS = [[-1, 0.5], [0.3, 0.8], [1.4, 0.2]];
/** Values: what each source position hands over. Only this differs between cats and dogs. */
export const values = (animal: Animal) => [[0.9, 0.1, 0], [0.1, 1, 0.2], [0, 0.3, animal === "cats" ? 1.1 : -1.1]];
export const CANDIDATES = ["고양이를", "개를", "사랑한다", "나는"];
/** Output layer: one row per candidate word. */
export const OUT = [[0, 0.5, 3], [0, 0.5, -3], [0, 2.2, 0], [2, 0, 0]];

export type Blank = { scores: number[]; weights: number[]; parts: number[][]; mixed: number[]; logits: number[]; probs: number[]; pick: number };
export function fillBlank(animal: Animal): Blank {
  const scores = KEYS.map((k) => dot(Q_BLANK, k)), weights = softmax(scores), vs = values(animal);
  const parts = vs.map((v, i) => v.map((x) => x * weights[i])), mixed = mixOf(weights, vs);
  const logits = OUT.map((row) => dot(row, mixed)), probs = softmax(logits);
  return { scores, weights, parts, mixed, logits, probs, pick: probs.indexOf(Math.max(...probs)) };
}

/* ---- Transformer 03 · two heads: "를" or "에게"? ---- */

export type Verb = "love" | "talk";
export const HEAD_CANDIDATES = ["고양이를", "고양이에게", "사랑한다", "말을"];
const QB = [1.4, 0.4], KEYS_B = [[-0.5, -0.5], [1.5, 0.5], [0.2, 0.6]];
const valuesA = [[0, 0], [0.1, 0], [1, 0]];
const valuesB = (verb: Verb) => [[0, 0], verb === "love" ? [1, 0] : [0, 1], [0.3, 0.3]];

export type TwoHeads = { wA: number[]; wB: number[]; cA: number[]; cB: number[]; logits: number[]; probs: number[]; pick: number };
/** Head A reads with the same query and keys as the blank above; head B has its own. `both` = false drops head B's result. */
export function twoHeads(verb: Verb, both: boolean): TwoHeads {
  const wA = softmax(KEYS.map((k) => dot(Q_BLANK, k))), wB = softmax(KEYS_B.map((k) => dot(QB, k)));
  const cA = mixOf(wA, valuesA), cB = both ? mixOf(wB, valuesB(verb)) : [0, 0];
  // the two results are placed side by side and one linear layer turns them into a score per candidate
  const logits = [3 * cA[0] + 3 * (cB[0] - cB[1]), 3 * cA[0] + 3 * (cB[1] - cB[0]), 2 * cB[0] - 1, 2 * cB[1] - 1];
  const probs = softmax(logits);
  return { wA, wB, cA, cB, logits, probs, pick: probs.indexOf(Math.max(...probs)) };
}

/* ---- Transformer 04 · the same blank, trained from nothing ---- */

export type Snapshot = { weights: number[]; probs: number[]; loss: number };
/** Gradient descent on two sentence pairs (… cats → 고양이를, … dogs → 개를). Learned: three reading scores and the output layer. */
export function trainBlank(steps = 120, lr = 0.6): Snapshot[] {
  let theta = [0, 0, 0];
  let M = CANDIDATES.map(() => [0, 0, 0]);
  const data: [Animal, number][] = [["cats", 0], ["dogs", 1]];
  const history: Snapshot[] = [];
  for (let t = 0; t <= steps; t++) {
    const w = softmax(theta);
    const gTheta = [0, 0, 0], gM = M.map(() => [0, 0, 0]);
    let snap: Snapshot | null = null, loss = 0;
    for (const [animal, answer] of data) {
      const vs = values(animal), c = mixOf(w, vs), p = softmax(M.map((row) => dot(row, c)));
      loss += -Math.log(p[answer]) / data.length;
      if (animal === "cats") snap = { weights: w, probs: p, loss: 0 };
      const dz = p.map((pk, k) => (pk - (k === answer ? 1 : 0)) / data.length);          // error at each candidate's score
      dz.forEach((d, k) => c.forEach((cv, j) => { gM[k][j] += d * cv; }));              // → output layer
      const dc = c.map((_, j) => dz.reduce((s, d, k) => s + d * M[k][j], 0));           // → the mixed vector
      const dw = vs.map((v) => dot(dc, v));                                              // → each reading share
      const mean = dw.reduce((s, d, i) => s + d * w[i], 0);
      dw.forEach((d, i) => { gTheta[i] += w[i] * (d - mean); });                          // → the reading scores
    }
    if (snap) history.push({ ...snap, loss });
    theta = theta.map((v, i) => v - lr * gTheta[i]);
    M = M.map((row, k) => row.map((v, j) => v - lr * gM[k][j]));
  }
  return history;
}

/* ---- ViT 02–03 · one patch reading the other three ---- */

export type Patch2 = "eye" | "wall";
/** Patch vectors after embedding: ① ear, ② eye (or wall), ③ wall, ④ wall. Two numbers each so they can be read. */
export const patchVectors = (second: Patch2): number[][] => [[1, 2], second === "eye" ? [2, 1] : [0, -1], [0, -1], [0, -1]];
const WK = [[0, 0.5], [0.5, 0]];
const apply = (W: number[][], x: number[]) => W.map((row) => dot(row, x));

export type Look = { x: number[][]; q: number[]; keys: number[][]; vals: number[][]; scores: number[]; weights: number[]; parts: number[][]; read: number[]; out: number[] };
/** One self-attention read by patch `owner` (0-based). W_Q and W_V are the identity here; W_K is a fixed 2×2 matrix. */
export function look(owner: number, second: Patch2 = "eye"): Look {
  const x = patchVectors(second), q = x[owner], keys = x.map((v) => apply(WK, v)), vals = x;
  const scores = keys.map((k) => dot(q, k)), weights = softmax(scores);
  const parts = vals.map((v, i) => v.map((n) => n * weights[i])), read = mixOf(weights, vals);
  return { x, q, keys, vals, scores, weights, parts, read, out: x[owner].map((n, d) => n + read[d]) };
}
