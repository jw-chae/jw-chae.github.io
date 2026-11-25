"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, frame, line, rbox, type Ctx } from "./kit";
import { loraCopy } from "./lora-copy";
import { A3_START, DW3, ROW3, TASK_Y3, TIMES3, W3, W3_TUNED, X3, X3_ALT, matVec, trainSide, type Mat } from "./lora-math";

const U = loraCopy.ui;
const PAD = 18;
const FROZEN = palette.normal;      // the pretrained matrix and what it outputs: blue
const TRAIN = palette.accent;       // everything training is allowed to change, and what it adds: amber
const TINT = `rgba(${palette.accentRgb},0.16)`;
const COOL = `rgba(${palette.normalRgb},0.07)`;

export const num = (v: number, d = 2) => { const s = v.toFixed(d).replace(/\.?0+$/, ""); return s === "-0" ? "0" : s.replace("-", "−"); };
export const vec = (a: number[], d = 2) => `[${a.map((v) => num(v, d)).join(", ")}]`;
const par = (v: number) => (v < 0 ? `(${num(v)})` : num(v));
/** "1×2 + 0×1 + 2×1": one row against the input, written out. */
const terms = (row: number[], x: number[]) => row.map((v, j) => `${par(v)}×${num(x[j])}`).join(" + ");
const dotOf = (a: number[], b: number[]) => a.reduce((s, v, j) => s + v * b[j], 0);

type GridOpt = { caption?: string; tone?: string; fill?: (r: number, c: number) => string | null };
/** A matrix as a block of cells with its number written in each cell. */
export function numGrid(ctx: Ctx, m: Mat, x: number, y: number, cw: number, ch: number, o: GridOpt = {}) {
  const tone = o.tone ?? palette.ink;
  m.forEach((row, r) => row.forEach((v, c) => {
    ctx.fillStyle = o.fill?.(r, c) ?? "#ffffff";
    ctx.fillRect(x + c * cw, y + r * ch, cw, ch);
    ctx.strokeStyle = palette.frame; ctx.lineWidth = 1;
    ctx.strokeRect(x + c * cw + 0.5, y + r * ch + 0.5, cw - 1, ch - 1);
    const s = num(v);
    label(ctx, s, x + c * cw + cw / 2, y + r * ch + ch / 2 + 0.5, palette.ink, s.length * 7.9 <= cw - 6 ? 13 : s.length * 7.3 <= cw - 4 ? 12 : s.length * 6.7 <= cw - 3 ? 11 : 10, "center");
  }));
  frame(ctx, x, y, m[0].length * cw, m.length * ch, tone, 1.5);
  if (o.caption) label(ctx, o.caption, x + (m[0].length * cw) / 2, y - 13, tone, 11, "center");
}

/* ------------------------------------------------------------------ */
/* 02 · One matrix, one input: what full fine-tuning changes            */
/* ------------------------------------------------------------------ */

const WX = matVec(W3, X3), TX = matVec(W3_TUNED, X3), DX = matVec(DW3, X3);

