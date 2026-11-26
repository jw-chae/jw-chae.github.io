/** Arithmetic behind the DETR study scenes. The picture is the YOLO chapter's: 160 × 160 picture pixels with the owner's
 *  pixel-art Siamese cat (public/study/cat-pixel.webp) and a drawn cup, and in the two-cat case a second cat right behind
 *  the first. The answer boxes are copied from yolo-math.ts (GT_CAT, GT_CAT2, GT_CUP). The share of every token cell
 *  covered by the cat and by the cup is measured from the cat image's alpha channel and the cup's drawn shape (Python and
 *  PIL, 10× supersampling, the same method that gave yolo-math.ts its CAT_COVER). Every model output (query vectors,
 *  class head, boxes, scores in training, the teacher's and the student's outputs) is hand-set for the explanation.
 *  Published values carry their paper and table in a comment. Import-free so node can run it. */

export type Box = [number, number, number, number];   // x1, y1, x2, y2 in picture pixels

export const IMG = 160;

/* ---- the picture (copied from yolo-math.ts) ---- */

/** Answer boxes, copied from yolo-math.ts: the cat measured from its alpha channel at its placement, the cup drawn in its box. */
export const GT_CAT: Box = [15, 32, 76, 139];
export const GT_CAT2: Box = [28, 31, 84, 129];
export const GT_CUP: Box = [114, 94, 148, 138];

/** Boxes the YOLO chapter's cells A and B wrote, and the box F on the second cat (copied from yolo-math.ts BOXES, BOX_F);
 *  04 reuses A and B as the boxes slots 1 and 2 write mid-training, 01 quotes the YOLO chapter's IoUs F–A and B–A. */
export const YOLO_A: Box = [12, 30, 78, 140];
export const YOLO_B: Box = [20, 20, 70, 130];
export const YOLO_F: Box = [28, 30, 80, 130];

/* ---- 02 · tokens: DETR's backbone map has stride 32, so 160 px becomes 5 × 5 ---- */

export const STRIDE = 32;
export const TOK = IMG / STRIDE;                        // 5
/** Share of each 32 px cell covered by the cat, row by row (measured). Row 1: both ears and eyes. Row 2: chin and chest.
 *  Row 3: haunch, body, front leg. Row 4: tail and paws. */
export const CAT5: number[][] = [
  [0, 0, 0.0003, 0, 0],
  [0.0001, 0.5728, 0.3188, 0, 0],
  [0.0608, 0.8075, 0.2775, 0, 0],
  [0.3693, 0.9868, 0.0766, 0, 0],
  [0.144, 0.3026, 0.0474, 0, 0],
];
/** The visible part of the second cat in the two-cat picture (its alpha times what cat 1 leaves uncovered), measured. */
export const CAT2V5: number[][] = [
  [0, 0, 0.0043, 0, 0],
  [0, 0.0919, 0.252, 0, 0],
  [0, 0.0051, 0.22, 0, 0],
  [0.0003, 0.0129, 0.2806, 0, 0],
  [0, 0.0002, 0, 0, 0],
];
/** Share of each 32 px cell covered by the cup (measured from its drawn shape: body, rim, handle). */
export const CUP5: number[][] = [
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0],
  [0, 0, 0, 0.0193, 0.0156],
  [0, 0, 0, 0.403, 0.379],
  [0, 0, 0, 0.1121, 0.0934],
];
/** The same shares on 16 px cells (stride 16, 10 × 10), measured the same way; used in 06 and 07. */
export const CAT10: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0.001, 0, 0, 0, 0, 0],
  [0, 0.0003, 0.4144, 0.238, 0.5758, 0.0001, 0, 0, 0, 0],
  [0, 0.0002, 0.6482, 0.9906, 0.6994, 0, 0, 0, 0, 0],
  [0, 0, 0.2716, 0.9914, 0.5807, 0.0029, 0, 0, 0, 0],
  [0, 0.2433, 0.9747, 0.9923, 0.5264, 0, 0, 0, 0, 0],
  [0, 0.6663, 0.9921, 0.9909, 0.147, 0.0001, 0, 0, 0, 0],
  [0.0004, 0.8103, 0.9923, 0.9721, 0.1592, 0.0001, 0, 0, 0, 0],
  [0.0169, 0.559, 0.6474, 0.5628, 0.1896, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];
