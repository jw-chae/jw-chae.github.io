/** Arithmetic behind the YOLO study scenes: one 160 × 160 picture with the Siamese cat (public/study/cat-pixel.webp)
 *  and a drawn cup, a 4 × 4 grid of cells, IoU and NMS by hand, the two label assignments, YOLOv10's reported numbers,
 *  and YOLOE's name vectors and fold. The answer boxes and the cat's share of each cell are measured from the cat
 *  image's alpha channel at its placement; every model output (cell boxes, scores, features) is hand-set for the
 *  explanation; every published value carries its table in a comment. */

export type Box = [number, number, number, number];   // x1, y1, x2, y2 in picture pixels
export type Mat = number[][];

export const IMG = 160, GRID = 4, CELL = IMG / GRID;

export const area = (b: Box) => Math.max(0, b[2] - b[0]) * Math.max(0, b[3] - b[1]);
export const interBox = (a: Box, b: Box): Box => [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.min(a[2], b[2]), Math.min(a[3], b[3])];
export const inter = (a: Box, b: Box) => area(interBox(a, b));
export const union = (a: Box, b: Box) => area(a) + area(b) - inter(a, b);
export const iou = (a: Box, b: Box) => inter(a, b) / union(a, b);
export const center = (r: number, c: number): [number, number] => [c * CELL + CELL / 2, r * CELL + CELL / 2];
export const inside = (p: [number, number], b: Box) => p[0] > b[0] && p[0] < b[2] && p[1] > b[1] && p[1] < b[3];
export const boxCenter = (b: Box): [number, number] => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
export const cellOf = (p: [number, number]): [number, number] => [Math.floor(p[1] / CELL), Math.floor(p[0] / CELL)];

/* ---- the picture: where the cat is drawn, and what the answer sheet says is there ---- */

/** Size of public/study/cat-pixel.webp in its own pixels (transparent background). */
export const CAT_SRC = { w: 658, h: 720, url: "/study/cat-pixel.webp" };
/** The cat's extent inside that image, in its pixels (left, top, right, bottom edges): columns and rows holding at
 *  least 20 opaque pixels (alpha > 0.5). Measured once from the alpha channel with Python and PIL.
 *  The thin whiskers reach x = 538 but never cover half a picture pixel at this scale, so the answer box leaves them out. */
export const CAT_EXTENT = [98, 8, 503, 718];
/** Where the image is drawn in the picture: its top-left corner and picture pixels per image pixel.
 *  Cat 2 (only in the "two cats" picture of 02) sits right behind cat 1, 0.92 times as large. */
export const CAT_AT = { x: 0.3, y: 30.8, k: 0.15 };
export const CAT2_AT = { x: 14.3, y: 29.8, k: 0.138 };
/** The answer box: the extent mapped into the picture, each edge rounded to the nearest picture pixel
 *  (a picture pixel counts as cat when the cat covers at least half of it). */
const placeBox = (at: { x: number; y: number; k: number }): Box =>
  CAT_EXTENT.map((v, i) => Math.round((i % 2 === 0 ? at.x : at.y) + v * at.k + 1e-9)) as Box;
export const GT_CAT: Box = placeBox(CAT_AT);            // [15, 32, 76, 139]
export const GT_CAT2: Box = placeBox(CAT2_AT);          // [28, 31, 84, 129]
/** The cup is drawn by hand inside this box: rim ellipse on top (y 94 to 100), body down to y 138, handle out to x 148. */
export const GT_CUP: Box = [114, 94, 148, 138];
/** Share of each grid cell covered by cat 1 (row by row), measured from the alpha channel at CAT_AT
 *  (area average at 10× supersampling, Python and PIL). Row 1: left ear edge, face. Row 2: haunch, chest
 *  and front legs. Row 3: tail, paws. */
