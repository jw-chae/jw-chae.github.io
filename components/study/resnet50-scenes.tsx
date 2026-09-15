"use client";

import { useMemo, useRef, useState } from "react";
import { clamp, drawGrid, gauss, glowDot, label, lerp, palette, rng, smooth, useCanvas } from "@/components/anomaly/lib";
import { resnetCopy as t } from "./resnet50-copy";

const NARROW = 560;

/* ------------------------------------------------------------------ */
/* 00 · Convolution basics: a 3x3 kernel sliding over one channel      */
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
    const kernel = [-1, 0, 1, -2, 0, 2, -1, 0, 1].map((v) => v / 4);   // vertical-edge detector (Sobel)
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
    const narrow = w < NARROW;
    const cell = narrow ? Math.min(22, (w - 60) / (N + outN + 4)) : Math.min(34, (w - 120) / (N + outN + 6));
    const ix = narrow ? 20 : w * 0.06, iy = h * 0.5 - (N * cell) / 2;
    const gray = (v: number) => `rgb(${Math.round(30 + v * 200)},${Math.round(30 + v * 200)},${Math.round(30 + v * 200)})`;
    for (let i = 0; i < N * N; i++) {
      ctx.fillStyle = gray(data.img[i]);
      ctx.fillRect(ix + (i % N) * cell + 1, iy + Math.floor(i / N) * cell + 1, cell - 2, cell - 2);
    }
    // sliding window
    const wx = ix + ox * stride * cell, wy = iy + oy * stride * cell;
    ctx.strokeStyle = palette.accent; ctx.lineWidth = 3; ctx.strokeRect(wx, wy, K * cell, K * cell);
    label(ctx, t.conv.input, ix + (N * cell) / 2, iy - 12, palette.muted, 10, "center");
    // kernel
    const kx = ix + N * cell + (narrow ? 14 : 34), ky = h * 0.5 - (K * cell) / 2;
    for (let i = 0; i < K * K; i++) {
      const v = data.kernel[i];
      ctx.fillStyle = v > 0 ? `rgba(${palette.normalRgb},${0.25 + Math.abs(v)})` : v < 0 ? `rgba(${palette.anomalyRgb},${0.25 + Math.abs(v)})` : palette.track;
      ctx.fillRect(kx + (i % K) * cell + 1, ky + Math.floor(i / K) * cell + 1, cell - 2, cell - 2);
      label(ctx, v.toFixed(2), kx + (i % K) * cell + cell / 2, ky + Math.floor(i / K) * cell + cell / 2, palette.ink, narrow ? 8 : 9, "center");
    }
    label(ctx, t.conv.kernel, kx + (K * cell) / 2, ky - 12, palette.muted, 10, "center");
    label(ctx, "×, Σ", kx + (K * cell) / 2, ky + K * cell + 14, palette.muted, 11, "center");
    // output
    const oxp = kx + K * cell + (narrow ? 14 : 34), oyp = h * 0.5 - (outN * cell) / 2;
    const mx = Math.max(...out.map(Math.abs), 1e-6);
    for (let i = 0; i < outN * outN; i++) {
      const done = i <= step;
      const v = out[i] / mx;
      ctx.fillStyle = done ? (v >= 0 ? `rgba(${palette.normalRgb},${0.15 + Math.abs(v) * 0.85})` : `rgba(${palette.anomalyRgb},${0.15 + Math.abs(v) * 0.85})`) : palette.track;
      ctx.fillRect(oxp + (i % outN) * cell + 1, oyp + Math.floor(i / outN) * cell + 1, cell - 2, cell - 2);
    }
    ctx.strokeStyle = palette.accent; ctx.lineWidth = 3; ctx.strokeRect(oxp + ox * cell, oyp + oy * cell, cell, cell);
    label(ctx, `${t.conv.output}  ${outN}×${outN}`, oxp + (outN * cell) / 2, oyp - 12, palette.muted, 10, "center");
    label(ctx, `out(${oy},${ox}) = ${out[step].toFixed(2)}`, oxp + (outN * cell) / 2, oyp + outN * cell + 14, palette.ink, 11, "center");
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
/* 01 · Tensor shape flow                                              */
/* ------------------------------------------------------------------ */