export const CUP10: number[][] = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0.0772, 0.0624, 0],
  [0, 0, 0, 0, 0, 0, 0, 0.8419, 0.7495, 0.0316],
  [0, 0, 0, 0, 0, 0, 0, 0.7701, 0.6776, 0.0575],
  [0, 0, 0, 0, 0, 0, 0, 0.4484, 0.3734, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
];

export type Token = { r: number; c: number; x: number; y: number; cat: number; cup: number };
/** The tokens of an n × n map in reading order (the order DETR flattens them in). In the two-cat picture both cats count as cat. */
export function tokens(n = TOK, two = false): Token[] {
  const cat = n === TOK ? CAT5 : CAT10, cup = n === TOK ? CUP5 : CUP10, s = IMG / n;
  const out: Token[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const extra = two && n === TOK ? CAT2V5[r][c] : 0;
    out.push({ r, c, x: c * s + s / 2, y: r * s + s / 2, cat: cat[r][c] + extra, cup: cup[r][c] });
  }
  return out;
}
export const TOKENS = tokens();
export const idxOf = (r: number, c: number, n = TOK) => r * n + c;

/** Toy position vector: DETR's 2D sine encoding with one frequency per axis instead of 64, half a period across the picture.
 *  pe(x, y) = [sin(πx/160), cos(πx/160), sin(πy/160), cos(πy/160)]. Its length is the same everywhere, so
 *  pe(a)·pe(b) = cos(πΔx/160) + cos(πΔy/160): 2 at the same place, smaller the farther apart. */
export const pe = (x: number, y: number) => [Math.sin((Math.PI * x) / IMG), Math.cos((Math.PI * x) / IMG), Math.sin((Math.PI * y) / IMG), Math.cos((Math.PI * y) / IMG)];
export const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
export function softmax(z: number[]): number[] {
  const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}
/** Key of a token: content (cat share, cup share) and position kept in separate places of one 6-number vector. */
export const keyOf = (t: Token) => [t.cat, t.cup, ...pe(t.x, t.y)];
export const D_KEY = 6;

/* ---- 03 · one object query reads the tokens (cross-attention), then the class head ---- */

/** A slot's query, hand-set as a trained model might have it: how strongly it seeks cat-like and cup-like content, and the
 *  point whose position vector it carries (scaled by `pos`). Nobody assigns these; training formed them. */
export type Query = { cat: number; cup: number; u: number; v: number; pos: number };
export const QUERIES: Query[] = [
  { cat: 6, cup: 0, u: 48, v: 88, pos: 3 },       // slot 1: near the chest
  { cat: 6, cup: 0, u: 64, v: 48, pos: 3 },       // slot 2: near the face, close to slot 1
  { cat: 0, cup: 14, u: 128, v: 112, pos: 3 },    // slot 3: near the lower right
  { cat: 2, cup: 2, u: 120, v: 24, pos: 3 },      // slot 4: upper right
  { cat: 2, cup: 2, u: 100, v: 150, pos: 3 },     // slot 5: bottom middle
];
export const N_SLOTS = QUERIES.length;
export type Part = "both" | "pos" | "content";
export const qVec = (q: Query, part: Part = "both") => [
  part === "pos" ? 0 : q.cat, part === "pos" ? 0 : q.cup,
  ...pe(q.u, q.v).map((v) => (part === "content" ? 0 : q.pos * v)),
];
/** Scores, reading shares and what the slot gathers: share-weighted sum of the token values (cat share, cup share). */
export function read(q: Query, part: Part = "both", toks: Token[] = TOKENS) {
  const qv = qVec(q, part);
  const score = toks.map((t) => dot(qv, keyOf(t)) / Math.sqrt(D_KEY));
  const share = softmax(score);
  const out = [toks.reduce((s, t, i) => s + share[i] * t.cat, 0), toks.reduce((s, t, i) => s + share[i] * t.cup, 0)];
  return { qv, score, share, out };
}
/** Class head, hand-set: logits [W·cat, W·cup, B_NONE], softmax over cat, cup, no object (∅). */
export const W_CLS = 10, B_NONE = 2.5;
export const classHead = (o: number[]) => softmax([W_CLS * o[0], W_CLS * o[1], B_NONE]);
export const CLASSES = ["cat", "cup", "none"] as const;
export type Cls = (typeof CLASSES)[number];
export const argmax = (p: number[]) => p.indexOf(Math.max(...p));