export function MatVecScene() {
  const [step, setStep] = useState(0);
  const T = U.matvec;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const g = Math.max(0, (h - 440) / 3), slot = (w - 2 * PAD) / 3, cw = Math.min(44, (slot - 10) / 3), ch = w < 420 ? 28 : 32, gw = 3 * cw;
    const gx = (i: number) => PAD + slot * i + (slot - gw) / 2, y0 = 66 + g / 2, fs = w < 420 ? 12 : 13;
    label(ctx, `${T.input} = ${vec(X3)}`, PAD, 20, palette.ink, 13);

    const tables: { m: Mat; cap: string; tone: string; out: number[]; fill?: GridOpt["fill"] }[] = [
      { m: W3, cap: T.w, tone: FROZEN, out: WX, fill: () => COOL },
      { m: W3_TUNED, cap: T.tuned, tone: palette.ink, out: TX, fill: () => TINT },
      { m: DW3, cap: T.dw, tone: TRAIN, out: DX },
    ];
    tables.forEach((t, i) => {
      if (step < i) return;
      ctx.save(); ctx.globalAlpha = step === i ? 1 : 0.8;
      numGrid(ctx, t.m, gx(i), y0, cw, ch, { caption: t.cap, tone: t.tone, fill: t.fill });
      label(ctx, T.put, gx(i) + gw / 2, y0 + 3 * ch + 16, palette.muted, 11, "center");
      label(ctx, vec(t.out), gx(i) + gw / 2, y0 + 3 * ch + 36, t.tone, fs, "center");
      ctx.restore();
    });

    const yT = y0 + 3 * ch + 72 + g;
    if (step < 2) {
      const M = step === 0 ? W3 : W3_TUNED, out = step === 0 ? WX : TX;
      label(ctx, step === 0 ? T.rule : T.changed, PAD, yT, step === 0 ? palette.muted : TRAIN, 12);
      M.forEach((row, i) => label(ctx, `${T.rows[i]}  ${terms(row, X3)} = ${num(out[i])}`, PAD, yT + 28 + i * 25, palette.ink, fs));
      if (step === 1) label(ctx, T.sameInput, PAD, yT + 28 + 3 * 25 + 4, palette.muted, 11);
    } else {
      label(ctx, T.split, PAD, yT, palette.muted, 12);
      const rows: [string, number[], string][] = [["W'x", TX, palette.ink], ["= Wx", WX, FROZEN], ["+ ΔWx", DX, TRAIN]];
      rows.forEach(([name, v, tone], i) => {
        label(ctx, name, PAD, yT + 28 + i * 25, tone, fs);
        label(ctx, vec(v), PAD + 74, yT + 28 + i * 25, tone, fs + 1);
      });
      label(ctx, T.still9, PAD, yT + 28 + 3 * 25 + 4, TRAIN, 12);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.step}>
          <span>{T.step}</span>
          {T.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Every row is a multiple of one row: nine cells from six numbers */
/* ------------------------------------------------------------------ */

const B_COL: Mat = TIMES3.map((v) => [v]);
const EX = { r: 1, c: 2 };          // the cell worked out as an example: second row, third column

export function SimpleScene() {
  const [step, setStep] = useState(0);
  const [alt, setAlt] = useState(false);
  const T = U.simple;
  const x = alt ? X3_ALT : X3;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const g = Math.max(0, (h - 440) / 3), cw = w < 420 ? 38 : 46, ch = w < 420 ? 28 : 32, gw = 3 * cw, gh = 3 * ch, fs = w < 420 ? 12 : 13;
    const bx = PAD + cw + 22, by = 44 + ch + 12 + g / 2, ax = dotOf(ROW3, x), add = TIMES3.map((b) => b * ax);
    label(ctx, T.caption, PAD, 20, TRAIN, 12);
    if (step === 2) label(ctx, `${T.input} = ${vec(x)}`, w - PAD, 20, palette.ink, 13, "right");

    // ΔW stays where it is through all three steps
    numGrid(ctx, DW3, bx, by, cw, ch, {
      tone: TRAIN,
      fill: (r, c) => (step === 0 ? (r === 0 ? TINT : null) : step === 1 && r === EX.r && c === EX.c ? TINT : null),
    });
    if (step === 0) {
      TIMES3.forEach((k, r) => label(ctx, r === 0 ? T.base : `= ${num(k)} × ${T.first}`, bx + gw + 14, by + r * ch + ch / 2, r === 0 ? TRAIN : palette.ink, fs));
    } else {
      // the six numbers that are kept: the multipliers down the side, the one row across the top
      numGrid(ctx, [ROW3], bx, by - ch - 12, cw, ch, { tone: TRAIN, fill: (_, c) => (step === 1 && c === EX.c ? TINT : step === 2 ? TINT : null) });
      numGrid(ctx, B_COL, PAD, by, cw, ch, { tone: TRAIN, fill: (r) => (step === 1 && r === EX.r ? TINT : step === 2 ? TINT : null) });
      label(ctx, T.a, bx + gw + 14, by - ch - 12 + ch / 2, TRAIN, fs);
      label(ctx, T.b, PAD, by + gh + 14, TRAIN, 12);
      label(ctx, "ΔW", bx + gw + 14, by + gh / 2, palette.muted, 12);
    }

    const yT = by + gh + 44 + g;
    if (step === 0) {
      label(ctx, T.rowsSay, PAD, yT, palette.ink, fs);
      label(ctx, T.count, PAD, yT + 26, palette.ink, fs);
      label(ctx, T.nine, PAD, yT + 52, palette.muted, 12);
    } else if (step === 1) {
      label(ctx, T.cellRule, PAD, yT, palette.muted, 12);
      label(ctx, `${T.example} ${num(TIMES3[EX.r])} × ${num(ROW3[EX.c])} = ${num(DW3[EX.r][EX.c])}`, PAD, yT + 26, palette.ink, fs);
      label(ctx, T.keep, PAD, yT + 52, TRAIN, 12);
      label(ctx, T.product, PAD, yT + 74, palette.muted, 12);
    } else {
      label(ctx, `A·x = ${terms(ROW3, x)} = ${num(ax)}`, PAD, yT, palette.ink, fs);
      label(ctx, `B × ${num(ax)} = ${vec(add)}`, PAD, yT + 25, TRAIN, fs);
      label(ctx, `${T.direct} ${vec(matVec(DW3, x))}`, PAD, yT + 50, palette.muted, 12);
      label(ctx, T.same, w - PAD, yT + 50, palette.mint, 12, "right");
      // three numbers in, one number in the middle, three numbers out
      const yF = yT + 92, bw = [0.3, 0.2, 0.38].map((k) => k * (w - 2 * PAD)), gap = ((w - 2 * PAD) - bw[0] - bw[1] - bw[2]) / 2;
      const xs = [PAD, PAD + bw[0] + gap, PAD + bw[0] + bw[1] + 2 * gap];
      const boxes: [string, string, string][] = [[T.in3, vec(x), palette.ink], [T.mid1, num(ax), TRAIN], [T.out3, vec(add), TRAIN]];
      boxes.forEach(([cap, value, tone], i) => {
        rbox(ctx, xs[i], yF, bw[i], 30, 8, i === 0 ? "#ffffff" : TINT, tone, 1.5);
        label(ctx, value, xs[i] + bw[i] / 2, yF + 15.5, palette.ink, 12, "center");
        label(ctx, cap, xs[i] + bw[i] / 2, yF - 12, palette.muted, 11, "center");
        if (i < 2) arrow(ctx, xs[i] + bw[i] + 3, yF + 15, xs[i + 1] - 3, yF + 15, TRAIN, 1.5);
        if (i < 2) label(ctx, i === 0 ? "A" : "B", xs[i] + bw[i] + gap / 2, yF + 30, TRAIN, 11, "center");
      });
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.step}>
          <span>{T.step}</span>
          {T.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        {step === 2 ? (
          <div className="ad-ctl ad-seg" role="group" aria-label={T.input}>
            <span>{T.input}</span>
            <button type="button" className={!alt ? "on" : ""} onClick={() => setAlt(false)}>{vec(X3)}</button>
            <button type="button" className={alt ? "on" : ""} onClick={() => setAlt(true)}>{vec(X3_ALT)}</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · The same input through the frozen path and the trained side path */
/* ------------------------------------------------------------------ */

const RUN = trainSide();
const LAST = RUN.length - 1;
const MAIN = matVec(W3, X3);
const moved = (a: number, b: number) => Math.abs(a - b) > 0.005;

export function SideScene() {
  const [step, setStep] = useState(0);
  const T = U.side;
  const s = RUN[step];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const g = Math.max(0, (h - 440) / 4), fs = w < 420 ? 12 : 13;
    const big = w >= 420, wc = big ? 34 : 30, wr = big ? 24 : 22, tc = big ? 52 : 46, tr = big ? 26 : 24, xr = PAD + 3 * tc + 34;
    label(ctx, `${T.input} = ${vec(X3)}`, PAD, 18, palette.ink, 13);

    // the frozen path: W is used in the computation and never changes
    const yW = 52;
    label(ctx, T.main, PAD, yW - 14, FROZEN, 11);
    numGrid(ctx, W3, PAD, yW, wc, wr, { tone: FROZEN, fill: () => COOL });
    label(ctx, `W·x = ${vec(MAIN)}`, xr, yW + 20, FROZEN, fs);
    label(ctx, T.frozen, xr, yW + 44, palette.muted, 11);

    // the side path: A first (three numbers become one), then B (one number becomes three)
    const yA = yW + 3 * wr + 38 + g, yB = yA + tr + 14;
    const nB = s.B.filter((v) => moved(v, 0)).length, nA = s.A.filter((v, j) => moved(v, A3_START[j])).length;
    label(ctx, T.side, PAD, yA - 14, TRAIN, 11);
    numGrid(ctx, [s.A], PAD + 20, yA, tc, tr, { tone: TRAIN, fill: (_, c) => (moved(s.A[c], A3_START[c]) ? TINT : null) });
    label(ctx, "A", PAD + 2, yA + tr / 2, TRAIN, 13);
    label(ctx, `A·x = ${num(s.ax)}`, xr, yA + tr / 2, palette.ink, fs);
    label(ctx, T.one, xr, yA + tr / 2 + 18, palette.muted, 11);
    numGrid(ctx, s.B.map((v) => [v]), PAD + 20, yB, tc, tr, { tone: TRAIN, fill: (r) => (moved(s.B[r], 0) ? TINT : null) });
    label(ctx, "B", PAD + 2, yB + 1.5 * tr, TRAIN, 13);
    label(ctx, `B × ${num(s.ax)} =`, PAD + 20 + tc + 14, yB + 1.1 * tr, palette.ink, fs);
    label(ctx, vec(s.side), PAD + 20 + tc + 14, yB + 2.1 * tr, TRAIN, fs + 1);
    label(ctx, `${T.movedBA} ${nB + nA} / 6`, w - PAD, yA - 14, nB + nA > 0 ? TRAIN : palette.muted, 11, "right");

    // the two results are added; the wanted output is opened only after that
    const yS = yB + 3 * tr + 30 + g, rh = 22, vx = PAD + 112;
    line(ctx, PAD, yS - 16, w - PAD, yS - 16, palette.frame, 1);
    const rows: [string, number[], string][] = [
      [T.rowMain, MAIN, FROZEN], [T.rowSide, s.side, TRAIN], [T.rowOut, s.out, palette.ink], [T.want, TASK_Y3[0], palette.mint], [T.err, s.err, palette.anomaly],
    ];
    rows.forEach(([name, v, tone], i) => {
      const y = yS + i * rh + (i >= 3 ? 8 : 0);
      label(ctx, name, PAD, y, tone, 12);
      label(ctx, vec(v), vx, y, tone, i === 2 ? fs + 1 : fs);
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{T.step} <b>{step}</b></span>
          <input type="range" min={0} max={LAST} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}
