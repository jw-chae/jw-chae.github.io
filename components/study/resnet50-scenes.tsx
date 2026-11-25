"use client";

import { useMemo, useRef, useState } from "react";
import { clamp, drawGrid, gauss, glowDot, label, lerp, palette, rng, smooth, useCanvas } from "@/components/anomaly/lib";
import { arrow, line } from "./kit";
import { resnetCopy as t } from "./resnet50-copy";

const NARROW = 560;
const PAD = 18;
const isPortrait = (w: number, h: number) => h > w * 1.15;

/* ------------------------------------------------------------------ */
/* 04 · Convolution basics: a 3x3 kernel sliding over one channel      */
/* ------------------------------------------------------------------ */

export function ConvBasicsScene() {
  const N = 8, K = 3;
  const [stride, setStride] = useState(1);
  const [playing, setPlaying] = useState(true);
  const data = useMemo(() => {
    const r = rng(3);
    const img = Array.from({ length: N * N }, (_, i) => {
      const x = i % N;
      const edge = x === 3 || x === 4 ? 1 : 0;                        // a vertical stripe
      return clamp(edge * 0.8 + 0.15 + gauss(r) * 0.08, 0, 1);
    });
    const kernel = [-1, 0, 1, -2, 0, 2, -1, 0, 1].map((v) => v / 4);   // left column negative, right column positive
    return { img, kernel };
  }, []);
  const outN = Math.floor((N - K) / stride) + 1;
  const out = useMemo(() => {
    const o = new Array(outN * outN).fill(0);
    for (let oy = 0; oy < outN; oy++) for (let ox = 0; ox < outN; ox++) {
      let acc = 0;
      for (let u = 0; u < K; u++) for (let v = 0; v < K; v++) acc += data.kernel[u * K + v] * data.img[(oy * stride + u) * N + ox * stride + v];
      o[oy * outN + ox] = acc;
    }
    return o;
  }, [data, outN, stride]);
  const tRef = useRef(0);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    if (playing) tRef.current = tt;
    const step = Math.floor((tRef.current * 2.2) % (outN * outN));
    const oy = Math.floor(step / outN), ox = step % outN;
    const portrait = isPortrait(w, h);
    // input and output share one cell size; the kernel gets larger cells so its numbers stay readable
    const ck = portrait ? 36 : 38, gap = portrait ? 30 : 26;
    const ci = portrait ? 26 : clamp(Math.floor((w - 2 * PAD - 2 * gap - K * ck) / (N + outN)), 16, 28);
    let ix: number, iy: number, kx: number, ky: number, oxp: number, oyp: number;
    if (portrait) {
      ix = (w - N * ci) / 2; iy = 38;
      const rowW = K * ck + gap + outN * ci;
      kx = (w - rowW) / 2; ky = iy + N * ci + 54; oxp = kx + K * ck + gap; oyp = ky;
    } else {
      const total = N * ci + gap + K * ck + gap + outN * ci, cy = h * 0.5 - 8;
      ix = (w - total) / 2; iy = cy - (N * ci) / 2;
      kx = ix + N * ci + gap; ky = cy - (K * ck) / 2;
      oxp = kx + K * ck + gap; oyp = cy - (outN * ci) / 2;
    }
    const gray = (v: number) => `rgb(${Math.round(30 + v * 200)},${Math.round(30 + v * 200)},${Math.round(30 + v * 200)})`;
    for (let i = 0; i < N * N; i++) {
      ctx.fillStyle = gray(data.img[i]);
      ctx.fillRect(ix + (i % N) * ci + 1, iy + Math.floor(i / N) * ci + 1, ci - 2, ci - 2);
    }
    // sliding window
    ctx.strokeStyle = palette.accent; ctx.lineWidth = 3; ctx.strokeRect(ix + ox * stride * ci, iy + oy * stride * ci, K * ci, K * ci);
    label(ctx, t.conv.input, ix + (N * ci) / 2, iy - 13, palette.muted, 11, "center");
    // kernel
    for (let i = 0; i < K * K; i++) {
      const v = data.kernel[i], cx = kx + (i % K) * ck, cy = ky + Math.floor(i / K) * ck;
      ctx.fillStyle = v > 0 ? `rgba(${palette.normalRgb},${0.25 + Math.abs(v)})` : v < 0 ? `rgba(${palette.anomalyRgb},${0.25 + Math.abs(v)})` : palette.track;
      ctx.fillRect(cx + 1, cy + 1, ck - 2, ck - 2);
      label(ctx, v === 0 ? "0" : v.toFixed(2).replace("-", "−"), cx + ck / 2, cy + ck / 2, palette.ink, 11, "center");
    }
    label(ctx, t.conv.kernel, kx + (K * ck) / 2, ky - 13, palette.muted, 11, "center");
    label(ctx, t.conv.sum, kx + (K * ck) / 2, ky + K * ck + 15, palette.muted, 11, "center");
    // output
    const mx = Math.max(...out.map(Math.abs), 1e-6);
    for (let i = 0; i < outN * outN; i++) {
      const done = i <= step;
      const v = out[i] / mx;
      ctx.fillStyle = done ? (v >= 0 ? `rgba(${palette.normalRgb},${0.15 + Math.abs(v) * 0.85})` : `rgba(${palette.anomalyRgb},${0.15 + Math.abs(v) * 0.85})`) : palette.track;
      ctx.fillRect(oxp + (i % outN) * ci + 1, oyp + Math.floor(i / outN) * ci + 1, ci - 2, ci - 2);
    }
    ctx.strokeStyle = palette.accent; ctx.lineWidth = 3; ctx.strokeRect(oxp + ox * ci, oyp + oy * ci, ci, ci);
    label(ctx, `${t.conv.output} ${outN}×${outN}`, oxp + (outN * ci) / 2, oyp - 13, palette.muted, 11, "center");
    label(ctx, `out(${oy},${ox}) = ${out[step].toFixed(2).replace("-", "−")}`, oxp + (outN * ci) / 2, oyp + outN * ci + 15, palette.ink, 12, "center");
    label(ctx, `${N}×${N}  →  ${outN}×${outN}   (stride ${stride})`, w / 2, h - 18, palette.muted, 11, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={t.conv.stride}>
          <span>{t.conv.stride}</span>
          {[1, 2].map((v) => <button key={v} type="button" className={stride === v ? "on" : ""} onClick={() => setStride(v)}>{v}</button>)}
        </div>
        <button type="button" className="ad-btn" onClick={() => setPlaying((p) => !p)}>{playing ? t.conv.pause : t.conv.play}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · Tensor shape flow                                              */
/* ------------------------------------------------------------------ */

/** Slots of the shape-flow figure; shared by the drawing and the pointer hit-test. */
function flowLayout(w: number, h: number, n: number) {
  const perRow = isPortrait(w, h) ? 3 : 5, rows = Math.ceil(n / perRow);
  const left = 12, top = 10, bottom = 58;                 // the bottom band holds the two-line readout
  return { perRow, rows, left, top, slotW: (w - 2 * left) / perRow, rowH: (h - top - bottom) / rows };
}

export function ShapeFlowScene() {
  const stages = t.flow.stages;
  const hover = useRef<number | null>(null);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const n = stages.length;
    const { perRow, left, top, slotW, rowH } = flowLayout(w, h, n);
    const maxFace = Math.min(slotW * 0.56, rowH * 0.4);
    const pulse = (tt * 0.9) % (n + 1.5);
    stages.forEach((s, i) => {
      const r = Math.floor(i / perRow), col = i % perRow;
      const cx = left + col * slotW + slotW / 2, slotTop = top + r * rowH, slotBottom = slotTop + rowH;
      const cy = slotTop + rowH * 0.42;
      const face = s.H === 1 ? 10 : lerp(14, maxFace, Math.sqrt(s.H / 224));
      const depth = clamp(Math.log2(s.C) * 3.2, 4, 40);
      const hot = hover.current === i;
      const lit = Math.abs(pulse - i) < 0.6 ? 1 - Math.abs(pulse - i) / 0.6 : 0;
      const isPC = s.id === "layer2" || s.id === "layer3";
      const x0 = cx - face / 2 - depth / 3, y0 = cy - face / 2 + depth / 3;
      // depth slab
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = isPC ? `rgba(${palette.accentRgb},0.35)` : `rgba(${palette.normalRgb},0.22)`;
      ctx.beginPath();
      ctx.moveTo(x0 + face, y0); ctx.lineTo(x0 + face + depth * 0.7, y0 - depth * 0.7);
      ctx.lineTo(x0 + face + depth * 0.7, y0 - depth * 0.7 + face); ctx.lineTo(x0 + face, y0 + face); ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(x0, y0); ctx.lineTo(x0 + depth * 0.7, y0 - depth * 0.7);
      ctx.lineTo(x0 + face + depth * 0.7, y0 - depth * 0.7); ctx.lineTo(x0 + face, y0); ctx.closePath(); ctx.fill();
      // face
      ctx.fillStyle = hot || lit > 0 ? (isPC ? palette.accent : palette.normal) : (isPC ? `rgba(${palette.accentRgb},0.75)` : `rgba(${palette.normalRgb},0.6)`);
      ctx.fillRect(x0, y0, face, face);
      ctx.strokeStyle = palette.frame; ctx.lineWidth = 1; ctx.strokeRect(x0 + 0.5, y0 + 0.5, face, face);
      if (lit > 0) { ctx.save(); ctx.globalAlpha = lit * 0.6; ctx.shadowColor = palette.accent; ctx.shadowBlur = 18; ctx.fillStyle = palette.accent; ctx.fillRect(x0, y0, face, face); ctx.restore(); }
      ctx.restore();
      // arrow to the next stage in the same row
      if (i < n - 1 && col < perRow - 1) arrow(ctx, cx + slotW / 2 - 10, cy, cx + slotW / 2 + 3, cy, palette.dotOff, 1.2);
      // the tag sits right above its own box, the name and shape at the foot of the slot
      if (isPC) label(ctx, t.flow.patchcore, cx, y0 - depth * 0.7 - 10, palette.accent, 11, "center");
      const [nameA, nameB] = s.name.split(" · ");
      if (nameB) {
        label(ctx, nameA, cx, slotBottom - 36, hot ? palette.ink : palette.muted, 11, "center");
        label(ctx, nameB, cx, slotBottom - 22, hot ? palette.ink : palette.muted, 11, "center");
      } else {
        label(ctx, nameA, cx, slotBottom - 22, hot ? palette.ink : palette.muted, 11, "center");
      }
      label(ctx, t.flow.shapeLabel(s.H, s.C), cx, slotBottom - 7, isPC ? palette.accent : palette.ink, 11, "center");
    });
    const hi = hover.current;
    ctx.fillStyle = palette.track2; ctx.fillRect(left, h - 50, w - 2 * left, 42);
    if (hi !== null) {
      const s = stages[hi];
      label(ctx, `${s.name}   ${t.flow.shapeLabel(s.H, s.C)}`, left + 8, h - 37, palette.ink, 12);
      label(ctx, s.desc, left + 8, h - 20, palette.muted, 11);
    } else {
      label(ctx, "H, W ↓   C ↑", left + 8, h - 37, palette.ink, 12);
      label(ctx, t.flow.hint, left + 8, h - 20, palette.muted, 11);
    }
  });

  return (
    <div className="ad-scene"
      onPointerMove={(e) => {
        const canvas = e.currentTarget.querySelector("canvas");
        if (!canvas) return;
        const r = canvas.getBoundingClientRect();
        const n = t.flow.stages.length;
        const { perRow, rows, left, top, slotW, rowH } = flowLayout(r.width, r.height, n);
        const col = Math.floor((e.clientX - r.left - left) / slotW), row = Math.floor((e.clientY - r.top - top) / rowH);
        const i = row * perRow + col;
        hover.current = col >= 0 && col < perRow && row >= 0 && row < rows && i < n ? i : null;
      }}
      onPointerLeave={() => { hover.current = null; }}>
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · Bottleneck parameter count                                     */
/* ------------------------------------------------------------------ */

const CH = [64, 128, 256, 512, 1024, 2048];
const RATIOS = [2, 4, 8];

export function BottleneckScene() {
  const [ci, setCi] = useState(2);
  const [ri, setRi] = useState(1);
  const C = CH[ci], r = RATIOS[ri], m = C / r;
  const naive = 9 * C * C;
  const p1 = C * m, p2 = 9 * m * m, p3 = m * C;
  const total = p1 + p2 + p3;
  const fmt = (v: number) => v.toLocaleString("en-US");

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const narrow = w < NARROW;
    const bx = narrow ? w * 0.44 : w * 0.3, top = 44, pitch = 68;
    const wid = (c: number) => lerp(60, 190, Math.log2(c) / 11);
    const boxes = [
      { y: top + 8, name: `1×1 conv   ${C} → ${m}`, p: p1, wid: wid(m) },
      { y: top + 8 + pitch, name: `3×3 conv   ${m} → ${m}`, p: p2, wid: wid(m) },
      { y: top + 8 + 2 * pitch, name: `1×1 conv   ${m} → ${C}`, p: p3, wid: wid(C) },
    ];
    const bw0 = wid(C), yIn = top - 8, yOut = top + 8 + 2 * pitch + 44;
    // channel-width bars show the "neck"
    const shapes = [{ y: yIn, wid: bw0 }, ...boxes.map((b) => ({ y: b.y + 44, wid: b.wid }))];
    ctx.strokeStyle = palette.dotOff; ctx.setLineDash([3, 4]);
    shapes.forEach((s) => { ctx.beginPath(); ctx.moveTo(bx - s.wid / 2, s.y); ctx.lineTo(bx + s.wid / 2, s.y); ctx.stroke(); });
    ctx.setLineDash([]);
    boxes.forEach((b, i) => {
      const flow = (tt * 0.8) % 3;
      const hot = Math.abs(flow - i) < 0.5;
      ctx.fillStyle = hot ? palette.normal : `rgba(${palette.normalRgb},0.55)`;
      ctx.fillRect(bx - b.wid / 2, b.y, b.wid, 34);
      label(ctx, b.name, bx, b.y + 17, "#ffffff", 11, "center");
      label(ctx, `${fmt(b.p)}${t.bottleneck.count}`, bx + b.wid / 2 + 10, b.y + 17, palette.muted, 11);
      if (i < 2) { ctx.strokeStyle = palette.dotOff; ctx.beginPath(); ctx.moveTo(bx, b.y + 34); ctx.lineTo(bx, b.y + 44); ctx.stroke(); }
    });
    // skip arc: the input goes around the three convs and is added back
    const ax = bx - bw0 / 2 - 10, bulge = Math.max(12, ax - 80);
    ctx.strokeStyle = palette.mint; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ax, yIn); ctx.bezierCurveTo(bulge, yIn + 60, bulge, yOut - 60, ax, yOut); ctx.stroke();
    label(ctx, "+ x", ax - 6, yOut + 14, palette.mint, 11, "right");
    label(ctx, `${C} ch`, bx, yIn - 12, palette.ink, 11, "center");
    label(ctx, `${C} ch`, bx, yOut + 14, palette.ink, 11, "center");
    // comparison bars
    const px = narrow ? w * 0.08 : w * 0.62, py = narrow ? yOut + 44 : top + 24, pw = narrow ? w * 0.84 : w * 0.32;
    const a = smooth(0, 1, (tt % 4) / 1.2);
    label(ctx, t.bottleneck.naive + `   3×3, ${C} → ${C}`, px, py, palette.muted, 11);
    ctx.fillStyle = palette.track; ctx.fillRect(px, py + 12, pw, 12);
    ctx.fillStyle = palette.anomaly; ctx.fillRect(px, py + 12, pw * a, 12);
    label(ctx, fmt(naive), px + pw, py + 34, palette.ink, 12, "right");
    label(ctx, t.bottleneck.bottle, px, py + 58, palette.muted, 11);
    ctx.fillStyle = palette.track; ctx.fillRect(px, py + 70, pw, 12);
    ctx.fillStyle = palette.normal; ctx.fillRect(px, py + 70, pw * (total / naive) * a, 12);
    label(ctx, fmt(total), px + pw, py + 92, palette.ink, 12, "right");
    label(ctx, `${t.bottleneck.saving}  ×${(naive / total).toFixed(1)}`, px, py + 118, palette.accent, 15);
    label(ctx, `${C} → ${m} → ${m} → ${C}`, px, py + 140, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{t.bottleneck.channels} <b>{C}</b></span>
          <input type="range" min={0} max={CH.length - 1} step={1} value={ci} onChange={(e) => setCi(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={t.bottleneck.ratio}>
          <span>{t.bottleneck.ratio}</span>
          {RATIOS.map((v, i) => <button key={v} type="button" className={ri === i ? "on" : ""} onClick={() => setRi(i)}>{v}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · 1×1 convolution: every new value is a weighted sum of one cell's channels */
/* ------------------------------------------------------------------ */

export function OneByOneScene() {
  const C = 16, K = 6, G = 5;
  const [pos, setPos] = useState<[number, number]>([2, 2]);
  const data = useMemo(() => {
    const r = rng(77);
    const X = Array.from({ length: G * G }, () => Array.from({ length: C }, () => gauss(r)));
    const W = Array.from({ length: K }, () => Array.from({ length: C }, () => gauss(r) * 0.6));
    return { X, W };
  }, []);
  const x = data.X[pos[0] * G + pos[1]];
  const y = data.W.map((row) => row.reduce((s, v, c) => s + v * x[c], 0));

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const heat = (v: number, base: string) => `rgba(${base},${clamp(Math.abs(v) / 2, 0.08, 1)})`;
    // the spatial grid: one cell is chosen, its neighbours take no part
    const gs = portrait ? 24 : 26, gx = PAD, gy = portrait ? 34 : h * 0.5 - (G * gs) / 2 - 14;
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
      ctx.fillStyle = i === pos[0] && j === pos[1] ? palette.accent : palette.track2;
      ctx.fillRect(gx + j * gs + 1, gy + i * gs + 1, gs - 2, gs - 2);
    }
    if (portrait) {
      label(ctx, "H × W", gx + G * gs + 14, gy + (G * gs) / 2 - 9, palette.muted, 11);
      label(ctx, t.onebyone.noSpatial, gx + G * gs + 14, gy + (G * gs) / 2 + 9, palette.muted, 11);
    } else {
      label(ctx, "H × W", gx + (G * gs) / 2, gy + G * gs + 14, palette.muted, 11, "center");
      label(ctx, t.onebyone.noSpatial, gx, gy + G * gs + 30, palette.muted, 11);
    }
    // x as a row, W under it column by column, y to the right of each row of W
    const rx = portrait ? PAD : gx + G * gs + 34, yw = 30, room = w - PAD - rx - 12 - yw - 44;
    const cell = clamp(Math.floor(room / C), 11, 18);
    const xy = portrait ? gy + G * gs + 62 : h * 0.5 - (cell + 34 + K * cell) / 2 - 6;
    const wy = xy + cell + 34, ox = rx + C * cell + 12;
    for (let c = 0; c < C; c++) { ctx.fillStyle = heat(x[c], palette.accentRgb); ctx.fillRect(rx + c * cell, xy, cell - 1, cell - 1); }
    label(ctx, t.onebyone.xName(C), rx, xy - 13, palette.ink, 11);
    label(ctx, t.onebyone.wName(K, C), rx, wy - 13, palette.ink, 11);
    label(ctx, "y", ox + yw / 2, wy - 13, palette.ink, 11, "center");
    const step = Math.floor((tt * 1.4) % (K + 1));
    for (let k = 0; k < K; k++) {
      const active = k === step, done = k < step;
      for (let c = 0; c < C; c++) {
        ctx.fillStyle = heat(data.W[k][c], palette.normalRgb);
        ctx.fillRect(rx + c * cell, wy + k * cell, cell - 1, cell - 1);
      }
      ctx.fillStyle = active || done ? heat(y[k], palette.anomalyRgb) : palette.track;
      ctx.fillRect(ox, wy + k * cell, yw, cell - 1);
      if (active || done) label(ctx, y[k].toFixed(2).replace("-", "−"), ox + yw + 5, wy + k * cell + cell / 2, palette.ink, 11);
      if (active) {
        ctx.strokeStyle = palette.accent; ctx.lineWidth = 2;
        ctx.strokeRect(rx - 1, wy + k * cell - 1, C * cell + 1, cell + 1);
        ctx.strokeRect(rx - 1, xy - 1, C * cell + 1, cell + 1);
      }
    }
    const foot = wy + K * cell + 18;
    if (step < K) label(ctx, `y_${step + 1} = Σ_c W[${step + 1}, c] · x_c`, rx, foot, palette.accent, 12);
    else label(ctx, `${t.onebyone.channels} ${C}  →  ${t.onebyone.filters} ${K}`, rx, foot, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={t.onebyone.pick}>
          <span>{t.onebyone.pick}</span>
          {[[0, 0], [1, 3], [2, 2], [4, 1], [3, 4]].map(([i, j]) => (
            <button key={`${i}${j}`} type="button" className={pos[0] === i && pos[1] === j ? "on" : ""} onClick={() => setPos([i, j])}>({i},{j})</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 · Identity vs projection shortcut                                */
/* ------------------------------------------------------------------ */

export function SkipScene() {
  const [diff, setDiff] = useState(false);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const narrow = w < NARROW;
    const x0 = narrow ? 24 : w * 0.1, x1 = narrow ? w - 24 : w * 0.9;
    const yMain = h * 0.62, ySkip = h * 0.26;
    const inShape = "56×56×256", outShape = diff ? "28×28×512" : "56×56×256";
    // main branch
    const boxes = ["1×1", diff ? "3×3, s2" : "3×3", "1×1"];
    const bw = narrow ? 52 : 74, gap = (x1 - x0 - 3 * bw - 120) / 4;
    ctx.strokeStyle = palette.frame; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x0, yMain); ctx.lineTo(x1, yMain); ctx.stroke();
    boxes.forEach((b, i) => {
      const bx = x0 + 60 + gap * (i + 1) + bw * i;
      ctx.fillStyle = palette.normal; ctx.fillRect(bx, yMain - 18, bw, 36);
      label(ctx, b, bx + bw / 2, yMain, "#ffffff", 11, "center");
    });
    label(ctx, t.skip.main + "  F(x)", x0 + 60, yMain + 34, palette.muted, 11);
    // shortcut
    const sx0 = x0 + 30, sx1 = x1 - 30;
    ctx.strokeStyle = diff ? palette.accent2 : palette.mint; ctx.lineWidth = 2;
    if (diff) ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(sx0, yMain); ctx.lineTo(sx0, ySkip); ctx.lineTo(sx1, ySkip); ctx.lineTo(sx1, yMain - 12); ctx.stroke();
    ctx.setLineDash([]);
    if (diff) {
      const pw = narrow ? 124 : 150, px = (sx0 + sx1) / 2 - pw / 2;
      ctx.fillStyle = palette.accent2; ctx.fillRect(px, ySkip - 16, pw, 32);
      label(ctx, t.skip.proj, px + pw / 2, ySkip, "#ffffff", 11, "center");
      label(ctx, "W_s x", px + pw + 8, ySkip - 13, palette.accent2, 11);
    } else {
      label(ctx, "x  (identity)", (sx0 + sx1) / 2, ySkip - 12, palette.mint, 11, "center");
    }
    label(ctx, t.skip.shortcut, sx0 + 6, ySkip + 14, palette.muted, 11);
    // plus node
    glowDot(ctx, sx1, yMain, 9, palette.ink, 2);
    label(ctx, "+", sx1, yMain, "#ffffff", 13, "center");
    label(ctx, "ReLU", sx1 + 16, yMain - 18, palette.muted, 11);
    // shapes: the input beside the branch point, the two things that meet at the plus node
    label(ctx, `x: ${inShape}`, sx0 + 8, yMain - 31, palette.ink, 11);
    label(ctx, `F(x): ${outShape}`, sx1 - 12, yMain + 34, palette.ink, 11, "right");
    label(ctx, diff ? `W_s x: ${outShape}   ✓ ${t.skip.addable}` : `x: ${inShape}   ✓ ${t.skip.addable}`, sx1 - 8, ySkip + 32, diff ? palette.accent2 : palette.mint, 11, "right");
    label(ctx, diff ? "y = F(x) + W_s x" : "y = F(x) + x", x0, h - 20, palette.ink, 13);
    // flowing dots
    const p = (tt * 0.35) % 1;
    glowDot(ctx, lerp(x0, sx1, p), yMain, 4, palette.accent, 3);
    const sp = p * 3;
    const q: [number, number] = sp < 1 ? [sx0, lerp(yMain, ySkip, sp)] : sp < 2 ? [lerp(sx0, sx1, sp - 1), ySkip] : [sx1, lerp(ySkip, yMain - 12, sp - 2)];
    glowDot(ctx, q[0], q[1], 4, diff ? palette.accent2 : palette.mint, 3);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group">
          <button type="button" className={!diff ? "on" : ""} onClick={() => setDiff(false)}>{t.skip.same}</button>
          <button type="button" className={diff ? "on" : ""} onClick={() => setDiff(true)}>{t.skip.diff}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10 · BatchNorm per channel                                          */
/* ------------------------------------------------------------------ */

const CHANNELS = [
  { name: "channel 17", mu: 100, sd: 15 },
  { name: "channel 18", mu: 0.01, sd: 0.005 },
  { name: "channel 42", mu: -3, sd: 1.2 },
];

export function BatchNormScene() {
  const [ch, setCh] = useState(0);
  const [gamma, setGamma] = useState(1);
  const [beta, setBeta] = useState(0);
  const samples = useMemo(() => {
    const r = rng(5);
    return CHANNELS.map((c) => Array.from({ length: 600 }, () => c.mu + c.sd * gauss(r)));
  }, []);
  const xs = samples[ch];
  const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
  const var_ = xs.reduce((a, b) => a + (b - mu) ** 2, 0) / xs.length;
  const sd = Math.sqrt(var_ + 1e-8);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const narrow = w < NARROW;
    const panelW = narrow ? w * 0.86 : w * 0.42, panelH = narrow ? h * 0.34 : h * 0.62;
    const p1x = narrow ? w * 0.07 : w * 0.05, p1y = narrow ? 30 : h * 0.16;
    const p2x = narrow ? p1x : w * 0.53, p2y = narrow ? h * 0.56 : p1y;
    const hist = (vals: number[], x: number, y: number, color: string, lo: number, hi: number, title: string, sub: string) => {
      const bins = 40, counts = new Array(bins).fill(0);
      vals.forEach((v) => { const b = Math.floor(((v - lo) / (hi - lo)) * bins); if (b >= 0 && b < bins) counts[b]++; });
      const mx = Math.max(...counts, 1);
      ctx.fillStyle = palette.track; ctx.fillRect(x, y, panelW, panelH);
      counts.forEach((c, b) => { const bh = (c / mx) * (panelH - 24); ctx.fillStyle = color; ctx.fillRect(x + (b / bins) * panelW + 1, y + panelH - bh, panelW / bins - 2, bh); });
      label(ctx, title, x, y - 12, palette.ink, 11);
      label(ctx, sub, x + panelW, narrow ? y + 12 : y - 12, palette.muted, 11, "right");
      label(ctx, lo.toPrecision(3), x, y + panelH + 12, palette.muted, 11);
      label(ctx, hi.toPrecision(3), x + panelW, y + panelH + 12, palette.muted, 11, "right");
    };
    hist(xs, p1x, p1y, palette.normal, mu - 4 * sd, mu + 4 * sd, `${t.bn.raw} · ${CHANNELS[ch].name}`, `${t.bn.mean} = ${mu.toPrecision(3)}   ${t.bn.std} = ${sd.toPrecision(3)}`);
    const ys = xs.map((v) => gamma * ((v - mu) / sd) + beta);
    hist(ys, p2x, p2y, palette.accent, -5, 5, t.bn.norm, `γ = ${gamma.toFixed(2)}   β = ${beta.toFixed(2)}`);
    // zero line on normalized panel
    const zx = p2x + ((0 + 5) / 10) * panelW;
    line(ctx, zx, p2y, zx, p2y + panelH, palette.dotOff, 1, [3, 3]);
    label(ctx, "0", zx, p2y + panelH + 12, palette.muted, 11, "center");
    if (!narrow) label(ctx, "x̂ = (x − μ_c) / √(σ_c² + ε)   →   y = γ_c x̂ + β_c", w / 2, h - 18, palette.muted, 11, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={t.bn.channel}>
          <span>{t.bn.channel}</span>
          {CHANNELS.map((c, i) => <button key={c.name} type="button" className={ch === i ? "on" : ""} onClick={() => setCh(i)}>{c.name.replace("channel ", "c")}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{t.bn.gamma} <b>{gamma.toFixed(2)}</b></span>
          <input type="range" min={0.2} max={3} step={0.05} value={gamma} onChange={(e) => setGamma(Number(e.target.value))} />
        </label>
        <label className="ad-ctl">
          <span>{t.bn.beta} <b>{beta.toFixed(2)}</b></span>
          <input type="range" min={-2} max={2} step={0.05} value={beta} onChange={(e) => setBeta(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 11 · One block, actual order                                        */
/* ------------------------------------------------------------------ */

const ORDER: [string, "conv" | "bn" | "relu" | "add"][] = [
  ["1×1 Conv", "conv"], ["BN", "bn"], ["ReLU", "relu"], ["3×3 Conv", "conv"], ["BN", "bn"], ["ReLU", "relu"], ["1×1 Conv", "conv"], ["BN", "bn"], ["+ x", "add"], ["ReLU", "relu"],
];
const ORDER_COLOR = { conv: palette.normal, bn: palette.accent, relu: palette.excluded, add: palette.mint };

export function BlockOrderScene() {
  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    // one column at every size: the order from top to bottom is the order of the computation
    const top = 14, rowH = (h - top - 36) / ORDER.length;
    const bw = Math.min(250, w * 0.5), bh = Math.min(28, rowH - 8), cx = w / 2 + 16;
    const rowY = (i: number) => top + rowH * (i + 0.5);
    const active = Math.floor((tt * 1.6) % (ORDER.length + 2));
    ORDER.forEach(([name, kind], i) => {
      const y = rowY(i), color = ORDER_COLOR[kind];
      if (i < ORDER.length - 1) line(ctx, cx, y + bh / 2, cx, rowY(i + 1) - bh / 2, palette.dotOff, 1);
      ctx.save();
      ctx.globalAlpha = i === active ? 1 : 0.55;
      ctx.fillStyle = color; ctx.fillRect(cx - bw / 2, y - bh / 2, bw, bh);
      if (i === active) { ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fillRect(cx - bw / 2, y - bh / 2, bw, bh); }
      ctx.restore();
      label(ctx, name, cx, y, "#ffffff", 12, "center");
    });
    // the shortcut: x leaves before the first conv and rejoins at the addition
    const sx = cx - bw / 2 - 34, y0 = rowY(0) - bh / 2 - 3, y1 = rowY(8);
    line(ctx, cx, y0, sx, y0, palette.mint, 2.5);
    line(ctx, sx, y0, sx, y1, palette.mint, 2.5);
    arrow(ctx, sx, y1, cx - bw / 2 - 3, y1, palette.mint, 2.5);
    label(ctx, "x", sx - 8, (y0 + y1) / 2, palette.mint, 13, "right");
    // legend along the bottom
    const slot = (w - 2 * PAD) / 4;
    ([["conv", "Conv"], ["bn", "BatchNorm"], ["relu", "ReLU"], ["add", t.blockLegend.add]] as const).forEach(([kind, name], j) => {
      ctx.fillStyle = ORDER_COLOR[kind]; ctx.fillRect(PAD + j * slot, h - 19, 9, 9);
      label(ctx, name, PAD + j * slot + 14, h - 14, palette.muted, 11);
    });
  });
  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
    </div>
  );
}
