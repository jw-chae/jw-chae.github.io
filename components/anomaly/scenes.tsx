"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  clamp, dist2, drawGrid, easeOut, gauss, glowDot, heat, label, lerp, palette, rng, smooth, useCanvas, useInView, type Pt,
} from "./lib";

const NARROW = 560;

/* ------------------------------------------------------------------ */
/* Scene 0 · Hero: image → patch grid → feature cloud                   */
/* ------------------------------------------------------------------ */

type CellInfo = { r: number; g: number; b: number; defect: boolean; tx: number; ty: number; delay: number };

export function HeroScene({ src, mask28, labels }: { src: string; mask28: string[]; labels: [string, string, string, string, string] }) {
  const cellsRef = useRef<CellInfo[] | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => {
      const off = document.createElement("canvas");
      off.width = 392;
      off.height = 392;
      const c = off.getContext("2d");
      if (!c) return;
      c.drawImage(img, 0, 0, 392, 392);
      const data = c.getImageData(0, 0, 392, 392).data;
      const r = rng(7);
      const cells: CellInfo[] = [];
      let di = 0;
      for (let row = 0; row < 28; row++) {
        for (let col = 0; col < 28; col++) {
          let sr = 0, sg = 0, sb = 0;
          for (let y = 0; y < 14; y += 2) for (let x = 0; x < 14; x += 2) {
            const i = ((row * 14 + y) * 392 + col * 14 + x) * 4;
            sr += data[i]; sg += data[i + 1]; sb += data[i + 2];
          }
          const n = 49;
          const mr = sr / n, mg = sg / n, mb = sb / n;
          const defect = mask28[row]?.[col] === "1";
          const lum = (0.3 * mr + 0.59 * mg + 0.11 * mb) / 255;
          const chroma = (Math.max(mr, mg, mb) - Math.min(mr, mg, mb)) / 255;
          let tx: number, ty: number;
          if (defect) {
            const ang = -0.9 + (di++ % 7) * 0.32 + gauss(r) * 0.08;
            const rad = 0.86 + 0.2 * r();
            tx = Math.cos(ang) * rad; ty = Math.sin(ang) * rad;
          } else {
            // schematic embedding: brightness/chroma → position on a curved normal manifold
            const u = clamp(lum * 1.6 - 0.3 + gauss(r) * 0.12, -1, 1);
            const v = clamp((chroma - 0.25) * 2.2 + gauss(r) * 0.12, -1, 1);
            const ang = u * 1.4 - 0.4;
            const rad = 0.35 + 0.35 * (v * 0.5 + 0.5) + gauss(r) * 0.05;
            tx = Math.cos(ang) * rad - 0.25; ty = Math.sin(ang) * rad + 0.15;
          }
          cells.push({ r: mr, g: mg, b: mb, defect, tx, ty, delay: (row * 28 + col) / 784 });
        }
      }
      cellsRef.current = cells;
      imgRef.current = img;
    };
  }, [src, mask28]);

  const ref = useCanvas((ctx, w, h, t) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 44);
    const cells = cellsRef.current;
    const img = imgRef.current;
    const narrow = w < NARROW;
    const T = 13;
    const tt = t % T;
    const S = narrow ? Math.min(h * 0.42, w * 0.42) : Math.min(h - 56, w * 0.36);
    const x0 = narrow ? w * 0.06 : w * 0.08, y0 = narrow ? h * 0.06 : (h - S) / 2;
    const cx = narrow ? w * 0.55 : w * 0.7, cy = narrow ? h * 0.72 : h * 0.5;
    // keep the anomalous arc (radius up to ~1.06 R) and its label inside the canvas
    const R = Math.min(narrow ? Math.min(w * 0.36, h * 0.2) : Math.min(S * 0.55, w * 0.22), (cy - 30) / 1.08, (w - cx - 8) / 1.08);
    const cell = S / 28;

    const showImg = smooth(0, 1.2, tt) * (1 - smooth(11.6, 12.8, tt));
    const gridP = smooth(1.4, 3.2, tt) * (1 - smooth(11.2, 12.4, tt));
    const flyP = smooth(3.6, 7.8, tt);
    const cloudP = smooth(7.6, 9.2, tt) * (1 - smooth(11.4, 12.6, tt));
    const back = smooth(11.4, 12.8, tt);

    if (img && showImg > 0) {
      ctx.save();
      ctx.globalAlpha = showImg * (1 - flyP * 0.75);
      ctx.drawImage(img, x0, y0, S, S);
      ctx.restore();
    }
    if (gridP > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(${palette.memoryRgb},${0.55 * gridP * (1 - flyP * 0.6)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 28; i++) {
        const p = i / 28;
        if (p <= gridP) {
          ctx.moveTo(x0 + i * cell, y0); ctx.lineTo(x0 + i * cell, y0 + S);
          ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + S, y0 + i * cell);
        }
      }
      ctx.stroke();
      ctx.restore();
    }
    if (narrow) label(ctx, labels[0], x0, y0 + S + 16, palette.muted, 10);
    else label(ctx, labels[0], x0 + S / 2, y0 + S + 16, palette.muted, 11, "center");
    if (flyP > 0.05 || cloudP > 0) label(ctx, labels[2], cx, cy + R + 28, palette.muted, 11, "center");
    if (gridP > 0.5 && flyP < 0.4) label(ctx, labels[1], x0 + S / 2, y0 - 12, palette.memory, 11, "center");

    const anomalyPulse = 0.5 + 0.5 * Math.sin(t * 4);
    const dotR = Math.max(2, cell * 0.28);
    if (cells && gridP > 0 && flyP <= 0) {
      // grid phase: mark the tokens that overlap the ground-truth defect on the image itself
      ctx.save();
      ctx.globalAlpha = gridP;
      for (let i = 0; i < cells.length; i++) {
        if (!cells[i].defect) continue;
        const row = Math.floor(i / 28), col = i % 28;
        glowDot(ctx, x0 + col * cell + cell / 2, y0 + row * cell + cell / 2, dotR + 0.6 * anomalyPulse, palette.anomaly, 4);
      }
      ctx.restore();
    }

    if (cells && (flyP > 0 || back < 1)) {
      for (let i = 0; i < cells.length; i++) {
        const c = cells[i];
        const row = Math.floor(i / 28), col = i % 28;
        const sx = x0 + col * cell + cell / 2, sy = y0 + row * cell + cell / 2;
        const ex = cx + c.tx * R, ey = cy + c.ty * R;
        const local = clamp((flyP - c.delay * 0.55) / 0.45, 0, 1);
        const p = easeOut(local) * (1 - back);
        if (p <= 0 && flyP <= 0) continue;
        const mx = (sx + ex) / 2, my = Math.min(sy, ey) - 36 - (i % 9) * 4;
        const x = (1 - p) * (1 - p) * sx + 2 * (1 - p) * p * mx + p * p * ex;
        const y = (1 - p) * (1 - p) * sy + 2 * (1 - p) * p * my + p * p * ey;
        const size = lerp(cell * 0.9, 5, p);
        if (c.defect) {
          glowDot(ctx, x, y, lerp(dotR, 4, p) + 2 * anomalyPulse * Math.max(p, 0.3), palette.anomaly, 5);
        } else {
          ctx.save();
          if (p > 0.85) {
            ctx.fillStyle = `rgba(${palette.normalRgb},${0.55 + 0.45 * cloudP})`;
            ctx.beginPath(); ctx.arc(x, y, 2.6, 0, Math.PI * 2); ctx.fill();
          } else {
            ctx.fillStyle = `rgb(${c.r | 0},${c.g | 0},${c.b | 0})`;
            ctx.fillRect(x - size / 2, y - size / 2, size, size);
          }
          ctx.restore();
        }
      }
      if (cloudP > 0) {
        ctx.save();
        ctx.globalAlpha = cloudP;
        ctx.strokeStyle = `rgba(${palette.memoryRgb},0.35)`;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.ellipse(cx - R * 0.25, cy + R * 0.15, R * 0.72, R * 0.62, -0.35, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        label(ctx, labels[3], cx - R * 0.25, cy + R * 0.15 + R * 0.62 + 14, `rgba(${palette.memoryRgb},${cloudP})`, 11, "center");
        label(ctx, labels[4], cx + R * 0.62, cy - R * 1.02 - 14, `rgba(${palette.anomalyRgb},${cloudP})`, 11, "center");
      }
    }
  }, { still: 9.4 });
  return <canvas ref={ref} className="ad-canvas ad-canvas-hero" aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Scene 2 · Coreset memory + contamination amplification              */
