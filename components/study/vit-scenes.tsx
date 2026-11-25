"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { clamp, drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, cells, frame, gray, line, signed, type Ctx } from "./kit";
import { CAT_HEAD_PARTS_16, CAT_HEAD_RGB_16, CAT_SRC } from "./cat-grids";
import { vitCopy } from "./vit-copy";
import { TAU_T, dino, dot, randMat, randn, seeded, sinusoid, softmax } from "./vit-math";
import { isPortrait, useHead } from "./vit-walk-scenes";

const U = vitCopy.ui;
const PAD = 18;
const at = (e: PointerEvent<HTMLCanvasElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

/* ------------------------------------------------------------------ */
/* 01 · Photo → patches → one row of weights per token number           */
/* ------------------------------------------------------------------ */

const IMG_SRC = CAT_SRC.head;
const PATCH_SIZES = [98, 56, 28, 14];
const NTH = [0, 1, 2];
const PROJ = randMat(24, 16, seeded(7), 0.5);       // stand-in for the learned patch-embedding matrix E

export function TokenScene() {
  const [P, setP] = useState(56);
  const [sel, setSel] = useState<number | null>(null);
  const [nth, setNth] = useState(0);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dataRef = useRef<Uint8ClampedArray | null>(null);
  const rectRef = useRef({ x: 0, y: 0, s: 1 });

  useEffect(() => {
    const img = new window.Image();
    img.src = IMG_SRC;
    img.onload = () => {
      const off = document.createElement("canvas");
      off.width = 392; off.height = 392;
      const c = off.getContext("2d");
      if (!c) return;
      c.drawImage(img, 0, 0, 392, 392);
      dataRef.current = c.getImageData(0, 0, 392, 392).data;
      imgRef.current = img;
    };
  }, []);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const img = imgRef.current, data = dataRef.current;
    const G = 392 / P, N = G * G;
    // until the reader clicks, the chosen patch sits on the left ear (the cell followed from section 02)
    const idx = sel ?? Math.floor(G * 0.4) * G + Math.floor(G * 0.2);
    const pr = Math.floor(idx / G), pcol = idx % G;
    const portrait = isPortrait(w, h);
    const S = portrait ? Math.min(w - 2 * PAD, h * 0.46) : Math.min(h - 80, w * 0.5);
    const ix = portrait ? (w - S) / 2 : PAD, iy = portrait ? 34 : (h - S) / 2 - 6;
    rectRef.current = { x: ix, y: iy, s: S };
    const k = S / 392;

    label(ctx, U.patch.image, ix + S / 2, iy - 14, palette.muted, 11, "center");
    if (!img || !data) {
      ctx.fillStyle = palette.track;
      ctx.fillRect(ix, iy, S, S);
      label(ctx, U.patch.loading, ix + S / 2, iy + S / 2, palette.muted, 12, "center");
      return;
    }
    ctx.drawImage(img, ix, iy, S, S);
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${G > 14 ? 0.28 : 0.55})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= G; i++) {
      ctx.moveTo(ix + i * P * k, iy); ctx.lineTo(ix + i * P * k, iy + S);
      ctx.moveTo(ix, iy + i * P * k); ctx.lineTo(ix + S, iy + i * P * k);
    }
    ctx.stroke();
    ctx.restore();
    frame(ctx, ix + pcol * P * k, iy + pr * P * k, P * k, P * k, palette.accent, 2.5);

    // the chosen patch, enlarged
    const dx = portrait ? PAD : ix + S + 26, dw = w - dx - PAD;
    let y = portrait ? iy + S + 34 : iy + 4;
    label(ctx, `${U.patch.patch}: ${P}×${P}×3 = ${P * P * 3}`, dx, y, palette.ink, 12);
    y += 14;
    const E = portrait ? 72 : Math.min(96, dw * 0.5);
    const sc = img.naturalWidth / 392;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, pcol * P * sc, pr * P * sc, P * sc, P * sc, dx, y, E, E);
    ctx.restore();
    frame(ctx, dx, y, E, E, palette.accent, 2);

    // 4 × 4 block means of brightness: 16 real numbers that stand in for the flattened patch
    const lum: number[] = [];
    const q = P / 4, st = Math.max(1, Math.floor(q / 4));
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      let s = 0, n = 0;
      for (let yy = 0; yy < q; yy += st) for (let xx = 0; xx < q; xx += st) {
        const o = ((Math.floor(pr * P + a * q + yy)) * 392 + Math.floor(pcol * P + b * q + xx)) * 4;
        s += (0.3 * data[o] + 0.59 * data[o + 1] + 0.11 * data[o + 2]) / 255; n++;
      }
      lum.push(s / n);
    }
    const feat = lum.map((v) => v - 0.5);
    const token = PROJ.map((row) => dot(row, feat));
    const tAbs = Math.max(...token.map(Math.abs), 1e-6), wAbs = Math.max(...PROJ[nth].map(Math.abs));

    // pixels in a row → one row of E → one number of the token
    const sx = portrait ? dx + E + 22 : dx, sw = portrait ? w - sx - PAD : dw;
    const fc = Math.min(15, sw / 16), tc = Math.min(15, sw / 24);
    let sy = portrait ? y + 18 : y + E + 30;
    label(ctx, U.patch.flat, sx, sy - 10, palette.muted, 11);
    lum.forEach((v, i) => { ctx.fillStyle = gray(v); ctx.fillRect(sx + i * fc + 0.5, sy, fc - 1, fc - 1); });
    sy += fc + 26;
    label(ctx, `E의 ${nth + 1}째 줄: ${U.patch.weights}`, sx, sy - 10, palette.muted, 11);
    PROJ[nth].forEach((v, i) => { ctx.fillStyle = signed(v, wAbs); ctx.fillRect(sx + i * fc + 0.5, sy, fc - 1, fc - 1); });
    sy += fc + 22;
    arrow(ctx, sx + 6, sy - 14, sx + 6, sy + 2, palette.accent, 1.5);
    label(ctx, `${U.patch.times} ${token[nth].toFixed(2).replace("-", "−")}`, sx + 18, sy - 4, palette.accent, 12);
    sy += 30;
    label(ctx, U.patch.token, sx, sy - 10, palette.muted, 11);
    token.forEach((v, i) => { ctx.fillStyle = signed(v, tAbs); ctx.fillRect(sx + i * tc + 0.5, sy, tc - 1, fc - 1); });
    frame(ctx, sx + nth * tc - 1, sy - 1.5, tc + 1, fc + 2, palette.accent, 2);

    const by = sy + fc + 34;
    label(ctx, `${U.patch.tokens}: ${G} × ${G} = ${N}`, portrait ? w / 2 : dx, by, palette.accent, 14, portrait ? "center" : "left");
  });

  return (
    <div className="ad-scene">
      <canvas
        ref={ref}
        className="ad-canvas"
        aria-hidden="true"
        onPointerDown={(e) => {
          const p = at(e), r = rectRef.current, G = 392 / P;
          const c = Math.floor(((p.x - r.x) / r.s) * G), rr = Math.floor(((p.y - r.y) / r.s) * G);
          if (c >= 0 && rr >= 0 && c < G && rr < G) setSel(rr * G + c);
        }}
      />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.patch.size}>
          <span>{U.patch.size}</span>
          {PATCH_SIZES.map((v) => <button key={v} type="button" className={P === v ? "on" : ""} onClick={() => { setP(v); setSel(null); }}>{v}px</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.patch.nth}>
          <span>{U.patch.nth}</span>
          {NTH.map((v) => <button key={v} type="button" className={nth === v ? "on" : ""} onClick={() => setNth(v)}>{v + 1}째</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · Position vectors on a plane                                     */
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
/* 07 · What one cell draws on: a fixed window, or shares computed from content */
/* ------------------------------------------------------------------ */

/** The cat's head shrunk to 16 × 16 cells (measured colours), and each cell's part from colour thresholds (approximate). */
const CG = 16;
const partOf = (r: number, c: number) => CAT_HEAD_PARTS_16[r][c];
const headColor = (r: number, c: number) => `rgb(${CAT_HEAD_RGB_16[r][c].map((v) => Math.round(v * 255)).join(",")})`;

export function ReachScene() {
  const [q, setQ] = useState<[number, number]>([10, 7]);       // the left eye
  const [L, setL] = useState(2);
  const rectRef = useRef({ grids: [[0, 0], [0, 0]], cell: 1 });
  // hand-set: the base cell gives a high score to cells of the same part (background, cream fur, dark points, inner ear, eye), wherever they are
  const weights = useMemo(() => {
    const mine = partOf(q[0], q[1]);
    return softmax(Array.from({ length: CG * CG }, (_, i) => (partOf(Math.floor(i / CG), i % CG) === mine ? 4 : 0)));
  }, [q]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), gap = 24;
    // landscape: the two grids side by side, captions below; portrait: stacked, captions to the right
    const cell = portrait
      ? Math.min(20, (h - 120) / (2 * CG), (w - 2 * PAD - 120) / CG)
      : Math.min(24, (w - 2 * PAD - gap) / (2 * CG), (h - 150) / CG);
    const side = CG * cell, half = side / 2;
    const x0 = portrait ? PAD : (w - (2 * side + gap)) / 2, y0 = portrait ? 36 : (h - side - 96) / 2 + 26;
    const rx = portrait ? x0 : x0 + side + gap, ry = portrait ? y0 + side + 44 : y0;
    rectRef.current = { grids: [[x0, y0], [rx, ry]], cell };
    const mx = Math.max(...weights);
    const base = headColor;
    let seen = 0;

    label(ctx, `${U.compare.cnn} · ${L}${U.compare.layer}`, x0 + half, y0 - 16, palette.normal, 12, "center");
    cells(ctx, x0, y0, cell, CG, CG, base);
    for (let r = 0; r < CG; r++) for (let c = 0; c < CG; c++) {
      if (Math.abs(r - q[0]) <= L && Math.abs(c - q[1]) <= L) {
        seen++;
        ctx.fillStyle = `rgba(${palette.normalRgb},0.62)`;
        ctx.fillRect(x0 + c * cell + 0.5, y0 + r * cell + 0.5, cell - 1, cell - 1);
      }
    }
    label(ctx, U.compare.attn, rx + half, ry - 16, palette.accent, 12, "center");
    cells(ctx, rx, ry, cell, CG, CG, base);
    for (let i = 0; i < CG * CG; i++) {
      ctx.fillStyle = `rgba(${palette.accentRgb},${0.03 + 0.8 * (weights[i] / mx)})`;
      ctx.fillRect(rx + (i % CG) * cell + 0.5, ry + Math.floor(i / CG) * cell + 0.5, cell - 1, cell - 1);
    }
    frame(ctx, x0 + q[1] * cell, y0 + q[0] * cell, cell, cell, palette.ink, 2.5);
    frame(ctx, rx + q[1] * cell, ry + q[0] * cell, cell, cell, palette.ink, 2.5);

    const seesCnn = `${U.compare.sees} ${seen} ${U.compare.of}`, seesAttn = `${U.compare.sees} ${CG * CG} ${U.compare.of}`;
    if (portrait) {
      // two short lines beside each grid: the count, then what sets the weights
      const tx = x0 + side + 14, split = (s: string) => {
        // break at the space nearest the middle
        const spaces = [...s].map((ch, i) => (ch === " " ? i : -1)).filter((i) => i > 0);
        const k = spaces.reduce((best, i) => (Math.abs(i - s.length / 2) < Math.abs(best - s.length / 2) ? i : best), spaces[0]);
        return [s.slice(0, k), s.slice(k + 1)];
      };
      ([[seesCnn, U.compare.fixed, y0, palette.normal], [seesAttn, U.compare.content, ry, palette.accent]] as const).forEach(([count, why, gy, color]) => {
        label(ctx, count, tx, gy + half - 22, color, 12);
        split(why).forEach((part, k) => label(ctx, part, tx, gy + half + 2 + k * 18, palette.muted, 11));
      });
      label(ctx, U.compare.hint, w / 2, ry + side + 26, palette.muted, 11, "center");
    } else {
      const ty = y0 + side + 18;
      label(ctx, seesCnn, x0 + half, ty, palette.normal, 12, "center");
      label(ctx, seesAttn, rx + half, ty, palette.accent, 12, "center");
      label(ctx, U.compare.fixed, x0 + half, ty + 20, palette.muted, 11, "center");
      label(ctx, U.compare.content, rx + half, ty + 20, palette.muted, 11, "center");
      label(ctx, U.compare.hint, w / 2, ty + 46, palette.muted, 11, "center");
    }
  });

  return (
    <div className="ad-scene">
      <canvas
        ref={ref}
        className="ad-canvas"
        aria-hidden="true"
        onPointerDown={(e) => {
          const p = at(e), r = rectRef.current;
          for (const [gx, gy] of r.grids) {
            const c = Math.floor((p.x - gx) / r.cell), rr = Math.floor((p.y - gy) / r.cell);
            if (c >= 0 && rr >= 0 && c < CG && rr < CG) setQ([rr, c]);
          }
        }}
      />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.compare.layers} <b>{L}</b></span>
          <input type="range" min={1} max={5} step={1} value={L} onChange={(e) => setL(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · DINO: one photo, two crops, two networks                        */
/* ------------------------------------------------------------------ */

const STEPS = 120;
/** One student weight over training steps: it drifts towards a value and jitters with every batch. Illustrative. */
const STUDENT: number[] = (() => {
  const r = seeded(42);
  return Array.from({ length: STEPS + 1 }, (_, k) => 1.2 * (1 - Math.exp(-k / 40)) + 0.2 * randn(r));
})();
const MOMENTA = [0.9, 0.97, 0.996];
/** Crops as fractions of the head drawing: left, top, side. The large one holds both ears, both eyes and the nose; the small one only the left ear. */
const BIG = [0.03, 0.03, 0.94], SMALL = [0.03, 0.17, 0.42];
const TEACH = palette.mint;        // plays the role of the answer
const STUD = palette.accent;       // the prediction
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function DinoScene() {
  const [step, setStep] = useState(0);
  const [tau, setTau] = useState(TAU_T);
  const [mi, setMi] = useState(1);
  const D = useMemo(() => dino(tau), [tau]);
  const head = useHead();
  const teacher = useMemo(() => {
    const m = MOMENTA[mi], out = [STUDENT[0]];
    for (let k = 1; k <= STEPS; k++) out.push(m * out[k - 1] + (1 - m) * STUDENT[k]);   // θ_t ← m·θ_t + (1−m)·θ_s
    return out;
  }, [mi]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), S = portrait ? 112 : Math.min(150, w * 0.3);
    const px = portrait ? (w - S) / 2 : PAD, py = 40;
    const img = head.current, n = img ? img.naturalWidth : 1;
    label(ctx, U.dino.photo, px + S / 2, py - 14, palette.muted, 11, "center");
    if (img) ctx.drawImage(img, px, py, S, S);
    else { ctx.fillStyle = palette.track; ctx.fillRect(px, py, S, S); }
    frame(ctx, px, py, S, S, palette.frame, 1);
    frame(ctx, px + BIG[0] * S, py + BIG[1] * S, BIG[2] * S, BIG[2] * S, TEACH, 2.5);
    frame(ctx, px + SMALL[0] * S, py + SMALL[1] * S, SMALL[2] * S, SMALL[2] * S, STUD, 2.5);

    const x0 = portrait ? PAD : px + S + 24, x1 = w - PAD, TH = 58;
    const top = portrait ? py + S + 36 : py + 14;
    const rows = [
      { name: `${U.dino.teacher}: ${U.dino.teacherDoes[step]}`, crop: BIG, color: TEACH, p: D.pt, nameColor: TEACH },
      { name: `${U.dino.student}: ${U.dino.studentDoes[step]}`, crop: SMALL, color: STUD, p: D.ps, nameColor: step === 2 ? palette.anomaly : STUD },
    ];
    rows.forEach((row, i) => {
      const y = top + i * 106, [u, v, s] = row.crop;
      label(ctx, row.name, x0, y - 11, row.nameColor, 11);
      // the crop, resized to the same box whichever its size in the photo
      if (img) ctx.drawImage(img, u * n, v * n, s * n, s * n, x0, y, TH, TH);
      else { ctx.fillStyle = palette.track; ctx.fillRect(x0, y, TH, TH); }
      frame(ctx, x0, y, TH, TH, row.color, 2);
      const bx = x0 + TH + 14, colw = (x1 - bx) / 6;
      if (step === 0) { label(ctx, U.dino.none, bx, y + TH / 2, palette.muted, 11); return; }
      row.p.forEach((val, kk) => {
        ctx.fillStyle = palette.track; ctx.fillRect(bx + kk * colw + 2, y, colw - 4, TH);
        ctx.fillStyle = row.color; ctx.fillRect(bx + kk * colw + 2, y + TH * (1 - val), colw - 4, TH * val);
        label(ctx, pct(val), bx + (kk + 0.5) * colw, y + TH + 11, palette.muted, 11, "center");
      });
      if (step === 2 && i === 1) {
        // where the student's bars land after one update of the student only
        D.psNext.forEach((val, kk) => line(ctx, bx + kk * colw, y + TH * (1 - val), bx + (kk + 1) * colw, y + TH * (1 - val), palette.anomaly, 2.5));
      }
    });

    const yb = top + 106 + TH + 40;
    if (step === 1) {
      label(ctx, U.dino.bins1, PAD, yb, palette.ink, 12);
      label(ctx, U.dino.bins2, PAD, yb + 22, palette.muted, 11);
    } else if (step === 2) {
      label(ctx, `${U.dino.loss} ${D.loss.toFixed(2)}`, PAD, yb, palette.anomaly, 14);
      label(ctx, U.dino.lossIs, PAD, yb + 22, palette.muted, 11);
      label(ctx, `${U.dino.after} ${D.lossNext.toFixed(2)}`, PAD, yb + 48, palette.anomaly, 13);
      label(ctx, U.dino.tick, PAD, yb + 68, palette.muted, 11);
    } else if (step === 3) {
      // the teacher is never corrected by the error: its weight is a slow average of the student's
      const py0 = yb + 30, py1 = h - 22, qx0 = PAD, qx1 = w - PAD;
      label(ctx, U.dino.ema, qx0, yb - 6, palette.muted, 11);
      label(ctx, U.dino.sLine, qx0, yb + 12, STUD, 11);
      label(ctx, U.dino.tLine, qx1, yb + 12, TEACH, 11, "right");
      const X = (kk: number) => qx0 + (kk / STEPS) * (qx1 - qx0), Y = (val: number) => py1 - ((val + 0.4) / 2.1) * (py1 - py0);
      const path = (vals: number[], color: string, lw: number) => {
        ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
        vals.forEach((val, kk) => (kk === 0 ? ctx.moveTo(X(kk), Y(val)) : ctx.lineTo(X(kk), Y(val))));
        ctx.stroke(); ctx.restore();
      };
      line(ctx, qx0, py1, qx1, py1, palette.frame, 1);
      path(STUDENT, `rgba(${palette.accentRgb},0.75)`, 1.2);
      path(teacher, TEACH, 2.5);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.dino.step}>
          <span>{U.dino.step}</span>
          {U.dino.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        {step === 1 || step === 2 ? (
          <label className="ad-ctl">
            <span>{U.dino.temp} <b>{tau.toFixed(2)}</b></span>
            <input type="range" min={0.02} max={0.1} step={0.01} value={tau} onChange={(e) => setTau(Number(e.target.value))} />
          </label>
        ) : null}
        {step === 3 ? (
          <div className="ad-ctl ad-seg" role="group" aria-label={U.dino.m}>
            <span>{U.dino.m}</span>
            {MOMENTA.map((m, i) => <button key={m} type="button" className={mi === i ? "on" : ""} onClick={() => setMi(i)}>{m}</button>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 · A memory of normal patches, and the distance to the nearest one */
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

type Bank = { test: number[][]; good: number[][]; score: number[]; near: number[][]; dist: number[][]; hi: number; lo: number };
const f2 = (v: number) => { const s = v.toFixed(2); return s === "-0.00" ? "0.00" : s.replace("-", "−"); };

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
        // s(p) = min over the memory of ‖z_p − m‖ ; the three nearest are kept so the figure can show them
        const score: number[] = [], near: number[][] = [], dist: number[][] = [];
        for (const a of ft) {
          const all = fg.map((m, j) => { let q = 0; for (let k = 0; k < a.length; k++) q += (a[k] - m[k]) ** 2; return [Math.sqrt(q), j]; });
          all.sort((x, y) => x[0] - y[0]);
          score.push(all[0][0]); near.push(all.slice(0, 3).map((v) => v[1])); dist.push(all.slice(0, 3).map((v) => v[0]));
        }
        const sorted = [...score].sort((x, y) => x - y);
        bank.current = { test: ft, good: fg, score, near, dist, hi: sorted[Math.floor(sorted.length * 0.985)], lo: sorted[Math.floor(sorted.length * 0.5)] };
      };
    };
    load("/anomaly/hazelnut-defect.webp", "test");
    load("/anomaly/hazelnut-good.webp", "good");
  }, []);

  const ref = useCanvas((ctx: Ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const gap = 18, S = Math.min((w - 2 * PAD - gap) / 2, h - 196), x0 = (w - 2 * S - gap) / 2, y0 = 40, x1 = x0 + S + gap, cell = S / MG;
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
    const s = sel ?? b.score.indexOf(Math.max(...b.score)), near = b.near[s], j = near[0];
    const sx = x0 + (s % MG) * cell, sy = y0 + Math.floor(s / MG) * cell;
    const spot = (n: number) => ({ x: x1 + (n % MG) * cell, y: y0 + Math.floor(n / MG) * cell });
    // second and third nearest: thin; the nearest: thick, joined to the chosen patch
    near.slice(1).forEach((n) => { const p = spot(n); frame(ctx, p.x - 1, p.y - 1, cell + 2, cell + 2, "#ffffff", 2.5); frame(ctx, p.x - 1, p.y - 1, cell + 2, cell + 2, palette.mint, 1); });
    const pj = spot(j);
    line(ctx, sx + cell / 2, sy + cell / 2, pj.x + cell / 2, pj.y + cell / 2, `rgba(${palette.inkRgb},0.45)`, 1.5, [4, 4]);
    frame(ctx, sx - 2, sy - 2, cell + 4, cell + 4, "#ffffff", 3); frame(ctx, sx - 2, sy - 2, cell + 4, cell + 4, palette.ink, 1.5);
    frame(ctx, pj.x - 2, pj.y - 2, cell + 4, cell + 4, "#ffffff", 3.5); frame(ctx, pj.x - 2, pj.y - 2, cell + 4, cell + 4, palette.mint, 2.5);

    // the two descriptors, their difference, and the distance that becomes the score
    const roomy = h - (y0 + S) > 230, rh = roomy ? 24 : 18;
    const tx = PAD, nameW = w < 400 ? 96 : 122, colW = (w - 2 * PAD - nameW) / 5;
    let ty = y0 + S + (roomy ? 30 : 21);
    U.memory.heads.forEach((name, k) => label(ctx, name, tx + nameW + (k + 1) * colW, ty, palette.muted, 11, "right"));
    const a = b.test[s], m = b.good[j];
    const rowsT: [string, number[], string][] = [[U.memory.picked, a, palette.ink], [U.memory.nearest, m, palette.mint], [U.memory.diff, a.map((v, k) => v - m[k]), palette.anomaly]];
    rowsT.forEach(([name, vals, color]) => {
      ty += rh;
      label(ctx, name, tx, ty, color, 11);
      vals.forEach((v, k) => label(ctx, f2(v), tx + nameW + (k + 1) * colW, ty, color, 12, "right"));
    });
    const high = b.score[s] > b.lo + 0.4 * (b.hi - b.lo);
    ty += rh + (roomy ? 10 : 6);
    label(ctx, `${U.memory.dist} ${b.score[s].toFixed(3)}`, tx, ty, palette.ink, 13);
    label(ctx, high ? U.memory.high : U.memory.low, w - PAD, ty + (w < 400 ? rh : 0), high ? palette.anomaly : palette.mint, 11, "right");
    ty += rh + (w < 400 ? rh : 0) + 2;
    label(ctx, `${U.memory.next} ${b.dist[s][1].toFixed(3)}, ${b.dist[s][2].toFixed(3)}`, tx, ty, palette.muted, 11);
    label(ctx, U.memory.hint, tx, ty + rh, palette.muted, 11);
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
