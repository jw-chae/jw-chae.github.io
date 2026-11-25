"use client";

import { useState } from "react";
import { clamp, drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, line, rbox, signed, type Ctx } from "./kit";
import { resnetCopy as t } from "./resnet50-copy";
import {
  TRAIN_STEPS, TRUNK_A, TRUNK_B, X_IN, blockWalk, bodyOut, chain, layerOut, netDepth, passWeight, presetWeights, trainChain,
  type NetKind, type Preset, type TrainSnap,
} from "./resnet50-math";

const U = t.walk;
const PAD = 18;
const VALUE = palette.normal;       // a value moving forward: blue
const SIGNAL = palette.anomaly;     // the error signal coming back: red
const CHANGE = palette.accent;      // what gets written or corrected: amber
const KEEP = palette.mint;          // the shortcut, and "same as the input": green
const isPortrait = (w: number, h: number) => h > w * 1.15;

/** Numbers as the prose writes them: two decimals when large enough, otherwise one significant digit written out in full. */
function tiny(v: number): string {
  const a = Math.abs(v);
  if (a < 1e-12) return "0";
  const sign = v < 0 ? "−" : "";
  if (a >= 100) return sign + String(Math.round(a));
  if (a >= 0.00995) return sign + String(+a.toFixed(2));
  const r = Number(a.toPrecision(1));
  return sign + r.toFixed(Math.max(0, Math.ceil(-Math.log10(r) - 1e-9)));
}
const w3 = (v: number) => String(+v.toFixed(3)).replace("-", "−");
const plus = (a: number, b: number) => `${tiny(a)} ${b < 0 ? "−" : "+"} ${tiny(Math.abs(b))}`;

function disc(ctx: Ctx, x: number, y: number, r: number, fill: string | null, stroke: string | null = null, lw = 2) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 01 · One number through one added layer, with and without the shortcut */
/* ------------------------------------------------------------------ */

