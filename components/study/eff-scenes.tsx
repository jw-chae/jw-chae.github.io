"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, frame, line } from "./kit";
import { effCopy } from "./eff-copy";
import { BW_STEPS, DEVICE, L1, L1_COST, L4, SEP_BW, SEP_FUSED, VARIANTS, cost, ridge, sepCompare, withBw } from "./eff-math";
import { COMP, DIFF, MOVE, PAD, SAME, guide, hbar, int, isPortrait, logMap, ratio, stack, tag, tint, us } from "./eff-draw";

const U = effCopy.ui;

/* ------------------------------------------------------------------ */
/* 01 · One conv layer: parameters, then multiply-adds                  */
/* ------------------------------------------------------------------ */

const DIMS = [{ H: 56, C: 64, k: 3 }, { H: 28, C: 64, k: 3 }, { H: 56, C: 128, k: 3 }, { H: 56, C: 64, k: 1 }];

/** A ratio against the original layer on a log2 axis that runs from 1/16 to 4, drawn from the "×1" mark. */
function ratioBar(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, r: number, color: string) {
  const lo = 1 / 16, hi = 4, at = (v: number) => logMap(v, lo, hi, x0, x1), one = at(1);
  ctx.fillStyle = palette.track; ctx.fillRect(x0, y, x1 - x0, 12);
  for (let e = -4; e <= 2; e++) line(ctx, at(2 ** e), y - 3, at(2 ** e), y + 15, palette.frame, 1);
  const xr = at(r);
  ctx.fillStyle = color;
  ctx.fillRect(Math.min(one, xr), y, Math.max(3, Math.abs(xr - one)), 12);
  line(ctx, one, y - 6, one, y + 18, palette.ink, 1.5);
}

const fracText = (r: number) => (Math.abs(r - 1) < 1e-9 ? U.count.same : r > 1 ? `×${ratio(r)}` : `×1/${ratio(1 / r)}`);

