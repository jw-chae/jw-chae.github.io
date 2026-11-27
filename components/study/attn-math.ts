/** Arithmetic behind the attention-cost study scenes. The running scene is the owner's Siamese cat: the whole drawing cut into 16-pixel
 *  patches at growing resolution (64 to 2048 px), four measured patch tokens for hand calculation, the 16 × 16 cat for windows and sparse
 *  patterns, and the 4 × 4 crop of the tokens chapter for low rank. Every number the chapter quotes is computed here.
 *  Import-free so node can run it. */

export const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
export const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
export function softmax(z: number[]): number[] {
  const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}
const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);
const mix = (w: number[], vs: number[][]) => vs[0].map((_, d) => w.reduce((s, wi, i) => s + wi * vs[i][d], 0));

/* ---- 01 · the cat at growing resolution, ViT-B sizes, bytes of the score table ---- */

/** Patch side in pixels. The cat drawing (public/study/cat-square.png) is resized to the side length and cut into 16 px patches. */
export const PATCH = 16;
export const SIDES = [64, 128, 256, 512, 1024, 2048];
/** Patch tokens only; a [CLS] token is left out throughout. */
export const tokensAt = (side: number) => (side / PATCH) ** 2;
/** ViT-B: vector length 768, 12 heads of 64, 12 layers. */
export const VITB = { d: 768, heads: 12, dh: 64, layers: 12 };
/** Share of one layer's multiply-adds that is token-to-token work, N / (N + 6d): derived in the tokens chapter, section 01. */
export const quadShare = (N: number, d = VITB.d) => N / (N + 6 * d);
/** Every number is stored in 16 bits. */
export const BYTES = 2;
/** The score table (or the probability table) of one head in one layer. */
export const headTable = (N: number) => N * N * BYTES;
export const layerTables = (N: number) => VITB.heads * headTable(N);
/** Training keeps the probability table P of every head in every layer for the backward pass (at least P; S is not counted). */
export const trainTables = (N: number) => VITB.layers * layerTables(N);
/** The token vectors leaving one layer: N × d numbers. */
export const tokenTensor = (N: number) => N * VITB.d * BYTES;
/** The MLP's widened vectors inside one layer: N × 4d numbers, also kept for the backward pass. */
export const mlpHidden = (N: number) => N * 4 * VITB.d * BYTES;
/** Images trained together in one batch, for the training-memory example. */
export const BATCH = 32;
/** Binary units: 1 KB = 2¹⁰ bytes, 1 MB = 2²⁰, 1 GB = 2³⁰. */
export const KB = 1024, MB = 1024 ** 2, GB = 1024 ** 3;

/** The eye on the viewer's left in cat-square.png (512 px) and the tip of the tail, as pixel positions; the cell holding each at a grid of g × g. */
export const EYE_PX = { x: 296.5, y: 131.5 };
export const TAIL_PX = { x: 144, y: 464 };
export const cellAt = (p: { x: number; y: number }, g: number): [number, number] => [Math.floor((p.y / 512) * g), Math.floor((p.x / 512) * g)];
/** Chebyshev distance in cells between the eye and the tail tip at a grid of g × g. */
export const eyeTailGap = (g: number) => { const a = cellAt(EYE_PX, g), b = cellAt(TAIL_PX, g); return Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])); };

/* ---- the four tokens: measured from the drawing, copied from tok-math.ts ---- */

/** Copied from tok-math.ts (the tokens chapter): the 4 × 4 crop x 158..318, y 79..239 of cat-square.png in 40 px cells, each cell's mean
 *  brightness 0.299 R + 0.587 G + 0.114 B and blueness B − R, measured from the drawing. */
