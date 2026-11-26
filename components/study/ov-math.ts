/** Arithmetic behind the open-vocabulary study scenes. The picture is the YOLO chapter's: 160 × 160 pixels, the
 *  Siamese cat (public/study/cat-pixel.webp) and a drawn cup, a 4 × 4 grid of 40-pixel cells. The picture constants are
 *  copied from yolo-math.ts so this module stays import-free for node. Every vector (cell features, image and text
 *  embeddings, refined name vectors) is hand-set for the explanation; every published value carries its source in a comment. */

export type Box = [number, number, number, number];   // x1, y1, x2, y2 in picture pixels
export type Mat = number[][];

/* ---- the picture (copied from yolo-math.ts) ---- */

export const IMG = 160, GRID = 4, CELL = IMG / GRID;
export const center = (r: number, c: number): [number, number] => [c * CELL + CELL / 2, r * CELL + CELL / 2];
export const inside = (p: [number, number], b: Box) => p[0] > b[0] && p[0] < b[2] && p[1] > b[1] && p[1] < b[3];
/** The cat's answer box (measured from the image's alpha channel in yolo-math.ts) and the cup's drawn box. */
export const GT_CAT: Box = [15, 32, 76, 139];
export const GT_CUP: Box = [114, 94, 148, 138];
/** The cells the chapter follows: A chest and front legs, B face, C haunch, D edge of the left ear, E the cup. */
export type CellId = "A" | "B" | "C" | "D" | "E";
export const RC: Record<CellId, [number, number]> = { A: [2, 1], B: [1, 1], C: [2, 0], D: [1, 0], E: [2, 3] };
export const idOf = (r: number, c: number): CellId | "" => (Object.keys(RC) as CellId[]).find((k) => RC[k][0] === r && RC[k][1] === c) ?? "";
export const IDX = { A: RC.A[0] * GRID + RC.A[1], B: RC.B[0] * GRID + RC.B[1], C: RC.C[0] * GRID + RC.C[1], D: RC.D[0] * GRID + RC.D[1], E: RC.E[0] * GRID + RC.E[1] };
/** Cells (row-major) with parts of the cat or the cup whose centres are elsewhere: tail, paws and tail, the cup's bottom. */
export const PART_CELLS = { tail: 12, paws: 13, cupBottom: 15 };

/* ---- small linear algebra ---- */

export const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
export const matVec = (M: Mat, x: number[]) => M.map((row) => row.reduce((s, v, j) => s + v * x[j], 0));
export const matMul = (A: Mat, B: Mat): Mat => A.map((row) => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
export const unit = (v: number[]) => { const n = Math.sqrt(dot(v, v)); return v.map((x) => x / n); };
export const softmax = (z: number[]) => { const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); };
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

/* ---- 01 · a closed head: one row of weights per name fixed at training (all hand-set) ---- */

/** The feature each cell hands to the last 1×1 convolution of the head (D′ = 4 numbers). Hand-set, loosely following
 *  the picture: A (chest), B (face), C (haunch) lean the "cat" way, D (mostly wall) less so, E the "cup" way; the
 *  bottom-row cells with the tail and paws get a weaker cat-like feature, the cup's bottom cell a weak cup-like one. */
export const FEAT: number[][] = (() => {
  const f: number[][] = [];
  const parts: Record<string, number[]> = { "3,0": [0.8, 0, 0.3, 0], "3,1": [1, 0, 0.4, 0.2], "0,1": [0.3, 0, 0.1, 0.1], "3,3": [0.1, 0.8, 0, 0.4] };
  const v: Record<string, number[]> = { A: [2, 0, 1, 0], B: [1.5, 0, 1, 0.5], C: [1.5, 0.5, 0.5, 0], D: [1, 0, 0.5, 0.5], E: [0, 2, 0, 1] };
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) f.push(v[idOf(r, c)] ?? parts[`${r},${c}`] ?? [0.2, 0.1, 0, ((r + c) % 3) * 0.1]);
  return f;
})();
/** A closed-set head: one row per class, cat and cup. Hand-set. */
export const K_CLS: Mat = [[1, 0, 1, 0], [0, 1, 0, 0.5]];
/** A row written by hand for "Siamese cat": a copy of the cat row, the only guess that is not arbitrary. */
export const ROW_GUESS = [...K_CLS[0]];
export const closedScore = (cell: number, row: number[]) => dot(row, FEAT[cell]);

/* ---- names as vectors: what a text encoder returns for each prompt (hand-set, length 1, D = 3) ---- */

export type NameKey = "cat" | "cup" | "siam" | "hat";
export const NAME_KEYS: NameKey[] = ["cat", "cup", "siam", "hat"];
/** Stand-ins for the text encoder's vector of "A photo of a {name}.". Real ones have hundreds of numbers.
 *  "Siamese cat" is set close to "cat", as a text encoder tends to place names of similar meaning; "hat" points away. */
