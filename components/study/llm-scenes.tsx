"use client";

import { useMemo, useRef, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { bar, frame, line, rbox, type Ctx } from "./kit";
import { llmCopy } from "./llm-copy";
import { BPE_WORDS, CORPUS, MODELS, MODEL_SIZES, VIT_B_PARAMS, bpe, bpeEncode, generate, nextDist, pick, reshape, teacherForcing, trainedDist, type Generated } from "./lm-math";

const U = llmCopy.ui;
export const PAD = 18;
export const READ = palette.normal;      // what the model reads: blue
export const WRITE = palette.accent;     // what comes out and what gets picked: amber
export const FONT = (size: number) => `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

/** Percentages for the trained model, where small leftovers matter: whole numbers from 10% up, one decimal below. */
export const pct = (p: number) => (p === 0 ? "0%" : p < 0.001 ? "<0.1%" : p < 0.0995 ? `${(p * 100).toFixed(1)}%` : `${Math.round(p * 100)}%`);

type ChipOpts = { size?: number; tone?: (i: number) => string; ink?: (i: number) => string; fill?: (i: number) => string | null; lw?: (i: number) => number; sub?: (i: number) => string | null };

/** Draw tokens as rounded chips left to right, wrapping at maxX. Returns where the row ended. */
export function chips(ctx: Ctx, tokens: string[], x0: number, y0: number, maxX: number, opts: ChipOpts = {}): { x: number; y: number } {
  const size = opts.size ?? 13, hgt = size + 14;
  let x = x0, y = y0;
  ctx.save(); ctx.font = FONT(size);
  tokens.forEach((t, i) => {
    const wd = Math.max(22, ctx.measureText(t).width + 14);
    if (x + wd > maxX && x > x0) { x = x0; y += hgt + (opts.sub ? 22 : 8); }
    const tone = opts.tone?.(i) ?? palette.ink;
    rbox(ctx, x, y, wd, hgt, 7, opts.fill?.(i) ?? "#ffffff", tone, opts.lw?.(i) ?? 1.5);
    label(ctx, t, x + wd / 2, y + hgt / 2 + 0.5, opts.ink?.(i) ?? tone, size, "center");
    const sub = opts.sub?.(i);
    if (sub) label(ctx, sub, x + wd / 2, y + hgt + 9, palette.muted, 9, "center");
    x += wd + 6;
  });
  ctx.restore();
  return { x, y: y + hgt };
}

export function CtxPicker({ ctx, set }: { ctx: number; set: (n: number) => void }) {
  return (
    <div className="ad-ctl ad-seg" role="group" aria-label={U.ctx}>
      <span>{U.ctx}</span>
      {[1, 2].map((n) => <button key={n} type="button" className={ctx === n ? "on" : ""} onClick={() => set(n)}>{n}</button>)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · The same blank read with one token of context, then two         */
/* ------------------------------------------------------------------ */

export function NextTokenScene() {
  const [ctx, setCtx] = useState(1);
  const [oi, setOi] = useState(0);
  const history = U.next.options[oi];
  const dist = useMemo(() => nextDist(MODELS[ctx], history), [ctx, history]);

  const ref = useCanvas((c, w, h) => {
    c.clearRect(0, 0, w, h);
    drawGrid(c, w, h, 40);
    label(c, U.next.context, PAD, 30, palette.muted, 11);
    const blank = history.length, cut = history.length - ctx;        // tokens before `cut` are outside the model's view
    const end = chips(c, [...history, "▢"], PAD, 44, w - PAD, {
      tone: (i) => (i === blank ? WRITE : i < cut ? palette.dotOff : READ),
      ink: (i) => (i === blank ? WRITE : i < cut ? palette.dotOff : palette.ink),
      fill: (i) => (i === blank ? `rgba(${palette.accentRgb},0.12)` : i < cut ? "#ffffff" : `rgba(${palette.normalRgb},0.08)`),
      lw: (i) => (i !== blank && i >= cut ? 2.5 : 1.5),
    });
    const y0 = end.y + 26, rh = Math.min(24, (h - y0 - 14) / Math.max(dist.length, 6)), nameW = 76, bx = PAD + nameW, bwid = w - PAD - bx - 86;
    dist.forEach((e, i) => {
      const y = y0 + i * rh;
      label(c, e.token, PAD, y + rh / 2, palette.ink, 12);
      bar(c, bx, y + rh / 2 - 6, bwid, 12, e.p, WRITE);
      label(c, `${(e.p * 100).toFixed(0)}%  (${e.count}${U.next.times})`, w - PAD, y + rh / 2, palette.muted, 11, "right");
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <CtxPicker ctx={ctx} set={setCtx} />
        <div className="ad-ctl ad-seg" role="group" aria-label={U.next.context}>
          <span>{U.next.context}</span>
          {U.next.options.map((o, i) => <button key={i} type="button" className={oi === i ? "on" : ""} onClick={() => setOi(i)}>{`${o.length > 2 ? "… " : ""}${o.slice(-2).join(" ")} ▢`}</button>)}
        </div>
        <details className="st-corpus">
          <summary>{U.next.corpus}</summary>
          <p>{CORPUS.map((s) => s.join(" ")).join("  ")}</p>
        </details>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Byte-pair encoding: count pairs, merge the most frequent, repeat */
/* ------------------------------------------------------------------ */

const FOLLOW = 2;      // index of "newest" in BPE_WORDS: the word the text follows

export function BpeScene() {
  const [steps, setSteps] = useState(0);
  const st = useMemo(() => bpe(steps), [steps]);
  const unseen = useMemo(() => bpeEncode("lowest", st.merges), [st]);

  const ref = useCanvas((c, w, h) => {
    c.clearRect(0, 0, w, h);
    drawGrid(c, w, h, 40);
    const last = steps ? st.merges[steps - 1] : null, merged = last ? last[0] + last[1] : "";
    label(c, last ? `${U.bpe.last}:  ${last[0]} + ${last[1]}  →  ${merged}` : U.bpe.none, PAD, 22, last ? WRITE : palette.muted, 13);

    // the pair counts that decide the next merge: the first one wins
    const cand = st.counts[steps] ?? [];
    c.save(); c.font = FONT(11);
    let x = PAD;
    const head = `${cand.length ? U.bpe.next : U.bpe.done}  `;
    label(c, head, x, 44, palette.muted, 11); x += c.measureText(head).width;
    for (const [i, p] of cand.slice(0, 3).entries()) {
      const text = `${p.a}+${p.b} ${p.count}${U.bpe.times}`, wd = c.measureText(text).width;
      if (x + wd > w - PAD) break;
      label(c, text, x, 44, i === 0 ? palette.ink : palette.muted, 11);
      x += wd + 14;
    }
    c.restore();

    label(c, `${U.bpe.vocab} ${st.vocab.length}${U.bpe.slots}`, PAD, 64, palette.muted, 11);

    let y = 84;
    const rowGap = Math.min(64, (h - 222) / 4);
    st.words.forEach((wd, i) => {
      label(c, `${BPE_WORDS[i][0]}  ${U.bpe.freq}${wd.freq}`, PAD, y + 14, i === FOLLOW ? palette.ink : palette.muted, 11);
      chips(c, wd.pieces, PAD + 92, y, w - PAD, {
        tone: (k) => (wd.pieces[k] === merged ? WRITE : palette.ink),
        fill: (k) => (wd.pieces[k] === merged ? `rgba(${palette.accentRgb},0.16)` : "#ffffff"),
      });
      y += rowGap;
    });
    line(c, PAD, y + 2, w - PAD, y + 2, palette.frame, 1);
    label(c, U.bpe.unseen, PAD, y + 24, palette.mint, 12);
    label(c, "lowest", PAD, y + 52, palette.muted, 11);
    chips(c, unseen, PAD + 92, y + 38, w - PAD, { tone: () => palette.mint, fill: () => "rgba(15,157,106,0.1)" });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.bpe.merges} <b>{steps}</b></span>
          <input type="range" min={0} max={10} step={1} value={steps} onChange={(e) => setSteps(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · Shift by one: every position is its own training problem        */
/* ------------------------------------------------------------------ */

const SHIFT_SENTENCES = [4, 3, 8];      // the running sentence first

export function ShiftScene() {
  const [ctx, setCtx] = useState(1);
  const [si, setSi] = useState(0);
  const [pos, setPos] = useState(4);     // position 5: the blank of section 01
  const sent = CORPUS[SHIFT_SENTENCES[si]];
  const tf = useMemo(() => teacherForcing(ctx, sent), [ctx, sent]);
  const mean = tf.reduce((s, r) => s + r.loss, 0) / tf.length;

  const ref = useCanvas((c, w, h) => {
    c.clearRect(0, 0, w, h);
    drawGrid(c, w, h, 40);
    const n = sent.length, i = Math.min(pos, n - 1), g = Math.max(0, (h - 440) / 3);
    const bw = (w - 2 * PAD) / n, bh = 34, y1 = 80, y2 = y1 + bh + 66 + g;
    const input = [U.shift.start, ...sent.slice(0, -1)];
    label(c, U.shift.input, PAD, 16, palette.muted, 11);
    label(c, U.shift.range, PAD, 36, READ, 11);
    label(c, U.shift.thick, PAD, 54, READ, 11);
    label(c, U.shift.target, i < n / 2 ? w - PAD : PAD, y2 - 16, palette.muted, 11, i < n / 2 ? "right" : "left");
    for (let k = 0; k < n; k++) {
      const x = PAD + k * bw, visible = k <= i, read = visible && k > i - ctx;       // the count model reads only the last `ctx` visible boxes
      rbox(c, x + 3, y1, bw - 6, bh, 7, visible ? `rgba(${palette.normalRgb},${read ? 0.14 : 0.04})` : palette.track, visible ? (read ? READ : `rgba(${palette.normalRgb},0.4)`) : palette.dotOff, read ? 2.5 : 1.2);
      label(c, visible ? input[k] : "·", x + bw / 2, y1 + bh / 2, visible ? palette.ink : palette.dotOff, 11, "center");
      const now = k === i;
      rbox(c, x + 3, y2, bw - 6, bh, 7, now ? "rgba(15,157,106,0.14)" : "#ffffff", now ? palette.mint : palette.dotOff, now ? 2.5 : 1);
      label(c, sent[k], x + bw / 2, y2 + bh / 2, now ? palette.ink : palette.muted, 11, "center");
      label(c, tf[k].loss.toFixed(2), x + bw / 2, y2 + bh + 14, now ? palette.anomaly : palette.muted, 11, "center");
    }
    // the mask lets this position read everything up to its own box; its prediction is graded by the token below it
    frame(c, PAD + 1, y1 - 4, (i + 1) * bw - 2, bh + 8, READ, 1.5, [5, 4]);
    const ax = PAD + (i + 0.5) * bw;
    line(c, ax, y1 + bh + 7, ax, y2 - 5, palette.mint, 2);

    const ty = y2 + bh + 46 + g;
    label(c, `${U.shift.pos} ${i + 1} · ${U.shift.answer} "${sent[i]}"${U.shift.p} ${(tf[i].p * 100).toFixed(0)}%`, PAD, ty, palette.ink, 12);
    label(c, `${U.shift.loss} = −ln ${tf[i].p.toFixed(2)} = ${tf[i].loss.toFixed(2)}`, PAD, ty + 22, palette.anomaly, 12);
    label(c, `${U.shift.mean} ${mean.toFixed(2)}`, PAD, ty + 56 + g, palette.ink, 13);
    bar(c, PAD, ty + 70 + g, w - 2 * PAD, 6, Math.min(1, mean / 1.2), palette.anomaly);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.shift.pos}>
          <span>{U.shift.pos}</span>
          {sent.map((_, k) => <button key={k} type="button" className={pos === k ? "on" : ""} onClick={() => setPos(k)}>{k + 1}</button>)}
        </div>
        <CtxPicker ctx={ctx} set={setCtx} />
        <div className="ad-ctl ad-seg" role="group" aria-label={U.shift.sentence}>
          <span>{U.shift.sentence}</span>
          {SHIFT_SENTENCES.map((_, k) => <button key={k} type="button" className={si === k ? "on" : ""} onClick={() => setSi(k)}>{k + 1}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · Temperature and top-k act on the model's output, not the model  */
/* ------------------------------------------------------------------ */

const SAMPLE_BASE = trainedDist("에서", 100);      // the row of section 05 after 100 steps: four likely tokens and a thin tail of 24
const HEAD = 4;
const TOPK = [SAMPLE_BASE.length, HEAD, 1];
const tailOf = (d: { p: number }[]) => d.slice(HEAD).reduce((s, e) => s + e.p, 0);
const BASE_ROWS = [...SAMPLE_BASE.slice(0, HEAD).map((e) => e.p), tailOf(SAMPLE_BASE)];

export function SamplingScene() {
  const [temp, setTemp] = useState(1);
  const [topk, setTopk] = useState(SAMPLE_BASE.length);
  const [counts, setCounts] = useState<number[]>(() => new Array(HEAD + 1).fill(0));
  const dist = useMemo(() => reshape(SAMPLE_BASE, temp, topk), [temp, topk]);
  const total = counts.reduce((a, b) => a + b, 0);
  const clear = () => setCounts(new Array(HEAD + 1).fill(0));
  const draw = () => setCounts((prev) => {
    const next = [...prev];
    for (let i = 0; i < 20; i++) next[Math.min(HEAD, dist.findIndex((e) => e.token === pick(dist, Math.random())))]++;
    return next;
  });

  const ref = useCanvas((c, w, h) => {
    c.clearRect(0, 0, w, h);
    drawGrid(c, w, h, 40);
    label(c, U.sample.context, PAD, 24, palette.ink, 13);
    label(c, U.sample.drawn, w - PAD, 24, palette.muted, 11, "right");
    label(c, U.sample.tick, PAD, 46, palette.muted, 11);
    const rows = [...dist.slice(0, HEAD).map((e) => ({ name: e.token, p: e.p })), { name: U.sample.rest, p: tailOf(dist) }];
    const y0 = 66, rh = Math.min(56, (h - y0 - 16) / rows.length), nameW = 84, bx = PAD + nameW, bwid = w - PAD - bx - 92;
    rows.forEach((r, i) => {
      const y = y0 + i * rh + rh / 2, cut = r.p === 0;
      label(c, r.name, PAD, y, cut ? palette.dotOff : i === HEAD ? palette.anomaly : palette.ink, 12);
      bar(c, bx, y - 7, bwid, 14, r.p, i === HEAD ? palette.anomaly : WRITE);
      line(c, bx + bwid * BASE_ROWS[i], y - 12, bx + bwid * BASE_ROWS[i], y + 12, palette.ink, 2);
      label(c, pct(r.p), bx + bwid + 44, y, cut ? palette.dotOff : palette.ink, 12, "right");
      label(c, total ? String(counts[i]) : "", w - PAD, y, palette.ink, 12, "right");
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.sample.temp} <b>{temp.toFixed(1)}</b></span>
          <input type="range" min={0.2} max={2} step={0.1} value={temp} onChange={(e) => { setTemp(Number(e.target.value)); clear(); }} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.sample.topk}>
          <span>{U.sample.topk}</span>
          {TOPK.map((k, i) => <button key={k} type="button" className={topk === k ? "on" : ""} onClick={() => { setTopk(k); clear(); }}>{i === 0 ? U.sample.off : k}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group">
          <button type="button" className="ad-btn" onClick={draw}>{U.sample.draw}</button>
          <button type="button" className="ad-btn" onClick={clear}>{U.sample.clear}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · The loop left to the dice: which sentences come out             */
/* ------------------------------------------------------------------ */

export function GenerateScene() {
  const [ctx, setCtx] = useState(1);
  const [temp, setTemp] = useState(1);
  const [run, setRun] = useState<{ list: Generated[]; seed: number }>(() => ({ list: [generate(1, 1, 3)], seed: 3 }));
  const clock = useRef(0), born = useRef(0);
  const write = () => {
    born.current = clock.current;
    setRun((r) => ({ list: [generate(ctx, temp, r.seed + 1), ...r.list].slice(0, 6), seed: r.seed + 1 }));
  };

  const ref = useCanvas((c, w, h, tt) => {
    c.clearRect(0, 0, w, h);
    drawGrid(c, w, h, 40);
    clock.current = tt;
    const cur = run.list[0];
    const shown = Math.min(cur.tokens.length, Math.floor((tt - born.current) / 0.32) + 1);
    const done = shown >= cur.tokens.length;
    label(c, done ? "" : U.generate.writing, w - PAD, 28, WRITE, 11, "right");
    const end = chips(c, cur.tokens.slice(0, shown), PAD, 42, w - PAD, {
      size: 14,
      tone: (i) => (i === shown - 1 && !done ? WRITE : palette.ink),
      sub: (i) => `${(cur.probs[i] * 100).toFixed(0)}%`,
    });
    if (done) label(c, cur.inCorpus ? `● ${U.generate.inCorpus}` : `● ${U.generate.novel}`, PAD, end.y + 40, cur.inCorpus ? palette.mint : palette.anomaly, 13);

    const hy = Math.max(end.y + 84, h * 0.46);
    line(c, PAD, hy - 16, w - PAD, hy - 16, palette.frame, 1);
    label(c, U.generate.history, PAD, hy, palette.muted, 11);
    run.list.slice(1).forEach((g, i) => {
      const y = hy + 24 + i * 24;
      c.fillStyle = g.inCorpus ? palette.mint : palette.anomaly;
      c.beginPath(); c.arc(PAD + 5, y, 4, 0, Math.PI * 2); c.fill();
      label(c, g.tokens.join(" "), PAD + 18, y, palette.ink, 12);
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <button type="button" className="ad-btn" onClick={write}>{U.generate.write}</button>
        <CtxPicker ctx={ctx} set={setCtx} />
        <label className="ad-ctl">
          <span>{U.generate.temp} <b>{temp.toFixed(1)}</b></span>
          <input type="range" min={0.5} max={1.5} step={0.1} value={temp} onChange={(e) => setTemp(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 · Parameter counts, linear and log                                */
/* ------------------------------------------------------------------ */

const human = (p: number) => (p >= 1e9 ? `${(p / 1e9).toFixed(p >= 1e10 ? 0 : 1)}B` : `${(p / 1e6).toFixed(0)}M`);

export function ScaleScene() {
  const [log, setLog] = useState(false);

  const ref = useCanvas((c, w, h) => {
    c.clearRect(0, 0, w, h);
    drawGrid(c, w, h, 40);
    const nameW = Math.min(150, w * 0.36), bx = PAD + nameW, bwid = w - PAD - bx - 56, y0 = 56, rh = Math.min(54, (h - y0 - 60) / MODEL_SIZES.length);
    const frac = (p: number) => (log ? (Math.log10(p) - 7) / (11.5 - 7) : p / 175e9);
    label(c, U.scale.params, bx, y0 - 22, palette.muted, 11);
    MODEL_SIZES.forEach((m, i) => {
      const y = y0 + i * rh;
      label(c, m.name, PAD, y + rh / 2 - 8, palette.ink, 12);
      label(c, String(m.year), PAD, y + rh / 2 + 8, palette.muted, 10);
      bar(c, bx, y + rh / 2 - 8, bwid, 16, frac(m.params), i === MODEL_SIZES.length - 1 ? palette.accent2 : palette.accent);
      label(c, human(m.params), bx + bwid + 8, y + rh / 2, palette.ink, 12);
    });
    const vx = bx + bwid * frac(VIT_B_PARAMS), yb = y0 + MODEL_SIZES.length * rh;
    line(c, vx, y0 - 6, vx, yb + 6, palette.mint, 1.5, [4, 4]);
    label(c, `${U.scale.vit} ${human(VIT_B_PARAMS)}`, Math.min(w - PAD, vx + 6), yb + 20, palette.mint, 11, vx > w * 0.6 ? "right" : "left");
    if (log) for (let e = 7; e <= 11; e++) {
      const x = bx + bwid * ((e - 7) / 4.5);
      line(c, x, yb + 2, x, yb + 8, palette.frame, 1);
      label(c, `10^${e}`, x, yb + 38, palette.muted, 9, "center");
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.scale.axis}>
          <span>{U.scale.axis}</span>
          <button type="button" className={!log ? "on" : ""} onClick={() => setLog(false)}>{U.scale.linear}</button>
          <button type="button" className={log ? "on" : ""} onClick={() => setLog(true)}>{U.scale.log}</button>
        </div>
      </div>
    </div>
  );
}