export const LUM = [0.94, 0.85, 0.48, 0.51, 0.95, 0.95, 0.67, 0.31, 0.95, 0.95, 0.9, 0.74, 0.94, 0.89, 0.85, 0.88];
export const BLUE = [-0.1, -0.13, -0.27, -0.27, -0.1, -0.1, -0.21, -0.09, -0.1, -0.1, -0.14, -0.31, -0.11, -0.2, -0.29, -0.26];
export const CROP = { x: 158, y: 79, size: 160 };
export type Kind = "bg" | "brown" | "cream" | "eye";
export const KIND: Kind[] = ["bg", "bg", "brown", "brown", "bg", "bg", "brown", "eye", "bg", "bg", "bg", "cream", "bg", "cream", "cream", "cream"];
const avg = (a: number[]) => sum(a) / a.length;
const sd = (a: number[]) => { const m = avg(a); return Math.sqrt(avg(a.map((v) => (v - m) ** 2))); };
const NORM = { lum: [avg(LUM), sd(LUM)], blue: [avg(BLUE), sd(BLUE)] };
/** The same scaling as the tokens chapter: subtract the mean of the 16 cells, divide by their standard deviation. */
export const X: number[][] = LUM.map((l, i) => [(l - NORM.lum[0]) / NORM.lum[1], (BLUE[i] - NORM.blue[0]) / NORM.blue[1]]);
export const EYE_CELL = 7;

/** The four tokens of the hand calculation, in the order they stream past: background, cream fur, the brown ear, the eye. */
export const FOUR = [4, 14, 2, 7];
export const FOUR_KIND: Kind[] = FOUR.map((i) => KIND[i]);
export const FOUR_X = FOUR.map((i) => X[i]);
/** Vector length of the toy tokens. */
export const D_TOY = 2;
/** The eye's query: hand-set to [−√2, 0], so that after dividing by √d the score of a key is minus its brightness number:
 *  darker patches score higher. K and V are the token vectors themselves. */
export const Q_EYE = [-Math.SQRT2, 0];
export const score = (q: number[], k: number[]) => dot(q, k) / Math.sqrt(D_TOY);
export const FOUR_S = FOUR_X.map((k) => score(Q_EYE, k));
export const FOUR_W = softmax(FOUR_S);
export const FOUR_OUT = mix(FOUR_W, FOUR_X);

/* ---- 02 · softmax one block at a time ---- */

export type OnlineStep = { block: number[]; m: number; l: number; acc: number[]; rescale: number; blockMax: number };
/** Streams the keys in the given order, `size` at a time. Keeps the running max m, the running sum ℓ of e^(s − m) and the running
 *  unnormalised output acc = Σ e^(s − m) v. When a block brings a larger max, the old ℓ and acc are multiplied by e^(m_old − m_new). */
export function online(order: number[] = [0, 1, 2, 3], size = 2): OnlineStep[] {
  const steps: OnlineStep[] = [];
  let m = -Infinity, l = 0, acc = [0, 0];
  for (let b = 0; b < order.length; b += size) {
    const block = order.slice(b, b + size), s = block.map((j) => FOUR_S[j]);
    const blockMax = Math.max(...s), mNew = Math.max(m, blockMax), rescale = m === -Infinity ? 0 : Math.exp(m - mNew);
    const e = s.map((v) => Math.exp(v - mNew));
    l = l * rescale + sum(e);
    acc = acc.map((a, d) => a * rescale + e.reduce((t, ei, i) => t + ei * FOUR_X[block[i]][d], 0));
    m = mNew;
    steps.push({ block, m, l, acc: [...acc], rescale, blockMax });
  }
  return steps;
}
export const onlineOut = (steps: OnlineStep[]) => { const last = steps[steps.length - 1]; return last.acc.map((a) => a / last.l); };
/** The largest 16-bit float, and the score above which e^s no longer fits in it. */
export const FP16_MAX = 65504;
export const OVERFLOW_AT = Math.log(FP16_MAX);

/* ---- 03 · FlashAttention: the same FLOPs, fewer bytes moved, on the efficiency chapter's hand-set device ---- */

/** The efficiency chapter's device, hand-set there: 4 × 10¹² FLOP per second, 40 × 10⁹ bytes per second between memory and the chip. */
export const DEVICE = { flops: 4e12, bw: 40e9 };
/** One head of ViT-B. */
export const DH = 64;
/** FLOPs of one head's attention, QKᵀ and PV, two FLOPs per multiply-add; softmax and scaling left out. */
export const attnFlops = (N: number, d = DH) => 4 * N * N * d;
/** Standard attention (the FlashAttention paper's Algorithm 0): read Q and K, write S, read S, write P, read P and V, write O. */
export function standardBytes(N: number, d = DH) {
  const qkvo = 4 * N * d * BYTES, tables = 4 * N * N * BYTES;
  return { qkvo, tables, total: qkvo + tables };
}
/** Tiled, in FlashAttention-2's loop order: a block of Br query rows stays on chip while every K, V block streams past; Q is read once,
 *  K and V are read once per query block, O is written once, and two fp32 numbers per row (m and ℓ) are written for the backward pass. */
