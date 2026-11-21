"use client";

import { useMemo, useRef, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { bar, frame, line, rbox, type Ctx } from "./kit";
import { llmCopy } from "./llm-copy";
import { BPE_WORDS, CORPUS, MODELS, MODEL_SIZES, VIT_B_PARAMS, bpe, bpeEncode, generate, nextDist, pick, reshape, teacherForcing, type Generated } from "./lm-math";

const U = llmCopy.ui;
const PAD = 18;
const FONT = (size: number) => `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;

/** Draw tokens as rounded chips left to right, wrapping at maxX. Returns the y of the last row. */
function chips(ctx: Ctx, tokens: string[], x0: number, y0: number, maxX: number, opts: { size?: number; tone?: (i: number) => string; fill?: (i: number) => string | null; sub?: (i: number) => string | null } = {}): number {
  const size = opts.size ?? 13, hgt = size + 14;
  let x = x0, y = y0;
  ctx.save(); ctx.font = FONT(size);
  tokens.forEach((t, i) => {
    const wd = Math.max(22, ctx.measureText(t).width + 14);
    if (x + wd > maxX && x > x0) { x = x0; y += hgt + (opts.sub ? 22 : 8); }
    const tone = opts.tone?.(i) ?? palette.ink;
    rbox(ctx, x, y, wd, hgt, 7, opts.fill?.(i) ?? "#ffffff", tone, 1.5);
    label(ctx, t, x + wd / 2, y + hgt / 2 + 0.5, tone, size, "center");
    const sub = opts.sub?.(i);
    if (sub) label(ctx, sub, x + wd / 2, y + hgt + 9, palette.muted, 9, "center");
    x += wd + 6;
  });
  ctx.restore();
  return y + hgt;
}

function CtxPicker({ ctx, set }: { ctx: number; set: (n: number) => void }) {
  return (
    <div className="ad-ctl ad-seg" role="group" aria-label={U.ctx}>
      <span>{U.ctx}</span>
      {[1, 2].map((n) => <button key={n} type="button" className={ctx === n ? "on" : ""} onClick={() => set(n)}>{n}</button>)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 01 · What can come next, counted from fourteen sentences             */
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
    const seen = history.length ? history : [U.next.start];
    const cut = history.length - ctx;        // tokens before this index are outside the model's view
    const yEnd = chips(c, [...seen, "▢"], PAD, 44, w - PAD, {
      tone: (i) => (i === seen.length ? palette.accent : history.length && i < cut ? palette.dotOff : palette.ink),
      fill: (i) => (i === seen.length ? `rgba(${palette.accentRgb},0.12)` : "#ffffff"),
    });
    const y0 = yEnd + 26, rh = Math.min(24, (h - y0 - 14) / Math.max(dist.length, 6)), nameW = 76, bx = PAD + nameW, bwid = w - PAD - bx - 86;
    dist.forEach((e, i) => {
      const y = y0 + i * rh;
      label(c, e.token, PAD, y + rh / 2, palette.ink, 12);
      bar(c, bx, y + rh / 2 - 6, bwid, 12, e.p, palette.accent);
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
          {U.next.options.map((o, i) => <button key={i} type="button" className={oi === i ? "on" : ""} onClick={() => setOi(i)}>{o.length ? `${o.join(" ")} ▢` : `▢`}</button>)}
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
/* 02 · Byte-pair encoding: merge the most frequent pair, repeat        */
/* ------------------------------------------------------------------ */

export function BpeScene() {
  const [steps, setSteps] = useState(3);
  const st = useMemo(() => bpe(steps), [steps]);
  const unseen = useMemo(() => bpeEncode("lowest", st.merges), [st]);

  const ref = useCanvas((c, w, h) => {
    c.clearRect(0, 0, w, h);
    drawGrid(c, w, h, 40);
    const last = steps ? st.merges[steps - 1] : null, merged = last ? last[0] + last[1] : "";
    label(c, last ? `${U.bpe.last}:  ${last[0]} + ${last[1]}  →  ${merged}` : U.bpe.none, PAD, 30, last ? palette.accent : palette.muted, 13);
    label(c, `${U.bpe.vocab} ${st.vocab.length}`, w - PAD, 30, palette.muted, 12, "right");
    let y = 56;
    const rowGap = Math.min(58, (h - 190) / 4);
    st.words.forEach((wd, i) => {
      label(c, `${BPE_WORDS[i][0]}  ${U.bpe.freq}${wd.freq}`, PAD, y + 14, palette.muted, 11);
      chips(c, wd.pieces, PAD + 92, y, w - PAD, {
        tone: (k) => (wd.pieces[k] === merged ? palette.accent : palette.ink),
        fill: (k) => (wd.pieces[k] === merged ? `rgba(${palette.accentRgb},0.16)` : "#ffffff"),
      });
      y += rowGap;
    });
    line(c, PAD, y + 2, w - PAD, y + 2, palette.frame, 1);
    label(c, U.bpe.unseen, PAD, y + 26, palette.mint, 12);
    label(c, "lowest", PAD, y + 54, palette.muted, 11);
    chips(c, unseen, PAD + 92, y + 40, w - PAD, { tone: () => palette.mint, fill: () => "rgba(15,157,106,0.1)" });
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
/* 03 · Shift by one: every position is its own training problem        */
/* ------------------------------------------------------------------ */

const SHIFT_SENTENCES = [3, 0, 8];

export function ShiftScene() {
  const [ctx, setCtx] = useState(1);
  const [si, setSi] = useState(0);
  const [pos, setPos] = useState<number | null>(null);
  const sent = CORPUS[SHIFT_SENTENCES[si]];
  const tf = useMemo(() => teacherForcing(ctx, sent), [ctx, sent]);
  const mean = tf.reduce((s, r) => s + r.loss, 0) / tf.length;

  const ref = useCanvas((c, w, h, tt) => {
    c.clearRect(0, 0, w, h);
    drawGrid(c, w, h, 40);
    const n = sent.length, i = pos ?? Math.floor(tt / 1.5) % n;
    const bw = (w - 2 * PAD) / n, bh = 34, y1 = 70, y2 = y1 + bh + 70;
    const input = ["<s>", ...sent.slice(0, -1)];
    label(c, U.shift.input, PAD, y1 - 18, palette.muted, 11);
    label(c, U.shift.target, PAD, y2 - 18, palette.muted, 11);
    for (let k = 0; k < n; k++) {
      const x = PAD + k * bw, visible = k <= i;
      rbox(c, x + 3, y1, bw - 6, bh, 7, visible ? `rgba(${palette.memoryRgb},0.1)` : palette.track, visible ? palette.memory : palette.dotOff, 1.5);
      label(c, visible ? input[k] : "·", x + bw / 2, y1 + bh / 2, visible ? palette.ink : palette.dotOff, 11, "center");
      const now = k === i;
      rbox(c, x + 3, y2, bw - 6, bh, 7, now ? `rgba(${palette.accentRgb},0.16)` : "#ffffff", now ? palette.accent : palette.dotOff, now ? 2.5 : 1);
      label(c, sent[k], x + bw / 2, y2 + bh / 2, now ? palette.ink : palette.muted, 11, "center");
      label(c, tf[k].loss.toFixed(2), x + bw / 2, y2 + bh + 14, now ? palette.accent : palette.muted, 10, "center");
    }
    // the predicting position reads everything to its left and writes the token below it
    const ax = PAD + (i + 0.5) * bw;
    line(c, ax, y1 + bh + 4, ax, y2 - 6, palette.accent, 2);
    frame(c, PAD + 1, y1 - 3, (i + 1) * bw - 2, bh + 6, palette.memory, 1.5, [5, 4]);

    const ty = y2 + bh + 52;
    label(c, `${U.shift.pos} ${i + 1}:  ${U.shift.p} ${(tf[i].p * 100).toFixed(0)}%   ${U.shift.loss} ${tf[i].loss.toFixed(2)}`, PAD, ty, palette.ink, 12);
    label(c, `${U.shift.mean} ${mean.toFixed(2)}`, PAD, ty + 26, palette.accent, 13);
    bar(c, PAD, ty + 42, w - 2 * PAD, 6, Math.min(1, mean / 1.2), palette.accent);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <CtxPicker ctx={ctx} set={setCtx} />
        <div className="ad-ctl ad-seg" role="group" aria-label={U.shift.sentence}>
          <span>{U.shift.sentence}</span>
          {SHIFT_SENTENCES.map((_, k) => <button key={k} type="button" className={si === k ? "on" : ""} onClick={() => { setSi(k); setPos(null); }}>{k + 1}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.shift.pos}>
          <span>{U.shift.pos}</span>
          {sent.map((_, k) => <button key={k} type="button" className={pos === k ? "on" : ""} onClick={() => setPos(k)}>{k + 1}</button>)}
          <button type="button" className={pos === null ? "on" : ""} onClick={() => setPos(null)}>{U.shift.auto}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · Temperature and top-k reshape the distribution                  */
/* ------------------------------------------------------------------ */

const SAMPLE_BASE = nextDist(MODELS[1], ["고양이", "는"]);

export function SamplingScene() {
  const [temp, setTemp] = useState(1);
  const [topk, setTopk] = useState(SAMPLE_BASE.length);
  const [counts, setCounts] = useState<number[]>(() => new Array(SAMPLE_BASE.length).fill(0));
  const dist = useMemo(() => reshape(SAMPLE_BASE, temp, topk), [temp, topk]);
  const total = counts.reduce((a, b) => a + b, 0);
  const clear = () => setCounts(new Array(SAMPLE_BASE.length).fill(0));
  const draw = () => setCounts((prev) => {
    const next = [...prev];
    for (let i = 0; i < 20; i++) next[dist.findIndex((e) => e.token === pick(dist, Math.random()))]++;
    return next;
  });

  const ref = useCanvas((c, w, h) => {
    c.clearRect(0, 0, w, h);
    drawGrid(c, w, h, 40);
    label(c, U.sample.context, PAD, 28, palette.ink, 13);
    label(c, U.sample.drawn, w - PAD, 28, palette.muted, 11, "right");
    const y0 = 50, rh = Math.min(26, (h - y0 - 16) / dist.length), nameW = 62, bx = PAD + nameW, bwid = w - PAD - bx - 104;
    dist.forEach((e, i) => {
      const y = y0 + i * rh, cut = e.p === 0;
      label(c, e.token, PAD, y + rh / 2, cut ? palette.dotOff : palette.ink, 12);
      bar(c, bx, y + rh / 2 - 6, bwid, 12, e.p, palette.accent);
      label(c, cut ? "—" : `${(e.p * 100).toFixed(0)}%`, bx + bwid + 40, y + rh / 2, cut ? palette.dotOff : palette.muted, 11, "right");
      label(c, total ? String(counts[i]) : "", w - PAD, y + rh / 2, palette.ink, 12, "right");
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
        <label className="ad-ctl">
          <span>{U.sample.topk} <b>{topk}</b></span>
          <input type="range" min={1} max={SAMPLE_BASE.length} step={1} value={topk} onChange={(e) => { setTopk(Number(e.target.value)); clear(); }} />
        </label>
        <div className="ad-ctl ad-seg" role="group">
          <button type="button" className="ad-btn" onClick={draw}>{U.sample.draw}</button>
          <button type="button" className="ad-btn" onClick={clear}>{U.sample.clear}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · Autoregressive generation, and where false sentences come from  */
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
    label(c, done ? "" : U.generate.writing, w - PAD, 28, palette.accent, 11, "right");
    const yEnd = chips(c, cur.tokens.slice(0, shown), PAD, 42, w - PAD, {
      size: 14,
      tone: (i) => (i === shown - 1 && !done ? palette.accent : palette.ink),
      sub: (i) => `${(cur.probs[i] * 100).toFixed(0)}%`,
    });
    if (done) label(c, cur.inCorpus ? `● ${U.generate.inCorpus}` : `● ${U.generate.novel}`, PAD, yEnd + 40, cur.inCorpus ? palette.mint : palette.anomaly, 13);

    const hy = Math.max(yEnd + 84, h * 0.46);
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
/* 06 · Parameter counts, linear and log                                */
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