export const CAT_COVER: number[][] = [
  [0.0031, 0.0448, 0, 0],
  [0.0632, 0.7548, 0.0005, 0],
  [0.405, 0.7102, 0, 0],
  [0.2497, 0.3061, 0, 0],
];
/** Share of the answer box GT_CAT covered by the cat (same measurement). */
export const CAT_BOX_SHARE = 0.621;

/* ---- 01 · what one cell writes out (YOLOv1 style: box, objectness, class probabilities given an object) ---- */

export type CellOut = { r: number; c: number; box: Box; obj: number; pCat: number; pCup: number };
export const NAMES2 = ["cat", "cup"] as const;

/** Row and column of the cells the chapter follows. A to D: the four cells whose centres lie inside the cat. E: the cup's cell. */
export type CellId = "A" | "B" | "C" | "D" | "E";
export const RC: Record<CellId, [number, number]> = { A: [2, 1], B: [1, 1], C: [2, 0], D: [1, 0], E: [2, 3] };
export const idOf = (r: number, c: number): CellId | "" => (Object.keys(RC) as CellId[]).find((k) => RC[k][0] === r && RC[k][1] === c) ?? "";

/** Hand-set boxes the cells write, placed around the measured cat: A (chest and front legs) close to the answer,
 *  B (face) pulled up, C (haunch) pulled left and down, D (mostly wall, edge of the left ear) pulled up. */
const BOX_A: Box = [12, 30, 78, 140];
const BOX_B: Box = [20, 20, 70, 130];
const BOX_C: Box = [4, 40, 80, 150];
const BOX_D: Box = [10, 20, 70, 110];
const BOX_E: Box = [110, 90, 150, 140];
export const BOXES = { A: BOX_A, B: BOX_B, C: BOX_C, D: BOX_D, E: BOX_E };
/** The box written for the second cat in the two-cat picture (hand-set, close to GT_CAT2). */
export const BOX_F: Box = [28, 30, 80, 130];

/** Hand-set outputs of all sixteen cells after training. Background cells still write a box; it is small and nobody reads it. */
export const CELLS: CellOut[] = (() => {
  const out: CellOut[] = [];
  const bg: [number, number][] = [[0.04, 0.5], [0.03, 0.6], [0.05, 0.3], [0.05, 0.5], [0.02, 0.4], [0.08, 0.7], [0.2, 0.5], [0.06, 0.2], [0.03, 0.5], [0.04, 0.55], [0.05, 0.45], [0.03, 0.35]];
  let k = 0;
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
    const [cx, cy] = center(r, c);
    const key = idOf(r, c);
    if (key === "A") out.push({ r, c, box: BOX_A, obj: 0.9, pCat: 0.8, pCup: 0.2 });
    else if (key === "B") out.push({ r, c, box: BOX_B, obj: 0.7, pCat: 0.9, pCup: 0.1 });
    else if (key === "C") out.push({ r, c, box: BOX_C, obj: 0.6, pCat: 0.85, pCup: 0.15 });
    else if (key === "D") out.push({ r, c, box: BOX_D, obj: 0.3, pCat: 0.8, pCup: 0.2 });
    else if (key === "E") out.push({ r, c, box: BOX_E, obj: 0.85, pCat: 0.1, pCup: 0.9 });
    else {
      const [obj, pCat] = bg[k++];
      out.push({ r, c, box: [cx - 14, cy - 14, cx + 14, cy + 14], obj, pCat, pCup: Math.round((1 - pCat) * 100) / 100 });
    }
  }
  return out;
})();
export const cellAt = (r: number, c: number) => CELLS[r * GRID + c];
/** Class-specific score at test time: objectness times the class probability given an object. */
export const scoreOf = (o: CellOut, cls: "cat" | "cup") => o.obj * (cls === "cat" ? o.pCat : o.pCup);

/* ---- 02 · IoU by hand and NMS step by step ---- */