/** Boxes the shared box head writes after layer 1, hand-set (the toy does not compute boxes): slot 2's box sits on the
 *  cat's head and overlaps slot 1's. */
export const LAYER1_BOX: Box[] = [[14, 30, 78, 140], [20, 22, 74, 124], [112, 92, 150, 140], [96, 8, 150, 52], [70, 118, 130, 158]];
/** Layer 1 (the cross-attention above, nothing else) for all five slots. */
export const layer1 = (two = false, part: Part = "both") => QUERIES.map((q) => { const r = read(q, part, tokens(TOK, two)); return { ...r, p: classHead(r.out) }; });

/* ---- 01 · the trained model's final answer: five slots, each a box and three probabilities (hand-set) ---- */

export type SlotOut = { p: [number, number, number]; box: Box };
/** Last-layer outputs, hand-set: slot 1 on the cat, slot 3 on the cup, slots 2, 4, 5 say no object. In the two-cat picture
 *  slot 2 takes the second cat. The boxes of ∅ slots are drawn nowhere and trained by nothing. */
export const FINAL_ONE: SlotOut[] = [
  { p: [0.93, 0.02, 0.05], box: [14, 31, 77, 140] },
  { p: [0.06, 0.02, 0.92], box: [22, 24, 72, 120] },
  { p: [0.03, 0.9, 0.07], box: [113, 93, 149, 139] },
  { p: [0.02, 0.03, 0.95], box: [96, 8, 150, 52] },
  { p: [0.04, 0.03, 0.93], box: [4, 120, 50, 158] },
];
export const FINAL_TWO: SlotOut[] = [
  { p: [0.92, 0.02, 0.06], box: [14, 31, 77, 140] },
  { p: [0.81, 0.02, 0.17], box: [28, 30, 83, 130] },
  { p: [0.03, 0.9, 0.07], box: [113, 93, 149, 139] },
  { p: [0.02, 0.03, 0.95], box: [96, 8, 150, 52] },
  { p: [0.04, 0.03, 0.93], box: [4, 120, 50, 158] },
];
/** Normalised (cx, cy, w, h), the form DETR's box head writes. */
export const cxcywh = (b: Box) => [(b[0] + b[2]) / 2 / IMG, (b[1] + b[3]) / 2 / IMG, (b[2] - b[0]) / IMG, (b[3] - b[1]) / IMG];
/** Numbers one slot writes and the whole output (toy: 4 box numbers + 3 probabilities). */
export const PER_SLOT = 4 + CLASSES.length;

/* ---- 04 · training: the matching cost, the best one-to-one assignment, the targets and the loss ---- */

export const area = (b: Box) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
export const inter = (a: Box, b: Box) => area([Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])]);
export const union = (a: Box, b: Box) => area(a) + area(b) - inter(a, b);
export const iou = (a: Box, b: Box) => inter(a, b) / union(a, b);
export const hull = (a: Box, b: Box): Box => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])];
/** Generalized IoU: IoU minus the share of the enclosing box that neither box covers. */
export const giou = (a: Box, b: Box) => iou(a, b) - (area(hull(a, b)) - union(a, b)) / area(hull(a, b));
export const l1 = (a: Box, b: Box) => { const p = cxcywh(a), q = cxcywh(b); return p.reduce((s, v, i) => s + Math.abs(v - q[i]), 0); };
/** DETR paper: λ_L1 = 5, λ_iou = 2. */
export const LAMBDA_L1 = 5, LAMBDA_IOU = 2;
export const NONE_WEIGHT = 0.1;                        // DETR paper: the log-probability term of ∅ is down-weighted by a factor 10

export type GtItem = { cls: Exclude<Cls, "none">; box: Box; name: string };
export const GT_ONE: GtItem[] = [{ cls: "cat", box: GT_CAT, name: "cat" }, { cls: "cup", box: GT_CUP, name: "cup" }];
export const GT_TWO: GtItem[] = [{ cls: "cat", box: GT_CAT, name: "cat1" }, { cls: "cat", box: GT_CAT2, name: "cat2" }, { cls: "cup", box: GT_CUP, name: "cup" }];
const ci = (c: Cls) => CLASSES.indexOf(c);

