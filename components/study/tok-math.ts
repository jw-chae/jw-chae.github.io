/** Arithmetic behind the token-reduction study scenes: a 4×4 crop of the owner's Siamese cat with a [CLS] token, pruning and merging on it,
 *  the cost of a layer, a toy video of the same cat closing its eye, a KV cache and a per-layer cache budget. Every number the chapter quotes
 *  is computed here. Import-free so node can run it. */

export const dot = (a: number[], b: number[]) => a.reduce((s, v, i) => s + v * b[i], 0);
export const norm = (a: number[]) => Math.sqrt(dot(a, a));
export const cosine = (a: number[], b: number[]) => dot(a, b) / (norm(a) * norm(b));
export const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));
export function softmax(z: number[]): number[] {
  const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0);
  return e.map((v) => v / s);
}
const mean = (vs: number[][], w?: number[]) => {
  const ws = w ?? vs.map(() => 1), tot = ws.reduce((a, b) => a + b, 0);
  return vs[0].map((_, d) => vs.reduce((s, v, i) => s + ws[i] * v[d], 0) / tot);
};

/* ---- the running example: the owner's Siamese cat, a 4 × 4 crop with one blue eye in it ---- */

export const GRID = 4;
/** Where the 16 patches come from: public/study/cat-square.png (512 × 512), the square x 158..318, y 79..239, cut into 40 px cells.
 *  The crop runs from the left ear down to the chest; the eye on the viewer's left sits whole in cell 7. */
export const CROP = { x: 158, y: 79, size: 160 };
export type Kind = "bg" | "brown" | "cream" | "eye" | "closed";
/** What each patch mostly shows, read off the picture in reading order. Used for names and colours only, never in a calculation
 *  (except to pick the background patches in identicalCheck). */
export const KIND: Kind[] = [
  "bg", "bg", "brown", "brown",
  "bg", "bg", "brown", "eye",
  "bg", "bg", "bg", "cream",
  "bg", "cream", "cream", "cream",
];
/** Measured from the crop, two decimals: each cell's mean brightness 0.299 R + 0.587 G + 0.114 B and its blueness B − R (channels 0..1,
 *  block means over the 40 × 40 pixels). Measured with a Python script; the same block means cat-grids.ts uses. */
export const LUM = [0.94, 0.85, 0.48, 0.51, 0.95, 0.95, 0.67, 0.31, 0.95, 0.95, 0.9, 0.74, 0.94, 0.89, 0.85, 0.88];
export const BLUE = [-0.1, -0.13, -0.27, -0.27, -0.1, -0.1, -0.21, -0.09, -0.1, -0.1, -0.14, -0.31, -0.11, -0.2, -0.29, -0.26];
/** The closed eye: the eye (an ellipse in cat-square.png) painted over in the mean colour of the fur ring just outside it
 *  (1.15 < ((x − cx)/rx)² + ((y − cy)/ry)² < 1.8), with a 2 px lid line along the lower arc of the box cx ± (rx − 3), cy − 7 .. cy + 4 from 15° to 165°, then cell 7
 *  measured the same way. The scenes draw the same ellipse and arc. */
export const EYE_SHAPE = { cx: 296.5, cy: 131.5, rx: 17.5, ry: 11.5, fill: "rgb(99,61,43)", line: "rgb(38,22,18)" };
export const CLOSED_CELL = { lum: 0.26, blue: -0.21 };

const avg = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
const sd = (a: number[]) => { const m = avg(a); return Math.sqrt(avg(a.map((v) => (v - m) ** 2))); };
/** The two numbers are put on one scale: subtract the mean of the 16 cells and divide by their standard deviation (computed once on
 *  the open-eye crop and reused for every frame). */
export const NORM = { lum: [avg(LUM), sd(LUM)], blue: [avg(BLUE), sd(BLUE)] };
export const embed = (lum: number, blue: number) => [(lum - NORM.lum[0]) / NORM.lum[1], (blue - NORM.blue[0]) / NORM.blue[1]];
/** Patch vectors: [brightness, blueness] after that scaling. Derived from the measured cells, not hand-set. */
export const X: number[][] = LUM.map((l, i) => embed(l, BLUE[i]));
export const CLOSED = embed(CLOSED_CELL.lum, CLOSED_CELL.blue);
export const EYE = 7;
/** The [CLS] vector entering the layer and the query it reads with: hand-set. [CLS] starts at the mean of the cells, [0, 0], and its query
 *  points to "darker and less blue", which in this crop is the brown and cream fur. K and V are the token vectors themselves. */