export const TEXT: Record<NameKey, number[]> = {
  cat: unit([0.8, 0, 0.6]),
  cup: unit([0, 1, 0]),
  siam: unit([0.6, 0, 0.8]),
  hat: unit([-0.6, 0, -0.8]),
};

/* ---- 02 · CLIP's contrastive training on a batch of three (image, caption) pairs (hand-set) ---- */

/** Logit scale of the toy. CLIP learns it: initialised to the equivalent of τ = 0.07 (a factor 1/0.07 ≈ 14.3) and
 *  clipped so the logits are never scaled by more than 100 (Radford et al. 2021, Sec. 2.5). */
export const SCALE = 10;
export const TAU0 = 0.07, SCALE_MAX = 100;
/** Crops of the picture used as the three training images, and the full picture for 03. */
export const CROPS: Record<"all" | "cat" | "cup" | "wall", Box> = { all: [0, 0, IMG, IMG], cat: GT_CAT, cup: GT_CUP, wall: [112, 8, 152, 48] };
export type Moment = "start" | "trained" | "collapsed";
export type Batch = { img: number[][]; txt: number[][] };
/** Image vectors after training: the cat crop sits a little nearer "Siamese cat" than "cat", the whole picture between
 *  the cat and the cup. Reused as the trained image encoder's outputs in 03. */
export const IMG_VEC = {
  cat: unit([0.66, 0.04, 0.75]),
  cup: unit([0.08, 0.98, 0.05]),
  wall: unit([-0.55, 0.35, 0.72]),
  all: unit([0.55, 0.55, 0.5]),
};
/** Caption vectors after training: "a Siamese cat sitting by the wall", "a white mug", "an empty peach wall". */
const TXT_TRAINED = [unit([0.4, 0.3, 0.86]), unit([0.25, 0.95, 0.15]), unit([-0.35, 0.65, 0.65])];
/** Before training: the encoders' outputs are unrelated to the content; hand-set so that every cosine is near 0. */
const IMG_START = [unit([1, 0.1, 0.05]), unit([1, -0.05, 0.12]), unit([1, 0.08, -0.1])];
const TXT_START = [unit([0.05, 1, 0.1]), unit([-0.1, 1, -0.05]), unit([0.12, 1, 0.08])];
const SAME = unit([0.5, 0.5, 0.7]);
export const BATCHES: Record<Moment, Batch> = {
  start: { img: IMG_START, txt: TXT_START },
  trained: { img: [IMG_VEC.cat, IMG_VEC.cup, IMG_VEC.wall], txt: TXT_TRAINED },
  collapsed: { img: [SAME, SAME, SAME], txt: [SAME, SAME, SAME] },
};
/** N × N cosines (rows: images, columns: captions). */
export const cosTable = (b: Batch): Mat => b.img.map((u) => b.txt.map((v) => dot(u, v)));
/** CLIP's symmetric loss: cross entropy of each image over the captions (rows) and of each caption over the images (columns). */
export function clipLoss(b: Batch, scale = SCALE) {
  const z = cosTable(b).map((row) => row.map((v) => v * scale));
  const N = z.length;
  const rows = z.map(softmax);
  const cols = z[0].map((_, j) => softmax(z.map((row) => row[j])));      // cols[j][i] = P(image i | caption j)
  const lossImg = -rows.reduce((s, r, i) => s + Math.log(r[i]), 0) / N;
  const lossTxt = -cols.reduce((s, c, j) => s + Math.log(c[j]), 0) / N;
  const diag = cosTable(b).reduce((s, r, i) => s + r[i], 0) / N;
  return { z, rows, cols, lossImg, lossTxt, loss: (lossImg + lossTxt) / 2, diag };
}

/* ---- 03 · zero-shot classification with name vectors ---- */

export const NAME_LISTS: NameKey[][] = [["cat", "cup"], ["cat", "cup", "siam"], ["cat", "cup", "siam", "hat"]];
export function zeroShot(img: number[], names: NameKey[], scale = SCALE) {
  const cos = names.map((n) => dot(img, TEXT[n]));
  return { cos, share: softmax(cos.map((v) => v * scale)) };
}

/* ---- 04 · one vector per cell, compared with the name vectors (YOLOE's object embedding head; D′ = 4, D = 3) ---- */

/** Last 1×1 convolution of the object embedding head: D = 3 outputs from D′ = 4 inputs. Hand-set. */
export const K_EMB: Mat = [[1, 0, 0.5, 0], [0, 1, 0, 0.5], [0.5, 0, 1, 0]];
export const EMB = FEAT.map((x) => matVec(K_EMB, x));             // O: one D = 3 vector per cell
export const scoreName = (cell: number, name: NameKey, P: Record<NameKey, number[]> = TEXT) => dot(EMB[cell], P[name]);