export function ShapeFlowScene() {
  const stages = t.flow.stages;
  const hover = useRef<number | null>(null);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const narrow = w < NARROW;
    const n = stages.length;
    const rows = w < 1000 ? 2 : 1;
    const perRow = Math.ceil(n / rows);
    const slotW = (w - 40) / perRow;
    const rowH = (h - 70) / rows;
    const maxFace = Math.min(slotW * 0.62, rowH * 0.5);
    const pulse = (tt * 0.9) % (n + 1.5);
    stages.forEach((s, i) => {
      const r = Math.floor(i / perRow), col = i % perRow;
      const cx = 20 + col * slotW + slotW / 2;
      const cy = 30 + r * rowH + rowH * 0.5;
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
      // arrow to next
      if (i < n - 1 && col < perRow - 1) {
        const ax = cx + slotW / 2 - 6, ay = cy;
        ctx.strokeStyle = palette.dotOff; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(ax - 10, ay); ctx.lineTo(ax + 2, ay); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(ax + 2, ay); ctx.lineTo(ax - 3, ay - 3); ctx.lineTo(ax - 3, ay + 3); ctx.closePath(); ctx.fillStyle = palette.dotOff; ctx.fill();
      }
      label(ctx, s.name, cx, cy + rowH * 0.5 - 22, hot ? palette.ink : palette.muted, narrow ? 9 : 10, "center");
      label(ctx, t.flow.shapeLabel(s.H, s.C), cx, cy + rowH * 0.5 - 8, isPC ? palette.accent : palette.ink, narrow ? 10 : 11, "center");
      if (isPC) label(ctx, t.flow.patchcore, cx, cy - rowH * 0.5 + 10, palette.accent, 9, "center");
    });
    const hi = hover.current;
    if (hi !== null) {
      const s = stages[hi];
      ctx.fillStyle = palette.track2; ctx.fillRect(12, h - 30, w - 24, 22);
      label(ctx, `${s.name}   ${t.flow.shapeLabel(s.H, s.C)}   —   ${s.desc}`, 20, h - 19, palette.ink, narrow ? 9 : 11);
    } else {
      label(ctx, "H, W ↓   C ↑", 20, h - 19, palette.muted, 11);
    }
  });

  return (
    <div className="ad-scene"
      onPointerMove={(e) => {
        const canvas = e.currentTarget.querySelector("canvas");
        if (!canvas) return;
        const r = canvas.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        const n = t.flow.stages.length, rows = r.width < 1000 ? 2 : 1, perRow = Math.ceil(n / rows);
        const slotW = (r.width - 40) / perRow, rowH = (r.height - 70) / rows;
        const col = Math.floor((x - 20) / slotW), row = Math.floor((y - 30) / rowH);
        const i = row * perRow + col;
        hover.current = col >= 0 && col < perRow && row >= 0 && row < rows && i < n ? i : null;
      }}
      onPointerLeave={() => { hover.current = null; }}>
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · Bottleneck parameter count                                     */
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
    const bx = narrow ? w * 0.5 : w * 0.3, top = 26;
    const boxes = [
      { y: top + 10, name: `1×1 conv   ${C} → ${m}`, p: p1, wid: lerp(60, 200, Math.log2(m) / 11) },
      { y: top + 90, name: `3×3 conv   ${m} → ${m}`, p: p2, wid: lerp(60, 200, Math.log2(m) / 11) },
      { y: top + 170, name: `1×1 conv   ${m} → ${C}`, p: p3, wid: lerp(60, 200, Math.log2(C) / 11) },
    ];
    const bw0 = lerp(60, 200, Math.log2(C) / 11);
    // channel-width bars show the "neck"
    const shapes = [{ y: top - 10, wid: bw0 }, ...boxes.map((b) => ({ y: b.y + 44, wid: b.wid }))];
    ctx.strokeStyle = palette.dotOff; ctx.setLineDash([3, 4]);
    shapes.forEach((s) => { ctx.beginPath(); ctx.moveTo(bx - s.wid / 2, s.y); ctx.lineTo(bx + s.wid / 2, s.y); ctx.stroke(); });
    ctx.setLineDash([]);
    boxes.forEach((b, i) => {
      const flow = (tt * 0.8) % 3;
      const hot = Math.abs(flow - i) < 0.5;
      ctx.fillStyle = hot ? palette.normal : `rgba(${palette.normalRgb},0.55)`;
      ctx.fillRect(bx - b.wid / 2, b.y, b.wid, 34);
      label(ctx, b.name, bx, b.y + 17, "#ffffff", 11, "center");
      label(ctx, `${fmt(b.p)} params`, bx + b.wid / 2 + 10, b.y + 17, palette.muted, 10);
      if (i < 2) { ctx.strokeStyle = palette.dotOff; ctx.beginPath(); ctx.moveTo(bx, b.y + 34); ctx.lineTo(bx, b.y + 44); ctx.stroke(); }
    });
    // skip arc
    ctx.strokeStyle = palette.mint; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx - bw0 / 2 - 10, top - 10); ctx.bezierCurveTo(bx - bw0 / 2 - 90, top + 60, bx - bw0 / 2 - 90, top + 160, bx - bw0 / 2 - 10, top + 214); ctx.stroke();
    label(ctx, "+ x", bx - bw0 / 2 - 22, top + 214, palette.mint, 11, "right");
    label(ctx, `${C} ch`, bx, top - 18, palette.ink, 10, "center");
    label(ctx, `${C} ch`, bx, top + 226, palette.ink, 10, "center");
    // comparison bars
    const px = narrow ? w * 0.08 : w * 0.62, py = narrow ? top + 250 : top + 30, pw = narrow ? w * 0.84 : w * 0.32;
    const mx = naive;
    const a = smooth(0, 1, (tt % 4) / 1.2);
    label(ctx, t.bottleneck.naive + `   3×3, ${C} → ${C}`, px, py, palette.muted, 11);
    ctx.fillStyle = palette.track; ctx.fillRect(px, py + 12, pw, 12);
    ctx.fillStyle = palette.anomaly; ctx.fillRect(px, py + 12, pw * a, 12);
    label(ctx, fmt(naive), px + pw, py + 34, palette.ink, 12, "right");
    label(ctx, t.bottleneck.bottle, px, py + 62, palette.muted, 11);
    ctx.fillStyle = palette.track; ctx.fillRect(px, py + 74, pw, 12);
    ctx.fillStyle = palette.normal; ctx.fillRect(px, py + 74, pw * (total / mx) * a, 12);
    label(ctx, fmt(total), px + pw, py + 96, palette.ink, 12, "right");
    label(ctx, `${t.bottleneck.saving}  ×${(naive / total).toFixed(1)}`, px, py + 124, palette.accent, 15);
    label(ctx, `${C} → ${m} → ${m} → ${C}`, px, py + 146, palette.muted, 11);
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
/* 03 · 1×1 convolution as channel mixing                              */
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
    const narrow = w < NARROW;
    const cell = narrow ? 14 : 18;
    // spatial grid (left)
    const gx = narrow ? w * 0.08 : w * 0.06, gy = narrow ? 20 : h * 0.5 - (G * cell * 1.6) / 2;
    const gs = cell * 1.6;
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
      const sel = i === pos[0] && j === pos[1];
      ctx.fillStyle = sel ? palette.accent : palette.track2;
      ctx.fillRect(gx + j * gs + 1, gy + i * gs + 1, gs - 2, gs - 2);
    }
    label(ctx, "H × W", gx + (G * gs) / 2, gy + G * gs + 12, palette.muted, 10, "center");
    label(ctx, t.onebyone.noSpatial, gx + (G * gs) / 2, gy + G * gs + 26, palette.muted, 9, "center");
    // x column
    const heat = (v: number, base: string) => { const a = clamp(Math.abs(v) / 2, 0.08, 1); return `rgba(${base},${a})`; };
    const xx = narrow ? gx + G * gs + 30 : gx + G * gs + 50, xy = narrow ? 20 : h * 0.5 - (C * cell) / 2;
    for (let c = 0; c < C; c++) { ctx.fillStyle = heat(x[c], palette.accentRgb); ctx.fillRect(xx, xy + c * cell, cell, cell - 1); }
    label(ctx, `x ∈ ℝ^${C}`, xx + cell / 2, xy - 10, palette.ink, 10, "center");
    // W matrix
    const wx = xx + cell + 30, wy = xy + (C * cell) / 2 - (K * cell) / 2;
    const step = Math.floor((tt * 1.4) % (K + 1));
    for (let k = 0; k < K; k++) {
      const active = k === step, done = k < step;
      for (let c = 0; c < C; c++) {
        ctx.fillStyle = heat(data.W[k][c], palette.normalRgb);
        ctx.fillRect(wx + c * cell, wy + k * cell, cell - 1, cell - 1);
      }
      if (active) { ctx.strokeStyle = palette.accent; ctx.lineWidth = 2; ctx.strokeRect(wx - 1, wy + k * cell - 1, C * cell + 1, cell + 1); }
      // output cell
      const ox = wx + C * cell + 30;
      ctx.fillStyle = active || done ? heat(y[k], palette.anomalyRgb) : palette.track;
      ctx.fillRect(ox, wy + k * cell, cell * 2, cell - 1);
      if (active || done) label(ctx, y[k].toFixed(2), ox + cell * 2 + 6, wy + k * cell + cell / 2, palette.ink, 10);
    }
    label(ctx, `W ∈ ℝ^{${K}×${C}}`, wx + (C * cell) / 2, wy - 10, palette.ink, 10, "center");
    label(ctx, `y ∈ ℝ^${K}`, wx + C * cell + 30 + cell, wy - 10, palette.ink, 10, "center");
    label(ctx, "·", wx - 15, wy + (K * cell) / 2, palette.muted, 16, "center");
    label(ctx, "=", wx + C * cell + 14, wy + (K * cell) / 2, palette.muted, 14, "center");
    if (step < K) label(ctx, `y_${step + 1} = Σ_c W[${step + 1}, c] · x_c`, wx, wy + K * cell + 16, palette.accent, 11);
    else label(ctx, `${t.onebyone.channels} ${C}  →  ${t.onebyone.filters} ${K}`, wx, wy + K * cell + 16, palette.muted, 11);
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
/* 04 · Identity vs projection shortcut                                */
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
    label(ctx, t.skip.main + "  F(x)", x0 + 60, yMain + 34, palette.muted, 10);
    // shortcut
    const sx0 = x0 + 30, sx1 = x1 - 30;
    ctx.strokeStyle = diff ? palette.accent2 : palette.mint; ctx.lineWidth = 2;
    if (diff) ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.moveTo(sx0, yMain); ctx.lineTo(sx0, ySkip); ctx.lineTo(sx1, ySkip); ctx.lineTo(sx1, yMain - 12); ctx.stroke();
    ctx.setLineDash([]);
    if (diff) {
      const pw = narrow ? 120 : 150, px = (sx0 + sx1) / 2 - pw / 2;
      ctx.fillStyle = palette.accent2; ctx.fillRect(px, ySkip - 16, pw, 32);
      label(ctx, t.skip.proj, px + pw / 2, ySkip, "#ffffff", 10, "center");
      label(ctx, "W_s x", px + pw + 8, ySkip, palette.accent2, 11);
    } else {
      label(ctx, "x  (identity)", (sx0 + sx1) / 2, ySkip - 12, palette.mint, 11, "center");
    }
    label(ctx, t.skip.shortcut, sx0 + 6, ySkip + 14, palette.muted, 10);
    // plus node
    glowDot(ctx, sx1, yMain, 9, palette.ink, 2);
    label(ctx, "+", sx1, yMain, "#ffffff", 13, "center");
    label(ctx, "ReLU", sx1 + 16, yMain - 18, palette.muted, 10);
    // shapes
    label(ctx, `x: ${inShape}`, x0, yMain - 30, palette.ink, 11);
    label(ctx, `F(x): ${outShape}`, sx1 - 12, yMain + 34, palette.ink, 11, "right");
    label(ctx, diff ? `W_s x: ${outShape}   ✓ 더할 수 있음` : `x: ${inShape}   ✓ 더할 수 있음`, sx1, ySkip + 30, diff ? palette.accent2 : palette.mint, 11, "right");
    label(ctx, diff ? "y = F(x) + W_s x" : "y = F(x) + x", x0, h - 20, palette.ink, 13);
    // flowing dots
    const p = (tt * 0.35) % 1;
    const mx = lerp(x0, sx1, p);
    glowDot(ctx, mx, yMain, 4, palette.accent, 3);
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
/* 05 · BatchNorm per channel                                          */
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
    const panelW = narrow ? w * 0.86 : w * 0.42, panelH = narrow ? h * 0.36 : h * 0.62;
    const p1x = narrow ? w * 0.07 : w * 0.05, p1y = narrow ? 24 : h * 0.16;
    const p2x = narrow ? p1x : w * 0.53, p2y = narrow ? h * 0.56 : p1y;
    const hist = (vals: number[], x: number, y: number, color: string, lo: number, hi: number, title: string, sub: string) => {
      const bins = 40, counts = new Array(bins).fill(0);
      vals.forEach((v) => { const b = Math.floor(((v - lo) / (hi - lo)) * bins); if (b >= 0 && b < bins) counts[b]++; });
      const mx = Math.max(...counts, 1);
      ctx.fillStyle = palette.track; ctx.fillRect(x, y, panelW, panelH);
      counts.forEach((c, b) => { const bh = (c / mx) * (panelH - 24); ctx.fillStyle = color; ctx.fillRect(x + (b / bins) * panelW + 1, y + panelH - bh, panelW / bins - 2, bh); });
      label(ctx, title, x, y - 12, palette.ink, 11);
      label(ctx, sub, x + panelW, y - 12, palette.muted, 10, "right");
      label(ctx, lo.toPrecision(3), x, y + panelH + 12, palette.muted, 9);
      label(ctx, hi.toPrecision(3), x + panelW, y + panelH + 12, palette.muted, 9, "right");
    };
    hist(xs, p1x, p1y, palette.normal, mu - 4 * sd, mu + 4 * sd, `${t.bn.raw} · ${CHANNELS[ch].name}`, `${t.bn.mean} = ${mu.toPrecision(3)}   ${t.bn.std} = ${sd.toPrecision(3)}`);
    const ys = xs.map((v) => gamma * ((v - mu) / sd) + beta);
    hist(ys, p2x, p2y, palette.accent, -5, 5, t.bn.norm, `γ = ${gamma.toFixed(2)}   β = ${beta.toFixed(2)}`);
    // zero line on normalized panel
    const zx = p2x + ((0 + 5) / 10) * panelW;
    ctx.strokeStyle = palette.dotOff; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(zx, p2y); ctx.lineTo(zx, p2y + panelH); ctx.stroke(); ctx.setLineDash([]);
    label(ctx, "0", zx, p2y + panelH + 12, palette.muted, 9, "center");
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
/* 06 · One block, actual order                                        */
/* ------------------------------------------------------------------ */