/** L_match = −p̂(c) + λ_L1·‖b − b̂‖₁ + λ_iou·(1 − GIoU), for one slot and one answer. */
export function cost(s: SlotOut, g: GtItem) {
  const prob = s.p[ci(g.cls)], L1 = l1(s.box, g.box), G = giou(s.box, g.box);
  return { prob, L1, G, total: -prob + LAMBDA_L1 * L1 + LAMBDA_IOU * (1 - G) };
}
export const costMatrix = (slots: SlotOut[], gts: GtItem[]) => slots.map((s) => gts.map((g) => cost(s, g)));

/** Best one-to-one assignment by trying every one (5·4 = 20 or 5·4·3 = 60 ways). The Hungarian algorithm finds the same
 *  minimum without listing them. Returns, for each answer, the slot it goes to. */
export function bestAssign(C: number[][]): { pick: number[]; total: number; tried: number } {
  const n = C.length, m = C[0].length;
  let best: number[] = [], bestT = Infinity, tried = 0;
  const go = (j: number, used: Set<number>, cur: number[], t: number) => {
    if (j === m) { tried++; if (t < bestT - 1e-12) { bestT = t; best = [...cur]; } return; }
    for (let i = 0; i < n; i++) if (!used.has(i)) { used.add(i); cur.push(i); go(j + 1, used, cur, t + C[i][j]); cur.pop(); used.delete(i); }
  };
  go(0, new Set(), [], 0);
  return { pick: best, total: bestT, tried };
}
/** Each answer takes its own cheapest slot, ignoring the others (can give one slot two answers). */
export const greedy = (C: number[][]) => C[0].map((_, j) => C.map((row) => row[j]).reduce((bi, v, i, col) => (v < col[bi] ? i : bi), 0));

/** Slot outputs at one moment during training (hand-set). One cat: slot 2 says "cat" more strongly than slot 1 but its box
 *  is worse, like cell B against cell A in the YOLO chapter. */
export const MID_ONE: SlotOut[] = [
  { p: [0.55, 0.05, 0.4], box: [12, 30, 78, 140] },
  { p: [0.6, 0.05, 0.35], box: [20, 20, 70, 130] },
  { p: [0.1, 0.5, 0.4], box: [110, 90, 150, 140] },
  { p: [0.15, 0.1, 0.75], box: [96, 10, 150, 60] },
  { p: [0.1, 0.3, 0.6], box: [100, 112, 140, 158] },
];
export const MID_TWO: SlotOut[] = [
  { p: [0.55, 0.05, 0.4], box: [12, 30, 78, 140] },
  { p: [0.3, 0.05, 0.65], box: [30, 40, 96, 142] },
  { p: [0.1, 0.5, 0.4], box: [110, 90, 150, 140] },
  { p: [0.15, 0.1, 0.75], box: [96, 10, 150, 60] },
  { p: [0.1, 0.3, 0.6], box: [100, 112, 140, 158] },
];

export type Target = { cls: Cls; box?: Box; gt?: number };
/** Targets from an assignment: matched slots get the answer's class and box, the rest get ∅ and no box. */
export function targets(n: number, gts: GtItem[], pick: number[]): Target[] {
  const t: Target[] = Array.from({ length: n }, () => ({ cls: "none" as Cls }));
  pick.forEach((slot, j) => { t[slot] = { cls: gts[j].cls, box: gts[j].box, gt: j }; });
  return t;
}
/** Hungarian loss terms per slot: class −w·log p̂(c) (w = 0.1 for ∅) and, for matched slots, the box term. */
export function lossTerms(slots: SlotOut[], t: Target[]) {
  return slots.map((s, i) => {
    const w = t[i].cls === "none" ? NONE_WEIGHT : 1;
    const cls = -w * Math.log(s.p[ci(t[i].cls)]);
    const bx = t[i].box ? LAMBDA_L1 * l1(s.box, t[i].box) + LAMBDA_IOU * (1 - giou(s.box, t[i].box)) : 0;
    return { cls, box: bx, total: cls + bx };
  });
}
export const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
/** Fixed order instead of matching: slot k gets the k-th answer of the answer sheet, the rest ∅. */
export const fixedPick = (m: number) => Array.from({ length: m }, (_, j) => j);
/** Total loss for one assignment rule and one answer-sheet order (sheet reversed = the cup written first). */
export function totalLoss(slots: SlotOut[], gts: GtItem[], rule: "match" | "fixed") {
  const pick = rule === "fixed" ? fixedPick(gts.length) : bestAssign(costMatrix(slots, gts).map((r) => r.map((c) => c.total))).pick;
  const t = targets(slots.length, gts, pick), terms = lossTerms(slots, t);
  return { pick, t, terms, total: sum(terms.map((x) => x.total)) };
}

