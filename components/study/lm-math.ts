/** A tiny language model and a tiny tokenizer for the LLM study scenes.
 *  Both are computed from the small corpora below, so every probability on screen is a real count. */

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

/* ---- the corpus: fourteen short sentences, particles split off as their own tokens ---- */

export const CORPUS: string[][] = [
  "고양이 는 생선 을 좋아한다 .",
  "고양이 는 낮잠 을 좋아한다 .",
  "강아지 는 산책 을 좋아한다 .",
  "강아지 는 공 을 물어온다 .",
  "고양이 는 소파 에서 잔다 .",
  "강아지 는 마당 에서 뛴다 .",
  "새 는 하늘 을 난다 .",
  "새 는 나무 에서 운다 .",
  "물고기 는 물 에서 헤엄친다 .",
  "고양이 는 새 를 쫓는다 .",
  "강아지 는 고양이 를 쫓는다 .",
  "아이 는 강아지 를 좋아한다 .",
  "아이 는 마당 에서 뛴다 .",
  "아이 는 공 을 던진다 .",
].map((s) => s.split(" "));

const START = "<s>";
export type Dist = { token: string; count: number; p: number }[];
export type NGram = { n: number; table: Map<string, Map<string, number>> };

/** Count which token follows each context of `ctx` previous tokens. */
export function buildModel(ctx: number): NGram {
  const table = new Map<string, Map<string, number>>();
  for (const sent of CORPUS) {
    const toks = [...new Array<string>(ctx).fill(START), ...sent];
    for (let i = ctx; i < toks.length; i++) {
      const key = toks.slice(i - ctx, i).join(" ");
      if (!table.has(key)) table.set(key, new Map());
      const m = table.get(key)!;
      m.set(toks[i], (m.get(toks[i]) ?? 0) + 1);
    }
  }
  return { n: ctx, table };
}

export const MODELS: Record<number, NGram> = { 1: buildModel(1), 2: buildModel(2) };

/** Next-token distribution after the given history, sorted by count. */
export function nextDist(model: NGram, history: string[]): Dist {
  const padded = [...new Array<string>(model.n).fill(START), ...history];
  const m = model.table.get(padded.slice(padded.length - model.n).join(" "));
  if (!m) return [];
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  return [...m.entries()].map(([token, count]) => ({ token, count, p: count / total })).sort((a, b) => b.count - a.count || a.token.localeCompare(b.token));
}

/** Reshape a distribution: p^(1/T), keep the k most likely, renormalise. */
export function reshape(d: Dist, temperature: number, topK: number): Dist {
  const kept = d.slice(0, Math.max(1, topK));
  const w = kept.map((e) => Math.pow(e.p, 1 / temperature));
  const sum = w.reduce((a, b) => a + b, 0);
  return d.map((e, i) => ({ ...e, p: i < kept.length ? w[i] / sum : 0 }));
}

export function pick(d: Dist, u: number): string {
  let acc = 0;
  for (const e of d) { acc += e.p; if (u < acc) return e.token; }
  return d[d.length - 1].token;
}

export type Generated = { tokens: string[]; probs: number[]; inCorpus: boolean };

/** Generate one sentence token by token until "." (or 12 tokens). */
export function generate(ctx: number, temperature: number, seed: number): Generated {
  const r = mulberry(seed * 7919 + ctx * 101 + Math.round(temperature * 10));
  const model = MODELS[ctx], tokens: string[] = [], probs: number[] = [];
  for (let i = 0; i < 12; i++) {
    const d = reshape(nextDist(model, tokens), temperature, 99);
    if (!d.length) break;
    const tok = pick(d, r());
    tokens.push(tok); probs.push(d.find((e) => e.token === tok)!.p);
    if (tok === ".") break;
  }
  const s = tokens.join(" ");
  return { tokens, probs, inCorpus: CORPUS.some((c) => c.join(" ") === s) };
}

/** Per-position training targets for one sentence: what the model sees, what it must predict, and its loss. */
export function teacherForcing(ctx: number, sent: string[]): { seen: string[]; target: string; p: number; loss: number }[] {
  return sent.map((target, i) => {
    const d = nextDist(MODELS[ctx], sent.slice(0, i));
    const p = d.find((e) => e.token === target)?.p ?? 0;
    return { seen: sent.slice(0, i), target, p, loss: -Math.log(Math.max(p, 1e-9)) };
  });
}

/* ---- byte-pair encoding on the classic four-word corpus ---- */

export const BPE_WORDS: [string, number][] = [["low", 5], ["lower", 2], ["newest", 6], ["widest", 3]];
export type BpeState = { merges: [string, string][]; words: { word: string; freq: number; pieces: string[] }[]; vocab: string[] };

const split = (w: string) => [...w.split(""), "_"];          // "_" marks the end of a word

function applyMerge(pieces: string[], a: string, b: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < pieces.length; i++) {
    if (i < pieces.length - 1 && pieces[i] === a && pieces[i + 1] === b) { out.push(a + b); i++; } else out.push(pieces[i]);
  }
  return out;
}

/** Run `steps` merges: each step joins the most frequent adjacent pair (ties broken alphabetically). */
export function bpe(steps: number): BpeState {
  let words = BPE_WORDS.map(([word, freq]) => ({ word, freq, pieces: split(word) }));
  const merges: [string, string][] = [];
  for (let s = 0; s < steps; s++) {
    const counts = new Map<string, number>();
    for (const w of words) for (let i = 0; i < w.pieces.length - 1; i++) {
      const k = w.pieces[i] + " " + w.pieces[i + 1];
      counts.set(k, (counts.get(k) ?? 0) + w.freq);
    }
    if (!counts.size) break;
    const [best] = [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))[0];
    const [a, b] = best.split(" ");
    merges.push([a, b]);
    words = words.map((w) => ({ ...w, pieces: applyMerge(w.pieces, a, b) }));
  }
  const vocab = new Set<string>();
  for (const [w] of BPE_WORDS) for (const ch of split(w)) vocab.add(ch);
  for (const [a, b] of merges) vocab.add(a + b);
  return { merges, words, vocab: [...vocab] };
}

/** Tokenize a word the tokenizer has never seen, replaying the learned merges in order. */
export function bpeEncode(word: string, merges: [string, string][]): string[] {
  let pieces = split(word);
  for (const [a, b] of merges) pieces = applyMerge(pieces, a, b);
  return pieces;
}

/* ---- parameter counts of well-known models (from their papers) ---- */

export const MODEL_SIZES: { name: string; year: number; params: number; note: string }[] = [
  { name: "Transformer (base)", year: 2017, params: 65e6, note: "번역" },
  { name: "GPT-1", year: 2018, params: 117e6, note: "" },
  { name: "BERT-large", year: 2018, params: 340e6, note: "" },
  { name: "GPT-2", year: 2019, params: 1.5e9, note: "" },
  { name: "GPT-3", year: 2020, params: 175e9, note: "" },
];
export const VIT_B_PARAMS = 86e6;