/* ------------------------------------------------------------------ */

type Cand = Pt & { bad: boolean };

function makeCandidates(): Cand[] {
  const r = rng(21);
  const pts: Cand[] = [];
  const blobs = [
    { x: -0.55, y: -0.25, sx: 0.16, sy: 0.1, n: 190 },
    { x: -0.15, y: 0.3, sx: 0.14, sy: 0.14, n: 170 },
    { x: 0.3, y: -0.35, sx: 0.12, sy: 0.16, n: 150 },
    { x: 0.55, y: 0.25, sx: 0.15, sy: 0.1, n: 150 },
    { x: 0.05, y: -0.05, sx: 0.28, sy: 0.08, n: 120 },
  ];
  for (const b of blobs) for (let i = 0; i < b.n; i++) pts.push({ x: b.x + gauss(r) * b.sx, y: b.y + gauss(r) * b.sy, bad: false });
  const bad: Pt[] = [
    { x: -0.85, y: 0.55 }, { x: 0.9, y: -0.8 }, { x: -0.2, y: -0.85 }, { x: 0.85, y: 0.8 }, { x: -0.9, y: -0.75 },
    { x: 0.35, y: 0.85 }, { x: -0.55, y: 0.9 }, { x: 0.95, y: -0.2 }, { x: -0.95, y: 0.05 }, { x: 0.15, y: -0.6 },
    { x: 0.6, y: 0.62 }, { x: -0.4, y: 0.62 }, { x: 0.02, y: 0.62 }, { x: -0.7, y: -0.55 },
  ];
  for (const b of bad) pts.push({ x: b.x + gauss(r) * 0.03, y: b.y + gauss(r) * 0.03, bad: true });
  return pts;
}

function farthestFirst(pts: Pt[], K: number, seed: number): number[] {
  const r = rng(seed);
  const n = pts.length;
  const order: number[] = [];
  const dmin = new Float64Array(n).fill(Infinity);
  let cur = Math.floor(r() * n);
  for (let k = 0; k < K; k++) {
    order.push(cur);
    let best = -1, bd = -1;
    for (let i = 0; i < n; i++) {
      const d = dist2(pts[i], pts[cur]);
      if (d < dmin[i]) dmin[i] = d;
      if (dmin[i] > bd) { bd = dmin[i]; best = i; }
    }
    cur = best;
  }
  return order;
}