export const CLS = [0, 0];
export const Q_CLS = [-0.5, -1];

/** A token in the row: its vector, how many patches it stands for, and which ones. */
export type Token = { v: number[]; s: number; members: number[] };
export const patches = (xs: number[][] = X): Token[] => xs.map((v, i) => ({ v, s: 1, members: [i] }));

export type Read = { scores: number[]; weights: number[]; self: number; read: number[]; out: number[] };
/** [CLS] reads itself and the given tokens once. Score = q·k + log s (proportional attention; s = 1 for a token that was never merged). */
export function clsRead(tokens: Token[], prop = true): Read {
  const keys = [CLS, ...tokens.map((t) => t.v)];
  const scores = keys.map((k, i) => dot(Q_CLS, k) + (i > 0 && prop ? Math.log(tokens[i - 1].s) : 0));
  const w = softmax(scores);
  const read = [0, 1].map((d) => w.reduce((s, wi, i) => s + wi * keys[i][d], 0));
  return { scores: scores.slice(1), weights: w.slice(1), self: w[0], read, out: CLS.map((c, d) => c + read[d]) };
}

/* ---- 01 · the cost of one layer ---- */

export type Cost = { proj: number; mlp: number; scores: number; mix: number };
/** Multiply-adds of one standard layer for N tokens of length d: Q, K, V and the output projection (4Nd²), the MLP (mats·N·d·width),
 *  the score table QKᵀ (N²d) and the mixing of V by the shares (N²d). Softmax, normalisation and biases are left out. */
export const layerCost = (N: number, d: number, width = 4 * d, mats = 2): Cost => ({ proj: 4 * N * d * d, mlp: mats * N * d * width, scores: N * N * d, mix: N * N * d });
export const linearPart = (c: Cost) => c.proj + c.mlp;
export const quadPart = (c: Cost) => c.scores + c.mix;
export const totalCost = (c: Cost) => linearPart(c) + quadPart(c);

export type Preset = { key: string; N: number; d: number; width: number; mats: number };
/** The toy picture, ViT-B/16 at 224 px, DINOv2 ViT-B/14 at 392 px, and one Vicuna-7B layer holding LLaVA-1.5's 576 image tokens or FastVID's 6272 video tokens. */
export const PRESETS: Preset[] = [
  { key: "toy", N: 17, d: 2, width: 8, mats: 2 },
  { key: "vitb", N: 197, d: 768, width: 3072, mats: 2 },
  { key: "dino", N: 785, d: 768, width: 3072, mats: 2 },
  { key: "llm", N: 576, d: 4096, width: 11008, mats: 3 },
  { key: "video", N: 6272, d: 4096, width: 11008, mats: 3 },
];
export const presetCost = (p: Preset, N = p.N) => layerCost(N, p.d, p.width, p.mats);
/** Tokens left when a share `frac` is kept (at least one). */
export const keptN = (p: Preset, frac: number) => Math.max(1, Math.round(p.N * frac));
/** Cost after keeping `frac` of the tokens, as a share of the full cost. */
export const costRatio = (p: Preset, frac: number) => totalCost(presetCost(p, keptN(p, frac))) / totalCost(presetCost(p));
export const quadShare = (p: Preset, N = p.N) => { const c = presetCost(p, N); return quadPart(c) / totalCost(c); };

/* ---- 02 · importance from the [CLS] shares, and pruning ---- */

export const FULL = clsRead(patches());
/** Patch indices from the largest [CLS] share to the smallest. */
export const ORDER = FULL.weights.map((_, i) => i).sort((a, b) => FULL.weights[b] - FULL.weights[a]);

