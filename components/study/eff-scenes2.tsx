"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, frame, line, rbox } from "./kit";
import { effCopy } from "./eff-copy";
import { ADD, BATCHES, L1, L4, REPVIT_TABLE, REP_SAME_MACS, REP_TIE, SEP_FUSED, YOLO_PAIRS, batchRow, seqCost, yoloRow, type RepRow, type Step } from "./eff-math";
import { COMP, DIFF, MOVE, PAD, guide, hbar, int, isPortrait, logMap, mb, tint, us } from "./eff-draw";

const U = effCopy.ui;

/* ------------------------------------------------------------------ */
/* 05 · Batch size: latency against throughput                          */
/* ------------------------------------------------------------------ */

const LAYERS: Step[] = [L1, L4];
const ROWS = LAYERS.map((s) => BATCHES.map((n) => batchRow(s, n)));
const HELD_MAX = 13e6;

export function BatchScene() {
  const [li, setLi] = useState(1);
  const [ni, setNi] = useState(0);
  const T = U.batch;
  const cur = ROWS[li][ni];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), g = port ? (h - 440) / 4 : 0, x0 = PAD + 44, x1 = w - PAD - 8;
    const X = (i: number) => x0 + ((x1 - x0) * i) / (BATCHES.length - 1);

    /** One small line chart: both layers, the chosen one dark, the chosen batch marked. */
    const chart = (top: number, ht: number, ymax: number, val: (r: (typeof ROWS)[number][number]) => number, title: string, ticks: number[], fmtTick: (v: number) => string) => {
      const Y = (v: number) => top + ht - (ht * v) / ymax;
      label(ctx, title, PAD, top - 20, palette.ink, 12);
      ticks.forEach((t) => { line(ctx, x0, Y(t), x1, Y(t), palette.grid, 1); label(ctx, fmtTick(t), x0 - 6, Y(t), palette.muted, 11, "right"); });
      frame(ctx, x0, top, x1 - x0, ht, palette.frame, 1);
      [1 - li, li].forEach((k) => {
        const on = k === li, rows = ROWS[k];
        ctx.save(); ctx.strokeStyle = on ? palette.ink : palette.muted; ctx.globalAlpha = on ? 1 : 0.45; ctx.lineWidth = on ? 2 : 1.5;
        ctx.beginPath(); rows.forEach((r, i) => (i === 0 ? ctx.moveTo(X(i), Y(val(r))) : ctx.lineTo(X(i), Y(val(r))))); ctx.stroke();
        rows.forEach((r, i) => { ctx.fillStyle = r.bound === "compute" ? COMP : MOVE; ctx.beginPath(); ctx.arc(X(i), Y(val(r)), on && i === ni ? 6 : 3.5, 0, Math.PI * 2); ctx.fill(); });
        ctx.restore();
      });
      return Y;
    };

    const ht = Math.max(84, (h - 214) / 2 - g * 0.4), top1 = 46, top2 = top1 + ht + 48;
    const Y1 = chart(top1, ht, 20000, (r) => r.perSec, T.thr, [0, 10000, 20000], (v) => (v === 0 ? "0" : `${v / 1000}k`));
    guide(ctx, x0, Y1(17300), x1, Y1(17300), palette.ink);
    label(ctx, T.ceiling, x1 - 4, Y1(17300) + 14, palette.muted, 11, "right");
    label(ctx, int(cur.perSec), X(ni) + (ni === BATCHES.length - 1 ? -10 : 10), Y1(cur.perSec) - 12, palette.ink, 12, ni === BATCHES.length - 1 ? "right" : "left");
    const Y2 = chart(top2, ht, 1000, (r) => r.time, `${T.lat} µs`, [0, 500, 1000], (v) => `${v}`);
    label(ctx, us(cur.time), X(ni) + (ni >= 3 ? -10 : 10), Y2(cur.time) - 12, palette.ink, 12, ni >= 3 ? "right" : "left");
    BATCHES.forEach((n, i) => label(ctx, `${n}`, X(i), top2 + ht + 14, i === ni ? palette.ink : palette.muted, 11, "center"));

    // what this layer holds at this batch
    const yH = top2 + ht + 54 + g * 0.6, bw = x1 - PAD, fw = (bw * cur.wBytes) / HELD_MAX, fa = (bw * cur.aBytes) / HELD_MAX;
    label(ctx, `${T.held} ${mb(cur.held)}`, PAD, yH, palette.ink, 12);
    label(ctx, cur.bound === "compute" ? T.computeBound : T.memoryBound, w - PAD, yH, cur.bound === "compute" ? COMP : MOVE, 12, "right");
    ctx.fillStyle = palette.track; ctx.fillRect(PAD, yH + 12, bw, 14);
    ctx.fillStyle = tint(palette.accentRgb, 0.95); ctx.fillRect(PAD, yH + 12, Math.max(2, fw), 14);
    ctx.fillStyle = tint(palette.accentRgb, 0.4); ctx.fillRect(PAD + fw, yH + 12, Math.max(2, fa), 14);
    label(ctx, `${T.weights} ${mb(cur.wBytes)}`, PAD, yH + 40, palette.ink, 11);
    label(ctx, `${T.maps} ${mb(cur.aBytes)}`, w - PAD, yH + 40, palette.muted, 11, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.layer}>
          <span>{T.layer}</span>
          {T.layers.map((name, i) => <button key={name} type="button" className={li === i ? "on" : ""} onClick={() => setLi(i)}>{name}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{T.n} <b>{BATCHES[ni]}</b></span>
          <input type="range" min={0} max={BATCHES.length - 1} step={1} value={ni} onChange={(e) => setNi(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · RepViT Table 1: multiply-adds against iPhone 12 latency          */
/* ------------------------------------------------------------------ */

const MARKS: string[][] = [[], REP_SAME_MACS, REP_TIE, ["EfficientFormer-L1", "EfficientFormerV2-S1"]];
const famColor = (r: RepRow) => (r.family === "RepViT" ? palette.accent : r.family === "EfficientFormerV2" ? palette.normal : "rgba(91,100,116,0.55)");

export function RepvitScene() {
  const [ym, setYm] = useState(0);
  const [mk, setMk] = useState(0);
  const T = U.rep;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), px0 = PAD + 40, px1 = w - PAD - 6, py0 = 56, py1 = h - (port ? 70 : 58);
    const xl = 0.3, xh = 12, [yl, yh] = ym === 0 ? [0.7, 8] : [300, 6000];
    const X = (v: number) => logMap(v, xl, xh, px0, px1), Y = (v: number) => logMap(v, yl, yh, py1, py0);
    const val = (r: RepRow) => (ym === 0 ? r.ms : r.thr);

    // legend
    const legend: [string, string][] = [[T.legend[0], palette.accent], [T.legend[1], palette.normal], [T.legend[2], "rgba(91,100,116,0.55)"]];
    let lx = PAD;
    legend.forEach(([name, col]) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(lx + 5, 18, 5, 0, Math.PI * 2); ctx.fill();
      label(ctx, name, lx + 14, 18, palette.ink, 11);
      ctx.save(); ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"; lx += ctx.measureText(name).width + 30; ctx.restore();
    });
    label(ctx, ym === 0 ? T.lat : T.thr, PAD, 40, palette.muted, 11);

    // axes, one grid line per doubling
    frame(ctx, px0, py0, px1 - px0, py1 - py0, palette.frame, 1);
    [0.5, 1, 2, 4, 8].forEach((t) => { line(ctx, X(t), py0, X(t), py1, palette.grid, 1); label(ctx, `${t}`, X(t), py1 + 12, palette.muted, 11, "center"); });
    (ym === 0 ? [1, 2, 4] : [500, 1000, 2000, 4000]).forEach((t) => { line(ctx, px0, Y(t), px1, Y(t), palette.grid, 1); label(ctx, `${t}`, px0 - 5, Y(t), palette.muted, 11, "right"); });
    label(ctx, T.x, px1, py1 + 28, palette.muted, 11, "right");

    const marked = MARKS[mk];
    if (mk === 1) guide(ctx, X(1.3), py0, X(1.3), py1, palette.ink);
    if (mk === 2 && ym === 0) guide(ctx, px0, Y(0.9), px1, Y(0.9), palette.ink);
    REPVIT_TABLE.forEach((r) => {
      const on = marked.includes(r.name);
      ctx.save(); ctx.globalAlpha = marked.length && !on ? 0.4 : 1;
      ctx.fillStyle = famColor(r); ctx.beginPath(); ctx.arc(X(r.gmacs), Y(val(r)), on ? 6.5 : 4.5, 0, Math.PI * 2); ctx.fill();
      if (on) { ctx.strokeStyle = palette.ink; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.restore();
    });

    // names of the marked points, pushed apart so they never sit on each other
    const tags = REPVIT_TABLE.filter((r) => marked.includes(r.name)).map((r) => ({ r, y: Y(val(r)) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < tags.length; i++) if (tags[i].y - tags[i - 1].y < 30) tags[i].y = tags[i - 1].y + 30;
    tags.forEach(({ r, y }) => {
      const x = X(r.gmacs), right = x < (px0 + px1) / 2, tx = right ? x + 14 : x - 14, al = right ? "left" : "right";
      line(ctx, x, Y(val(r)), tx, y, palette.frame, 1);
      const sub2 = mk === 1 ? `${r.gmacs} GMACs, ${ym === 0 ? `${r.ms.toFixed(1)}ms` : `${int(r.thr)}/s`}` : `${r.ms.toFixed(1)}ms, ${int(r.thr)}/s`;
      ctx.save(); ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      const tw = Math.max(ctx.measureText(r.name).width, ctx.measureText(sub2).width) + 8; ctx.restore();
      ctx.fillStyle = "rgba(255,255,255,0.88)"; ctx.fillRect(right ? tx - 4 : tx - tw + 4, y - 15, tw, 31);
      label(ctx, r.name, tx, y - 7, palette.ink, 11, al);
      label(ctx, sub2, tx, y + 8, palette.muted, 11, al);
    });
    label(ctx, T.source, w - PAD, h - 12, palette.muted, 11, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.y}>
          <span>{T.y}</span>
          {T.ys.map((name, i) => <button key={name} type="button" className={ym === i ? "on" : ""} onClick={() => setYm(i)}>{name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.mark}>
          <span>{T.mark}</span>
          {T.marks.map((name, i) => <button key={name} type="button" className={mk === i ? "on" : ""} onClick={() => setMk(i)}>{name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · YOLOv10 Table 1: four yardsticks for the same pair               */
/* ------------------------------------------------------------------ */

export function YoloScene() {
  const [pi, setPi] = useState(0);
  const [step, setStep] = useState(0);
  const T = U.yolo;
  const [a, b] = YOLO_PAIRS[pi].map(yoloRow);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), g = port ? (h - 440) / 5 : 0, fs = w < 420 ? 11 : 12;
    label(ctx, `${a.name}  ${T.ap} ${a.ap}`, PAD, 18, palette.muted, 11);
    label(ctx, `${b.name}  ${T.ap} ${b.ap}`, w - PAD, 18, palette.ink, 11, "right");

    const vals: [number, number][] = [[a.params, b.params], [a.gflops, b.gflops], [a.msF, b.msF], [a.ms, b.ms]];
    const x0 = PAD, x1 = w - PAD - 64, full = (x1 - x0) / 1.05, rh = 52 + g;
    vals.forEach(([va, vb], i) => {
      if (i > step) return;
      const y = 46 + i * rh, ch = (vb - va) / va;
      ctx.save(); ctx.globalAlpha = i === step ? 1 : 0.7;
      label(ctx, T.rows[i], x0, y, palette.ink, 12);
      label(ctx, `${ch >= 0 ? "+" : "−"}${Math.abs(ch * 100).toFixed(1)}%`, w - PAD, y, ch < -0.2 ? DIFF : palette.ink, 13, "right");
      hbar(ctx, x0, y + 10, full * 1.05, 10, 1 / 1.05, "rgba(91,100,116,0.5)");
      hbar(ctx, x0, y + 24, full * 1.05, 10, vb / va / 1.05, palette.ink);
      label(ctx, `${va}${T.units[i]}`, x0 + full + 4, y + 15, palette.muted, fs);
      label(ctx, `${vb}${T.units[i]}`, x0 + full * (vb / va) + 4, y + 29, palette.ink, fs);
      ctx.restore();
    });
    label(ctx, T.older, x0 + full, 46 + Math.min(step, 3) * rh + 46, palette.muted, 11, "right");

    // the end-to-end time split into forward and post-processing
    if (step === 3) {
      const y = 46 + 4 * rh + 18 + g, tmax = 11, bw = w - 2 * PAD, sx = (v: number) => (bw * v) / tmax;
      [a, b].forEach((m, k) => {
        const yy = y + k * 34, post = m.ms - m.msF;
        label(ctx, m.name, PAD, yy, palette.ink, 11);
        ctx.fillStyle = COMP; ctx.fillRect(PAD, yy + 8, sx(m.msF), 12);
        ctx.fillStyle = DIFF; ctx.fillRect(PAD + sx(m.msF), yy + 8, Math.max(2, sx(post)), 12);
        label(ctx, `${T.forward} ${m.msF} + ${T.post} ${post.toFixed(2)} = ${m.ms}${T.ms}`, w - PAD, yy, palette.muted, 11, "right");
      });
    }
    label(ctx, T.source, w - PAD, h - 12, palette.muted, 11, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.pair}>
          <span>{T.pair}</span>
          {T.pairs.map((name, i) => <button key={name} type="button" className={pi === i ? "on" : ""} onClick={() => setPi(i)}>{name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.step}>
          <span>{T.step}</span>
          {T.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · A shortcut beside the conv: almost no FLOPs, many bytes          */
/* ------------------------------------------------------------------ */

const T_MAX = 100;

export function BranchScene() {
  const [two, setTwo] = useState(false);
  const [li, setLi] = useState(0);
  const T = U.branch;
  const main = li === 0 ? L1 : SEP_FUSED;
  const one = seqCost([main]), now = seqCost(two ? [main, ADD] : [main]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), g = port ? (h - 440) / 4 : 0, fs = w < 420 ? 11 : 12;

    // the block: x, conv, (+ shortcut), y
    const yd = 62 + g * 0.5, bxW = Math.min(130, w * 0.3), xX = PAD + 14, xC = w * 0.5 - bxW / 2, xP = w * 0.5 + bxW / 2 + 42, xY = w - PAD - 14;
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(xX, yd, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = palette.normal; ctx.lineWidth = 1.5; ctx.stroke();
    label(ctx, T.x, xX, yd, palette.ink, 12, "center");
    rbox(ctx, xC, yd - 18, bxW, 36, 8, tint(palette.normalRgb, 0.08), palette.normal, 1.5);
    label(ctx, li === 0 ? T.conv : T.sep, xC + bxW / 2, yd, palette.ink, 12, "center");
    arrow(ctx, xX + 14, yd, xC - 4, yd, palette.muted, 1.5);
    if (two) {
      rbox(ctx, xP - 13, yd - 13, 26, 26, 13, tint(palette.accentRgb, 0.12), MOVE, 1.5);
      label(ctx, T.add, xP, yd, MOVE, 14, "center");
      arrow(ctx, xC + bxW + 2, yd, xP - 16, yd, palette.muted, 1.5);
      arrow(ctx, xP + 15, yd, xY - 15, yd, palette.muted, 1.5);
      ctx.save(); ctx.strokeStyle = MOVE; ctx.lineWidth = 1.8; ctx.beginPath();
      ctx.moveTo(xX, yd - 14); ctx.lineTo(xX, yd - 40); ctx.lineTo(xP, yd - 40); ctx.lineTo(xP, yd - 16); ctx.stroke(); ctx.restore();
      label(ctx, T.shortcut, (xX + xP) / 2, yd - 50, MOVE, 11, "center");
    } else arrow(ctx, xC + bxW + 2, yd, xY - 15, yd, palette.muted, 1.5);
    ctx.fillStyle = "#ffffff"; ctx.beginPath(); ctx.arc(xY, yd, 13, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = palette.normal; ctx.lineWidth = 1.5; ctx.stroke();
    label(ctx, T.y, xY, yd, palette.ink, 12, "center");

    // the steps one after another on a fixed time axis
    const yt = yd + 66 + g, x0 = PAD, x1 = w - PAD, sx = (t: number) => ((x1 - x0) * t) / T_MAX;
    for (let t = 0; t <= T_MAX; t += 25) { line(ctx, x0 + sx(t), yt - 6, x0 + sx(t), yt + 104, palette.grid, 1); label(ctx, t === T_MAX ? `${t}µs` : `${t}`, x0 + sx(t), yt + 116, palette.muted, 11, t === 0 ? "left" : t === T_MAX ? "right" : "center"); }
    let t0 = 0;
    now.parts.forEach((p, i) => {
      const xs = x0 + sx(t0), name = i === 0 ? T.stepConv : T.stepAdd;
      const colr = p.bound === "compute" ? COMP : MOVE;
      rbox(ctx, xs, yt, Math.max(4, sx(p.time) - 2), 30, 5, tint(p.bound === "compute" ? palette.normalRgb : palette.accentRgb, 0.16), colr, 1.5);
      label(ctx, us(p.time), xs + 6, yt + 15, palette.ink, 11);
      label(ctx, name, xs + 2, yt + 42, palette.muted, 11);
      hbar(ctx, xs, yt + 54, Math.max(4, sx(p.time) - 2), 7, p.compute / Math.max(p.time, 1e-9), COMP, p.bound === "compute");
      hbar(ctx, xs, yt + 66, Math.max(4, sx(p.time) - 2), 7, p.memory / Math.max(p.time, 1e-9), MOVE, p.bound === "memory");
      t0 += p.time;
    });
    label(ctx, `${T.compute}`, x0, yt + 86, COMP, 11);
    label(ctx, `${T.memory}`, x0 + 46, yt + 86, MOVE, 11);
    guide(ctx, x0 + sx(now.time), yt - 10, x0 + sx(now.time), yt + 34, palette.ink);

    // three totals, with the change against one branch
    const yS = yt + 150 + g * 0.6, ch = (a: number, b0: number) => (two ? `+${((a / b0 - 1) * 100).toFixed(a / b0 - 1 < 0.01 ? 2 : 0)}%` : "");
    const rows: [string, string, string][] = [
      [T.flops, int(now.flops), ch(now.flops, one.flops)],
      [T.bytes, int(now.bytes), ch(now.bytes, one.bytes)],
      [T.time, us(now.time), ch(now.time, one.time)],
    ];
    rows.forEach(([name, v, c], i) => {
      const y = yS + i * 22;
      label(ctx, name, PAD, y, palette.muted, fs);
      label(ctx, v, PAD + (w < 420 ? 98 : 120), y, palette.ink, fs);
      if (c) label(ctx, c, w - PAD, y, i === 0 ? palette.ink : DIFF, fs, "right");
    });
    if (two) label(ctx, T.vsOne, w - PAD, yS - 20, palette.muted, 11, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.branches}>
          <span>{T.branches}</span>
          {T.branchOpts.map((name, i) => <button key={name} type="button" className={(two ? 1 : 0) === i ? "on" : ""} onClick={() => setTwo(i === 1)}>{name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.layer}>
          <span>{T.layer}</span>
          {T.layers.map((name, i) => <button key={name} type="button" className={li === i ? "on" : ""} onClick={() => setLi(i)}>{name}</button>)}
        </div>
      </div>
    </div>
  );
}