export function OneLayerScene() {
  const [shortcut, setShortcut] = useState(false);
  const [w10, setW10] = useState(1);            // weight in tenths, so 0 and 1 are exact
  const [x, setX] = useState(X_IN);
  const wt = w10 / 10;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const body = bodyOut(wt, x), out = layerOut(wt, x, shortcut);
    const same = Math.abs(out - x) < 1e-9, erased = Math.abs(out) < 1e-9;

    // --- the layer: input, body, output, and the line around the body ---
    const colW = (w - 2 * PAD) / 3, cx = (i: number) => PAD + colW * (i + 0.5);
    const bw = Math.min(112, colW - 22), bh = 46, yBox = portrait ? 92 : 80, yMid = yBox + bh / 2, ySkip = yBox - 42;
    const branchX = (cx(0) + cx(1)) / 2, plusX = (cx(1) + cx(2)) / 2;
    const outColor = same ? KEEP : erased ? SIGNAL : CHANGE;

    label(ctx, U.one.input, cx(0), yBox - 13, palette.muted, 11, "center");
    label(ctx, shortcut ? (colW < 125 ? U.one.bodyShort : U.one.bodyF) : U.one.body, cx(1), yBox - 13, palette.muted, 11, "center");
    label(ctx, U.one.output, cx(2), yBox - 13, palette.muted, 11, "center");
    line(ctx, cx(0) + bw / 2, yMid, cx(1) - bw / 2 - 8, yMid, palette.muted, 1.5);
    arrow(ctx, cx(1) - bw / 2 - 10, yMid, cx(1) - bw / 2 - 2, yMid, palette.muted, 1.5);
    line(ctx, cx(1) + bw / 2, yMid, cx(2) - bw / 2 - 8, yMid, palette.muted, 1.5);
    arrow(ctx, cx(2) - bw / 2 - 10, yMid, cx(2) - bw / 2 - 2, yMid, palette.muted, 1.5);
    if (shortcut) {
      line(ctx, branchX, yMid, branchX, ySkip, KEEP, 2.5);
      line(ctx, branchX, ySkip, plusX, ySkip, KEEP, 2.5);
      arrow(ctx, plusX, ySkip, plusX, yMid - 10, KEEP, 2.5);
      disc(ctx, branchX, yMid, 3.5, KEEP);
      disc(ctx, plusX, yMid, 9, KEEP);
      label(ctx, "+", plusX, yMid + 0.5, "#ffffff", 14, "center");
      label(ctx, U.one.line, (branchX + plusX) / 2, ySkip - 12, KEEP, 11, "center");
    }
    rbox(ctx, cx(0) - bw / 2, yBox, bw, bh, 8, "#ffffff", VALUE, 1.5);
    label(ctx, tiny(x), cx(0), yMid, palette.ink, 18, "center");
    rbox(ctx, cx(1) - bw / 2, yBox, bw, bh, 8, `rgba(${palette.normalRgb},0.1)`, VALUE, 1.5);
    label(ctx, tiny(body), cx(1), yMid, palette.ink, 18, "center");
    label(ctx, `${tiny(wt)} × ${tiny(x)}`, cx(1), yBox + bh + 14, VALUE, 12, "center");
    rbox(ctx, cx(2) - bw / 2, yBox, bw, bh, 8, "#ffffff", outColor, 2);
    label(ctx, tiny(out), cx(2), yMid, palette.ink, 18, "center");
    label(ctx, shortcut ? plus(x, body) : U.one.asIs, cx(2), yBox + bh + 14, shortcut ? KEEP : palette.muted, shortcut ? 12 : 11, "center");
    label(ctx, same ? U.one.same : erased ? U.one.erased : U.one.differs, cx(2), yBox + bh + 32, outColor, 12, "center");

    // --- output against the weight: where does the line meet "output = input"? ---
    const px0 = PAD + 30, px1 = w - PAD - 6, py0 = yBox + bh + (portrait ? 100 : 76), py1 = h - 32;
    const wMin = -0.5, wMax = 1.5, oMin = -0.5 * x, oMax = 2.5 * x;
    const X = (wv: number) => px0 + ((px1 - px0) * (wv - wMin)) / (wMax - wMin);
    const Y = (o: number) => py1 - ((py1 - py0) * (o - oMin)) / (oMax - oMin);
    const pass = passWeight(shortcut);

    ctx.fillStyle = palette.track2; ctx.fillRect(X(-0.15), py0, X(0.15) - X(-0.15), py1 - py0);
    label(ctx, U.one.start, Math.max(PAD + 58, X(0)), py0 - 11, palette.muted, 11, "center");
    line(ctx, px0, py0, px0, py1, palette.frame, 1);
    line(ctx, px0, py1, px1, py1, palette.frame, 1);
    line(ctx, px0, Y(0), px1, Y(0), palette.frame, 1);
    label(ctx, "0", px0 - 6, Y(0), palette.muted, 11, "right");
    label(ctx, U.one.axisOut, px0 - 6, py0 + 6, palette.muted, 11, "right");
    line(ctx, px0, Y(x), px1, Y(x), KEEP, 1.5, [5, 4]);
    if (shortcut) label(ctx, `${U.one.equal} ${tiny(x)}`, px1, Y(x) + 12, KEEP, 11, "right");
    else label(ctx, `${U.one.equal} ${tiny(x)}`, X(0.55), Y(x) - 10, KEEP, 11, "center");
    [0, 1].forEach((tick) => {
      line(ctx, X(tick), py1, X(tick), py1 + 4, palette.muted, 1);
      label(ctx, `w = ${tick}`, X(tick), py1 + 15, tick === pass ? KEEP : palette.muted, 11, "center");
    });
    line(ctx, X(wMin), Y(layerOut(wMin, x, shortcut)), X(wMax), Y(layerOut(wMax, x, shortcut)), VALUE, 2.5);
    disc(ctx, X(pass), Y(x), 8, null, KEEP, 2.5);
    line(ctx, X(wt), py1, X(wt), Y(out), CHANGE, 1, [3, 3]);
    disc(ctx, X(wt), Y(out), 5, CHANGE);
    label(ctx, `w = ${tiny(wt)}, ${U.one.out} ${tiny(out)}`, px1, py0 - 11, CHANGE, 12, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.shortcut}>
          <span>{U.shortcut}</span>
          <button type="button" className={!shortcut ? "on" : ""} onClick={() => setShortcut(false)}>{U.off}</button>
          <button type="button" className={shortcut ? "on" : ""} onClick={() => setShortcut(true)}>{U.on}</button>
        </div>
        <label className="ad-ctl">
          <span>{U.one.weight} <b>{wt.toFixed(1)}</b></span>
          <input type="range" min={-5} max={15} step={1} value={w10} onChange={(e) => setW10(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.one.inputCtl}>
          <span>{U.one.inputCtl}</span>
          {[2, 5].map((v) => <button key={v} type="button" className={x === v ? "on" : ""} onClick={() => setX(v)}>{v}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · Eight layers: values go down, the error signal comes back up     */
/* ------------------------------------------------------------------ */

const PRESETS: Preset[] = ["near0", "zero", "one"];
const BAR_FULL = 4;

/** One table cell: the number, and a bar for its size (full at BAR_FULL). */
function valueCell(ctx: Ctx, x: number, y: number, cw: number, v: number, color: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  label(ctx, tiny(v), x, y - 6, palette.ink, cw < 90 ? 11 : 12);
  ctx.fillStyle = palette.track; ctx.fillRect(x, y + 5, cw - 12, 5);
  ctx.fillStyle = color; ctx.fillRect(x, y + 5, (cw - 12) * clamp(Math.abs(v) / BAR_FULL, 0, 1), 5);
  ctx.restore();
}

export function ChainScene() {
  const [step, setStep] = useState(0);
  const [shortcut, setShortcut] = useState(false);
  const [preset, setPreset] = useState<Preset>("near0");

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const ws = presetWeights(preset), c = chain(ws, X_IN, shortcut), n = ws.length;
    const portrait = isPortrait(w, h);
    const top = 40, bottom = h - 30, rh = (bottom - top) / (n + 1);
    const c0 = portrait ? 94 : Math.min(150, w * 0.27), colW = (w - 2 * PAD - c0) / 3, colX = (k: number) => PAD + c0 + k * colW;
    const rowY = (r: number) => top + rh * (r + 0.5);
    const tone = (k: number) => (step === k ? 1 : 0.62);

    // column headers appear with their step
    const hf = colW < 90 ? 11 : 12;
    label(ctx, U.chain.value, colX(0), 18, VALUE, hf);
    if (step >= 1) label(ctx, U.chain.signal, colX(1), 18, SIGNAL, hf);
    if (step >= 2) label(ctx, U.chain.update, colX(2), 18, CHANGE, hf);
    line(ctx, PAD, top - 6, w - PAD, top - 6, palette.frame, 1);

    // the shortcut: one line down the side that passes every layer body
    if (shortcut) {
      line(ctx, PAD - 8, rowY(0), PAD - 8, rowY(n), KEEP, 2.5);
      for (let r = 0; r <= n; r++) disc(ctx, PAD - 8, rowY(r), 3, KEEP);
    }

    for (let r = 0; r <= n; r++) {
      const y = rowY(r);
      if (r > 0) line(ctx, PAD, y - rh / 2, w - PAD, y - rh / 2, palette.grid, 1);
      if (r === 0) {
        label(ctx, U.chain.input, PAD, y, palette.ink, 12);
      } else {
        const wv = ws[r - 1];
        label(ctx, `${r}${U.chain.layer}${r === n ? ` · ${U.chain.output}` : ""}`, PAD, y - 7, palette.ink, 12);
        label(ctx, shortcut ? `× (1 ${wv < 0 ? "−" : "+"} ${tiny(Math.abs(wv))})` : `× ${tiny(wv)}`, PAD, y + 8, shortcut ? KEEP : palette.muted, 11);
      }
      valueCell(ctx, colX(0), y, colW, c.h[r], VALUE, tone(0));
      if (step >= 1 && r > 0) valueCell(ctx, colX(1), y, colW, c.d[r], SIGNAL, tone(1));
      if (step >= 2 && r > 0) valueCell(ctx, colX(2), y, colW, c.upd[r - 1], CHANGE, tone(2));
    }
    label(ctx, U.chain.foot[step], PAD, h - 14, step === 0 ? VALUE : step === 1 ? SIGNAL : CHANGE, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.chain.step}>
          <span>{U.chain.step}</span>
          {U.chain.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.shortcut}>
          <span>{U.shortcut}</span>
          <button type="button" className={!shortcut ? "on" : ""} onClick={() => setShortcut(false)}>{U.off}</button>
          <button type="button" className={shortcut ? "on" : ""} onClick={() => setShortcut(true)}>{U.on}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.chain.weights}>
          <span>{U.chain.weights}</span>
          {PRESETS.map((p, i) => <button key={p} type="button" className={preset === p ? "on" : ""} onClick={() => setPreset(p)}>{U.chain.presets[i]}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · The same stacks trained by gradient descent                     */
/* ------------------------------------------------------------------ */

const KINDS: NetKind[] = ["plain2", "plain8", "res8"];
const GOALS = [1.5, 1];
const KIND_COLOR: Record<NetKind, string> = { plain2: palette.accent2, plain8: SIGNAL, res8: KEEP };
const RUNS: Record<string, TrainSnap[]> = {};
for (const mul of GOALS) for (const kind of KINDS) RUNS[`${kind}:${mul}`] = trainChain(kind, mul);
const W_LO = -0.3, W_HI = 1.4;

export function TrainScene() {
  const [kind, setKind] = useState<NetKind>("plain8");
  const [mul, setMul] = useState(1.5);
  const [step, setStep] = useState(0);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const run = RUNS[`${kind}:${mul}`], snap = run[step], start = run[0], depth = netDepth(kind), color = KIND_COLOR[kind];

    // --- the weights of the chosen net, now and where they started ---
    const wy0 = 36, wy1 = portrait ? 166 : 134, slot = (w - 2 * PAD) / 8;
    // on a narrow canvas "−0.039" is as wide as a slot, so neighbouring values go on two staggered lines
    const stagger = slot < 48;
    const WY = (v: number) => wy1 - ((wy1 - wy0) * (clamp(v, W_LO, W_HI) - W_LO)) / (W_HI - W_LO);
    label(ctx, U.train.weights, PAD, 16, palette.muted, 11);
    line(ctx, PAD, WY(0), w - PAD, WY(0), palette.muted, 1);
    for (let i = 0; i < depth; i++) {
      const cx = PAD + slot * (i + 0.5), bwid = Math.min(22, slot * 0.5), v = snap.w[i];
      ctx.fillStyle = color;
      ctx.fillRect(cx - bwid / 2, Math.min(WY(v), WY(0)), bwid, Math.max(1.5, Math.abs(WY(v) - WY(0))));
      line(ctx, cx - bwid / 2 - 5, WY(start.w[i]), cx + bwid / 2 + 5, WY(start.w[i]), palette.muted, 2);
      label(ctx, w3(v), cx, wy1 + 12 + (stagger && i % 2 ? 13 : 0), palette.ink, 11, "center");
      label(ctx, `${i + 1}${U.train.layer}`, cx, wy1 + (stagger ? 40 : 27), palette.muted, 11, "center");
    }

    // --- what goes in, what comes out, what it should have been ---
    const ym = wy1 + (stagger ? 64 : 54), target = mul * X_IN;
    const lossText = snap.loss < 0.0005 ? "0" : tiny(snap.loss);
    if (portrait) {
      label(ctx, `${U.train.input} ${tiny(X_IN)}`, PAD, ym, palette.ink, 13);
      label(ctx, `${U.train.output} ${tiny(snap.out)}`, w / 2, ym, CHANGE, 13, "center");
      label(ctx, `${U.train.target} ${tiny(target)}`, w - PAD, ym, KEEP, 13, "right");
      label(ctx, `${U.train.loss} ${lossText}`, PAD, ym + 22, SIGNAL, 13);
    } else {
      const q = (w - 2 * PAD) / 4;
      label(ctx, `${U.train.input} ${tiny(X_IN)}`, PAD, ym, palette.ink, 13);
      label(ctx, `${U.train.output} ${tiny(snap.out)}`, PAD + q * 0.9, ym, CHANGE, 13);
      label(ctx, `${U.train.target} ${tiny(target)}`, PAD + q * 2.35, ym, KEEP, 13);
      label(ctx, `${U.train.loss} ${lossText}`, w - PAD, ym, SIGNAL, 13, "right");
    }

    // --- the loss of all three nets over the steps ---
    const px0 = PAD + 26, px1 = w - PAD - 6, py0 = ym + (portrait ? 68 : 46), py1 = h - 28, top = mul === 1.5 ? 5 : 2.5;
    const PX = (s: number) => px0 + ((px1 - px0) * s) / TRAIN_STEPS, PY = (l: number) => py1 - ((py1 - py0) * Math.min(l, top)) / top;
    let lx = PAD;
    KINDS.forEach((k, i) => {
      ctx.fillStyle = KIND_COLOR[k]; ctx.fillRect(lx, py0 - 22, 12, k === kind ? 4 : 2);
      label(ctx, U.train.nets[i], lx + 16, py0 - 20, k === kind ? palette.ink : palette.muted, 11);
      lx += (w - 2 * PAD) / 3;
    });
    line(ctx, px0, py0, px0, py1, palette.frame, 1);
    line(ctx, px0, py1, px1, py1, palette.frame, 1);
    label(ctx, String(top), px0 - 6, py0, palette.muted, 11, "right");
    label(ctx, "0", px0 - 6, py1, palette.muted, 11, "right");
    label(ctx, U.train.lossAxis, px0 + 6, py0 + 2, palette.muted, 11);
    [0, TRAIN_STEPS / 2, TRAIN_STEPS].forEach((s) => label(ctx, String(s), PX(s), py1 + 13, palette.muted, 11, s === 0 ? "left" : s === TRAIN_STEPS ? "right" : "center"));
    label(ctx, U.train.stepAxis, (PX(TRAIN_STEPS / 2) + PX(TRAIN_STEPS)) / 2, py1 + 13, palette.muted, 11, "center");
    KINDS.forEach((k) => {
      const hist = RUNS[`${k}:${mul}`];
      ctx.save();
      ctx.globalAlpha = k === kind ? 1 : 0.4;
      ctx.strokeStyle = KIND_COLOR[k]; ctx.lineWidth = k === kind ? 3 : 1.5; ctx.lineJoin = "round";
      ctx.beginPath();
      hist.forEach((s, i) => (i === 0 ? ctx.moveTo(PX(i), PY(s.loss)) : ctx.lineTo(PX(i), PY(s.loss))));
      ctx.stroke();
      ctx.restore();
    });
    line(ctx, PX(step), py0, PX(step), py1, palette.muted, 1, [3, 3]);
    disc(ctx, PX(step), PY(snap.loss), 5, color);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.train.net}>
          <span>{U.train.net}</span>
          {KINDS.map((k, i) => <button key={k} type="button" className={kind === k ? "on" : ""} onClick={() => setKind(k)}>{U.train.nets[i]}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.train.goal}>
          <span>{U.train.goal}</span>
          {GOALS.map((g, i) => <button key={g} type="button" className={mul === g ? "on" : ""} onClick={() => setMul(g)}>{U.train.goals[i]}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{U.train.step} <b>{step}</b></span>
          <input type="range" min={0} max={TRAIN_STEPS} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · One position through one bottleneck block: wide trunk, narrow body */
/* ------------------------------------------------------------------ */

const sameVec = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-9);

export function TrunkScene() {
  const [step, setStep] = useState(0);
  const [wide, setWide] = useState(true);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const A = blockWalk(TRUNK_A, wide), B = blockWalk(TRUNK_B, wide);
    const names = wide ? U.trunk.wideRows : U.trunk.narrowRows;
    // each row: the two inputs side by side, and the first step at which the row is shown
    const rows: { a: number[]; b: number[]; from: number }[] = [
      { a: A.trunk, b: B.trunk, from: 0 },
      { a: [A.r], b: [B.r], from: 0 },
      { a: [A.m], b: [B.m], from: 1 },
      { a: A.F, b: B.F, from: 1 },
      { a: A.y, b: B.y, from: 2 },
      { a: [A.next], b: [B.next], from: 3 },
    ];
    const top = 34, rh = (h - top - 6) / rows.length, gap = 14, colW = (w - 2 * PAD - gap) / 2;
    const colX = (k: number) => PAD + k * (colW + gap);
    const cs = Math.min(44, (colW - 18 - 9) / 4), ch = Math.min(28, rh - 30), span = 4 * cs + 9;
    const cellY = (r: number) => top + r * rh + 22;

    label(ctx, U.trunk.colA, colX(0) + 18, 16, palette.ink, 12);
    label(ctx, U.trunk.colB, colX(1) + 18, 16, palette.ink, 12);

    rows.forEach((row, r) => {
      if (row.from > step) return;
      const used = (step === 2 && (r === 0 || r === 3)) || (step === 3 && r === 4);
      const fresh = row.from === step || used, same = sameVec(row.a, row.b), y = cellY(r);
      ctx.save();
      ctx.globalAlpha = fresh ? 1 : 0.7;
      label(ctx, names[r], PAD, y - 12, fresh ? palette.ink : palette.muted, 11);
      label(ctx, same ? U.trunk.same : U.trunk.differs, w - PAD, y - 12, same ? KEEP : SIGNAL, 12, "right");
      [row.a, row.b].forEach((vals, k) => {
        const other = k === 0 ? row.b : row.a, n = vals.length;
        const x0 = colX(k) + 18 + (span - (n * cs + (n - 1) * 3)) / 2;
        vals.forEach((v, i) => {
          const differs = Math.abs(v - other[i]) > 1e-9;
          rbox(ctx, x0 + i * (cs + 3), y, cs, ch, 5, signed(v, 3.4), differs ? SIGNAL : palette.frame, differs ? 2 : 1);
          label(ctx, tiny(v), x0 + i * (cs + 3) + cs / 2, y + ch / 2 + 0.5, palette.ink, 12, "center");
        });
      });
      ctx.restore();
    });

    // the shortcut carries the trunk row past the body down to the addition: one line in the left margin, clear of the labels
    if (step >= 2) {
      const n = rows[0].a.length, edge = colX(0) + 18 + (span - (n * cs + (n - 1) * 3)) / 2 - 3;
      const lx = PAD - 8, y0 = cellY(0) + ch / 2, y1 = cellY(4) + ch / 2;
      line(ctx, edge, y0, lx, y0, KEEP, 2.5);
      line(ctx, lx, y0, lx, y1, KEEP, 2.5);
      arrow(ctx, lx, y1, edge, y1, KEEP, 2.5);
      disc(ctx, lx, y0, 3.5, KEEP);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.trunk.step}>
          <span>{U.trunk.step}</span>
          {U.trunk.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.trunk.width}>
          <span>{U.trunk.width}</span>
          <button type="button" className={wide ? "on" : ""} onClick={() => setWide(true)}>{U.trunk.wide}</button>
          <button type="button" className={!wide ? "on" : ""} onClick={() => setWide(false)}>{U.trunk.narrow}</button>
        </div>
      </div>
    </div>
  );
}