export type Pruned = { kept: number[]; tokens: Token[]; read: Read; droppedShare: number };
/** Keep the k patches with the largest share, drop the rest, and let [CLS] read again over what is left. */
export function prune(k: number): Pruned {
  const kept = ORDER.slice(0, k).sort((a, b) => a - b);
  const tokens = kept.map((i) => ({ v: X[i], s: 1, members: [i] }));
  const droppedShare = FULL.weights.reduce((s, w, i) => s + (kept.includes(i) ? 0 : w), 0);
  return { kept, tokens, read: clsRead(tokens), droppedShare };
}

/* ---- 03 · merging: the most similar pair first, averaged by size ---- */

/** Merge two tokens into one: the vector is the average weighted by how many patches each stands for. */
export const mergeTwo = (a: Token, b: Token): Token => ({ v: mean([a.v, b.v], [a.s, b.s]), s: a.s + b.s, members: [...a.members, ...b.members].sort((x, y) => x - y) });

/** Greedy merging down to k tokens: find the pair with the highest cosine similarity of their vectors (the keys here), average it, repeat. */
export function mergeTo(k: number, start: Token[] = patches()): Token[] {
  let ts = start.map((t) => ({ ...t, members: [...t.members] }));
  while (ts.length > k) {
    let bi = 0, bj = 1, best = -Infinity;
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
      const c = cosine(ts[i].v, ts[j].v);
      if (c > best + 1e-12) { best = c; bi = i; bj = j; }
    }
    const m = mergeTwo(ts[bi], ts[bj]);
    ts = ts.filter((_, i) => i !== bi && i !== bj);
    ts.push(m);
    ts.sort((a, b) => a.members[0] - b.members[0]);
  }
  return ts;
}

/** A patch counts as "lost in an average" when its token sits farther than this from its own vector: one standard deviation of the
 *  scaled numbers. A display threshold, hand-set. */
export const FAR = 1;

/** Which token now stands for patch p, and how far its vector is from the patch's own. */
export function representation(tokens: Token[], p: number, xs: number[][] = X): { token: Token | null; err: number | null } {
  const t = tokens.find((u) => u.members.includes(p)) ?? null;
  return { token: t, err: t ? dist(t.v, xs[p]) : null };
}

export type Edge = { a: number; b: number; sim: number; kept: boolean };
/** One step of ToMe's bipartite soft matching on the 16 patches: alternate patches go to A and B, every A patch draws one edge to its most
 *  similar B patch, the r most similar edges are kept, and each kept A patch is averaged into its B partner. */
export function bipartite(r: number, start: Token[] = patches()): { edges: Edge[]; out: Token[] } {
  const A = start.filter((_, i) => i % 2 === 0), B = start.filter((_, i) => i % 2 === 1);
  const raw = A.map((a) => {
    let bj = 0, best = -Infinity;
    B.forEach((b, j) => { const c = cosine(a.v, b.v); if (c > best) { best = c; bj = j; } });
    return { ai: a.members[0], bj, sim: best };
  });
  const rank = raw.map((_, i) => i).sort((x, y) => raw[y].sim - raw[x].sim);
  const keep = new Set(rank.slice(0, r));
  const groups = B.map((b) => [b]);
  const left: Token[] = [];
  raw.forEach((e, i) => { const a = A[i]; if (keep.has(i)) groups[e.bj].push(a); else left.push(a); });
  const merged = groups.map((g) => g.reduce((acc, t) => mergeTwo(acc, t)));
  const out = [...left, ...merged].sort((a, b) => a.members[0] - b.members[0]);
  const edges = raw.map((e, i) => ({ a: e.ai, b: B[e.bj].members[0], sim: e.sim, kept: keep.has(i) }));
  return { edges, out };
}

/** If the merged patches were exactly alike, proportional attention would give [CLS] exactly the same read. The patches of one kind
 *  (the three brown ones by default) replaced by copies of their mean, read separately and as one token of size n: */
export function identicalCheck(kind: Kind = "brown"): { separate: number[]; merged: number[]; one: number[]; n: number } {
  const ids = KIND.map((k, i) => (k === kind ? i : -1)).filter((i) => i >= 0);
  const one = mean(ids.map((i) => X[i]));
  const copies = ids.map((i) => ({ v: one, s: 1, members: [i] }));
  const rest = patches().filter((t) => KIND[t.members[0]] !== kind);
  return { separate: clsRead([...copies, ...rest]).read, merged: clsRead([{ v: one, s: ids.length, members: ids }, ...rest]).read, one, n: ids.length };
}