export type Cand = { id: string; box: Box; score: number; cls: "cat" | "cup" };
export const SCORE_MIN = 0.3;          // hand-set: candidates must score above this before NMS
export const cand = (id: CellId, cls: "cat" | "cup"): Cand => ({ id, box: BOXES[id], score: scoreOf(cellAt(...RC[id]), cls), cls });
/** All candidate boxes of the one-cat picture, by class, before the score cut. */
export const CANDS_ONE: Cand[] = [cand("A", "cat"), cand("B", "cat"), cand("C", "cat"), cand("D", "cat"), cand("E", "cup")];
/** The two-cat picture: the same four cat boxes plus one box on the second cat. */
export const CAND_F: Cand = { id: "F", box: BOX_F, score: 0.58, cls: "cat" };
export const CANDS_TWO: Cand[] = [...CANDS_ONE.slice(0, 4), CAND_F, CANDS_ONE[4]];

export type NmsStep = { keep: string; removed: { id: string; iou: number }[]; spared: { id: string; iou: number }[] };
export type NmsRun = { sorted: Cand[]; steps: NmsStep[]; kept: string[]; comparisons: number };

/** Greedy NMS within each class: take the highest score, drop every remaining box whose IoU with it exceeds the threshold, repeat. */
export function nms(cands: Cand[], thr: number): NmsRun {
  const sorted = cands.filter((c) => c.score > SCORE_MIN).sort((a, b) => b.score - a.score);
  let left = [...sorted];
  const steps: NmsStep[] = [], kept: string[] = [];
  let comparisons = 0;
  while (left.length) {
    const top = left[0];
    kept.push(top.id);
    const rest = left.slice(1).filter((c) => c.cls === top.cls);
    const other = left.slice(1).filter((c) => c.cls !== top.cls);
    const removed: NmsStep["removed"] = [], spared: NmsStep["spared"] = [];
    rest.forEach((c) => {
      const v = iou(top.box, c.box);
      comparisons++;
      (v > thr ? removed : spared).push({ id: c.id, iou: v });
    });
    steps.push({ keep: top.id, removed, spared });
    const gone = new Set(removed.map((x) => x.id));
    left = [...rest.filter((c) => !gone.has(c.id)), ...other].sort((a, b) => b.score - a.score);
  }
  return { sorted, steps, kept, comparisons };
}
export const THRESHOLDS = [0.5, 0.6, 0.7];

/* ---- 03 · training: which cells are told "this is the cat" ---- */

/** One moment during training: the cat score each of the four cells gives now (hand-set), and its box. */
export const TRAIN_P = { A: 0.25, B: 0.9, C: 0.3, D: 0.2 };
export const TRAIN_IDS = ["A", "B", "C", "D"] as const;
export type TrainId = (typeof TRAIN_IDS)[number];
export const TOPK = 3;                 // hand-set number of positives for one-to-many in this example
export const ALPHA = 0.5, BETA = 6;    // YOLOv10 paper: α_o2m = 0.5, β_o2m = 6.0, taken from YOLOv8

/** s: is the cell's centre inside the cat's answer box? */
export const spatial = (id: TrainId) => (inside(center(...RC[id]), GT_CAT) ? 1 : 0);
export const trainIou = (id: TrainId) => iou(BOXES[id], GT_CAT);
/** YOLOv10 Eq. 1: m(α, β) = s · p^α · IoU^β */
export const metric = (id: TrainId, a = ALPHA, b = BETA) => spatial(id) * TRAIN_P[id] ** a * trainIou(id) ** b;
export const rankBy = (a: number, b: number) => [...TRAIN_IDS].sort((x, y) => metric(y, a, b) - metric(x, a, b));

/** u*: the largest IoU any prediction has with the cat. */
export const U_STAR = Math.max(...TRAIN_IDS.map(trainIou));

