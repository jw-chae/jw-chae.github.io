"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { clamp, drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { bar, cells, frame, line, type Ctx } from "./kit";
import { dot, seeded, randn, sinusoid, softmax } from "./tf-math";
import { vitCopy } from "./vit-copy";

const U = vitCopy.ui;
const PAD = 18;
const at = (e: PointerEvent<HTMLCanvasElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

/* ------------------------------------------------------------------ */
/* 02 · [CLS] gathers from the patches it chooses                       */
/* ------------------------------------------------------------------ */

const CG = 11;
const isObj = (r: number, c: number) => (r - 3) ** 2 + (c - 7) ** 2 <= 2.3 ** 2 || (r - 8) ** 2 + (c - 2) ** 2 <= 1.6 ** 2;
const OBJ = Array.from({ length: CG * CG }, (_, i) => isObj(Math.floor(i / CG), i % CG));
const AREA = OBJ.filter(Boolean).length / OBJ.length;

export function ClsScene() {
  const [beta, setBeta] = useState(0);
  // the [CLS] query points along the "object" direction; β is how sharply it prefers matching patches
  const wts = useMemo(() => softmax(OBJ.map((o) => (o ? beta : 0))), [beta]);
  const share = wts.reduce((s, v, i) => s + (OBJ[i] ? v : 0), 0);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const cell = Math.min(30, (w - 2 * PAD) / CG, (h - 150) / CG);
    const x0 = (w - CG * cell) / 2, y0 = 62, mx = Math.max(...wts);
    label(ctx, U.cls.cls, w / 2, y0 - 38, palette.accent, 11, "center");
    ctx.fillStyle = palette.accent; ctx.fillRect(w / 2 - 26, y0 - 26, 52, 18);
    label(ctx, "[CLS]", w / 2, y0 - 17, "#ffffff", 10, "center");
    cells(ctx, x0, y0, cell, CG, CG, (r, c) => (OBJ[r * CG + c] ? `rgba(${palette.inkRgb},0.32)` : palette.track));
    for (let i = 0; i < CG * CG; i++) {
      ctx.fillStyle = `rgba(${palette.accentRgb},${0.1 + 0.8 * (wts[i] / mx)})`;
      ctx.fillRect(x0 + (i % CG) * cell + 0.5, y0 + Math.floor(i / CG) * cell + 0.5, cell - 1, cell - 1);
    }
    const ty = y0 + CG * cell + 24;
    label(ctx, `${U.cls.share} ${(share * 100).toFixed(0)}%`, PAD, ty, palette.accent, 13);
    label(ctx, `${U.cls.area} ${(AREA * 100).toFixed(0)}%`, w - PAD, ty, palette.muted, 12, "right");
    bar(ctx, PAD, ty + 16, w - 2 * PAD, 6, share, palette.accent);
    if (beta === 0) label(ctx, U.cls.mean, w / 2, ty + 38, palette.muted, 11, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.cls.beta} <b>{beta.toFixed(1)}</b></span>
          <input type="range" min={0} max={6} step={0.5} value={beta} onChange={(e) => setBeta(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Position vectors on a plane                                     */
/* ------------------------------------------------------------------ */

const PG = 14;
const POS2 = Array.from({ length: PG * PG }, (_, i) => [...sinusoid(Math.floor(i / PG), 8), ...sinusoid(i % PG, 8)]);

export function Pos2DScene() {
  const [q, setQ] = useState(4 * PG + 9);
  const rect = useRef({ x0: 0, y0: 0, cell: 1 });
  const sims = useMemo(() => POS2.map((v) => dot(v, POS2[q]) / 8), [q]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const cell = Math.min(26, (w - 2 * PAD) / PG, (h - 110) / PG);
    const x0 = (w - PG * cell) / 2, y0 = 46;
    rect.current = { x0, y0, cell };
    const lo = Math.min(...sims);
    label(ctx, U.pos2d.sim, w / 2, y0 - 18, palette.muted, 11, "center");
    cells(ctx, x0, y0, cell, PG, PG, (r, c) => `rgba(${palette.accentRgb},${0.06 + 0.92 * ((sims[r * PG + c] - lo) / (1 - lo)) ** 1.5})`);
    const qr = Math.floor(q / PG), qc = q % PG;
    frame(ctx, x0 + qc * cell, y0 + qr * cell, cell, cell, palette.ink, 2.5);
    label(ctx, `${U.pos2d.row} ${qr + 1} · ${U.pos2d.col} ${qc + 1}`, w / 2, y0 + PG * cell + 20, palette.ink, 12, "center");
    label(ctx, U.pos2d.hint, w / 2, y0 + PG * cell + 42, palette.muted, 11, "center");
  });

  return (
    <div className="ad-scene">
      <canvas
        ref={ref}
        className="ad-canvas"
        aria-hidden="true"
        onPointerDown={(e) => {
          const p = at(e), r = rect.current;
          const c = Math.floor((p.x - r.x0) / r.cell), rr = Math.floor((p.y - r.y0) / r.cell);
          if (c >= 0 && rr >= 0 && c < PG && rr < PG) setQ(rr * PG + c);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · DINO: a student matches a slowly averaged teacher               */
/* ------------------------------------------------------------------ */

const Z_T = [0.22, 0.1, 0.02, -0.06, 0.0, -0.12], Z_S = [0.16, 0.12, 0.05, -0.02, 0.03, -0.1];
const STEPS = 120;
const STUDENT: number[] = (() => {
  const r = seeded(42);
  return Array.from({ length: STEPS + 1 }, (_, k) => 1.2 * (1 - Math.exp(-k / 40)) + 0.2 * randn(r));
})();
const MOMENTA = [0.9, 0.97, 0.996];

export function DinoScene() {
  const [tau, setTau] = useState(0.04);
  const [mi, setMi] = useState(1);
  const imgRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.src = "/anomaly/hazelnut-good.webp";
    img.onload = () => { imgRef.current = img; };
  }, []);
  const calc = useMemo(() => {
    const pt = softmax(Z_T.map((v) => v / tau)), ps = softmax(Z_S.map((v) => v / 0.1));
    const m = MOMENTA[mi], teacher = [STUDENT[0]];
    for (let k = 1; k <= STEPS; k++) teacher.push(m * teacher[k - 1] + (1 - m) * STUDENT[k]);   // θ_t ← m·θ_t + (1−m)·θ_s
    return { pt, ps, loss: -pt.reduce((s, p, k) => s + p * Math.log(ps[k]), 0), teacher };
  }, [tau, mi]);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const S = Math.min(150, w * 0.36, h * 0.3), ix = PAD, iy = 34, img = imgRef.current;
    if (img) ctx.drawImage(img, ix, iy, S, S);
    else { ctx.fillStyle = palette.track; ctx.fillRect(ix, iy, S, S); label(ctx, U.dino.loading, ix + S / 2, iy + S / 2, palette.muted, 10, "center"); }
    // two crops of the same photo: a large one for the teacher, a small one for the student
    const g = 0.62 * S, l = 0.3 * S;
    const gx = ix + (S - g) * (0.5 + 0.4 * Math.sin(tt * 0.5)), gy = iy + (S - g) * (0.5 + 0.4 * Math.cos(tt * 0.37));
    const lx = ix + (S - l) * (0.5 + 0.45 * Math.sin(tt * 0.83 + 1)), ly = iy + (S - l) * (0.5 + 0.45 * Math.cos(tt * 0.61 + 2));
    frame(ctx, gx, gy, g, g, palette.normal, 2.5);
    frame(ctx, lx, ly, l, l, palette.accent, 2.5);

    const bx = ix + S + 22, bwid = w - bx - PAD, colw = bwid / 6;
    const drawBars = (p: number[], y: number, color: string, name: string) => {
      label(ctx, name, bx, y - 10, color, 11);
      const hh = Math.min(52, S * 0.34);
      p.forEach((v, k) => {
        ctx.fillStyle = palette.track; ctx.fillRect(bx + k * colw + 2, y, colw - 4, hh);
        ctx.fillStyle = color; ctx.fillRect(bx + k * colw + 2, y + hh * (1 - v), colw - 4, hh * v);
      });
      return y + hh;
    };
    const y1 = drawBars(calc.pt, iy + 12, palette.normal, U.dino.teacher);
    drawBars(calc.ps, y1 + 30, palette.accent, U.dino.student);
    label(ctx, `${U.dino.loss} ${calc.loss.toFixed(2)}`, PAD, iy + S + 22, palette.ink, 12);

    // EMA: the teacher weight follows the student weight slowly
    const py0 = iy + S + 56, py1 = h - 22, px0 = PAD, px1 = w - PAD;
    label(ctx, U.dino.ema, px0, py0 - 12, palette.muted, 11);
    const X = (k: number) => px0 + (k / STEPS) * (px1 - px0), Y = (v: number) => py1 - ((v + 0.4) / 2.1) * (py1 - py0);
    const path = (vals: number[], color: string, lw: number) => {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
      vals.forEach((v, k) => (k === 0 ? ctx.moveTo(X(k), Y(v)) : ctx.lineTo(X(k), Y(v))));
      ctx.stroke(); ctx.restore();
    };
    line(ctx, px0, py1, px1, py1, palette.frame, 1);
    path(STUDENT, `rgba(${palette.accentRgb},0.75)`, 1.2);
    path(calc.teacher, palette.normal, 2.5);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.dino.temp} <b>{tau.toFixed(2)}</b></span>
          <input type="range" min={0.02} max={0.1} step={0.01} value={tau} onChange={(e) => setTau(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.dino.m}>
          <span>{U.dino.m}</span>
          {MOMENTA.map((m, i) => <button key={m} type="button" className={mi === i ? "on" : ""} onClick={() => setMi(i)}>{m}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · A memory of normal patches, and nearest-neighbour distance      */
/* ------------------------------------------------------------------ */

const MG = 20, MP = 10, MR = MG * MP;       // 20×20 patches of 10 px on a 200×200 copy

/** A deliberately simple patch descriptor: mean colour, brightness spread, edge strength. Stands in for a DINOv2 token. */
function describe(img: HTMLImageElement): number[][] | null {
  const off = document.createElement("canvas");
  off.width = MR; off.height = MR;
  const c = off.getContext("2d");
  if (!c) return null;
  c.drawImage(img, 0, 0, MR, MR);
  const d = c.getImageData(0, 0, MR, MR).data, lum = (x: number, y: number) => (0.3 * d[(y * MR + x) * 4] + 0.59 * d[(y * MR + x) * 4 + 1] + 0.11 * d[(y * MR + x) * 4 + 2]) / 255;
  const feats: number[][] = [];
  for (let pr = 0; pr < MG; pr++) for (let pc = 0; pc < MG; pc++) {
    let r = 0, g = 0, b = 0, s1 = 0, s2 = 0, ed = 0;
    for (let y = 0; y < MP; y++) for (let x = 0; x < MP; x++) {
      const px = pc * MP + x, py = pr * MP + y, o = (py * MR + px) * 4, L = lum(px, py);
      r += d[o]; g += d[o + 1]; b += d[o + 2]; s1 += L; s2 += L * L;
      if (px + 1 < MR && py + 1 < MR) ed += Math.abs(lum(px + 1, py) - L) + Math.abs(lum(px, py + 1) - L);
    }
    const n = MP * MP, mean = s1 / n;
    feats.push([r / n / 255, g / n / 255, b / n / 255, 2 * Math.sqrt(Math.max(0, s2 / n - mean * mean)), (3 * ed) / n]);
  }
  return feats;
}

type Bank = { score: number[]; nn: number[]; hi: number; lo: number };

export function MemoryScene() {
  const [sel, setSel] = useState<number | null>(null);
  const imgs = useRef<{ test: HTMLImageElement | null; good: HTMLImageElement | null }>({ test: null, good: null });
  const bank = useRef<Bank | null>(null);
  const rect = useRef({ x: 0, y: 0, s: 1 });

  useEffect(() => {
    const load = (src: string, key: "test" | "good") => {
      const img = new window.Image();
      img.src = src;
      img.onload = () => {
        imgs.current[key] = img;
        const { test, good } = imgs.current;
        if (!test || !good) return;
        const ft = describe(test), fg = describe(good);
        if (!ft || !fg) return;
        // s(p) = min over the memory of ‖z_p − m‖
        const score: number[] = [], nn: number[] = [];
        for (const a of ft) {
          let best = Infinity, bi = 0;
          fg.forEach((m, j) => { let q = 0; for (let k = 0; k < a.length; k++) q += (a[k] - m[k]) ** 2; if (q < best) { best = q; bi = j; } });
          score.push(Math.sqrt(best)); nn.push(bi);
        }
        const sorted = [...score].sort((x, y) => x - y);
        bank.current = { score, nn, hi: sorted[Math.floor(sorted.length * 0.985)], lo: sorted[Math.floor(sorted.length * 0.5)] };
      };
    };
    load("/anomaly/hazelnut-defect.webp", "test");
    load("/anomaly/hazelnut-good.webp", "good");
  }, []);

  const ref = useCanvas((ctx: Ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const gap = 18, S = Math.min((w - 2 * PAD - gap) / 2, h - 130), x0 = (w - 2 * S - gap) / 2, y0 = 46, x1 = x0 + S + gap, cell = S / MG;
    rect.current = { x: x0, y: y0, s: S };
    label(ctx, U.memory.test, x0 + S / 2, y0 - 16, palette.muted, 11, "center");
    label(ctx, U.memory.bank, x1 + S / 2, y0 - 16, palette.muted, 11, "center");
    const { test, good } = imgs.current, b = bank.current;
    if (!test || !good || !b) {
      ctx.fillStyle = palette.track; ctx.fillRect(x0, y0, S, S); ctx.fillRect(x1, y0, S, S);
      label(ctx, U.memory.loading, w / 2, y0 + S / 2, palette.muted, 12, "center");
      return;
    }
    ctx.drawImage(test, x0, y0, S, S);
    ctx.drawImage(good, x1, y0, S, S);
    for (let i = 0; i < MG * MG; i++) {
      const a = clamp((b.score[i] - b.lo) / (b.hi - b.lo), 0, 1);
      if (a < 0.04) continue;
      ctx.fillStyle = `rgba(${palette.anomalyRgb},${0.8 * a})`;
      ctx.fillRect(x0 + (i % MG) * cell, y0 + Math.floor(i / MG) * cell, cell, cell);
    }
    const s = sel ?? b.score.indexOf(Math.max(...b.score)), j = b.nn[s];
    const sx = x0 + (s % MG) * cell, sy = y0 + Math.floor(s / MG) * cell, jx = x1 + (j % MG) * cell, jy = y0 + Math.floor(j / MG) * cell;
    line(ctx, sx + cell / 2, sy + cell / 2, jx + cell / 2, jy + cell / 2, `rgba(${palette.inkRgb},0.45)`, 1.5, [4, 4]);
    frame(ctx, sx - 2, sy - 2, cell + 4, cell + 4, "#ffffff", 3); frame(ctx, sx - 2, sy - 2, cell + 4, cell + 4, palette.ink, 1.5);
    frame(ctx, jx - 2, jy - 2, cell + 4, cell + 4, "#ffffff", 3); frame(ctx, jx - 2, jy - 2, cell + 4, cell + 4, palette.mint, 2);

    const high = b.score[s] > b.lo + 0.4 * (b.hi - b.lo);
    const ty = y0 + S + 26;
    label(ctx, `${U.memory.dist} ${b.score[s].toFixed(3)}`, w / 2, ty, palette.ink, 13, "center");
    label(ctx, high ? U.memory.high : U.memory.low, w / 2, ty + 22, high ? palette.anomaly : palette.mint, 12, "center");
    label(ctx, U.memory.hint, w / 2, ty + 44, palette.muted, 11, "center");
  });

  return (
    <div className="ad-scene">
      <canvas
        ref={ref}
        className="ad-canvas"
        aria-hidden="true"
        onPointerDown={(e) => {
          const p = at(e), r = rect.current;
          const c = Math.floor(((p.x - r.x) / r.s) * MG), rr = Math.floor(((p.y - r.y) / r.s) * MG);
          if (c >= 0 && rr >= 0 && c < MG && rr < MG) setSel(rr * MG + c);
        }}
      />
    </div>
  );
}