export function CountScene() {
  const [step, setStep] = useState(0);
  const [vi, setVi] = useState(0);
  const T = U.count;
  const d = DIMS[vi], v = VARIANTS[vi], base = VARIANTS[0];
  const perKernel = d.k * d.k * d.C, outs = d.H * d.H * d.C;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), u = Math.min(1, (w - 2 * PAD) / 440), g = port ? (h - 440) / 3 : 0, fs = w < 420 ? 12 : 13;
    const colW = (w - 2 * PAD) / 3, yS = 78 + g * 0.6;
    const sideFull = 112 * u, side = sideFull * (d.H / 56), depth = 15 * u * (d.C / 64);
    const ksz = 9 * u * d.k + 8, kdep = depth;

    // the three objects stay in place; only their size follows the chosen variant
    const xIn = PAD + 4, xK = PAD + colW + (colW - ksz) / 2 - 6, xOut = PAD + 2 * colW + 4;
    const yMid = yS + (sideFull - side) / 2;
    label(ctx, `${T.input} ${d.H}×${d.H}×${d.C}`, xIn, 22, palette.ink, 12);
    label(ctx, `${T.kernel} ${d.k}×${d.k}×${d.C}`, PAD + colW + colW / 2, 22, step === 0 ? MOVE : palette.ink, 12, "center");
    label(ctx, `× ${d.C}${T.count}`, PAD + colW + colW / 2, 40, step === 0 ? MOVE : palette.muted, 12, "center");
    label(ctx, `${T.output} ${d.H}×${d.H}×${d.C}`, w - PAD, 22, palette.ink, 12, "right");

    const sIn = stack(ctx, xIn, yMid, side, depth, palette.normal, palette.normalRgb);
    stack(ctx, xK, yS + (sideFull - ksz) / 2, ksz, kdep, step === 0 ? MOVE : palette.muted, step === 0 ? palette.accentRgb : palette.inkRgb);
    stack(ctx, xOut, yMid, side, depth, step === 2 ? MOVE : palette.normal, step === 2 ? palette.accentRgb : palette.normalRgb);

    if (step === 1) {
      // one output number reads a k×k window through all input channels
      const cellIn = Math.max(7, (side * d.k) / d.H), cellOut = Math.max(6, side / d.H);
      const wx = xIn + side * 0.42, wy = yMid + side * 0.38, ox = xOut + side * 0.42, oy = yMid + side * 0.38;
      ctx.fillStyle = tint(palette.accentRgb, 0.35);
      ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + sIn.dx, wy - sIn.dy); ctx.lineTo(wx + sIn.dx + cellIn, wy - sIn.dy); ctx.lineTo(wx + cellIn, wy); ctx.closePath(); ctx.fill();
      frame(ctx, wx, wy, cellIn, cellIn, MOVE, 2);
      ctx.fillStyle = MOVE; ctx.fillRect(ox, oy, cellOut, cellOut);
      frame(ctx, ox - 1, oy - 1, cellOut + 2, cellOut + 2, palette.ink, 1.5);
      arrow(ctx, wx + cellIn + 6, wy + cellIn / 2, xK - 6, yS + sideFull / 2, MOVE, 1.5);
      arrow(ctx, xK + ksz + kdep * 0.62 + 4, yS + sideFull / 2, ox - 5, oy + cellOut / 2, MOVE, 1.5);
      label(ctx, T.window, xIn, yMid + side + 18, MOVE, 11);
    }
    if (step === 2) label(ctx, `${int(outs)}`, xOut + side / 2, yMid + side / 2, palette.ink, 12, "center");

    // what this step counts
    const yT = yS + sideFull + 40 + g, lh = 24;
    const lines: [string, string][] = step === 0
      ? [[`${T.each}: ${d.k}×${d.k}×${d.C} = ${int(perKernel)}${T.count}`, palette.ink], [`${int(perKernel)} × ${d.C} = ${int(v.weights)}${T.count}`, MOVE]]
      : step === 1
        ? [[`${T.perOut}: ${T.macs} ${int(perKernel)}`, palette.ink], [`${T.input} ${int(perKernel)} × ${T.kernel} ${int(perKernel)}, ${T.pairs}`, palette.muted]]
        : [[`${T.outs} ${d.H}×${d.H}×${d.C} = ${int(outs)}`, palette.ink], [`${int(perKernel)} × ${int(outs)} = ${int(v.macs)}`, MOVE]];
    lines.forEach(([s, c], i) => label(ctx, s, PAD, yT + i * lh, c, fs));

    // the two counts against the original layer
    const yB = Math.min(h - 74, yT + 116 + g), bx0 = PAD, bx1 = w - PAD;
    const rows: [string, number, number, boolean][] = [
      [T.params, v.weights, v.weights / base.weights, true],
      [T.macs, v.macs, v.macs / base.macs, step === 2],
    ];
    rows.forEach(([name, val, r, shown], i) => {
      const y = yB + i * 38;
      label(ctx, shown ? `${name} ${int(val)}` : `${name} ?`, bx0, y - 9, shown ? palette.ink : palette.muted, 12);
      if (shown) label(ctx, fracText(r), bx1, y - 9, r === 1 ? SAME : palette.ink, 12, "right");
      if (shown) ratioBar(ctx, bx0, bx1, y, r, i === 0 ? MOVE : COMP);
      else { ctx.fillStyle = palette.track; ctx.fillRect(bx0, y, bx1 - bx0, 12); }
    });
    const tickAt = (v: number) => logMap(v, 1 / 16, 4, bx0, bx1);
    label(ctx, "1/16", tickAt(1 / 16), yB + 38 + 26, palette.muted, 11, "left");
    label(ctx, "1/4", tickAt(1 / 4), yB + 38 + 26, palette.muted, 11, "center");
    label(ctx, T.base, tickAt(1), yB + 38 + 26, palette.muted, 11, "center");
    label(ctx, "4", tickAt(4), yB + 38 + 26, palette.muted, 11, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.step}>
          <span>{T.step}</span>
          {T.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.vary}>
          <span>{T.vary}</span>
          {T.variants.map((name, i) => <button key={name} type="button" className={vi === i ? "on" : ""} onClick={() => setVi(i)}>{name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · Bytes moved and time on the hand-set device                     */
/* ------------------------------------------------------------------ */

const T_AXIS = 100;   // µs: the time axis stays put while the bandwidth changes

export function BytesScene() {
  const [bi, setBi] = useState(BW_STEPS.indexOf(40));
  const T = U.bytes;
  const gbs = BW_STEPS[bi], dev = withBw(gbs), c = cost(L1, 1, dev), rd = ridge(dev);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), g = port ? (h - 440) / 4 : 0, x0 = PAD, x1 = w - PAD, bw = x1 - x0, fs = w < 420 ? 12 : 13;
    label(ctx, `${T.device}, ${T.bw} ${gbs}GB/s`, PAD, 20, palette.muted, 11);

    // 1. bytes moved, split into the three pieces
    const yB = 52 + g * 0.5;
    label(ctx, `${T.moved} ${int(c.bytes)}`, x0, yB, palette.ink, fs);
    const parts: [string, number, number][] = [[T.weights, L1.weights * 2, 0.95], [T.input, L1.read * 2, 0.55], [T.output, L1.write * 2, 0.32]];
    let xx = x0;
    parts.forEach(([, b, a]) => { const ww = (bw * b) / c.bytes; ctx.fillStyle = tint(palette.accentRgb, a); ctx.fillRect(xx, yB + 14, ww - 1, 18); xx += ww; });
    const legW = bw / 3;
    parts.forEach(([name, b, a], i) => {
      ctx.fillStyle = tint(palette.accentRgb, a); ctx.fillRect(x0 + i * legW, yB + 44, 10, 10);
      label(ctx, `${name} ${int(b)}`, x0 + i * legW + 15, yB + 49, palette.ink, 11);
    });

    // 2. compute time against moving time on a fixed axis
    const yT = yB + 96 + g, at = (t: number) => x0 + (bw * Math.min(t, T_AXIS)) / T_AXIS;
    for (let t = 0; t <= T_AXIS; t += 25) { line(ctx, at(t), yT - 6, at(t), yT + 74, palette.grid, 1); label(ctx, `${t}`, at(t), yT + 86, palette.muted, 11, t === 0 ? "left" : t === T_AXIS ? "right" : "center"); }
    label(ctx, "µs", x1, yT + 100, palette.muted, 11, "right");
    const bars: [string, number, string, boolean][] = [[T.compute, c.compute, COMP, c.bound === "compute"], [T.memory, c.memory, MOVE, c.bound === "memory"]];
    bars.forEach(([name, t, col, strong], i) => {
      const y = yT + i * 38;
      label(ctx, `${name} ${us(t)}`, x0, y + 2, strong ? palette.ink : palette.muted, 12);
      hbar(ctx, x0, y + 12, bw, 14, Math.min(t, T_AXIS) / T_AXIS, col, strong);
    });
    guide(ctx, at(c.time), yT - 10, at(c.time), yT + 78, palette.ink);

    // 3. the verdict, and the same verdict read off intensity versus P/B
    const yV = yT + 124 + g * 0.6;
    label(ctx, `${T.time} ${us(c.time)}`, x0, yV, palette.ink, fs + 1);
    label(ctx, c.bound === "compute" ? T.computeBound : T.memoryBound, x1, yV, c.bound === "compute" ? COMP : MOVE, 12, "right");
    if (c.bound === "memory") label(ctx, `${T.wait} ${Math.round((1 - c.compute / c.time) * 100)}%`, x1, yV + 20, palette.muted, 11, "right");

    const yI = yV + 58 + g * 0.6, lo = 10, hi = 1000, ix = (v: number) => logMap(v, lo, hi, x0, x1);
    ctx.fillStyle = tint(palette.accentRgb, 0.12); ctx.fillRect(x0, yI - 7, ix(rd) - x0, 14);
    ctx.fillStyle = tint(palette.normalRgb, 0.12); ctx.fillRect(ix(rd), yI - 7, x1 - ix(rd), 14);
    [10, 100, 1000].forEach((t) => label(ctx, `${t}`, ix(t), yI + 22, palette.muted, 11, t === 10 ? "left" : t === 1000 ? "right" : "center"));
    line(ctx, ix(rd), yI - 12, ix(rd), yI + 12, palette.ink, 2);
    label(ctx, `${T.ridge} ${int(rd)}`, ix(rd), yI - 20, palette.ink, 11, ix(rd) > w * 0.6 ? "right" : "left");
    ctx.fillStyle = COMP; ctx.beginPath(); ctx.arc(ix(c.intensity), yI, 6, 0, Math.PI * 2); ctx.fill();
    label(ctx, `${T.intensity} ${c.intensity.toFixed(1)}`, ix(c.intensity), yI + 40, COMP, 11, ix(c.intensity) > w * 0.6 ? "right" : "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{T.bw} <b>{gbs}GB/s</b></span>
          <input type="range" min={0} max={BW_STEPS.length - 1} step={1} value={bi} onChange={(e) => setBi(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Depthwise + pointwise: fewer multiply-adds, nearly the same bytes */
/* ------------------------------------------------------------------ */

export function SeparableScene() {
  const [li, setLi] = useState(1);
  const [bi, setBi] = useState(1);
  const T = U.sep;
  const gbs = SEP_BW[bi], dev = withBw(gbs), r = sepCompare(gbs);
  const pick = li === 0 ? r.std : li === 1 ? r.fused : r.split;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), g = port ? (h - 440) / 3 : 0, x0 = PAD, x1 = w - PAD;

    // ratios against the plain 3×3 at the same bandwidth
    const nameW = w < 420 ? 96 : 112, bx0 = x0 + nameW, bx1 = x1 - 44, at = (v: number) => bx0 + ((bx1 - bx0) * Math.min(v, 2)) / 2;
    const macR = (li === 0 ? L1.macs : SEP_FUSED.macs) / L1.macs;
    const rows: [string, number, string][] = [[T.macs, macR, COMP], [T.bytes, pick.bytes / r.std.bytes, MOVE], [T.time, pick.time / r.std.time, palette.ink]];
    const y0 = 30;
    rows.forEach(([name, v, col], i) => {
      const y = y0 + i * 30;
      label(ctx, name, x0, y + 6, palette.ink, 12);
      ctx.fillStyle = palette.track; ctx.fillRect(bx0, y, bx1 - bx0, 12);
      ctx.fillStyle = col; ctx.fillRect(bx0, y, Math.max(2, at(v) - bx0), 12);
      label(ctx, ratio(v), x1, y + 6, palette.ink, 12, "right");
    });
    line(ctx, at(1), y0 - 8, at(1), y0 + 80, palette.ink, 1.5);
    label(ctx, T.base, at(1), y0 + 92, palette.muted, 11, "center");

    // roofline: log-log, flat roof at P, slope at B
    const px0 = x0 + 30, px1 = x1 - 6, py0 = y0 + 128 + g, py1 = h - 56;
    const xl = 1, xh = 1000, yl = 0.05, yh = 8;
    const X = (v: number) => logMap(v, xl, xh, px0, px1), Y = (v: number) => logMap(v, yl, yh, py1, py0);
    frame(ctx, px0, py0, px1 - px0, py1 - py0, palette.frame, 1);
    [1, 10, 100, 1000].forEach((t) => { line(ctx, X(t), py0, X(t), py1, palette.grid, 1); label(ctx, `${t}`, X(t), py1 + 12, palette.muted, 11, t === 1 ? "left" : t === 1000 ? "right" : "center"); });
    [0.1, 1].forEach((t) => { line(ctx, px0, Y(t), px1, Y(t), palette.grid, 1); label(ctx, `${t}`, px0 - 4, Y(t), palette.muted, 11, "right"); });
    label(ctx, T.axisX, px1, py1 + 28, palette.muted, 11, "right");
    label(ctx, `${T.roof} T/s`, px0 + 4, py0 - 10, palette.muted, 11);
    const P = DEVICE.peak / 1e12, Bt = dev.bw / 1e12, rdg = P / Bt;
    // the slope from the left edge up to the ridge, then the flat roof
    ctx.save(); ctx.strokeStyle = palette.ink; ctx.lineWidth = 2; ctx.beginPath();
    ctx.moveTo(X(xl), Y(Math.max(yl, Bt * xl))); ctx.lineTo(X(rdg), Y(P)); ctx.lineTo(X(xh), Y(P)); ctx.stroke(); ctx.restore();
    label(ctx, T.peak, X(xh) - 4, Y(P) - 10, palette.ink, 11, "right");
    const sl = Math.max(xl * 1.6, rdg / 12);
    label(ctx, `${gbs}GB/s`, X(sl) + 10, Y(Bt * sl) + 14, MOVE, 11, "left");

    const dot = (I: number, perf: number, col: string, text: string, faint = false, below = false) => {
      ctx.save(); ctx.globalAlpha = faint ? 0.35 : 1;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(I), Y(perf), faint ? 5 : 6.5, 0, Math.PI * 2); ctx.fill();
      label(ctx, text, X(I) + (below ? 0 : 10), Y(perf) + (below ? 18 : 12), col, 11, below ? (X(I) > px1 - 60 ? "right" : "center") : "left");
      ctx.restore();
    };
    const std = r.std.parts[0];
    dot(std.intensity, Math.min(P, Bt * std.intensity), COMP, T.std, li !== 0, true);
    if (li === 1) { const f = r.fused.parts[0]; dot(f.intensity, Math.min(P, Bt * f.intensity), MOVE, T.fused); }
    if (li === 2) r.split.parts.forEach((p, i) => dot(p.intensity, Math.min(P, Bt * p.intensity), MOVE, i === 0 ? T.dw : T.pw));

    // the time this choice takes
    const yt = py1 + 46;
    const parts = pick.parts;
    const tx = parts.length === 1 ? `${T.formula}: ${us(parts[0].time)} = max(${parts[0].compute.toFixed(1)}, ${parts[0].memory.toFixed(1)})` : `${T.time} ${us(pick.time)} = ${parts.map((p) => us(p.time)).join(" + ")}`;
    label(ctx, tx, x0, Math.min(yt, h - 12), palette.ink, w < 420 ? 11 : 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.layer}>
          <span>{T.layer}</span>
          {T.layers.map((name, i) => <button key={name} type="button" className={li === i ? "on" : ""} onClick={() => setLi(i)}>{name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.bw}>
          <span>{T.bw}</span>
          {SEP_BW.map((b, i) => <button key={b} type="button" className={bi === i ? "on" : ""} onClick={() => setBi(i)}>{b}GB/s</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · Same multiply-adds: layer1's 3×3 against layer4's 3×3            */
/* ------------------------------------------------------------------ */

const C1 = L1_COST, C4 = cost(L4);

export function TwinScene() {
  const [step, setStep] = useState(0);
  const T = U.twin;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), g = port ? (h - 440) / 5 : 0, u = Math.min(1, (w - 2 * PAD) / 520), fs = w < 420 ? 12 : 13;
    const colW = (w - 2 * PAD) / 2, cx = [PAD + colW * 0.5, PAD + colW * 1.5];
    label(ctx, T.left, cx[0], 18, palette.ink, 12, "center");
    label(ctx, T.right, cx[1], 18, palette.ink, 12, "center");
    label(ctx, T.leftShape, cx[0], 36, palette.muted, 11, "center");
    label(ctx, T.rightShape, cx[1], 36, palette.muted, 11, "center");

    // the two boxes: front face = map size, depth = channels, both to the same scale
    const unit = 1.7 * u, yBox = 60 + 92 * u;
    const s1 = 56 * unit, d1 = 64 * unit * 0.19, s4 = 7 * unit, d4 = 512 * unit * 0.19;
    stack(ctx, cx[0] - (s1 + d1 * 0.62) / 2, yBox - s1 / 2 + d1 * 0.23, s1, d1, palette.normal, palette.normalRgb);
    stack(ctx, cx[1] - (s4 + d4 * 0.62) / 2, yBox - s4 / 2 + d4 * 0.23, s4, d4, palette.normal, palette.normalRgb);

    // rows revealed one per step
    const rowsY = yBox + 70 + g, rh = 44 + g * 0.5;
    const rows: { name: string; a: string; b: string; same: boolean; note: string }[] = [
      { name: T.macs, a: int(L1.macs), b: int(L4.macs), same: true, note: T.same },
      { name: T.params, a: int(L1.weights), b: int(L4.weights), same: false, note: `${ratio(L4.weights / L1.weights)}${T.times}` },
      { name: T.acts, a: int(C1.aBytes), b: int(C4.aBytes), same: false, note: `${ratio(C1.aBytes / C4.aBytes)}${T.fraction}` },
      { name: T.time, a: us(C1.time), b: us(C4.time), same: false, note: `${ratio(C4.time / C1.time)}${T.times}` },
    ];
    rows.forEach((r, i) => {
      if (i > step) return;
      const y = rowsY + i * rh;
      ctx.save(); ctx.globalAlpha = i === step ? 1 : 0.75;
      label(ctx, r.name, PAD, y, palette.muted, 11);
      tag(ctx, r.note, w - PAD, y, r.same ? SAME : DIFF, true);
      label(ctx, r.a, cx[0], y + 20, palette.ink, fs, "center");
      label(ctx, r.b, cx[1], y + 20, palette.ink, fs, "center");
      ctx.restore();
    });

    // the time row also shows what each time is made of
    if (step === 3) {
      const yb = rowsY + 3 * rh + 38, bw = colW - 28, tmax = 130;
      [C1, C4].forEach((c, k) => {
        const xb = PAD + k * colW + 10;
        hbar(ctx, xb, yb, bw, 8, c.compute / tmax, COMP, c.bound === "compute");
        hbar(ctx, xb, yb + 14, bw, 8, c.memory / tmax, MOVE, c.bound === "memory");
        label(ctx, `${T.compute} ${c.compute.toFixed(1)}`, xb, yb + 34, COMP, 11);
        label(ctx, `${T.memory} ${c.memory.toFixed(1)}`, xb + bw, yb + 34, MOVE, 11, "right");
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
      </div>
    </div>
  );
}