export type Assign = { pos: TrainId[]; target: Record<TrainId, number> };
/** One-to-many: the top-k cells by the metric are positives; target t_j = u* · m_j / m*. Others get 0. */
export function assignO2M(a = ALPHA, b = BETA, k = TOPK): Assign {
  const order = rankBy(a, b), pos = order.slice(0, k), mStar = metric(order[0], a, b);
  const target = { A: 0, B: 0, C: 0, D: 0 } as Record<TrainId, number>;
  pos.forEach((id) => { target[id] = (U_STAR * metric(id, a, b)) / mStar; });
  return { pos, target };
}
/** One-to-one: only the single best cell is a positive and its target is u*. */
export function assignO2O(a = ALPHA, b = BETA): Assign {
  const best = rankBy(a, b)[0];
  const target = { A: 0, B: 0, C: 0, D: 0 } as Record<TrainId, number>;
  target[best] = U_STAR;
  return { pos: [best], target };
}
/** YOLOv10 Eq. 2: the supervision gap A = t_o2o,i − 1(i∈Ω)·t_o2m,i + Σ_{k∈Ω\{i}} t_o2m,k */
export function gap(o2m: Assign, o2o: Assign): number {
  const i = o2o.pos[0];
  const inOmega = o2m.pos.includes(i);
  return o2o.target[i] - (inOmega ? o2m.target[i] : 0) + o2m.pos.filter((k) => k !== i).reduce((s, k) => s + o2m.target[k], 0);
}
/** The o2o metric choices in the figure: consistent with r = 1 and r = 2, and the inconsistent β = 2 of the paper's Fig. 2(b). */
export const O2O_CHOICES: { key: string; a: number; b: number }[] = [
  { key: "r1", a: 0.5, b: 6 },
  { key: "r2", a: 1, b: 12 },
  { key: "b2", a: 0.5, b: 2 },
];

/* ---- 04 · inference with only the one-to-one head (its scores are hand-set to show what it was trained to do) ---- */

export const O2O_SCORE: Record<CellId, number> = { A: 0.7, B: 0.12, C: 0.07, D: 0.04, E: 0.68 };
export const O2M_SCORE: Record<CellId, number> = { A: scoreOf(cellAt(...RC.A), "cat"), B: scoreOf(cellAt(...RC.B), "cat"), C: scoreOf(cellAt(...RC.C), "cat"), D: scoreOf(cellAt(...RC.D), "cat"), E: scoreOf(cellAt(...RC.E), "cup") };

/* ---- published numbers: YOLOv10 (arXiv 2405.14458, NeurIPS 2024). COCO val, T4 GPU, TensorRT FP16, batch 1 ---- */