/* ---- 05 · letting the names into the image path (toy versions of the two published operations) ---- */

export const FUSION_LISTS: NameKey[][] = [["cat", "cup"], ["cup"]];
/** Best match of a cell with any name in the list: max_j (o · w_j). */
export const maxSim = (cell: number, names: NameKey[]) => Math.max(...names.map((n) => scoreName(cell, n)));
/** YOLO-World's max-sigmoid attention, X′ = X · δ(max_j X W_jᵀ), applied in the toy to the cell vectors themselves:
 *  each cell's features are multiplied by this gate. */
export const gate = (cell: number, names: NameKey[]) => sigmoid(maxSim(cell, names));
/** Grounding DINO's language-guided query selection, Top_Nq(Max(X_I X_Tᵀ)): the Nq cells with the highest best match. */
export const NQ_TOY = 3, NQ_PAPER = 900;
export const topQueries = (names: NameKey[], k = NQ_TOY) => FEAT.map((_, i) => i).sort((a, b) => maxSim(b, names) - maxSim(a, names)).slice(0, k);

/* ---- 06 · RepRTA: refine the name vectors during training, then fold them into the last convolution ---- */

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

/* ---- 07 · visual prompt (SAVPE, toy with one group) and prompt-free retrieval (LRPC) ---- */

/** The box a user draws around the cat (hand-set, a little looser than the answer box on the left).
 *  The cells whose centres fall inside it are A, B, C, D. Toy: semantic features = the cells' embeddings, one weight group. */
export const PROMPT_BOX: Box = [13, 30, 78, 139];
export const PROMPT_CELLS = [IDX.A, IDX.B, IDX.C, IDX.D];
/** Share of the prompt box covered by the cat (alpha measurement of yolo-math.ts, the method behind CAT_COVER). */
export const PROMPT_BOX_SHARE = 0.573;
export const ACT_LOGITS = [1.2, 0.6, 0.2, -0.4];                 // hand-set activation-branch outputs in A, B, C, D (D is mostly wall)
export const ACT_W = softmax(ACT_LOGITS);
export const POOL_W = PROMPT_CELLS.map(() => 1 / PROMPT_CELLS.length);
/** Weighted sum of the semantic features inside the box, scaled to length 1 like the text prompts. */
export const visualPrompt = (w: number[]) => unit([0, 1, 2].map((d) => PROMPT_CELLS.reduce((s, cell, i) => s + w[i] * EMB[cell][d], 0)));

/** LRPC: a "something is here" score per cell (hand-set), then only cells above δ are compared with the built-in vocabulary.
 *  Highest in the cells holding the cat's and the cup's centres, between 0.001 and 0.01 in the bottom cells with the
 *  tail, the paws and the cup's bottom, below 0.001 on the wall (the ear tips in row 0 included). */
export const VOCAB = 4585;                                     // YOLOE Sec. 4.1: built-in vocabulary of 4585 category names
export const ANCHORS_REAL = 8400;                              // YOLOE appendix B: total anchor points in the baseline
export const OBJ_ANY: number[] = [
  0.0002, 0.0006, 0.0002, 0.0001,
  0.31, 0.62, 0.0004, 0.0002,
  0.55, 0.93, 0.0009, 0.86,
  0.0035, 0.0042, 0.0006, 0.0012,
];
export const DELTAS = [0.0001, 0.001, 0.01];
export const kept = (delta: number) => OBJ_ANY.map((v, i) => (v > delta ? i : -1)).filter((i) => i >= 0);

/* ---- published numbers ---- */

/** CLIP, Radford et al. 2021, arXiv 2103.00020. */
export const CLIP_PAPER = {
  pairs: 400e6,               // Sec. 2.2: 400 million (image, text) pairs from the internet
  batch: 32768,               // Sec. 2.5: minibatch size
  text: { params: 63e6, layers: 12, width: 512, heads: 8, vocab: 49152, maxLen: 76 },   // Sec. 2.4
  zeroShotImageNet: 76.2,     // Table 1 / Sec. 3.1.3, ViT-L/14@336px, matches the original ResNet-50
  imagenetTrain: 1.28e6,      // "none of the 1.28 million crowd-labeled training examples"
  promptGain: 1.3,            // Sec. 3.1.4: "A photo of a {label}." improves ImageNet accuracy by 1.3%
  ensemble: { prompts: 80, gain: 3.5 },   // Sec. 3.1.4: an additional 3.5% over the single default prompt
};
/** YOLO-World, Cheng et al. 2024, arXiv 2401.17270. Table 2: LVIS minival zero-shot, FPS on one V100 without TensorRT,
 *  re-parameterized model. The abstract of v3 says 35.4 AP for the L model; Table 2 lists 35.0. */