export function BlockOrderScene() {
  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const narrow = w < NARROW;
    const steps = ["1×1 Conv", "BN", "ReLU", "3×3 Conv", "BN", "ReLU", "1×1 Conv", "BN", "+ x", "ReLU"];
    const kinds = ["conv", "bn", "relu", "conv", "bn", "relu", "conv", "bn", "add", "relu"];
    const cols = narrow ? 2 : 1;
    const perCol = Math.ceil(steps.length / cols);
    const colW = (w - 40) / cols;
    const rowH = (h - 40) / perCol;
    const active = Math.floor((tt * 1.6) % (steps.length + 2));
    steps.forEach((s, i) => {
      const c = Math.floor(i / perCol), r = i % perCol;
      const x = 20 + c * colW + colW * 0.5, y = 20 + r * rowH + rowH / 2;
      const kind = kinds[i];
      const color = kind === "conv" ? palette.normal : kind === "bn" ? palette.accent : kind === "add" ? palette.mint : palette.excluded;
      const bw = narrow ? colW * 0.7 : Math.min(260, w * 0.4), bh = Math.min(26, rowH - 6);
      ctx.save();
      ctx.globalAlpha = i === active ? 1 : 0.55;
      ctx.fillStyle = color; ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh);
      if (i === active) { ctx.shadowColor = color; ctx.shadowBlur = 14; ctx.fillRect(x - bw / 2, y - bh / 2, bw, bh); }
      ctx.restore();
      label(ctx, s, x, y, "#ffffff", 11, "center");
      if (r < perCol - 1 && i < steps.length - 1) { ctx.strokeStyle = palette.dotOff; ctx.beginPath(); ctx.moveTo(x, y + bh / 2); ctx.lineTo(x, y + rowH - bh / 2); ctx.stroke(); }
    });
    // skip arc alongside column 0 from before step 0 to the add node
    const c0x = 20 + colW * 0.5;
    const addIdx = 8, addC = Math.floor(addIdx / perCol), addR = addIdx % perCol;
    const ax = 20 + addC * colW + colW * 0.5, ay = 20 + addR * rowH + rowH / 2;
    const bwSkip = narrow ? colW * 0.7 : Math.min(260, w * 0.4);
    ctx.strokeStyle = palette.mint; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(c0x - bwSkip / 2 - 6, 20 + rowH / 2 - 13);
    ctx.lineTo(c0x - bwSkip / 2 - 40, 20 + rowH / 2 - 13);
    ctx.lineTo(c0x - bwSkip / 2 - 40, narrow ? ay + 40 : ay);
    ctx.lineTo(ax - bwSkip / 2 - 6, narrow ? ay + 40 : ay);
    if (narrow) ctx.lineTo(ax - bwSkip / 2 - 6, ay);
    ctx.stroke();
    label(ctx, "x", c0x - bwSkip / 2 - 46, 20 + rowH / 2 - 13, palette.mint, 12, "right");
    // legend
    const lx = narrow ? 20 : w - 200, ly = narrow ? h - 14 : 30;
    [[palette.normal, "Conv"], [palette.accent, "BatchNorm"], [palette.excluded, "ReLU"], [palette.mint, "residual add"]].forEach(([c, n], j) => {
      const x = narrow ? lx + j * 85 : lx, y = narrow ? ly : ly + j * 18;
      ctx.fillStyle = c; ctx.fillRect(x, y - 4, 9, 9); label(ctx, n, x + 14, y, palette.muted, 10);
    });
  });
  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
    </div>
  );
}