export function flashBytes(N: number, Br = 128, d = DH) {
  const passes = Math.ceil(N / Br), qo = 2 * N * d * BYTES, kv = 2 * N * d * BYTES * passes, stats = 2 * N * 4;
  return { passes, qo, kv, stats, total: qo + kv + stats };
}
export const timeOf = (flops: number, bytes: number) => { const c = flops / DEVICE.flops, m = bytes / DEVICE.bw; return { compute: c, move: m, t: Math.max(c, m) }; };
/** Kept for the backward pass, per head: the probability table, or the two statistics per row. */
export const keptStandard = (N: number) => N * N * BYTES;
export const keptFlash = (N: number) => 2 * N * 4;
/** Bytes of the table's four trips against bytes of the extra K, V reads: 4N² against 2Nd · N/Br, a ratio of 2Br / d. */
export const tripRatio = (Br: number, d = DH) => (2 * Br) / d;
export const BLOCKS = [64, 128, 256];

/* ---- 04 · windows on the 16 × 16 cat (the sparse patterns are kept for the comparison in 07 and the doubts; no figure draws them) ---- */

export const G = 16;
export const EYE16 = cellAt(EYE_PX, G);
export const TAIL16 = cellAt(TAIL_PX, G);
export type Pattern = "full" | "swin" | "swinShift" | "slide2" | "slide1" | "random" | "global" | "strided" | "bigbird";
/** The extra global token, index G·G. */
export const GLOBAL = G * G;
const hasGlobal = (p: Pattern) => p === "global" || p === "bigbird";