export const YW_PAPER = {
  L: { params: 48, fps: 52.0, ap: 35.0, apAbstract: 35.4 },
  S: { params: 13, fps: 74.1, ap: 26.2 },
  poolTokens: 27,              // Image-Pooling Attention: 3×3 regions from three scales
  maxNouns: 80,                // online vocabulary per mosaic sample of 4 images: at most 80 nouns
  data: { o365: 609e3, gqa: 621e3, flickr: 149e3, cc3m: 246e3 },   // Table 1, images
};
/** Grounding DINO, Liu et al. 2023, arXiv 2303.05499. */
export const GD_PAPER = {
  queries: 900, maxTextTokens: 256, enhancerLayers: 6, decoderLayers: 6,
  cocoZeroShot: 52.5,          // Grounding DINO L (Swin-L), no COCO images in training
  cocoFinetune: 62.6,          // COCO minival after fine-tuning
  odinwZeroShot: 26.1,         // ODinW zero-shot mean AP
  T: { params: 172, gflops: 464, fps: 8.37 }, glipT: { params: 232, gflops: 488, fps: 6.11 },   // Table 20, hardware not stated
};
/** YOLOv10-S for scale (YOLOv10 Table 1, COCO, T4): 21.6 GFLOPs. */
export const V10S_GFLOPS = 21.6;

/** YOLOE, Wang et al. 2025, arXiv 2503.07465 (ICCV 2025). */
/** Table 1: LVIS minival zero-shot, Fixed AP, text prompts; FPS on T4 TensorRT / iPhone 12 CoreML; training hours on 8 RTX4090. */
export const YOLOE_TABLE1 = {
  "YOLO-Worldv2-S": { params: 13, hours: 41.7, fpsT4: 216.4, fpsIp: 48.9, ap: 24.4, apr: 17.1 },
  "YOLOE-v8-S": { params: 12, hours: 12.0, fpsT4: 305.8, fpsIp: 64.3, ap: 27.9, apr: 22.3 },
  "YOLO-Worldv2-L": { params: 48, hours: 80.0, fpsT4: 80.0, fpsIp: 22.1, ap: 35.5, apr: 25.6 },
  "YOLOE-v8-L": { params: 45, hours: 22.5, fpsT4: 102.5, fpsIp: 27.2, ap: 35.9, apr: 33.2 },
};
/** Table 5: roadmap on the L model, LVIS minival standard AP, FPS T4 / iPhone 12. Text: fusion removal gives 1.28× / 1.23×;
 *  RepRTA is described as "+2.3% AP" although the table goes from 31.5 to 33.5. */
export const YOLOE_TABLE5 = [
  { key: "world", ap: 33.0, fps: 80.0, fpsIp: 22.1 },
  { key: "epochs", ap: 31.0, fps: 80.0, fpsIp: 22.1 },
  { key: "neg", ap: 31.9, fps: 80.0, fpsIp: 22.1 },
  { key: "nofusion", ap: 30.0, fps: 102.5, fpsIp: 27.2 },
  { key: "mobileclip", ap: 31.5, fps: 102.5, fpsIp: 27.2 },
  { key: "reprta", ap: 33.5, fps: 102.5, fpsIp: 27.2 },
  { key: "seg", ap: 33.3, fps: 102.5, fpsIp: 27.2 },
];
export const YOLOE_FUSION_SPEEDUP = { t4: 1.28, iphone: 1.23 };
export const YOLOE_REPRTA_TEXT = 2.3;
/** Sec. 4.4: COCO transfer, full tuning. YOLOE-v8-L 53.0 AP^b / 42.7 AP^m after 80 epochs vs YOLOv8-L 52.4 / 42.3 after 300. */
export const YOLOE_COCO = { yoloe: { apb: 53.0, apm: 42.7, epochs: 80 }, v8: { apb: 52.4, apm: 42.3, epochs: 300 } };
/** Table 6: SAVPE vs mask pooling, +1.5 AP; 31.9 AP at A = 16. */
export const YOLOE_SAVPE = { gain: 1.5, ap: 31.9, pool: 30.4, groups: 16 };
/** Table 7 (LVIS minival, prompt-free, T4): FPS and AP without LRPC and with each δ. */
export const YOLOE_TABLE7 = {
  S: [{ d: "none", ap: 21.0, fps: 56.5 }, { d: "1e-3", ap: 21.0, fps: 95.8 }, { d: "1e-4", ap: 21.0, fps: 66.1 }, { d: "1e-2", ap: 20.8, fps: 106 }],
  L: [{ d: "none", ap: 27.2, fps: 19.9 }, { d: "1e-3", ap: 27.2, fps: 25.3 }],
};