/* ---- 04 · where an MLLM cuts: LLaVA-1.5-7B sizes ---- */

/** CLIP ViT-L/14 at 336 px: 576 patches and [CLS], 24 layers. Vicuna-7B: 32 layers, d = 4096, a three-matrix MLP of width 11008. */
export const CLIP_L = { N: 577, d: 1024, width: 4096, mats: 2, layers: 24 };
export const VICUNA = { d: 4096, width: 11008, mats: 3, layers: 32 };
export const VISUAL = 576;
/** Prompt text (system prompt and question) entering the LLM with the image tokens. Hand-set. */
export const TEXT = 64;
export type CutMode = "none" | "fastv" | "cls";
export type Prefill = { enc: number; early: number; late: number; total: number };
/** Multiply-adds before the first answer token: the vision encoder, LLM layers 1–2, and LLM layers 3–32. FastV cuts after layer 2; VTC-CLS before layer 1. */
export function prefill(mode: CutMode, keep: number): Prefill {
  const enc = CLIP_L.layers * totalCost(layerCost(CLIP_L.N, CLIP_L.d, CLIP_L.width, CLIP_L.mats));
  const layer = (n: number) => totalCost(layerCost(n + TEXT, VICUNA.d, VICUNA.width, VICUNA.mats));
  const nEarly = mode === "cls" ? keep : VISUAL, nLate = mode === "none" ? VISUAL : keep;
  const early = 2 * layer(nEarly), late = (VICUNA.layers - 2) * layer(nLate);
  return { enc, early, late, total: enc + early + late };
}

/* ---- 05 · a toy video for FastVID: the same crop for six frames, the cat closes its eye from frame 4 ---- */

/** Frame index (0-based) from which the eye is closed. */
export const CLOSE_AT = 3;
/** Six frames of 16 patch vectors. Frames 1–3 are the crop; from frame 4 cell 7 is the closed eye. A hand-set drift of 0.01 per frame
 *  in the first number stands in for sensor noise, so neighbouring frames are never exactly equal. */
export const FRAMES: number[][][] = Array.from({ length: 6 }, (_, f) => X.map((v, i) => {
  const u = f >= CLOSE_AT && i === EYE ? CLOSED : v;
  return [u[0] + 0.01 * f * ((i % 3) - 1), u[1]];
}));
export const frameKinds = (f: number): Kind[] => KIND.map((k, i) => (f >= CLOSE_AT && i === EYE ? "closed" : k));
/** One summary vector per frame: its 16 patch vectors laid end to end, 32 numbers. (The average would be [0, 0] for the open-eye crop,
 *  since the patch vectors were centred on it, and a cosine needs a direction.) */
export const FEAT = FRAMES.map((fr) => fr.flat());
/** Similarity of each frame with the next one (5 transitions for 6 frames). */
export const TRANS = FEAT.slice(0, -1).map((f, i) => cosine(f, FEAT[i + 1]));

/** Segments as lists of frame indices. A boundary after frame i means frames i and i+1 fall in different segments. */
export function segmentsFrom(boundaries: number[], F = FRAMES.length): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  for (let f = 0; f < F; f++) { cur.push(f); if (boundaries.includes(f) || f === F - 1) { out.push(cur); cur = []; } }
  return out;
}
/** DySeg: cut at the c − 1 least similar transitions, and also wherever the similarity falls below τ. */
export function dyseg(tau = 0.9, c = 2): number[][] {
  const least = TRANS.map((_, i) => i).sort((a, b) => TRANS[a] - TRANS[b]).slice(0, c - 1);
  const below = TRANS.map((t, i) => (t < tau ? i : -1)).filter((i) => i >= 0);
  return segmentsFrom([...new Set([...least, ...below])]);
}
export const fixedSeg = (len = 4) => segmentsFrom(Array.from({ length: FRAMES.length }, (_, i) => i).filter((i) => (i + 1) % len === 0));