/** Table 1. Latency includes post-processing (TensorRT efficientNMSPlugin), Latency^f is the forward pass only. */
export const V10_TABLE1 = {
  "YOLOv8-S": { params: 11.2, flops: 28.6, ap: 44.9, lat: 7.07, latF: 2.33 },
  "YOLOv8-N": { params: 3.2, flops: 8.7, ap: 37.3, lat: 6.16, latF: 1.77 },
  "YOLOv9-C": { params: 25.3, flops: 102.1, ap: 52.5, lat: 10.57, latF: 6.13 },
  "RT-DETR-R18": { params: 20.0, flops: 60.0, ap: 46.5, lat: 4.58, latF: 4.49 },
  "YOLOv10-N": { params: 2.3, flops: 6.7, ap: 38.5, lat: 1.84, latF: 1.79 },
  "YOLOv10-S": { params: 7.2, flops: 21.6, ap: 46.3, lat: 2.49, latF: 2.39 },
  "YOLOv10-M": { params: 15.4, flops: 59.1, ap: 51.1, lat: 4.74, latF: 4.63 },
  "YOLOv10-B": { params: 19.1, flops: 92.0, ap: 52.5, lat: 5.74, latF: 5.67 },
  "YOLOv10-L": { params: 24.4, flops: 120.3, ap: 53.2, lat: 7.28, latF: 7.21 },
  "YOLOv10-X": { params: 29.5, flops: 160.4, ap: 54.4, lat: 10.7, latF: 10.6 },
} as const;
/** Table 16: YOLOv10-S if NMS is run on it anyway. */
export const V10S_WITH_NMS = 7.15;
/** Table 3, on YOLOv8-S: AP and latency for each assignment. */
export const V10_TABLE3 = { o2m: { ap: 44.9, lat: 7.07 }, o2o: { ap: 43.4, lat: 2.44 }, dual: { ap: 44.3, lat: 2.44 } };
/** Table 4: AP of the NMS-free YOLOv8-S for each (α_o2o, β_o2o), with α_o2m = 0.5, β_o2m = 6. */
export const V10_TABLE4: { a: number; b: number; ap: number }[] = [
  { a: 0.5, b: 2.0, ap: 42.7 }, { a: 0.5, b: 4.0, ap: 44.2 }, { a: 0.5, b: 6.0, ap: 44.3 }, { a: 0.5, b: 8.0, ap: 44.0 },
  { a: 0.25, b: 3.0, ap: 44.3 }, { a: 0.25, b: 6.0, ap: 43.5 }, { a: 1.0, b: 6.0, ap: 43.9 }, { a: 1.0, b: 12.0, ap: 44.3 },
];
/** Table 2 (S) and Table 5 (S), the roadmap from YOLOv8-S with NMS to YOLOv10-S. */
export type Road = { key: string; params: number; flops: number; ap: number; lat: number };
export const V10_ROAD_S: Road[] = [
  { key: "base", params: 11.2, flops: 28.6, ap: 44.9, lat: 7.07 },   // Table 2 #1: YOLOv8-S with NMS
  { key: "free", params: 11.2, flops: 28.6, ap: 44.3, lat: 2.44 },   // #2: NMS-free (consistent dual assignments)
  { key: "cls", params: 9.9, flops: 23.5, ap: 44.2, lat: 2.39 },     // Table 5 #2: lightweight classification head
  { key: "down", params: 8.0, flops: 22.2, ap: 44.4, lat: 2.36 },    // Table 5 #3: spatial-channel decoupled downsampling
  { key: "block", params: 6.2, flops: 20.8, ap: 44.5, lat: 2.31 },   // Table 5 #4 = Table 2 #3: rank-guided block design
  { key: "acc", params: 7.2, flops: 21.6, ap: 46.3, lat: 2.49 },     // Table 2 #4: large-kernel conv + PSA
];
export const V10_ROAD_M: Road[] = [
  { key: "base", params: 25.9, flops: 78.9, ap: 50.6, lat: 9.5 },    // Table 2 #5: YOLOv8-M with NMS
  { key: "free", params: 25.9, flops: 78.9, ap: 50.3, lat: 5.22 },   // #6
  { key: "cls", params: 23.2, flops: 67.7, ap: 50.2, lat: 5.07 },    // Table 5 #2
  { key: "down", params: 19.7, flops: 65.0, ap: 50.4, lat: 4.97 },   // Table 5 #3
  { key: "block", params: 14.1, flops: 58.1, ap: 50.4, lat: 4.57 },  // Table 5 #4 = Table 2 #7
  { key: "acc", params: 15.4, flops: 59.1, ap: 51.1, lat: 4.74 },    // Table 2 #8 (PSA only: no large kernel for M)
];
/** Sec. 3.2: in YOLOv8-S the classification head costs 5.95 GFLOPs / 1.51 M parameters, the regression head 2.34 G / 0.64 M. */
export const V8S_HEADS = { cls: { flops: 5.95, params: 1.51 }, reg: { flops: 2.34, params: 0.64 } };
/** Table 6: AP with classification errors removed vs regression errors removed (YOLOv10-S, base and +cls). */
export const V10_TABLE6 = { base: { ap: 44.3, woC: 59.9, woR: 64.5 }, cls: { ap: 44.2, woC: 59.9, woR: 64.2 } };
/** Table 9: AP as stages are switched to CIB in the order of rising intrinsic rank (8, 4, 7, ...). */
export const V10_TABLE9 = [{ stages: "-", ap: 44.4 }, { stages: "8", ap: 44.5 }, { stages: "8,4", ap: 44.5 }, { stages: "8,4,7", ap: 44.3 }];
/** Sec. 4.3: on YOLOv10-S, large-kernel conv +0.4 AP for +0.03 ms, PSA +1.4 AP for +0.15 ms; limitation: o2m+NMS beats NMS-free by 1.0 (N) and 0.5 (S) AP. */
export const V10_ACC = { lk: { ap: 0.4, ms: 0.03 }, psa: { ap: 1.4, ms: 0.15 } };
export const V10_GAP = { N: 1.0, S: 0.5 };