/* ---- 05 · slots reading each other (decoder self-attention) ---- */

/** Toy self-attention among the five slots after layer 1: each slot's vector is what it gathered (cat, cup) scaled by
 *  SELF_GAIN, next to its query's position vector (scaled by SELF_POS). Q = K = that vector. */
export const SELF_GAIN = 4, SELF_POS = 1;
export const slotVec = (q: Query, out: number[]) => [SELF_GAIN * out[0], SELF_GAIN * out[1], ...pe(q.u, q.v).map((v) => SELF_POS * v)];
export function selfAttn(two = false) {
  const l1o = layer1(two);
  const V = QUERIES.map((q, i) => slotVec(q, l1o[i].out));
  const scores = V.map((a) => V.map((b) => dot(a, b) / Math.sqrt(V[0].length)));
  return { V, scores, share: scores.map(softmax) };
}
/** Layer-2 outputs, hand-set as a trained model might give them: slot 2 now says ∅ (one cat) or takes the second cat. */
export const LAYER2_ONE = FINAL_ONE;
export const LAYER2_TWO = FINAL_TWO;

/* ---- 06 · what it cost: uniform reading at the start, token counts, small objects ---- */

/** At initialisation the query reads every token almost equally (Deformable DETR paper). Toy: exactly equal. */
export function uniformRead(n = TOK) {
  const toks = tokens(n), k = toks.length;
  const out = [sum(toks.map((t) => t.cat)) / k, sum(toks.map((t) => t.cup)) / k];
  return { share: 1 / k, out, p: classHead(out) };
}
export const maxShare = (m: number[][]) => Math.max(...m.flat());
/** Entries of one encoder self-attention table (every token against every token), per head and layer. */
export const tableEntries = (tokensN: number) => tokensN * tokensN;
/** DETR paper: shortest side at most 800, longest at most 1333 (input resize). Tokens at stride 32 and 16 for that size. */
export const BIG = { h: 800, w: 1333 };
export const tokensAt = (s: number) => Math.ceil(BIG.h / s) * Math.ceil(BIG.w / s);
/** Tokens over several maps of that big picture (Deformable DETR: strides 8, 16, 32 and a fourth map at 64). */
export const tokensMulti = (strides: number[]) => sum(strides.map(tokensAt));
/** Points one query reads in Deformable DETR: M heads × L maps × K points. */
export const pointsPerQuery = (M = 8, L = 4, K = 4) => M * L * K;
/** DETR paper: encoder self-attention costs O(d²HW + d(HW)²). With d = 256. */
export const D_MODEL = 256;
export const encCost = (hw: number, d = D_MODEL) => ({ lin: d * d * hw, quad: d * hw * hw });

/* ---- 07 · Deformable DETR: a reference point and four sampled points instead of every token ---- */

/** Bilinear read of an n × n map at picture point (x, y), cell centres at (c + 0.5)·s. */
export function bilinear(m: number[][], x: number, y: number) {
  const n = m.length, s = IMG / n;
  const gx = Math.min(n - 1, Math.max(0, x / s - 0.5)), gy = Math.min(n - 1, Math.max(0, y / s - 0.5));
  const x0 = Math.floor(gx), y0 = Math.floor(gy), x1 = Math.min(n - 1, x0 + 1), y1 = Math.min(n - 1, y0 + 1), fx = gx - x0, fy = gy - y0;
  return m[y0][x0] * (1 - fx) * (1 - fy) + m[y0][x1] * fx * (1 - fy) + m[y1][x0] * (1 - fx) * fy + m[y1][x1] * fx * fy;
}
/** Slot 1's reference point and four sampling offsets with their attention logits, hand-set. */
export const REF = { x: 48, y: 88 };
export const OFFSETS: { dx: number; dy: number; logit: number }[] = [
  { dx: -12, dy: -40, logit: 0.6 },   // up to the left ear and eye
  { dx: 0, dy: -12, logit: 1.0 },     // chin and chest
  { dx: -14, dy: 16, logit: 0.8 },    // haunch
  { dx: 6, dy: 40, logit: 0.2 },      // paws
];
export const K_POINTS = OFFSETS.length;                 // Deformable DETR: K = 4 points per head (and per level), M = 8 heads
export function deformRead(n = TOK) {
  const cat = n === TOK ? CAT5 : CAT10, cup = n === TOK ? CUP5 : CUP10;
  const w = softmax(OFFSETS.map((o) => o.logit));
  const pts = OFFSETS.map((o, k) => {
    const x = REF.x + o.dx, y = REF.y + o.dy;
    return { x, y, w: w[k], cat: bilinear(cat, x, y), cup: bilinear(cup, x, y) };
  });
  const out = [sum(pts.map((p) => p.w * p.cat)), sum(pts.map((p) => p.w * p.cup))];
  return { pts, out, p: classHead(out) };
}
/** Reads per query and in the whole encoder (every token is a query there), dense versus four points. */
export const reads = (tokensN: number, k = K_POINTS) => ({ denseQuery: tokensN, deformQuery: k, denseEnc: tokensN * tokensN, deformEnc: tokensN * k });