export type Anchor = { frame: number; patch: number; v: number[]; from: { frame: number; patch: number }[] };
/** DTM inside one segment, simplified: every patch of the first frame is an anchor; every other token of the segment joins its most similar
 *  anchor (cosine), and each anchor becomes β·a + (1 − β)·mean(joined) with β = 0.6. */
export function dtm(seg: number[], beta = 0.6): Anchor[] {
  const f0 = seg[0];
  const anchors: Anchor[] = FRAMES[f0].map((v, p) => ({ frame: f0, patch: p, v, from: [] }));
  seg.slice(1).forEach((f) => FRAMES[f].forEach((v, p) => {
    let best = 0, bs = -Infinity;
    anchors.forEach((a, j) => { const c = cosine(v, a.v); if (c > bs) { bs = c; best = j; } });
    anchors[best].from.push({ frame: f, patch: p });
  }));
  return anchors.map((a) => (a.from.length === 0 ? a : { ...a, v: a.v.map((x, d) => beta * x + (1 - beta) * mean(a.from.map((q) => FRAMES[q.frame][q.patch]))[d]) }));
}
/** Where the closed eye of frame 4 went under the given segments: its anchor (its own, if frame 4 starts a segment). */
export function closedAnchor(segs: number[][]): { anchor: Anchor; own: boolean } {
  const seg = segs.find((s) => s.includes(CLOSE_AT))!, an = dtm(seg), own = seg[0] === CLOSE_AT;
  return { anchor: own ? an[EYE] : an.find((q) => q.from.some((r) => r.frame === CLOSE_AT && r.patch === EYE))!, own };
}

/* ---- 06 · a toy video for TempMe: four still frames, merged inside each frame or also across frames ---- */

/** Four frames of the still crop; tiny hand-set differences between frames stand in for sensor noise. */
export const STILL: number[][][] = Array.from({ length: 4 }, (_, f) => X.map((v, i) => [v[0] + 0.02 * ((f + i) % 3 - 1), v[1] + 0.02 * ((f * 2 + i) % 3 - 1)]));
/** Tokens of frame f carry members f·16 + p. */
export const stillTokens = (f: number): Token[] => STILL[f].map((v, p) => ({ v, s: 1, members: [f * 16 + p] }));
export const stillVec = (m: number) => STILL[Math.floor(m / 16)][m % 16];

/** Merge only inside each frame until `total` tokens remain for the whole video. */
export const perFrame = (total: number): Token[] => [0, 1, 2, 3].flatMap((f) => mergeTo(total / 4, stillTokens(f)));
/** TempMe-like: frames 1+2 and 3+4 become clips, then the two clips become one; each stage merges down to `per` tokens per clip. */
export function acrossFrames(total: number): Token[] {
  if (total >= 32) return perFrame(total);
  const frames = [0, 1, 2, 3].map((f) => mergeTo(8, stillTokens(f)));
  const clips = [mergeTo(Math.max(total / 2, 8), [...frames[0], ...frames[1]]), mergeTo(Math.max(total / 2, 8), [...frames[2], ...frames[3]])];
  if (total >= 16) return [...clips[0], ...clips[1]];
  return mergeTo(total, [...clips[0], ...clips[1]]);
}
/** The largest distance from any original patch of the four frames to the token that now stands for it. */
export const worstErr = (tokens: Token[]) => Math.max(...tokens.flatMap((t) => t.members.map((m) => dist(t.v, stillVec(m)))));

/** ViT-B/16 at 224 px, 12 frames, 12 layers: the frame-by-frame baseline, and ToMe removing r = 10 tokens per layer between attention and MLP. */
export function vitbVideo(r: number): { macs: number; tokensOut: number } {
  const d = 768, frames = 12;
  let N = 197, macs = 0;
  for (let l = 0; l < 12; l++) {
    const att = 4 * N * d * d + 2 * N * N * d;
    N -= r;
    macs += att + 2 * N * d * 4 * d;
  }
  return { macs: macs * frames, tokensOut: N * frames };
}

/* ---- 07 · the KV cache, on the toy MLLM and on Vicuna-7B ---- */

