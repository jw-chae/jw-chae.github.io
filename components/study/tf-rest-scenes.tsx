"use client";

import { useMemo, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { frame, line, rbox, type Ctx } from "./kit";
import { tfCopy } from "./tf-copy";
import { ORDER_A, ORDER_B, W_Q, headCost, orderPair, readRow, sinusoid, type RowRead, type Word } from "./tf-math";

const U = tfCopy.ui;
const PAD = 18;
const READ = palette.normal;        // reading shares: blue, as in 02–04
const num = (v: number, d = 2) => { const s = v.toFixed(d).replace(/\.?0+$/, ""); return s === "-0" ? "0" : s.replace("-", "−"); };
const vec = (a: number[], d = 2) => `[${a.map((v) => num(v, d)).join(", ")}]`;
const pc = (v: number) => `${v < 0.01 && v > 0 ? (v * 100).toFixed(1) : Math.round(v * 100)}%`;

type Cols = { cx: (i: number) => number; bw: number; narrow: boolean };
function columns(w: number): Cols {
  const colW = (w - 2 * PAD) / 3;
  return { cx: (i) => PAD + colW * (i + 0.5), bw: Math.min(116, colW - 12), narrow: colW < 125 };
}

/** Three word boxes in the same place as the source row of 02. The box that owns the query is filled and tagged Q. */
function wordRow(ctx: Ctx, c: Cols, y: number, words: string[], owner: number, colors?: string[]) {
  words.forEach((word, i) => {
    const hot = i === owner, color = colors?.[i] ?? READ;
    rbox(ctx, c.cx(i) - c.bw / 2, y, c.bw, 34, 8, hot ? `rgba(${palette.normalRgb},0.12)` : "#ffffff", color, hot ? 2.5 : 1.5);
    label(ctx, word, c.cx(i), y + 17, palette.ink, 14, "center");
    if (hot) label(ctx, "Q", c.cx(i) - c.bw / 2 + 8, y + 17, READ, 11);
  });
}

/** Reading shares above the words: a percentage and a bar per position. */
function shares(ctx: Ctx, c: Cols, y: number, ws: number[], fresh = false) {
  ws.forEach((wt, i) => {
    label(ctx, pc(wt), c.cx(i), y, READ, fresh ? 15 : 13, "center");
    ctx.fillStyle = palette.track; ctx.fillRect(c.cx(i) - c.bw / 2, y + 11, c.bw, 6);
    ctx.fillStyle = READ; ctx.fillRect(c.cx(i) - c.bw / 2, y + 11, Math.max(2, c.bw * wt), 6);
  });
}

/* ------------------------------------------------------------------ */
/* 07 · One row reading itself: the query's owner sits in the same row  */
/* ------------------------------------------------------------------ */

type Verb2 = "love" | "chase";
const VERBS: Verb2[] = ["love", "chase"];

export function SelfReadScene() {
  const [step, setStep] = useState(0);
  const [owner, setOwner] = useState(2);
  const [verb, setVerb] = useState<Verb2>("love");
  const words = useMemo<Word[]>(() => ["I", verb, "cats"], [verb]);
  const r = useMemo(() => readRow(words, false), [words]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const c = columns(w), d = c.narrow ? 1 : 2, g = Math.max(0, (h - 440) / 4);
    const yShare = 34, yBox = 62, yX = yBox + 50, yS = yX + 16, yRead = yS + 28 + g, yAfter = yRead + 48, yTab = yAfter + 46 + g;
    const name = words[owner];

    label(ctx, U.self.row, PAD, 14, palette.muted, 11);
    wordRow(ctx, c, yBox, words, owner);
    words.forEach((_, i) => label(ctx, `x ${vec(r.x[i], d)}`, c.cx(i), yX, palette.ink, 11, "center"));

    if (step === 0) label(ctx, U.self.before, w / 2, yRead + 15, palette.muted, 11, "center");
    if (step >= 1) {
      ctx.save(); ctx.globalAlpha = step === 1 ? 1 : 0.82;
      label(ctx, `${name}${U.self.shareOf}`, w - PAD, 14, READ, 11, "right");
      shares(ctx, c, yShare, r.weights[owner], step === 1);
      words.forEach((_, i) => {
        label(ctx, `${U.self.score} ${num(r.scores[owner][i])}`, c.cx(i), yS, palette.ink, 11, "center");
        line(ctx, c.cx(i), yS + 9, w / 2, yRead - 2, `rgba(${palette.normalRgb},${0.25 + 0.7 * r.weights[owner][i]})`, 1 + 5 * r.weights[owner][i]);
      });
      rbox(ctx, w / 2 - 120, yRead, 240, 30, 8, `rgba(${palette.normalRgb},0.1)`, READ, 1.5);
      label(ctx, `${U.self.read} ${vec(r.read[owner])}`, w / 2, yRead + 15, palette.ink, 12, "center");
      label(ctx, `${U.self.after} ${name} ${U.self.afterIs}`, w / 2, yAfter, palette.muted, 11, "center");
      label(ctx, `${vec(r.x[owner])} + ${vec(r.read[owner])} = ${vec(r.out[owner])}`, w / 2, yAfter + 17, palette.ink, 12, "center");
      ctx.restore();
    }
    if (step >= 2) {
      // every slot reads with its own query: one row of shares per slot
      const lw = 58, sw = 62, cw = Math.min(86, (w - 2 * PAD - lw - sw) / 3), th = 25;
      const tx = (w - (lw + 3 * cw + sw)) / 2 + lw, ty = yTab + 22;
      label(ctx, U.self.table, PAD, yTab - 6, READ, 11);
      words.forEach((word, j) => label(ctx, word, tx + (j + 0.5) * cw, yTab + 12, palette.muted, 11, "center"));
      words.forEach((word, i) => {
        const y = ty + i * th;
        label(ctx, word, tx - 8, y + th / 2 - 1, i === owner ? READ : palette.ink, 12, "right");
        r.weights[i].forEach((wt, j) => {
          ctx.fillStyle = `rgba(${palette.normalRgb},${0.08 + 0.85 * wt})`; ctx.fillRect(tx + j * cw + 1, y + 1, cw - 2, th - 3);
          label(ctx, pc(wt), tx + (j + 0.5) * cw, y + th / 2 - 1, wt > 0.5 ? "#ffffff" : palette.ink, 12, "center");
        });
        label(ctx, U.self.sum, tx + 3 * cw + 8, y + th / 2 - 1, palette.muted, 11);
      });
      frame(ctx, tx, ty + owner * th, 3 * cw, th - 1, palette.ink, 2);
      label(ctx, U.self.together, w / 2, ty + 3 * th + 14, palette.muted, 11, "center");
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.self.step}>
          <span>{U.self.step}</span>
          {U.self.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.self.owner}>
          <span>{U.self.owner}</span>
          {words.map((word, i) => <button key={word} type="button" className={owner === i ? "on" : ""} onClick={() => setOwner(i)}>{word}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.self.verb}>
          <span>{U.self.verb}</span>
          {VERBS.map((v) => <button key={v} type="button" className={verb === v ? "on" : ""} onClick={() => setVerb(v)}>{v}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · A matrix in front of the query, and one vector split across heads */
/* ------------------------------------------------------------------ */

const ROW: Word[] = ["I", "love", "cats"];
const HEADS = [1, 2, 4, 8];

export function MatrixScene() {
  const [useM, setUseM] = useState(false);
  const [owner, setOwner] = useState(2);
  const [heads, setHeads] = useState(8);
  const r = useMemo(() => readRow(ROW, useM), [useM]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const c = columns(w), d = c.narrow ? 1 : 2, g = Math.max(0, (h - 440) / 3);
    const yShare = 34, yBox = 62, yK = yBox + 50, yS = yK + 16, yQ = yS + 24 + g, yRead = yQ + 78, ySplit = yRead + 34 + g;
    const name = ROW[owner];

    label(ctx, U.matrix.row, PAD, 14, palette.muted, 11);
    label(ctx, `${name}${U.matrix.shareOf}`, w - PAD, 14, READ, 11, "right");
    shares(ctx, c, yShare, r.weights[owner]);
    wordRow(ctx, c, yBox, ROW, owner);
    ROW.forEach((_, i) => {
      label(ctx, `x ${vec(r.x[i], d)}`, c.cx(i), yK, palette.ink, 11, "center");
      label(ctx, `${U.matrix.score} ${num(r.scores[owner][i])}`, c.cx(i), yS, palette.ink, 11, "center");
    });

    // the owner's query: W_Q × x = Q, or x itself when no matrix is applied
    const mx = w / 2 - 96, top = yQ + 16;
    const box = (x: number, y: number, wd: number, text: string, on: boolean, stroke: string) => {
      rbox(ctx, x, y, wd, 20, 4, on ? "#ffffff" : null, stroke, 1.2);
      if (text) label(ctx, text, x + wd / 2, y + 10, on ? palette.ink : palette.dotOff, 11, "center");
    };
    label(ctx, `${name}${U.matrix.qOf}`, PAD, yQ + 4, READ, 11);
    label(ctx, useM ? "W_Q" : U.matrix.none, mx + 35, yQ + 4, useM ? palette.anomaly : palette.muted, 11, "center");
    label(ctx, "x", mx + 116, yQ + 4, palette.muted, 11, "center");
    label(ctx, "Q", mx + 185, yQ + 4, READ, 11, "center");
    for (let a = 0; a < 2; a++) {
      for (let b = 0; b < 2; b++) box(mx + b * 36, top + a * 22, 34, useM ? num(W_Q[a][b]) : "", useM, useM ? palette.anomaly : palette.dotOff);
      box(mx + 96, top + a * 22, 40, num(r.x[owner][a]), true, palette.frame);
      box(mx + 162, top + a * 22, 46, num(r.q[owner][a]), true, READ);
    }
    label(ctx, "×", mx + 83, top + 21, useM ? palette.ink : palette.dotOff, 13, "center");
    label(ctx, "=", mx + 149, top + 21, palette.ink, 13, "center");
    label(ctx, `${name}${U.matrix.read} ${vec(r.read[owner])}`, w / 2, yRead, palette.ink, 12, "center");

    // one 512-number vector shared out across the heads
    const cost = headCost(512, heads), W = w - 2 * PAD, gap = 4, sw = (W - (heads - 1) * gap) / heads;
    line(ctx, PAD, ySplit - 16, w - PAD, ySplit - 16, palette.frame, 1);
    label(ctx, U.matrix.split, PAD, ySplit, palette.muted, 11);
    for (let k = 0; k < heads; k++) {
      rbox(ctx, PAD + k * (sw + gap), ySplit + 12, sw, 22, 5, `rgba(${palette.normalRgb},0.12)`, READ, 1.2);
      label(ctx, String(cost.dh), PAD + k * (sw + gap) + sw / 2, ySplit + 23, palette.ink, 11, "center");
    }
    label(ctx, `${U.matrix.one} ${cost.dh}${U.matrix.cells} · ${U.matrix.sets} ${heads}${U.matrix.setUnit}`, PAD, ySplit + 52, palette.ink, 12);
    label(ctx, `${U.matrix.weights} 3 × ${heads} × ${cost.dh} × 512 = ${cost.qkv.toLocaleString("en-US")}`, PAD, ySplit + 72, palette.ink, 12);
    label(ctx, U.matrix.constant, PAD, ySplit + 92, palette.mint, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.matrix.make}>
          <span>{U.matrix.make}</span>
          <button type="button" className={!useM ? "on" : ""} onClick={() => setUseM(false)}>{U.matrix.raw}</button>
          <button type="button" className={useM ? "on" : ""} onClick={() => setUseM(true)}>{U.matrix.withM}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.matrix.owner}>
          <span>{U.matrix.owner}</span>
          {ROW.map((word, i) => <button key={word} type="button" className={owner === i ? "on" : ""} onClick={() => setOwner(i)}>{word}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.matrix.heads}>
          <span>{U.matrix.heads}</span>
          {HEADS.map((n) => <button key={n} type="button" className={heads === n ? "on" : ""} onClick={() => setHeads(n)}>{n}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 · The same three words in two orders                              */
/* ------------------------------------------------------------------ */

const WORD_COLOR: Record<string, string> = { dogs: palette.accent2, chase: palette.muted, cats: palette.accent };
const SHOWN: Record<string, string> = { dogs: "Dogs", chase: "chase", cats: "Cats" };
const shownAt = (word: string, i: number) => (i === 0 ? SHOWN[word] : word);

export function WordOrderScene() {
  const [usePos, setUsePos] = useState(false);
  const [who, setWho] = useState<Word>("cats");
  const o = useMemo(() => orderPair(usePos), [usePos]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const c = columns(w), d = c.narrow ? 1 : 2, g = Math.max(0, (h - 440) / 3);
    const block = (y0: number, name: string, words: Word[], r: RowRead) => {
      const oi = words.indexOf(who);
      label(ctx, name, PAD, y0, palette.muted, 11);
      label(ctx, `${who}${U.order.shareOf}`, w - PAD, y0, READ, 11, "right");
      shares(ctx, c, y0 + 20, r.weights[oi]);
      wordRow(ctx, c, y0 + 46, words.map(shownAt), oi, words.map((word) => WORD_COLOR[word]));
      words.forEach((_, i) => {
        const pe = c.narrow ? `+${vec(sinusoid(i, 2), d)}` : `+ ${U.order.pos} ${vec(sinusoid(i, 2), d)}`;
        label(ctx, usePos ? pe : U.order.noPos, c.cx(i), y0 + 95, usePos ? palette.anomaly : palette.dotOff, 11, "center");
        label(ctx, `x ${vec(r.x[i], d)}`, c.cx(i), y0 + 111, palette.ink, 11, "center");
        if (c.narrow) {
          // three columns of about 106 px: the caption and the vector go on separate lines
          label(ctx, U.order.after, c.cx(i), y0 + 129, palette.muted, 11, "center");
          label(ctx, vec(r.out[i], d), c.cx(i), y0 + 145, i === oi ? READ : palette.ink, 11, "center");
        } else {
          label(ctx, `${U.order.after} ${vec(r.out[i], d)}`, c.cx(i), y0 + 127, i === oi ? READ : palette.ink, 11, "center");
        }
      });
    };
    const bh = c.narrow ? 170 : 152, yA = 14, yB = yA + bh + g, yD = yB + bh + g;
    block(yA, U.order.a, ORDER_A, o.a);
    line(ctx, PAD, yB - 14, w - PAD, yB - 14, palette.frame, 1);
    block(yB, U.order.b, ORDER_B, o.b);
    line(ctx, PAD, yD - 14, w - PAD, yD - 14, palette.frame, 1);

    label(ctx, U.order.delta, PAD, yD, palette.muted, 11);
    ORDER_A.forEach((word, i) => {
      const dl = o.delta[word];
      label(ctx, `${word} ${dl.toFixed(2)}`, c.cx(i), yD + 20, dl < 0.005 ? palette.mint : palette.anomaly, 12, "center");
    });
    label(ctx, usePos ? U.order.differ : U.order.same, w / 2, yD + 42, usePos ? palette.anomaly : palette.mint, 12, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.order.posCtl}>
          <span>{U.order.posCtl}</span>
          <button type="button" className={!usePos ? "on" : ""} onClick={() => setUsePos(false)}>{U.order.off}</button>
          <button type="button" className={usePos ? "on" : ""} onClick={() => setUsePos(true)}>{U.order.on}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.order.owner}>
          <span>{U.order.owner}</span>
          {ORDER_A.map((word) => <button key={word} type="button" className={who === word ? "on" : ""} onClick={() => setWho(word)}>{word}</button>)}
        </div>
      </div>
    </div>
  );
}