/* ---- 08 · DINO's noised boxes, RT-DETR's encoder ---- */

/** Noised copies of the cat's answer box, hand-set: a small shift (positive, trained to give back GT_CAT) and a larger one
 *  (negative, trained to say ∅). DINO: noise below λ1 positive, between λ1 and λ2 negative. */
export const DN_POS: Box = [19, 27, 80, 133];
export const DN_NEG: Box = [32, 50, 96, 152];
/** Toy multi-scale maps of the 160 px picture: strides 8, 16, 32. */
export const SCALES = [{ name: "S3", stride: 8 }, { name: "S4", stride: 16 }, { name: "S5", stride: 32 }].map((s) => ({ ...s, n: (IMG / s.stride) ** 2 }));
export const allScaleTokens = sum(SCALES.map((s) => s.n));

/* ---- 09 · source-free adaptation (FRANCK): pseudo-labels from a teacher, matching the student's slots to them ---- */

/** Teacher outputs on the foggy picture (weak augmentation), hand-set. Kept as pseudo-labels if the best class clears 0.3. */
export const PSEUDO_THR = 0.3;                         // FRANCK paper: confidence threshold 0.3
export const TEACHER: SlotOut[] = [
  { p: [0.62, 0.03, 0.35], box: [16, 33, 76, 138] },
  { p: [0.21, 0.02, 0.77], box: [22, 24, 72, 120] },
  { p: [0.04, 0.41, 0.55], box: [113, 95, 149, 139] },
  { p: [0.12, 0.05, 0.83], box: [96, 8, 150, 52] },
  { p: [0.05, 0.04, 0.91], box: [4, 120, 50, 158] },
];
/** Student outputs on the strongly augmented foggy picture, hand-set: slot 2 a weak duplicate of the cat, slot 4 calls a
 *  patch of wall "cat". Each slot's feature (what it gathered, toy two numbers) is what a memory bank would store. */
export const STUDENT: (SlotOut & { feat: number[] })[] = [
  { p: [0.48, 0.04, 0.48], box: [14, 30, 78, 136], feat: [0.62, 0.01] },
  { p: [0.36, 0.03, 0.61], box: [20, 22, 74, 122], feat: [0.48, 0.01] },
  { p: [0.05, 0.33, 0.62], box: [112, 92, 150, 140], feat: [0.02, 0.31] },
  { p: [0.34, 0.06, 0.6], box: [92, 14, 146, 64], feat: [0.05, 0.02] },
  { p: [0.06, 0.05, 0.89], box: [4, 120, 50, 158], feat: [0.03, 0.01] },
];
export function pseudoLabels(): GtItem[] {
  const out: GtItem[] = [];
  TEACHER.forEach((s) => {
    const k = argmax(s.p.slice(0, 2));
    if (s.p[k] > PSEUDO_THR) out.push({ cls: CLASSES[k] as "cat" | "cup", box: s.box, name: CLASSES[k] });
  });
  return out;
}
export type Bank = "cat" | "cup" | "bg";
/** Which bank each student slot's feature goes to: by matching to the pseudo-labels (FRANCK's CMMB) or by the student's
 *  own confidence above a threshold (the alternative the paper compares against). */