function shuffled(n: number, seed: number): number[] {
  const r = rng(seed);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export type MemoryCopy = { budget: string; selector: string; global: string; random: string; replay: string; stats: [string, string, string, string] };

export function MemoryScene({ t }: { t: MemoryCopy }) {
  const [budget, setBudget] = useState(2);
  const [selector, setSelector] = useState<"global" | "random">("global");
  const [epoch, setEpoch] = useState(0);
  const pts = useMemo(() => makeCandidates(), []);
  const N = pts.length;
  const K = Math.max(1, Math.round((budget / 100) * N));
  const order = useMemo(() => (selector === "global" ? farthestFirst(pts, N, 3) : shuffled(N, 5 + epoch)), [pts, N, selector, epoch]);
  const startRef = useRef(0);
  useEffect(() => { startRef.current = performance.now(); }, [budget, selector, epoch]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const narrow = w < NARROW;
    const elapsed = (performance.now() - startRef.current) / 1000;
    const nSel = Math.min(K, Math.floor(elapsed * 14));
    const cx = narrow ? w / 2 : w * 0.34, cy = narrow ? h * 0.34 : h / 2;
    const R = narrow ? Math.min(w * 0.44, h * 0.29) : Math.min(w * 0.3, h * 0.45);
    const P = (p: Pt) => ({ x: cx + p.x * R, y: cy + p.y * R });
    for (const p of pts) {
      const q = P(p);
      ctx.fillStyle = p.bad ? palette.anomalySoft : palette.normalSoft;
      ctx.beginPath(); ctx.arc(q.x, q.y, p.bad ? 3.2 : 2.2, 0, Math.PI * 2); ctx.fill();
    }
    let badSel = 0;
    for (let i = 0; i < nSel; i++) {
      const p = pts[order[i]];
      const q = P(p);
      if (p.bad) badSel++;
      const fresh = i === nSel - 1;
      glowDot(ctx, q.x, q.y, fresh ? 5 : 3.4, p.bad ? palette.anomaly : palette.memory, fresh ? 5 : 2);
      if (fresh) {
        const pulse = (elapsed * 14) % 1;
        ctx.strokeStyle = p.bad ? `rgba(${palette.anomalyRgb},${1 - pulse})` : `rgba(${palette.memoryRgb},${1 - pulse})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(q.x, q.y, 6 + pulse * 22, 0, Math.PI * 2); ctx.stroke();
      }
    }
    const nBad = pts.filter((p) => p.bad).length;
    const pPool = nBad / N;
    const pMem = nSel > 0 ? badSel / nSel : 0;
    const A = pPool > 0 && nSel > 0 ? pMem / pPool : 0;
    const px = narrow ? w * 0.08 : w * 0.7, py = narrow ? h * 0.66 : h * 0.5 - 76;
    const gap = narrow ? 34 : 40;
    const rows: [string, string, string][] = [
      [t.stats[0], `${nSel} / ${K}`, palette.memory],
      [t.stats[1], `${badSel} / ${nBad}`, palette.anomaly],
      [t.stats[2], `${(pMem * 100).toFixed(1)}%  vs  ${(pPool * 100).toFixed(1)}%`, palette.ink],
      [t.stats[3], `${A.toFixed(1)}×`, A > 3 ? palette.accent : palette.ink],
    ];
    rows.forEach(([k, v, col], i) => {
      label(ctx, k, px, py + i * gap, palette.muted, 11);
      label(ctx, v, px, py + i * gap + 16, col, 15);
    });
    const bw = narrow ? w * 0.84 : w * 0.25, by = py + 4 * gap + 4;
    ctx.fillStyle = palette.track2; ctx.fillRect(px, by, bw, 8);
    ctx.fillStyle = A > 3 ? palette.accent : palette.memory;
    ctx.fillRect(px, by, clamp(A / 30, 0, 1) * bw, 8);
    label(ctx, "A_K = 1", px + bw / 30, by + 20, palette.muted, 10, "center");
    label(ctx, "30×", px + bw, by + 20, palette.muted, 10, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{t.budget} <b>{budget}%</b> (K = {K})</span>
          <input type="range" min={1} max={10} step={1} value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={t.selector}>
          <span>{t.selector}</span>
          <button type="button" className={selector === "global" ? "on" : ""} onClick={() => setSelector("global")}>{t.global}</button>
          <button type="button" className={selector === "random" ? "on" : ""} onClick={() => setSelector("random")}>{t.random}</button>
        </div>
        <button type="button" className="ad-btn" onClick={() => setEpoch((e) => e + 1)}>{t.replay}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scene 3 · Hard NN vs soft local projection (ProCon)                 */
/* ------------------------------------------------------------------ */

function makeAnchors(): Pt[] {
  const r = rng(11);
  const pts: Pt[] = [];
  for (let i = 0; i < 150; i++) {
    const a = -0.35 + r() * 1.7;
    const rad = 0.62 + gauss(r) * 0.045;
    pts.push({ x: Math.cos(a) * rad - 0.2, y: Math.sin(a) * rad * 0.8 - 0.15 });
  }
  for (let i = 0; i < 40; i++) pts.push({ x: -0.55 + gauss(r) * 0.08, y: -0.5 + gauss(r) * 0.06 });
  pts.push({ x: 0.72, y: -0.62 });
  return pts;
}

export type ProjectionCopy = { k: string; preset: string; free: string; hard: string; soft: string; ratio: string; stray: string };

export function ProjectionScene({ t }: { t: ProjectionCopy }) {
  const anchors = useMemo(() => makeAnchors(), []);
  const [k, setK] = useState(5);
  const [mode, setMode] = useState<"free" | "preset">("free");
  const pointer = useRef<Pt | null>(null);

  const ref = useCanvas((ctx, w, h, t0) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const narrow = w < NARROW;
    const cx = narrow ? w / 2 : w * 0.36, cy = narrow ? h * 0.33 : h * 0.52;
    const R = narrow ? Math.min(w * 0.42, h * 0.28) : Math.min(w * 0.3, h * 0.5);
    const P = (p: Pt) => ({ x: cx + p.x * R, y: cy + p.y * R });
    let z: Pt;
    if (mode === "preset") z = { x: 0.66, y: -0.56 };
    else if (pointer.current) z = { x: (pointer.current.x - cx) / R, y: (pointer.current.y - cy) / R };
    else z = { x: 0.15 + 0.55 * Math.cos(t0 * 0.5), y: -0.05 + 0.45 * Math.sin(t0 * 0.37) };
    const d = anchors.map((a, i) => ({ i, d2: dist2(a, z) })).sort((a, b) => a.d2 - b.d2);
    const nn = d.slice(0, k);
    const tau = nn[Math.floor((nn.length - 1) / 2)].d2 + 1e-9;
    const wts = nn.map((n) => Math.exp(-n.d2 / tau));
    const Z = wts.reduce((s, v) => s + v, 0);
    const zh: Pt = { x: 0, y: 0 };
    nn.forEach((n, j) => { zh.x += (wts[j] / Z) * anchors[n.i].x; zh.y += (wts[j] / Z) * anchors[n.i].y; });
    const sNN = Math.sqrt(d[0].d2);
    const res = Math.sqrt(dist2(z, zh));
    for (let i = 0; i < anchors.length; i++) {
      const q = P(anchors[i]);
      const stray = i === anchors.length - 1;
      ctx.fillStyle = stray ? palette.stray : palette.normalSoft;
      ctx.beginPath(); ctx.arc(q.x, q.y, stray ? 4 : 2.6, 0, Math.PI * 2); ctx.fill();
    }
    const zq = P(z), zhq = P(zh);
    nn.forEach((n, j) => {
      const q = P(anchors[n.i]);
      ctx.strokeStyle = `rgba(${palette.memoryRgb},${0.15 + 0.85 * (wts[j] / Z)})`;
      ctx.lineWidth = 0.5 + 5 * (wts[j] / Z);
      ctx.beginPath(); ctx.moveTo(zq.x, zq.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      glowDot(ctx, q.x, q.y, 3.5, palette.memory, 2);
    });
    const hq = P(anchors[d[0].i]);
    ctx.setLineDash([5, 5]); ctx.strokeStyle = palette.accent2; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(zq.x, zq.y); ctx.lineTo(hq.x, hq.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = palette.accent; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(zq.x, zq.y); ctx.lineTo(zhq.x, zhq.y); ctx.stroke();
    glowDot(ctx, zhq.x, zhq.y, 5, palette.accent, 4);
    glowDot(ctx, zq.x, zq.y, 6, palette.ink, 3);
    label(ctx, "z", zq.x + 10, zq.y - 10, palette.ink, 13);
    label(ctx, "ẑ", zhq.x + 10, zhq.y + 12, palette.accent, 13);
    const sq = P(anchors[anchors.length - 1]);
    label(ctx, t.stray, sq.x, sq.y + 16, palette.accent2, 10, "center");
    const px = narrow ? w * 0.08 : w * 0.7, py = narrow ? h * 0.66 : h * 0.5 - 66;
    label(ctx, t.hard, px, py, palette.accent2, 11);
    label(ctx, `s_NN = ${sNN.toFixed(3)}`, px, py + 18, palette.ink, 15);
    label(ctx, t.soft, px, py + 48, palette.accent, 11);
    label(ctx, `r = ${res.toFixed(3)}`, px, py + 66, palette.ink, 15);
    label(ctx, t.ratio, px, py + 96, palette.muted, 11);
    const ratio = res / Math.max(sNN, 1e-6);
    label(ctx, `r / s_NN = ${ratio.toFixed(2)}`, px, py + 114, ratio > 1.5 ? palette.anomaly : palette.ink, 15);
    label(ctx, `k = ${k}   τ = median d² = ${tau.toFixed(3)}`, px, py + 140, palette.muted, 10);
  });

  return (
    <div
      className="ad-scene"
      onPointerMove={(e) => {
        if (mode !== "free") return;
        const canvas = e.currentTarget.querySelector("canvas");
        if (!canvas) return;
        const r = canvas.getBoundingClientRect();
        pointer.current = { x: e.clientX - r.left, y: e.clientY - r.top };
      }}
      onPointerLeave={() => { pointer.current = null; }}
    >
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{t.k} <b>k = {k}</b></span>
          <input type="range" min={1} max={8} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group">
          <button type="button" className={mode === "free" ? "on" : ""} onClick={() => setMode("free")}>{t.free}</button>
          <button type="button" className={mode === "preset" ? "on" : ""} onClick={() => setMode("preset")}>{t.preset}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scene 4 · Bank-wise consensus: min / mean / median over banks       */
/* ------------------------------------------------------------------ */

function blob(map: Float32Array, cx: number, cy: number, s: number, amp: number) {
  for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
    const d = ((x - cx) ** 2 + (y - cy) ** 2) / (2 * s * s);
    map[y * 28 + x] += amp * Math.exp(-d);
  }
}

function makeBanks(B: number): Float32Array[] {
  const r = rng(31);
  const banks: Float32Array[] = [];
  for (let b = 0; b < B; b++) {
    const m = new Float32Array(784);
    for (let i = 0; i < 784; i++) m[i] = 0.06 + 0.07 * r();
    blob(m, 9, 17, 1.6, 0.85);
    if (b === 1) blob(m, 20, 7, 1.3, 0.95);
    if (b === 3) blob(m, 21, 21, 1.1, 0.7);
    if (b === 4) blob(m, 5, 5, 1.0, 0.5);
    banks.push(m);
  }
  return banks;
}

function drawHeat(ctx: CanvasRenderingContext2D, m: Float32Array, x: number, y: number, size: number, alpha = 1) {
  const c = size / 28;
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 784; i++) {
    ctx.fillStyle = heat(m[i]);
    ctx.fillRect(x + (i % 28) * c, y + Math.floor(i / 28) * c, c + 0.5, c + 0.5);
  }
  ctx.restore();
}

function topMean(m: Float32Array, frac = 0.005) {
  const k = Math.max(1, Math.round(784 * frac));
  const s = Array.from(m).sort((a, b) => b - a).slice(0, k);
  return s.reduce((a, b) => a + b, 0) / k;
}

export type ConsensusCopy = { rule: string; min: string; mean: string; median: string; bank: string; score: string };

export function ConsensusScene({ t }: { t: ConsensusCopy }) {
  const banks = useMemo(() => makeBanks(5), []);
  const [rule, setRule] = useState<"min" | "mean" | "median">("median");
  const { ref: box, inView } = useInView<HTMLDivElement>(0.3);
  const t0 = useRef<number | null>(null);
  const agg = useMemo(() => {
    const out = new Float32Array(784);
    for (let i = 0; i < 784; i++) {
      const v = banks.map((b) => b[i]).sort((a, b) => a - b);
      out[i] = rule === "min" ? v[0] : rule === "mean" ? v.reduce((a, b) => a + b, 0) / v.length : v[2];
    }
    return out;
  }, [banks, rule]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    if (inView && t0.current === null) t0.current = performance.now();
    const el = t0.current === null ? 0 : (performance.now() - t0.current) / 1000;
    const gap = 10;
    const tile = Math.min((w - 48 - 4 * gap) / 5, 96);
    const x0 = (w - (5 * tile + 4 * gap)) / 2, y0 = 20;
    banks.forEach((b, i) => {
      const a = smooth(i * 0.35, i * 0.35 + 0.6, el);
      if (a <= 0) return;
      const x = x0 + i * (tile + gap);
      drawHeat(ctx, b, x, y0, tile, a);
      label(ctx, `${t.bank} ${i + 1}`, x + tile / 2, y0 + tile + 12, palette.muted, 10, "center");
      label(ctx, topMean(b).toFixed(2), x + tile / 2, y0 + tile + 26, i === 1 ? palette.anomaly : palette.ink, 11, "center");
    });
    label(ctx, `${t.score} (top 0.5%)`, w / 2, y0 + tile + 44, palette.muted, 10, "center");
    const by = y0 + tile + 62;
    const big = Math.min(h - by - 44, w * 0.5);
    const bx = (w - big) / 2;
    const a2 = smooth(2.2, 3.0, el);
    if (a2 > 0) {
      label(ctx, "▼", w / 2, by - 8, `rgba(${palette.inkRgb},${0.5 * a2})`, 11, "center");
      drawHeat(ctx, agg, bx, by, big, a2);
      ctx.strokeStyle = palette.accent; ctx.lineWidth = 2; ctx.strokeRect(bx - 1, by - 1, big + 2, big + 2);
      label(ctx, `${rule}_b R_b(p)`, bx + big / 2, by + big + 14, palette.accent, 12, "center");
      label(ctx, `${t.score} ${topMean(agg).toFixed(2)}`, bx + big / 2, by + big + 30, palette.ink, 12, "center");
    }
  });

  return (
    <div className="ad-scene" ref={box}>
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={t.rule}>
          <span>{t.rule}</span>
          {(["min", "mean", "median"] as const).map((r) => (
            <button key={r} type="button" className={rule === r ? "on" : ""} onClick={() => setRule(r)}>{t[r]}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scene 5 · Map → score: max pooling vs structural descriptor         */
/* ------------------------------------------------------------------ */

function descriptor(m: Float32Array) {
  const n = 784;
  const mean = m.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(m.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  const top = topMean(m, 0.01);
  let tv = 0;
  for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
    if (x < 27) tv += Math.abs(m[y * 28 + x + 1] - m[y * 28 + x]);
    if (y < 27) tv += Math.abs(m[(y + 1) * 28 + x] - m[y * 28 + x]);
  }
  return [sd, top, tv / n];
}

function normalMap(seed: number) {
  const r = rng(seed);
  const m = new Float32Array(784);
  for (let i = 0; i < 784; i++) m[i] = 0.05 + 0.08 * r();
  blob(m, 4 + Math.floor(r() * 20), 4 + Math.floor(r() * 20), 0.9, 0.85 + 0.15 * r());
  return m;
}

export type MapCopy = { extent: string; normal: string; anomalous: string; max: string; dims: [string, string, string]; struct: string };

export function MapToScoreScene({ t }: { t: MapCopy }) {
  const [extent, setExtent] = useState(3);
  const normals = useMemo(() => Array.from({ length: 60 }, (_, i) => normalMap(100 + i)), []);
  const stats = useMemo(() => {
    const ds = normals.map(descriptor);
    const mu = [0, 1, 2].map((d) => ds.reduce((a, v) => a + v[d], 0) / ds.length);
    const sd = [0, 1, 2].map((d) => Math.sqrt(ds.reduce((a, v) => a + (v[d] - mu[d]) ** 2, 0) / ds.length) + 1e-6);
    return { mu, sd };
  }, [normals]);
  const mapA = useMemo(() => normalMap(7), []);
  const mapB = useMemo(() => {
    const r = rng(9);
    const m = new Float32Array(784);
    for (let i = 0; i < 784; i++) m[i] = 0.05 + 0.08 * r();
    for (let k = 0; k < extent * 2 + 1; k++) blob(m, 8 + k * 1.4 + (k % 2) * 1.5, 18 - k * 0.9, 1.1, 0.55);
    const mx = Math.max(...Array.from(m));
    const target = Math.max(...Array.from(mapA));
    for (let i = 0; i < 784; i++) m[i] = 0.05 + (m[i] - 0.05) * ((target - 0.05) / (mx - 0.05));
    return m;
  }, [extent, mapA]);
  const { ref: box, inView } = useInView<HTMLDivElement>(0.3);
  const t0 = useRef<number | null>(null);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    if (inView && t0.current === null) t0.current = performance.now();
    const el = t0.current === null ? 0 : (performance.now() - t0.current) / 1000;
    const size = Math.min((w - 72) / 2, h * 0.38, 200);
    const xs = (w - (2 * size + 24)) / 2, y0 = 18;
    const maps: [Float32Array, string, number][] = [[mapA, t.normal, xs], [mapB, t.anomalous, xs + size + 24]];
    const zs: number[][] = [];
    maps.forEach(([m, name, x]) => {
      drawHeat(ctx, m, x, y0, size);
      label(ctx, name, x + size / 2, y0 + size + 14, palette.ink, 12, "center");
      const mx = Math.max(...Array.from(m));
      label(ctx, `${t.max} = ${mx.toFixed(2)}`, x + size / 2, y0 + size + 30, palette.accent2, 11, "center");
      const d = descriptor(m);
      zs.push(d.map((v, i) => (v - stats.mu[i]) / stats.sd[i]));
    });
    const bx = w * 0.06, bw = w * 0.88, yb = y0 + size + 52;
    const rowH = Math.min(52, (h - yb - 44) / 3);
    const maxZ = 20;
    t.dims.forEach((name, d) => {
      const y = yb + d * rowH;
      label(ctx, name, bx, y, palette.muted, 11);
      const zn = Math.abs(zs[0][d]), za = Math.abs(zs[1][d]);
      const a = smooth(0.3 + d * 0.25, 0.9 + d * 0.25, el);
      label(ctx, `|z|  ${(zn * a).toFixed(1)}  vs  ${(za * a).toFixed(1)}`, bx + bw, y, palette.ink, 10, "right");
      [zn, za].forEach((z, mi) => {
        const yy = y + 12 + mi * 12;
        ctx.fillStyle = palette.track; ctx.fillRect(bx, yy, bw, 8);
        ctx.fillStyle = mi === 0 ? palette.normal : palette.anomaly;
        ctx.fillRect(bx, yy, clamp(z / maxZ, 0, 1) * bw * a, 8);
      });
    });
    const D = zs.map((z) => Math.max(...z.map(Math.abs)));
    const yD = yb + 3 * rowH + 4;
    label(ctx, t.struct, bx, yD, palette.accent, 12);
    label(ctx, `${t.normal} ${D[0].toFixed(1)}   ·   ${t.anomalous} ${D[1].toFixed(1)}`, bx, yD + 18, palette.ink, 12);
  });

  return (
    <div className="ad-scene" ref={box}>
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{t.extent} <b>{extent}</b></span>
          <input type="range" min={1} max={6} step={1} value={extent} onChange={(e) => setExtent(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scene 6 · Geometry-consistent routing (GCR)                         */
/* ------------------------------------------------------------------ */

export type RoutingCopy = { heads: string[]; mean: string; topq: string; routed: string; wrong: string; patches: string };

export function RoutingScene({ t }: { t: RoutingCopy }) {
  const data = useMemo(() => {
    const r = rng(41);
    const centers: Pt[] = [{ x: -0.6, y: -0.35 }, { x: 0.05, y: 0.05 }, { x: 0.62, y: 0.35 }, { x: -0.35, y: 0.62 }];
    const spread = [0.1, 0.09, 0.18, 0.11];
    const protos = centers.map((c, i) => Array.from({ length: 34 }, () => ({ x: c.x + gauss(r) * spread[i], y: c.y + gauss(r) * spread[i] })));
    const patches: Pt[] = Array.from({ length: 28 }, () => ({ x: 0.05 + gauss(r) * 0.08, y: 0.05 + gauss(r) * 0.08 }));
    for (let i = 0; i < 4; i++) patches.push({ x: 0.5 + gauss(r) * 0.05, y: 0.55 + gauss(r) * 0.05 });
    return { centers, protos, patches };
  }, []);
  const { ref: box, inView } = useInView<HTMLDivElement>(0.3);
  const t0 = useRef<number | null>(null);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    if (inView && t0.current === null) t0.current = performance.now();
    const el = t0.current === null ? 0 : (performance.now() - t0.current) / 1000;
    const narrow = w < NARROW;
    const cx = narrow ? w / 2 : w * 0.34, cy = narrow ? h * 0.3 : h / 2;
    const R = narrow ? Math.min(w * 0.42, h * 0.26) : Math.min(w * 0.3, h * 0.46);
    const P = (p: Pt) => ({ x: cx + p.x * R, y: cy + p.y * R });
    const cols = [palette.normal, palette.memory, palette.accent2, palette.mint];
    data.protos.forEach((ps, hi) => {
      ctx.save();
      ctx.globalAlpha = 0.55;
      ps.forEach((p) => { const q = P(p); ctx.fillStyle = cols[hi]; ctx.beginPath(); ctx.arc(q.x, q.y, 2.6, 0, Math.PI * 2); ctx.fill(); });
      ctx.restore();
      const c = P(data.centers[hi]);
      label(ctx, t.heads[hi], c.x, c.y - R * 0.16 - 8, cols[hi], 11, "center");
    });
    const nShow = Math.min(32, Math.floor(el * 10));
    const per = data.protos.map(() => ({ sum: 0, max: 0 }));
    for (let i = 0; i < nShow; i++) {
      const p = data.patches[i];
      const q = P(p);
      data.protos.forEach((ps, hi) => {
        let d = Infinity;
        for (const m of ps) d = Math.min(d, dist2(p, m));
        per[hi].sum += d; per[hi].max = Math.max(per[hi].max, d);
      });
      const bad = i >= 28;
      glowDot(ctx, q.x, q.y, bad ? 4.5 : 3.2, bad ? palette.anomaly : palette.ink, 2);
    }
    const bx = narrow ? w * 0.08 : w * 0.68, bw = narrow ? w * 0.84 : w * 0.28;
    const y0 = narrow ? h * 0.56 : h * 0.5 - 112;
    const rowGap = narrow ? 104 : 124, barGap = narrow ? 20 : 22;
    const rows: [string, (i: number) => number][] = [[t.mean, (i) => per[i].sum / Math.max(nShow, 1)], [t.topq, (i) => per[i].max]];
    rows.forEach(([name, f], ri) => {
      const yy = y0 + ri * rowGap;
      label(ctx, name, bx, yy, palette.ink, 11);
      const vals = data.protos.map((_, i) => f(i));
      const mx = Math.max(...vals, 1e-6);
      const arg = vals.indexOf(Math.min(...vals));
      vals.forEach((v, i) => {
        const y = yy + 16 + i * barGap;
        ctx.fillStyle = palette.track; ctx.fillRect(bx, y, bw, 10);
        ctx.fillStyle = cols[i]; ctx.fillRect(bx, y, (v / mx) * bw, 10);
        if (nShow > 0 && i === arg) {
          const ok = arg === 1;
          const len = (v / mx) * bw;
          const txt = ok ? `← ${t.routed}` : `← ${t.wrong}`;
          if (len > bw * 0.55) label(ctx, txt, bx + bw, y + 5, ok ? palette.accent : palette.anomaly, 10, "right");
          else label(ctx, txt, bx + len + 8, y + 5, ok ? palette.accent : palette.anomaly, 10);
        }
      });
    });
    label(ctx, `${nShow} / 32 ${t.patches}`, bx, y0 + 2 * rowGap - 6, palette.muted, 10);
  });

  return (
    <div className="ad-scene" ref={box}>
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scene · Candidate eligibility (CLEANCON out-of-bag gate)             */
/* ------------------------------------------------------------------ */

export type EligibilityCopy = { gate: string; retain: string; kept: string; dropped: string; badKept: string; legend: [string, string, string] };

export function EligibilityScene({ t }: { t: EligibilityCopy }) {
  const [retain, setRetain] = useState(50);
  const imgs = useMemo(() => {
    const r = rng(51);
    const arr = Array.from({ length: 26 }, (_, i) => ({ i, bad: false, rare: false, a: 0.22 + r() * 0.3 }));
    [4, 21].forEach((i) => { arr[i].bad = true; arr[i].a = 0.65 + r() * 0.3; });
    arr[13].bad = true; arr[13].a = 0.47;               // a contaminated image whose OOB score is only mildly high
    arr[17].rare = true; arr[17].a = 0.6;               // a rare-but-normal image that also scores high
    return arr;
  }, []);
  const sorted = useMemo(() => [...imgs].sort((a, b) => a.a - b.a), [imgs]);
  const { ref: box, inView } = useInView<HTMLDivElement>(0.3);
  const t0 = useRef<number | null>(null);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    if (inView && t0.current === null) t0.current = performance.now();
    const el = t0.current === null ? 0 : (performance.now() - t0.current) / 1000;
    const narrow = w < NARROW;
    const lx = w * 0.07, lw = w * 0.86, ly = h * 0.16, lh = h * 0.56;
    const n = sorted.length;
    const keepN = Math.round((retain / 100) * n);
    const colW = lw / n;
    const sortP = smooth(1.6, 2.8, el);
    imgs.forEach((im, idx) => {
      const rank = sorted.indexOf(im);
      const x = lx + lerp(idx, rank, sortP) * colW;
      const grow = smooth(idx * 0.04, idx * 0.04 + 0.6, el);
      const bh = im.a * lh * grow;
      const kept = rank < keepN;
      const base = im.bad ? palette.anomaly : im.rare ? palette.mint : palette.memory;
      ctx.save();
      ctx.globalAlpha = kept ? 1 : 0.32;
      ctx.fillStyle = base;
      ctx.fillRect(x + 2, ly + lh - bh, colW - 4, bh);
      ctx.restore();
      // tiny "image" tile under each bar
      ctx.fillStyle = kept ? base : palette.dotOff;
      ctx.fillRect(x + 2, ly + lh + 6, colW - 4, 6);
    });
    const gateP = smooth(2.9, 3.5, el);
    if (gateP > 0) {
      const gx = lx + keepN * colW;
      ctx.strokeStyle = `rgba(${palette.accentRgb},${gateP})`; ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(gx, ly - 6); ctx.lineTo(gx, ly + lh + 14); ctx.stroke(); ctx.setLineDash([]);
      label(ctx, `${t.retain} ${retain}%`, gx, ly - 16, palette.accent, 11, "center");
      const badKept = sorted.slice(0, keepN).filter((s) => s.bad).length;
      label(ctx, `${t.kept}: ${keepN}   ${t.dropped}: ${n - keepN}   ${t.badKept}: ${badKept}`, lx, ly + lh + 30, badKept > 0 ? palette.anomaly : palette.muted, 11);
    }
    label(ctx, t.gate, lx, ly - 40, palette.ink, narrow ? 10 : 12);
    label(ctx, "a_i = TopMean_0.5%( median_b r_{i,p,b} )", lx, ly + lh + 48, palette.muted, 10);
    // legend
    const ly2 = ly + lh + (narrow ? 68 : 66);
    [[palette.memory, t.legend[0]], [palette.anomaly, t.legend[1]], [palette.mint, t.legend[2]]].forEach(([c, name], j) => {
      const x = lx + j * (narrow ? w * 0.28 : 150);
      ctx.fillStyle = c; ctx.fillRect(x, ly2 - 4, 9, 9);
      label(ctx, name, x + 14, ly2, palette.muted, 10);
    });
  });

  return (
    <div className="ad-scene" ref={box}>
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{t.retain} <b>R = {retain}%</b></span>
          <input type="range" min={50} max={90} step={10} value={retain} onChange={(e) => setRetain(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Scene · Missing support (BoundarySupport ring)                       */
/* ------------------------------------------------------------------ */

export type SupportCopy = { steps: [string, string, string, string, string]; step: string; auto: string; ring: string; excluded: string };

export function SupportScene({ t }: { t: SupportCopy }) {
  const [auto, setAuto] = useState(true);
  const [manual, setManual] = useState(0);
  const masks = useMemo(() => {
    const A = new Uint8Array(784), D = new Uint8Array(784), C = new Uint8Array(784), Rg = new Uint8Array(784);
    for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
      const i = y * 28 + x;
      const dA = Math.hypot(x - 13.5, y - 13.5);
      if (dA < 3.2 || (Math.abs(x - 13.5) < 1.2 && Math.abs(y - 13.5) < 6)) A[i] = 1;
      const dD = Math.hypot(x - 14.3, y - 13.2);
      if (dD < 4.3 && !A[i]) D[i] = 1;
    }
    for (let i = 0; i < 784; i++) C[i] = A[i] | D[i];
    for (let y = 0; y < 28; y++) for (let x = 0; x < 28; x++) {
      let near = 0;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < 28 && yy < 28 && A[yy * 28 + xx]) { near = 1; break; }
      }
      const i = y * 28 + x;
      Rg[i] = near && !C[i] ? 1 : 0;
    }
    return { A, D, C, Rg, nA: A.reduce((a, b) => a + b, 0), nC: C.reduce((a, b) => a + b, 0), nR: Rg.reduce((a, b) => a + b, 0) };
  }, []);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const narrow = w < NARROW;
    const step = auto ? Math.floor((tt / 1.8) % 5) : manual;
    const size = narrow ? Math.min(w * 0.8, h * 0.6) : Math.min(h * 0.74, w * 0.5);
    const rx = narrow ? (w - size) / 2 : w * 0.08, ry = narrow ? h * 0.06 : (h - size) / 2 - 10, c = size / 28;
    const { A, D, C, Rg } = masks;
    const pulse = 0.5 + 0.5 * Math.sin(tt * 3);
    for (let i = 0; i < 784; i++) {
      const x = rx + (i % 28) * c, y = ry + Math.floor(i / 28) * c;
      let fill = palette.cell;
      if (step >= 1 && A[i]) fill = palette.anomaly;
      if (step >= 2 && D[i]) fill = `rgba(${palette.accentRgb},0.75)`;
      if (step >= 3 && C[i]) fill = palette.excluded;
      if (step >= 4 && Rg[i]) fill = palette.mint;
      ctx.fillStyle = fill; ctx.fillRect(x + 0.5, y + 0.5, c - 1, c - 1);
      if (step >= 3 && C[i]) {
        ctx.strokeStyle = palette.xmark; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x + 2, y + 2); ctx.lineTo(x + c - 2, y + c - 2); ctx.moveTo(x + c - 2, y + 2); ctx.lineTo(x + 2, y + c - 2); ctx.stroke();
      }
      if (step >= 4 && Rg[i]) {
        ctx.save(); ctx.globalAlpha = 0.35 + 0.35 * pulse; ctx.shadowColor = palette.mint; ctx.shadowBlur = 8; ctx.fillStyle = palette.mint;
        ctx.fillRect(x + 0.5, y + 0.5, c - 1, c - 1); ctx.restore();
      }
    }
    ctx.strokeStyle = palette.frame; ctx.strokeRect(rx, ry, size, size);
    // side panel: step list with counts
    const px = narrow ? w * 0.08 : rx + size + w * 0.06, py = narrow ? ry + size + 26 : ry + 10;
    t.steps.forEach((name, s) => {
      const on = s === step, done = s < step;
      const y = py + s * (narrow ? 20 : 30);
      ctx.fillStyle = on ? palette.accent : done ? palette.ink : palette.dotOff;
      ctx.beginPath(); ctx.arc(px + 5, y, on ? 5 : 3.5, 0, Math.PI * 2); ctx.fill();
      label(ctx, name, px + 18, y, on ? palette.ink : done ? palette.muted : palette.dotOff, narrow ? 10 : 11);
    });
    const cy = py + 5 * (narrow ? 20 : 30) + 8;
    if (step >= 3) label(ctx, `${t.excluded}: ${masks.nC}`, px + 18, cy, palette.muted, 10);
    if (step >= 4) label(ctx, `${t.ring}: ${masks.nR}`, px + 18, cy + 16, palette.mint, 10);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={t.step}>
          <span>{t.step}</span>
          {[0, 1, 2, 3, 4].map((s) => (
            <button key={s} type="button" className={!auto && manual === s ? "on" : ""} onClick={() => { setAuto(false); setManual(s); }}>{s === 0 ? "0" : ["A", "D", "C", "R"][s - 1]}</button>
          ))}
          <button type="button" className={auto ? "on" : ""} onClick={() => setAuto(true)}>{t.auto}</button>
        </div>
      </div>
    </div>
  );
}