/** A fixed pseudo-random sequence (mulberry32), so the random keys are the same on every load. */
function rng(seed: number) {
  let a = seed;
  return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Three random keys per cell (BigBird's r = 3), drawn once with a fixed seed, outside the cell's own 3 × 3 window. */
export const RANDOM_KEYS: number[][] = (() => {
  const r = rng(7);
  return Array.from({ length: G * G }, (_, q) => {
    const qr = Math.floor(q / G), qc = q % G, out: number[] = [];
    while (out.length < 3) {
      const k = Math.floor(r() * G * G), kr = Math.floor(k / G), kc = k % G;
      if (Math.max(Math.abs(kr - qr), Math.abs(kc - qc)) > 1 && !out.includes(k)) out.push(k);
    }
    return out;
  });
})();

/** Swin's window size on this grid (the paper's Figure 2 uses 4 × 4 windows shifted by 2 on an 8 × 8 map). */
export const M = 4;
const win = (x: number, shift: boolean) => (shift ? Math.floor((x + M / 2) / M) : Math.floor(x / M));
/** The keys cell q reads in layer `layer` (layers count from 1) under each pattern. */
export function keysOf(p: Pattern, q: number, layer = 1): number[] {
  if (q === GLOBAL) return Array.from({ length: G * G }, (_, i) => i);
  const qr = Math.floor(q / G), qc = q % G, out: number[] = [];
  const near = (rad: number) => { for (let r = qr - rad; r <= qr + rad; r++) for (let c = qc - rad; c <= qc + rad; c++) if (r >= 0 && c >= 0 && r < G && c < G) out.push(r * G + c); };
  if (p === "full") return Array.from({ length: G * G }, (_, i) => i);
  if (p === "swin" || p === "swinShift") {
    const shift = p === "swinShift" && layer % 2 === 0;
    for (let r = 0; r < G; r++) for (let c = 0; c < G; c++) if (win(r, shift) === win(qr, shift) && win(c, shift) === win(qc, shift)) out.push(r * G + c);
    return out;
  }
  if (p === "slide2") { near(2); return out; }
  if (p === "strided") {
    // the two-dimensional strided pattern read without the causal half: the cell's own row and its own column
    for (let c = 0; c < G; c++) out.push(qr * G + c);
    for (let r = 0; r < G; r++) if (r !== qr) out.push(r * G + qc);
    return out;
  }
  near(1);
  if (p === "random" || p === "bigbird") out.push(...RANDOM_KEYS[q]);
  if (hasGlobal(p)) out.push(GLOBAL);
  return out;
}
/** Which tokens hold information that started at the eye after `layers` layers: a token is reached once any key it reads was reached. */
export function reach(p: Pattern, layers: number): boolean[] {
  const n = G * G + 1;
  let got = Array.from({ length: n }, (_, i) => i === EYE16[0] * G + EYE16[1]);
  for (let l = 1; l <= layers; l++) {
    const prev = got;
    got = prev.map((v, q) => v || ((q < G * G || hasGlobal(p)) && keysOf(p, q, l).some((k) => prev[k])));
  }
  return got;
}
/** The first layer after which the tail tip holds something from the eye; null if it never does within `max` layers. */
export function layersToTail(p: Pattern, max = 40): number | null {
  for (let l = 1; l <= max; l++) if (reach(p, l)[TAIL16[0] * G + TAIL16[1]]) return l;
  return null;
}
/** Query-key pairs scored in one layer (the global token's own row included when there is one). */
export const pairsPerLayer = (p: Pattern) => Array.from({ length: G * G + (hasGlobal(p) ? 1 : 0) }, (_, q) => keysOf(p, q, 1).length).reduce((a, b) => a + b, 0);
/** How many keys the eye reads in one layer. */
export const eyeKeys = (p: Pattern, layer = 1) => keysOf(p, EYE16[0] * G + EYE16[1], layer).length;
/** A sliding window of radius r needs ⌈gap / r⌉ layers to carry the eye to the tail at a grid of g × g. */
export const slideLayers = (g: number, r: number) => Math.ceil(eyeTailGap(g) / r);

/* ---- Linformer on the 4 × 4 crop: the eye's row over k pooled keys (summarised in a few sentences in 05; no figure) ---- */

/** The eye's scores against all 16 crop tokens, its shares and what it reads. */
export const CROP_S = X.map((k) => score(Q_EYE, k));
export const CROP_W = softmax(CROP_S);
export const CROP_OUT = mix(CROP_W, X);
/** Mean pooling along the sequence in reading order, kernel and stride 16 / k (one of the projections the Linformer paper lists), used for
 *  both K and V. Returns the groups, the pooled keys, the eye's shares over them, what it reads and how far that is from the exact read. */
export function linformer(k: number) {
  const size = X.length / k;
  const groups = Array.from({ length: k }, (_, g) => Array.from({ length: size }, (_, i) => g * size + i));
  const keys = groups.map((g) => [avg(g.map((i) => X[i][0])), avg(g.map((i) => X[i][1]))]);
  const w = softmax(keys.map((kk) => score(Q_EYE, kk)));
  const out = mix(w, keys);
  return { groups, keys, w, out, err: dist(out, CROP_OUT) };
}
export const LIN_KS = [16, 8, 4, 2, 1];

/* ---- 05 · linear attention: the order of multiplication, and the kernel φ(x) = elu(x) + 1 ---- */

/** Multiply-adds of the two products: (QKᵀ)V and Q(KᵀV), per head. Softmax's or the kernel's normalisation left out. */
export const tableFirst = (N: number, d: number) => 2 * N * N * d;
export const stateFirst = (N: number, d: number) => 2 * N * d * d;
/** Katharopoulos et al.'s feature map, applied to every entry. */
export const phi = (x: number[]) => x.map((v) => (v > 0 ? v + 1 : Math.exp(v)));
/** The eye's shares over the four tokens with its query scaled by c: softmax of the scores, or φ(cq)·φ(k) normalised. */
export function sharesAt(c: number) {
  const q = Q_EYE.map((v) => c * v);
  const soft = softmax(FOUR_X.map((k) => score(q, k)));
  const kern = FOUR_X.map((k) => dot(phi(q), phi(k))), tot = sum(kern);
  return { soft, kern: kern.map((v) => v / tot) };
}
/** As c grows without bound, φ(cq) tends to [0, 1], so the kernel shares tend to the second entry of φ(k), normalised. */
export const KERNEL_LIMIT = (() => { const y = FOUR_X.map((k) => phi(k)[1]), t = sum(y); return y.map((v) => v / t); })();
/** The running state of causal linear attention over the four tokens: S = Σ φ(k) vᵀ (d × d) and z = Σ φ(k) (d). */
export const STATE = (() => {
  const S = [[0, 0], [0, 0]], z = [0, 0];
  FOUR_X.forEach((k) => { const f = phi(k); for (let a = 0; a < 2; a++) { z[a] += f[a]; for (let b = 0; b < 2; b++) S[a][b] += f[a] * k[b]; } });
  const fq = phi(Q_EYE), num = [0, 1].map((b) => fq[0] * S[0][b] + fq[1] * S[1][b]), den = fq[0] * z[0] + fq[1] * z[1];
  return { S, z, out: num.map((v) => v / den) };
})();
/** Numbers held per head while decoding: the K, V cache of n tokens, or the state S and z. */
export const cacheNumbers = (n: number, d: number) => 2 * n * d;
export const stateNumbers = (d: number) => d * d + d;

/* ---- 06 · decoding: KV cache bytes per token, MQA and GQA ---- */

export type Lm = { key: string; layers: number; heads: number; kv: number; dh: number; window: number | null; trained: number };
/** From the papers: Llama 2 7B keeps Llama 1's 7B shape (32 layers, d = 4096, 32 heads, so 128 per head) and has no GQA; Llama 3 8B has
 *  32 layers, 32 heads, 8 key/value heads; Mistral 7B has 32 layers, head_dim 128, 32 heads, 8 key/value heads and a 4096-token window.
 *  "MQA" is Llama 2 7B's shape with one key/value head, a what-if. `trained` is the context length the model was trained for. */
export const LMS: Lm[] = [
  { key: "llama2", layers: 32, heads: 32, kv: 32, dh: 128, window: null, trained: 4096 },
  { key: "llama3", layers: 32, heads: 32, kv: 8, dh: 128, window: null, trained: 131072 },
  // Mistral 7B: the paper lists context_len 8192 but presents the sliding window as handling sequences of arbitrary length, so it is not flagged
  { key: "mistral", layers: 32, heads: 32, kv: 8, dh: 128, window: 4096, trained: 1e9 },
  { key: "mqa", layers: 32, heads: 32, kv: 1, dh: 128, window: null, trained: 4096 },
];
export const kvPerToken = (m: Lm) => 2 * m.layers * m.kv * m.dh * BYTES;
/** Tokens held in the cache after n tokens: all of them, or the last W with Mistral's rolling buffer. */
export const held = (m: Lm, n: number) => (m.window ? Math.min(n, m.window) : n);
export const cacheBytes = (m: Lm, n: number) => kvPerToken(m) * held(m, n);
/** One decoding step reads the whole cache once; attention does 2 · heads · held · dh multiply-adds per layer, 4 FLOPs per pair of products. */
export const stepFlops = (m: Lm, n: number) => 4 * m.heads * held(m, n) * m.dh * m.layers;
export const intensity = (m: Lm, n: number) => stepFlops(m, n) / cacheBytes(m, n);
export const CONTEXTS = [1024, 4096, 8192, 32768, 131072];

/* ---- 07 · choosing: one row per situation ---- */

export type Situation = { key: string; N: number; train: boolean; decode: boolean };
export const SITUATIONS: Situation[] = [
  { key: "small", N: 196, train: false, decode: false },
  { key: "cat1k", N: 4096, train: true, decode: false },
  { key: "cat2k", N: 16384, train: true, decode: false },
  { key: "longgen", N: 32768, train: false, decode: true },
];
/** Multiply-adds of one ViT-B layer when each query reads w keys instead of all N, as a share of the full layer. */
export const windowedLayerShare = (N: number, w: number, d = VITB.d) => (12 * N * d * d + 2 * N * Math.min(w, N) * d) / (12 * N * d * d + 2 * N * N * d);
/** The same with linear attention: per head 2·N·dh² instead of 2·N²·dh, so 2·N·dh·d for the layer. */
export const linearLayerShare = (N: number, d = VITB.d, dh = VITB.dh) => (12 * N * d * d + 2 * N * dh * d) / (12 * N * d * d + 2 * N * N * d);
/** Choices compared in the last section: a 7 × 7 window, the row-and-column pattern, Linformer with k = 256, linear attention, GQA with 8 key/value heads. */
export const CHOICE = { w: 49, k: 256 };
export type MethodKey = "flash" | "window" | "sparse" | "linformer" | "linear" | "gqa";
export const METHODS: MethodKey[] = ["flash", "window", "sparse", "linformer", "linear", "gqa"];
export type Row = { key: MethodKey; exact: boolean; retrain: "no" | "yes" | "part"; compute: number | null; memory: number | null };
/** For a ViT-B situation: compute is the layer's multiply-adds as a share of the full layer; memory is the attention tables held
 *  (training: every layer's P for the backward pass; inference: one layer's tables). For the decoding situation (Llama 2 7B's shape,
 *  n tokens): compute is one step's attention FLOPs as a share of full attention, memory is the K, V cache (or the state). Null: does not apply. */
export function chooseRows(s: Situation): { baseCompute: number; baseMemory: number; rows: Row[] } {
  const { heads: h, layers: L, dh } = VITB, N = s.N;
  if (!s.decode) {
    const keep = (perHead: number) => (s.train ? L * h * perHead : h * perHead);
    const sparseW = 2 * Math.sqrt(N) - 1;
    return {
      baseCompute: 1, baseMemory: keep(N * N * BYTES),
      rows: [
        { key: "flash", exact: true, retrain: "no", compute: 1, memory: s.train ? L * h * keptFlash(N) : 0 },
        { key: "window", exact: false, retrain: "yes", compute: windowedLayerShare(N, CHOICE.w), memory: keep(N * Math.min(CHOICE.w, N) * BYTES) },
        { key: "sparse", exact: false, retrain: "yes", compute: windowedLayerShare(N, sparseW), memory: keep(N * Math.min(sparseW, N) * BYTES) },
        { key: "linformer", exact: false, retrain: "yes", compute: windowedLayerShare(N, CHOICE.k), memory: keep(N * Math.min(CHOICE.k, N) * BYTES) },
        { key: "linear", exact: false, retrain: "yes", compute: linearLayerShare(N), memory: keep((dh * dh + dh) * BYTES) },
        { key: "gqa", exact: false, retrain: "part", compute: null, memory: null },
      ],
    };
  }
  const mha = LMS[0], gqa = LMS[1], swa = LMS[2], n = N;
  const strided = 2 * Math.sqrt(n);
  const statePerHead = (mha.dh * mha.dh + mha.dh) * BYTES;
  return {
    baseCompute: 1, baseMemory: cacheBytes(mha, n),
    rows: [
      { key: "flash", exact: true, retrain: "no", compute: 1, memory: cacheBytes(mha, n) },
      { key: "window", exact: false, retrain: "yes", compute: held(swa, n) / n, memory: cacheBytes({ ...mha, window: swa.window }, n) },
      { key: "sparse", exact: false, retrain: "yes", compute: strided / n, memory: cacheBytes(mha, n) },
      { key: "linformer", exact: false, retrain: "yes", compute: null, memory: null },
      { key: "linear", exact: false, retrain: "yes", compute: mha.dh / n, memory: mha.layers * mha.heads * statePerHead },
      { key: "gqa", exact: false, retrain: "part", compute: 1, memory: cacheBytes(gqa, n) },
    ],
  };
}

/* ---- published values the chapter quotes (from the papers, not computed) ---- */

export const PUBLISHED = {
  flash: { gpt2: { flopsStd: 66.6, flopsFlash: 75.2, hbmStd: 40.3, hbmFlash: 4.4, msStd: 41.7, msFlash: 7.3 }, bert: 15, gpt2x: 3, lra: 2.4, memx: 20, pathX: { len: 16384, acc: 61.4 }, path256: { len: 65536, acc: 63.1 } },
  flash2: { speedup: 2, util: "50-73%", tflops: 225, mfu: 72 },
  flash3: { speedup: "1.5-2.0", tflops: 740, util: 75 },
  swin: { M: 7 },
  longformer: { window: 512, len: 4096 },
  mistral: { window: 4096, span: "131K", cut: 8, at: 32768 },
  bigbird: { longer: 8 },
  linformer: { n: 512, k: 128, faster: 1.5, batch: 1.7 },
  rnn: { faster: 4000 },
  mamba: { throughput: 5 },
  mqa: { bleuMha: 26.7, bleuMqa: 26.5, decMha: 46, decMqa: 3.8 },
  gqa: { tMhaXxl: 1.51, tMqa: 0.24, tGqa: 0.28, avgMha: 47.2, avgMqa: 46.6, avgGqa: 47.1, uptrain: 5 },
};