export function banks(rule: "match" | "thr", thr = PSEUDO_THR): Bank[] {
  if (rule === "thr") return STUDENT.map((s) => { const k = argmax(s.p.slice(0, 2)); return s.p[k] > thr ? (CLASSES[k] as Bank) : "bg"; });
  const pl = pseudoLabels(), { pick } = bestAssign(costMatrix(STUDENT, pl).map((r) => r.map((c) => c.total)));
  const b: Bank[] = STUDENT.map(() => "bg");
  pick.forEach((slot, j) => { b[slot] = pl[j].cls; });
  return b;
}

/* ---- published numbers ---- */

/** DETR (Carion et al., ECCV 2020, arXiv 2005.12872). Table 1, COCO val. GFLOPs, FPS, params (M), AP, AP_S, AP_L. */
export const DETR_T1 = {
  "Faster RCNN-FPN+": { gflops: 180, fps: 26, params: 42, ap: 42.0, aps: 26.6, apl: 53.4 },
  DETR: { gflops: 86, fps: 28, params: 41, ap: 42.0, aps: 20.5, apl: 61.1 },
  "DETR-DC5": { gflops: 187, fps: 12, params: 41, ap: 43.3, aps: 22.5, apl: 61.1 },
};
/** DETR: N = 100 slots; 300-epoch ablation schedule on 16 V100 takes 3 days; 500 epochs for the main comparison;
 *  the Faster R-CNN+ baselines use the 9x schedule (about 109 epochs). */
export const DETR_FACTS = { N: 100, epochsAbl: 300, days: 3, gpus: 16, epochsMain: 500, frcnnPlusEpochs: 109, d: 256, layers: 6 };
/** DETR Table 2: encoder layers 0 vs 6 (AP 36.7 vs 40.6, AP_L 54.2 vs 60.2). */
export const DETR_ENC = { l0: { ap: 36.7, apl: 54.2 }, l6: { ap: 40.6, apl: 60.2 } };
/** DETR Sec. 4.2: AP improves +8.2 (AP) / +9.5 (AP50) from the first to the last decoder layer. */
export const DETR_DEC = { ap: 8.2, ap50: 9.5 };
/** DETR loss ablation: class + ℓ1 + GIoU 40.6; without GIoU 35.8; without ℓ1 39.9. */
export const DETR_LOSS = { all: 40.6, noGiou: 35.8, noL1: 39.9 };
/** Deformable DETR (Zhu et al., ICLR 2021, arXiv 2010.04159). Table 1, COCO val, FPS on V100. */
export const DEFORM_T1 = {
  DETR: { epochs: 500, ap: 42.0, aps: 20.5, gpuh: 2000, fps: 28, gflops: 86 },
  "DETR-DC5 (50)": { epochs: 50, ap: 35.3, aps: 15.2, gpuh: 700, fps: 12, gflops: 187 },
  "Deformable DETR": { epochs: 50, ap: 43.8, aps: 26.4, gpuh: 325, fps: 19, gflops: 173 },
};
export const DEFORM_FACTS = { M: 8, K: 4, queries: 300 };
/** DINO (Zhang et al., ICLR 2023, arXiv 2203.03605), ResNet-50, 5 scales: 49.4 AP at 12 epochs, 51.3 at 24; 900 queries. */
export const DINO_FACTS = { ap12: 49.4, ap24: 51.3, queries: 900 };
/** RT-DETR (Zhao et al., CVPR 2024, arXiv 2304.08069): R50 53.1 AP 108 FPS, R101 54.3 AP 74 FPS on T4; top 300 queries;
 *  the encoder of Deformable DETR is 49% of GFLOPs for 11% of AP (cited from Lin et al.). */
export const RTDETR_FACTS = { r50: { ap: 53.1, fps: 108 }, r101: { ap: 54.3, fps: 74 }, queries: 300, encFlops: 49, encAp: 11 };
/** YOLOv10 Table 1 (copied from yolo-math.ts V10_TABLE1): COCO val, T4 TensorRT FP16, batch 1. */
export const V10_VS = { rt18: { ap: 46.5, lat: 4.58 }, v10s: { ap: 46.3, lat: 2.49 } };
/** FRANCK (Yao et al., IEEE TIP, arXiv 2510.11090), Cityscapes to Foggy Cityscapes, mAP at IoU 0.5. */
export const FRANCK = { ours: 44.9, sourceOnly: 29.6, thr: [43.7, 44.4, 44.3], thrAt: [0.3, 0.6, 0.8], noisy: { thr: 42.1, match: 43.3 }, bank: 100, tau: 0.07 };