export const PROMPT = 20;         // 16 image tokens and 4 question tokens
export const ANSWER = 6;          // answer tokens generated one at a time
export const TOY_LAYERS = 4;
/** Token passes through all layers for each step: step 0 reads the prompt, step s ≥ 1 feeds back answer token s. */
export const passes = (step: number, cache: boolean) => (cache ? (step === 0 ? PROMPT : 1) : PROMPT + step);
export const cachedTokens = (step: number) => PROMPT + step;
/** Bytes of K and V for one token across all layers of Vicuna-7B in 16-bit numbers. */
export const KV_BYTES_PER_TOKEN = 2 * VICUNA.layers * VICUNA.d * 2;

/* ---- 08 · PrefixKV: how many cache entries each layer keeps ---- */

/** Hand-set importance of the 20 prompt entries in four layers, already sorted from largest to smallest and summing to 1 in each layer. */
export const DECAY = [0.93, 0.55, 0.8, 0.62];
export const IMPORTANCE: number[][] = DECAY.map((rho) => {
  const raw = Array.from({ length: PROMPT }, (_, j) => rho ** j), s = raw.reduce((a, b) => a + b, 0);
  return raw.map((v) => v / s);
});
export const cumulative = (row: number[]) => row.map((_, j) => row.slice(0, j + 1).reduce((a, b) => a + b, 0));
/** Smallest number of entries whose importance adds up to at least p. */
export const prefixFor = (row: number[], p: number) => { const c = cumulative(row); const k = c.findIndex((v) => v >= p - 1e-12); return k < 0 ? row.length : k + 1; };
/** Every layer keeps the same number of entries. */
export const sameRatio = (budget: number) => IMPORTANCE.map(() => Math.round(budget * PROMPT));
/** PrefixKV: binary search for the largest common threshold p whose prefixes fit in the total budget. Returns the counts and the trail of p values. */
export function prefixKV(budget: number, iters = 12): { counts: number[]; p: number; trail: { p: number; total: number }[] } {
  const cap = Math.round(budget * PROMPT * IMPORTANCE.length);
  let lo = 0, hi = 1, best = IMPORTANCE.map(() => 0), bestP = 0;
  const trail: { p: number; total: number }[] = [];
  for (let t = 0; t < iters; t++) {
    const p = (lo + hi) / 2, counts = IMPORTANCE.map((row) => prefixFor(row, p)), total = counts.reduce((a, b) => a + b, 0);
    trail.push({ p, total });
    if (total <= cap) { lo = p; best = counts; bestP = p; } else hi = p;
  }
  return { counts: best, p: bestP, trail };
}
export const keptImportance = (counts: number[]) => counts.map((k, l) => IMPORTANCE[l].slice(0, k).reduce((a, b) => a + b, 0));

/* ---- published values the chapter quotes (from the papers, not computed) ---- */

export const PUBLISHED = {
  tome: { base: 85.96, baseSpeed: 93.3, pruneRandom: 79.22, pruneAttn: 79.48, greedy: 84.36, bipartite: 84.25, speeds: { pruneRandom: 184.4, pruneAttn: 183.8, greedy: 179.4, bipartite: 182.9 } },
  vtc: { base: 62.1, avg: { 256: { fastv: 60.5, cls: 61.7 }, 128: { fastv: 56.6, cls: 60.5 }, 64: { fastv: 45.3, cls: 58.4 } } as Record<number, { fastv: number; cls: number }>, gqaTime: { base: 3018, 128: 2049, 64: 1750 } },
  fastvid: { tokens: 6272, kept: 608, tflops: 48.82, tflopsKept: 4.04, prefillMs: 476.3, prefillKeptMs: 67.2, acc: 59.3, accKept: 58.1, dyseg: 98.0, fixed: 95.3, cluster: 93.9 },
  tempme: { lora: { tokens: 2364, gflops: 211.3, vps: 30.6, rsum: 201.4 }, tome: { tokens: 924, gflops: 144.4, vps: 40.8, rsum: 200.6 }, vop: { gflops: 246.2, vps: 25.0, rsum: 202.3 }, tempme: { tokens: 127, gflops: 121.4, vps: 45.1, rsum: 206.7, params: 0.5 } },
  prefixkv: { full: 3.2, at20: { prefixkv: 3.69, pyramid: 12.4, h2o: 48.3, elastic: 14.0 }, tps: { prefixkv: 486.7, full: 266.6 } },
};