/** The downsampling cost of Sec. 3.2 written out for one example size (H = W = 80, C = 64 chosen by hand). */
export function downsample(H: number, W: number, C: number) {
  const regular = { macs: (H / 2) * (W / 2) * 9 * C * 2 * C, params: 9 * C * 2 * C };
  const pw = { macs: H * W * C * 2 * C, params: C * 2 * C };                  // 1×1, C → 2C, full resolution
  const dw = { macs: (H / 2) * (W / 2) * 9 * 2 * C, params: 9 * 2 * C };      // 3×3 depthwise, stride 2, on 2C channels
  return { regular, decoupled: { macs: pw.macs + dw.macs, params: pw.params + dw.params }, pw, dw };
}
export const DS_EX = { H: 80, W: 80, C: 64 };

/* ---- 06 · names as vectors (YOLOE text-prompt path). D′ = 4, D = 3, all hand-set ---- */

/** The feature each cell hands to the last 1×1 convolution of the head (D′ = 4 numbers). Hand-set, loosely following
 *  the picture: A (chest), B (face), C (haunch) lean the "cat" way, D (mostly wall) less so, E the "cup" way; the
 *  bottom-row cells with the tail and paws get a weaker cat-like feature, the cup's bottom cell a weak cup-like one. */
export const FEAT: number[][] = (() => {
  const f: number[][] = [];
  const parts: Record<string, number[]> = { "3,0": [0.8, 0, 0.3, 0], "3,1": [1, 0, 0.4, 0.2], "0,1": [0.3, 0, 0.1, 0.1], "3,3": [0.1, 0.8, 0, 0.4] };
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) {
    const key = idOf(r, c);
    const v: Record<string, number[]> = { A: [2, 0, 1, 0], B: [1.5, 0, 1, 0.5], C: [1.5, 0.5, 0.5, 0], D: [1, 0, 0.5, 0.5], E: [0, 2, 0, 1] };
    f.push(v[key] ?? parts[`${r},${c}`] ?? [0.2, 0.1, 0, ((r + c) % 3) * 0.1]);
  }
  return f;
})();
/** Last 1×1 convolution of the object embedding head: D = 3 outputs from D′ = 4 inputs. */
export const K_EMB: Mat = [[1, 0, 0.5, 0], [0, 1, 0, 0.5], [0.5, 0, 1, 0]];
/** A closed-set head of the same place: one row per class, cat and cup. Hand-set. */
export const K_CLS: Mat = [[1, 0, 1, 0], [0, 1, 0, 0.5]];

export const matVec = (M: Mat, x: number[]) => M.map((row) => row.reduce((s, v, j) => s + v * x[j], 0));
export const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
export const matMul = (A: Mat, B: Mat): Mat => A.map((row) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
const unit = (v: number[]) => { const n = Math.sqrt(dot(v, v)); return v.map((x) => x / n); };

/** Names the YOLOE sections use: the two closed-set names, then "Siamese cat" (the breed of the cat in the picture,
 *  added after training) and "hat" (nothing like it in the picture). */
export type NameKey = "cat" | "cup" | "siam" | "hat";
export const NAME_KEYS: NameKey[] = ["cat", "cup", "siam", "hat"];
/** Stand-ins for what a text encoder returns for each name, length 1. Real ones have hundreds of numbers.
 *  "Siamese cat" is set close to "cat", as a real text encoder tends to place names of similar meaning. */
export const TEXT: Record<NameKey, number[]> = {
  cat: unit([0.8, 0, 0.6]),
  cup: unit([0, 1, 0]),
  siam: unit([0.6, 0, 0.8]),
  hat: unit([-0.6, 0, -0.8]),
};
export const EMB = FEAT.map((x) => matVec(K_EMB, x));             // O: one D = 3 vector per cell
export const scoreName = (cell: number, name: NameKey, P: Record<NameKey, number[]> = TEXT) => dot(EMB[cell], P[name]);
export const IDX = { A: RC.A[0] * GRID + RC.A[1], B: RC.B[0] * GRID + RC.B[1], C: RC.C[0] * GRID + RC.C[1], D: RC.D[0] * GRID + RC.D[1], E: RC.E[0] * GRID + RC.E[1], bg: 3 };

/* ---- 07 · RepRTA: refine the name vectors during training, then fold them into the last convolution ---- */

/** What f_θ might return for each name after training. Hand-set: the fold works for any values here. */
export const TEXT_REFINED: Record<NameKey, number[]> = {
  cat: [0.9, -0.1, 0.4],
  cup: [0.05, 0.95, -0.1],
  siam: [0.3, 0, 0.9],
  hat: [-0.5, 0.1, -0.8],
};
/** K′ = f_θ(P) · K: C rows of D′ numbers, the kernel of a plain C-class 1×1 convolution. */
export const fold = (names: NameKey[], P: Record<NameKey, number[]> = TEXT_REFINED): Mat => matMul(names.map((n) => P[n]), K_EMB);
/** Scores of one cell by the two-step path (I → K → O, then O · P̃) and by the folded path (I → K′). */
export function twoWays(cell: number, names: NameKey[]) {
  const O = matVec(K_EMB, FEAT[cell]);
  const twoStep = names.map((n) => dot(O, TEXT_REFINED[n]));
  const oneStep = matVec(fold(names), FEAT[cell]);
  return { O, twoStep, oneStep, gap: Math.max(...twoStep.map((v, i) => Math.abs(v - oneStep[i]))) };
}
/** Multiply-adds per cell: two-step D·D′ + C·D, folded C·D′. */
export const macsTwoStep = (C: number) => K_EMB.length * K_EMB[0].length + C * K_EMB.length;
export const macsFolded = (C: number) => C * K_EMB[0].length;

/* ---- 08 · visual prompt (SAVPE, toy with one group) and prompt-free retrieval (LRPC) ---- */

/** The box a user draws around the cat (hand-set, a little looser than the answer box on the left, top and right).
 *  The cells whose centres fall inside it are A, B, C, D. Toy: semantic features = the cells' embeddings, one weight group. */
export const PROMPT_BOX: Box = [13, 30, 78, 139];
export const PROMPT_CELLS = [IDX.A, IDX.B, IDX.C, IDX.D];
/** Share of the prompt box covered by the cat (same alpha measurement as CAT_COVER). */
export const PROMPT_BOX_SHARE = 0.573;
export const ACT_LOGITS = [1.2, 0.6, 0.2, -0.4];                 // hand-set activation-branch outputs in A, B, C, D (D is mostly wall)
export const softmax = (z: number[]) => { const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); };
export const ACT_W = softmax(ACT_LOGITS);
export const POOL_W = PROMPT_CELLS.map(() => 1 / PROMPT_CELLS.length);
/** Weighted sum of the semantic features inside the box, scaled to length 1 like the text prompts. */
export const visualPrompt = (w: number[]) => unit([0, 1, 2].map((d) => PROMPT_CELLS.reduce((s, cell, i) => s + w[i] * EMB[cell][d], 0)));

/** LRPC: a "something is here" score per cell (hand-set), then only cells above δ are compared with the built-in vocabulary.
 *  Set to follow the picture: highest in the cells holding the cat's and the cup's centres, between 0.001 and 0.01 in the
 *  bottom cells with the tail, the paws and the cup's bottom, below 0.001 on the wall (the ear tips in row 0 included). */
export const VOCAB = 4585;                                     // YOLOE: tag list with 4585 category names
export const ANCHORS_REAL = 8400;                              // YOLOE appendix B: total anchor points in the baseline
export const OBJ_ANY: number[] = [
  0.0002, 0.0006, 0.0002, 0.0001,
  0.31, 0.62, 0.0004, 0.0002,
  0.55, 0.93, 0.0009, 0.86,
  0.0035, 0.0042, 0.0006, 0.0012,
];
/** Cells (row-major) holding parts of the cat or the cup whose centres are elsewhere: tail, paws and tail, cup's bottom. */
export const PART_CELLS = { tail: 12, paws: 13, cupBottom: 15 };
export const DELTAS = [0.0001, 0.001, 0.01];
export const kept = (delta: number) => OBJ_ANY.map((v, i) => (v > delta ? i : -1)).filter((i) => i >= 0);
/** YOLOE Table 7 (LVIS minival, prompt-free, T4): FPS and AP without LRPC and with each δ. */
export const YOLOE_TABLE7 = {
  S: [{ d: "none", ap: 21.0, fps: 56.5 }, { d: "1e-3", ap: 21.0, fps: 95.8 }, { d: "1e-4", ap: 21.0, fps: 66.1 }, { d: "1e-2", ap: 20.8, fps: 106 }],
  L: [{ d: "none", ap: 27.2, fps: 19.9 }, { d: "1e-3", ap: 27.2, fps: 25.3 }],
};

/* ---- published numbers: YOLOE (arXiv 2503.07465, ICCV 2025) ---- */

/** Table 1: LVIS minival zero-shot, Fixed AP, text prompts; FPS on T4 TensorRT / iPhone 12 CoreML; training hours on 8 RTX4090. */
export const YOLOE_TABLE1 = {
  "YOLO-Worldv2-S": { params: 13, hours: 41.7, fpsT4: 216.4, fpsIp: 48.9, ap: 24.4, apr: 17.1 },
  "YOLOE-v8-S": { params: 12, hours: 12.0, fpsT4: 305.8, fpsIp: 64.3, ap: 27.9, apr: 22.3 },
  "YOLO-Worldv2-L": { params: 48, hours: 80.0, fpsT4: 80.0, fpsIp: 22.1, ap: 35.5, apr: 25.6 },
  "YOLOE-v8-L": { params: 45, hours: 22.5, fpsT4: 102.5, fpsIp: 27.2, ap: 35.9, apr: 33.2 },
};
/** Table 5: roadmap on the L model, LVIS minival standard AP, FPS T4 / iPhone 12. */
export const YOLOE_TABLE5 = [
  { key: "world", ap: 33.0, fps: 80.0 },
  { key: "epochs", ap: 31.0, fps: 80.0 },
  { key: "neg", ap: 31.9, fps: 80.0 },
  { key: "nofusion", ap: 30.0, fps: 102.5 },
  { key: "mobileclip", ap: 31.5, fps: 102.5 },
  { key: "reprta", ap: 33.5, fps: 102.5 },
  { key: "seg", ap: 33.3, fps: 102.5 },
];
/** Sec. 4.4: COCO transfer, full tuning. YOLOE-v8-L 53.0 AP^b / 42.7 AP^m after 80 epochs vs YOLOv8-L 52.4 / 42.3 after 300. */
export const YOLOE_COCO = { yoloe: { apb: 53.0, apm: 42.7, epochs: 80 }, v8: { apb: 52.4, apm: 42.3, epochs: 300 } };
/** Table 6: SAVPE vs mask pooling, +1.5 AP; 31.9 AP at A = 16. */
export const YOLOE_SAVPE = { gain: 1.5, ap: 31.9, groups: 16 };
