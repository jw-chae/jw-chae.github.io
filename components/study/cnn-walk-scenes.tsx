"use client";

import { useMemo, useRef, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { cnnCopy } from "./cnn-copy";
import {
  BAR_N, BAR_SHOW, KERNELS, KERNEL_SEEDS, KERNEL_STEPS, POKE_MID, POKE_N, WALK_IMG, WALK_KERNEL, WALK_KERNEL_H, WALK_SPOTS,
  brighten, conv, oneCell, pokeRun, predictBar, trainKernel, type Grid,
} from "./cnn-math";
import { arrow, cells, frame, gray, rbox, signed, type Ctx } from "./kit";

const U = cnnCopy.ui;
const PAD = 18;
const isPortrait = (w: number, h: number) => h > w * 1.15;
/** Up to two decimals, trailing zeros dropped, real minus sign. */
const num = (v: number, d = 2) => {
  const s = v.toFixed(d).replace(/\.?0+$/, "");
  return s === "-0" || s === "" ? "0" : s.replace("-", "−");
};
const fix = (v: number, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? (0).toFixed(d) : v.toFixed(d)).replace("-", "−");
const text = (ctx: Ctx, s: string, x: number, y: number, cell: number, color: string, size = 11) =>
  label(ctx, s, x + cell / 2, y + cell / 2, color, size, "center");

/* ------------------------------------------------------------------ */
/* Shared layout of 01 and 02: picture and output on top, three small  */
/* tables (window × kernel = products) below                            */
/* ------------------------------------------------------------------ */

type Board = { c: number; x0: number; iy: number; outX: number; outY: number; m: number; bx: number; by: number };

function board(w: number, h: number): Board {
  const c = Math.min(24, (w - 2 * PAD - 36) / 16, (h * 0.5 - 36) / 9);
  const x0 = (w - (16 * c + 36)) / 2, iy = 34;
  const m = Math.min(34, (w - 2 * PAD - 48) / 9, (h - (iy + 9 * c) - 96) / 3);
  const by = iy + 9 * c + 46 + Math.max(0, (h - 440) / 5);
  return { c, x0, iy, outX: x0 + 9 * c + 36, outY: iy + c, m, bx: (w - (9 * m + 48)) / 2, by };
}

/** The picture with the window framed, and the arrow towards the output grid. */
function drawPicture(ctx: Ctx, b: Board, img: Grid, r: number, c: number) {
  label(ctx, U.board.input, b.x0 + 4.5 * b.c, b.iy - 14, palette.muted, 11, "center");
  cells(ctx, b.x0, b.iy, b.c, 9, 9, (y, x) => gray(img.d[y * 9 + x]));
  frame(ctx, b.x0 + c * b.c, b.iy + r * b.c, 3 * b.c, 3 * b.c, palette.accent, 2.5);
  label(ctx, U.board.output, b.outX + 3.5 * b.c, b.iy - 14, palette.muted, 11, "center");
  arrow(ctx, b.x0 + 9 * b.c + 8, b.iy + 4.5 * b.c, b.outX - 8, b.iy + 4.5 * b.c, palette.muted);
}

/** Window, kernel, products. `showProd` false leaves the third table as question marks. */
function drawTables(ctx: Ctx, b: Board, win: number[], k: number[], prod: number[], showProd: boolean) {
  const kAbs = Math.max(...k.map(Math.abs)) * 1.35, pAbs = Math.max(...prod.map(Math.abs), 1e-6) * 1.35;
  const names = [U.board.window, U.board.kernel, U.board.product];
  for (let t = 0; t < 3; t++) {
    const gx = b.bx + t * (3 * b.m + 24);
    label(ctx, names[t], gx + 1.5 * b.m, b.by - 12, palette.muted, 11, "center");
    for (let i = 0; i < 9; i++) {
      const x = gx + (i % 3) * b.m, y = b.by + Math.floor(i / 3) * b.m;
      const fill = t === 0 ? gray(win[i]) : t === 1 ? signed(k[i], kAbs) : showProd ? signed(prod[i], pAbs) : palette.track;
      ctx.fillStyle = fill;
      ctx.fillRect(x + 1, y + 1, b.m - 2, b.m - 2);
      const s = t === 0 ? num(win[i]) : t === 1 ? num(k[i]) : showProd ? num(prod[i]) : "?";
      text(ctx, s, x, y, b.m, t === 0 ? (win[i] > 0.5 ? palette.ink : "#ffffff") : t === 2 && !showProd ? palette.muted : palette.ink);
    }
    if (t < 2) label(ctx, t === 0 ? "×" : "=", gx + 3 * b.m + 12, b.by + 1.5 * b.m, palette.muted, 15, "center");
  }
}

const place = (r: number, c: number) => `${U.board.out} ${r + 1}${U.board.row} ${c + 1}${U.board.col}`;

/* ------------------------------------------------------------------ */
/* 01 · One window, one output cell                                    */
/* ------------------------------------------------------------------ */

const BRIGHTER = brighten(WALK_IMG, 0.1);

export function CellScene() {
  const [step, setStep] = useState(0);
  const [spot, setSpot] = useState(0);
  const [bright, setBright] = useState(false);
  const [seen, setSeen] = useState<number[]>([]);
  const reveal = (s: number) => setSeen((v) => (v.includes(s) ? v : [...v, s]));
  const img = bright ? BRIGHTER : WALK_IMG;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const b = board(w, h);
    const [r, c] = WALK_SPOTS[spot];
    const { win, prod, sum } = oneCell(img, WALK_KERNEL, r, c);
    drawPicture(ctx, b, img, r, c);

    // the output grid: empty until a window has been summed
    cells(ctx, b.outX, b.outY, b.c, 7, 7, () => palette.track);
    seen.forEach((s) => {
      if (s === spot && step < 2) return;
      const [sr, sc] = WALK_SPOTS[s];
      const v = oneCell(WALK_IMG, WALK_KERNEL, sr, sc).sum;
      ctx.fillStyle = Math.abs(v) < 1e-9 ? "#ffffff" : signed(v, 3.2);
      ctx.fillRect(b.outX + sc * b.c + 0.5, b.outY + sr * b.c + 0.5, b.c - 1, b.c - 1);
      frame(ctx, b.outX + sc * b.c + 0.5, b.outY + sr * b.c + 0.5, b.c - 1, b.c - 1, palette.dotOff, 1);
    });
    frame(ctx, b.outX + c * b.c, b.outY + r * b.c, b.c, b.c, palette.accent, 2.5);
    if (step < 2) text(ctx, "?", b.outX + c * b.c, b.outY + r * b.c, b.c, palette.accent, 13);

    drawTables(ctx, b, win, WALK_KERNEL, prod, step >= 1);
    const ty = b.by + 3 * b.m + 22;
    if (step === 2) label(ctx, `${U.board.sum} = ${num(sum)}   →   ${place(r, c)}`, w / 2, ty, palette.accent, 13, "center");
    else label(ctx, `${U.board.sum} = ?`, w / 2, ty, palette.muted, 13, "center");
    U.cell.captions[step].forEach((s, i) => label(ctx, s, w / 2, ty + 26 + i * 17, palette.muted, 11, "center"));
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.cell.step}>
          <span>{U.cell.step}</span>
          {U.cell.steps.map((name, i) => (
            <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => { setStep(i); if (i === 2) reveal(spot); }}>{i + 1}. {name}</button>
          ))}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.cell.spot}>
          <span>{U.cell.spot}</span>
          {U.cell.spots.map((name, i) => (
            <button key={name} type="button" className={spot === i ? "on" : ""} onClick={() => { setSpot(i); if (step === 2) reveal(i); }}>{name}</button>
          ))}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.cell.photo}>
          <span>{U.cell.photo}</span>
          <button type="button" className={!bright ? "on" : ""} onClick={() => setBright(false)}>{U.cell.plain}</button>
          <button type="button" className={bright ? "on" : ""} onClick={() => setBright(true)}>{U.cell.brighter}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · The same computation at all 49 places; swap the kernel          */
/* ------------------------------------------------------------------ */

const KLIST: number[][] = [WALK_KERNEL, WALK_KERNEL_H, [...KERNELS.blur], [...KERNELS.sharpen]];

export function KernelScene() {
  const [ki, setKi] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [manual, setManual] = useState(22);
  const idxRef = useRef(22);
  const out = useMemo(() => conv(WALK_IMG, KLIST[ki]), [ki]);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const idx = playing ? Math.floor(tt * 2.2) % 49 : manual;
    idxRef.current = idx;
    const r = Math.floor(idx / 7), c = idx % 7;
    const b = board(w, h);
    const { win, prod, sum } = oneCell(WALK_IMG, KLIST[ki], r, c);
    const mAbs = Math.max(...out.d.map(Math.abs), 1e-6) * 1.2;

    drawPicture(ctx, b, WALK_IMG, r, c);
    ctx.fillStyle = palette.dotOff;
    ctx.fillRect(b.outX, b.outY, 7 * b.c, 7 * b.c);
    cells(ctx, b.outX, b.outY, b.c, 7, 7, () => "#ffffff");
    cells(ctx, b.outX, b.outY, b.c, 7, 7, (y, x) => (Math.abs(out.d[y * 7 + x]) < 1e-9 ? "#ffffff" : signed(out.d[y * 7 + x], mAbs)));
    frame(ctx, b.outX + c * b.c, b.outY + r * b.c, b.c, b.c, palette.accent, 2.5);
    drawTables(ctx, b, win, KLIST[ki], prod, true);
    label(ctx, `${U.board.sum} = ${num(sum)}   →   ${place(r, c)}`, w / 2, b.by + 3 * b.m + 22, palette.accent, 13, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.kernel.pick}>
          <span>{U.kernel.pick}</span>
          {U.kernel.names.map((n, i) => <button key={n} type="button" className={ki === i ? "on" : ""} onClick={() => setKi(i)}>{n}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group">
          <button type="button" className="ad-btn" onClick={() => { setManual(idxRef.current); setPlaying((p) => !p); }}>{playing ? U.kernel.pause : U.kernel.play}</button>
          <button type="button" className="ad-btn" onClick={() => { setManual((idxRef.current + 1) % 49); setPlaying(false); }}>{U.kernel.step}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Nine numbers learned from one label per picture                 */
/* ------------------------------------------------------------------ */

const HIST = KERNEL_SEEDS.map((s) => trainKernel(s));

export function KernelLearnScene() {
  const [pic, setPic] = useState(0);
  const [seed, setSeed] = useState(0);
  const [step, setStep] = useState(0);
  const snap = HIST[seed][step];
  const ex = BAR_SHOW[pic];
  const res = useMemo(() => predictBar(ex.x, snap), [ex, snap]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const on = BAR_N - 2;
    const ar = Math.floor(res.at / on), ac = res.at % on;
    const kAbs = Math.max(...snap.k.map(Math.abs), 0.3) * 1.35, mAbs = Math.max(...res.map.d.map(Math.abs), 1e-6) * 1.2;

    // picture, kernel and map: one row on wide canvases; on phones the kernel drops below
    let p: number, cm: number, km: number, px: number, mx: number, kx: number, y0: number, ky: number, rowBottom: number;
    if (portrait) {
      p = Math.min(16, (w - 2 * PAD - 40) / 14); cm = (p * 8) / 6.4; km = 34;
      px = PAD; y0 = 38; mx = w - PAD - on * cm;
      ky = y0 + 8 * p + 40; kx = PAD;
      rowBottom = ky + 3 * km;
    } else {
      const unit = Math.min(18, (w - 2 * PAD - 88) / 21);
      p = unit; km = Math.min(38, unit * 2.1); cm = unit * 1.12;
      const gap = (w - 2 * PAD - 8 * p - 3 * km - on * cm) / 2;
      px = PAD; y0 = 40; kx = px + 8 * p + gap; mx = kx + 3 * km + gap;
      ky = y0 + (8 * p - 3 * km) / 2;
      rowBottom = y0 + 8 * p;
    }
    const my = y0 + (8 * p - on * cm) / 2;

    label(ctx, U.learn.input, px + 4 * p, y0 - 14, palette.muted, 11, "center");
    cells(ctx, px, y0, p, 8, 8, (r, c) => gray(ex.x.d[r * 8 + c]));
    frame(ctx, px - 1, y0 - 1, 8 * p + 2, 8 * p + 2, palette.xmark, 1);
    frame(ctx, px + ac * p, y0 + ar * p, 3 * p, 3 * p, palette.accent, 2.5);

    label(ctx, U.learn.map, mx + (on * cm) / 2, my - 14, palette.muted, 11, "center");
    ctx.fillStyle = palette.dotOff;
    ctx.fillRect(mx, my, on * cm, on * cm);
    cells(ctx, mx, my, cm, on, on, () => "#ffffff");
    cells(ctx, mx, my, cm, on, on, (r, c) => signed(res.map.d[r * on + c], mAbs));
    frame(ctx, mx + ac * cm, my + ar * cm, cm, cm, palette.accent, 2.5);

    label(ctx, U.learn.kernel, kx + 1.5 * km, ky - 12, palette.muted, 11, "center");
    for (let i = 0; i < 9; i++) {
      const x = kx + (i % 3) * km, y = ky + Math.floor(i / 3) * km;
      ctx.fillStyle = signed(snap.k[i], kAbs);
      ctx.fillRect(x + 1, y + 1, km - 2, km - 2);
      text(ctx, fix(snap.k[i]), x, y, km, palette.ink, 10);
    }
    frame(ctx, kx - 2, ky - 2, 3 * km + 4, 3 * km + 4, palette.anomaly, 1.5, [4, 3]);
    if (portrait) {
      const tx = kx + 3 * km + 16;
      label(ctx, `${U.learn.fixes}:`, tx, ky + 16, palette.anomaly, 11);
      label(ctx, U.learn.fixed, tx, ky + 34, palette.anomaly, 11);
      label(ctx, `a = ${fix(snap.a)}`, tx, ky + 62, palette.muted, 11);
      label(ctx, `b = ${fix(snap.b)}`, tx, ky + 80, palette.muted, 11);
      arrow(ctx, px + 8 * p + 6, y0 + 4 * p, mx - 6, y0 + 4 * p, palette.muted);
    } else {
      arrow(ctx, px + 8 * p + 6, y0 + 4 * p, kx - 8, y0 + 4 * p, palette.muted);
      arrow(ctx, kx + 3 * km + 8, y0 + 4 * p, mx - 6, y0 + 4 * p, palette.muted);
    }

    // below: the largest response, the probability, the label kept apart, the error
    const sp = Math.min(40, Math.max(26, (h - rowBottom - 50) / (portrait ? 4 : 5)));
    const x1 = w - PAD;
    let y = rowBottom + 36;
    if (!portrait) {
      label(ctx, `${U.learn.fixes}: ${U.learn.fixed}`, PAD, y, palette.anomaly, 11);
      label(ctx, `a = ${fix(snap.a)}   b = ${fix(snap.b)}`, x1, y, palette.muted, 11, "right");
      y += sp;
    }
    label(ctx, `${U.learn.max} = ${fix(res.m)}`, PAD, y, palette.accent, 13);
    y += sp;
    const bx = PAD + 112, bw = x1 - bx - 52;
    label(ctx, U.learn.prob, PAD, y, palette.ink, 12);
    ctx.fillStyle = palette.track; ctx.fillRect(bx, y - 6, bw, 12);
    ctx.fillStyle = palette.accent; ctx.fillRect(bx, y - 6, Math.max(2, bw * res.p), 12);
    label(ctx, `${Math.round(res.p * 100)}%`, x1, y, palette.ink, 13, "right");
    y += sp;
    const ans = `${U.learn.answer}: ${ex.y ? U.learn.vertical : U.learn.horizontal}`;
    rbox(ctx, PAD, y - 13, 92, 26, 7, "rgba(15,157,106,0.1)", palette.mint, 1.5);
    label(ctx, ans, PAD + 46, y, palette.ink, 12, "center");
    label(ctx, pic === 2 ? U.learn.unused : U.learn.used, PAD + 104, y, pic === 2 ? palette.muted : palette.mint, 11);
    y += sp;
    label(ctx, `${U.learn.loss} ${fix(snap.loss)}`, PAD, y, palette.anomaly, 13);
    label(ctx, U.learn.lossOf, x1, y, palette.muted, 11, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.learn.step} <b>{step}</b></span>
          <input type="range" min={0} max={KERNEL_STEPS} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.learn.photo}>
          <span>{U.learn.photo}</span>
          {U.learn.photos.map((name, i) => <button key={name} type="button" className={pic === i ? "on" : ""} onClick={() => setPic(i)}>{name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.learn.start}>
          <span>{U.learn.start}</span>
          {U.learn.starts.map((name, i) => <button key={name} type="button" className={seed === i ? "on" : ""} onClick={() => setSeed(i)}>{name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · Change one pixel: which cells change after 1, 2, 3 layers?      */
/* ------------------------------------------------------------------ */

const POKES = [0, 1, 2, 3, 4].map((d) => pokeRun(d));
const MID = POKE_MID * POKE_N + POKE_MID;

export function ReachScene() {
  const [dist, setDist] = useState(0);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const base = POKES[0].layers, now = POKES[dist].layers;
    const N = POKE_N;
    const ci = 12;
    const ix = PAD, iy = 34;
    const g = Math.max(0, (h - 440) / 4);

    // the picture, with the tracked centre and the changed pixel
    label(ctx, U.reach.input, ix + (N * ci) / 2, iy - 14, palette.muted, 11, "center");
    cells(ctx, ix, iy, ci, N, N, (r, c) => gray(now[0].d[r * N + c]));
    frame(ctx, ix + POKE_MID * ci, iy + POKE_MID * ci, ci, ci, palette.accent, 2.5);
    if (dist > 0) frame(ctx, ix + (POKE_MID + dist) * ci, iy + POKE_MID * ci, ci, ci, palette.anomaly, 2.5);

    // legend beside the picture
    const lx = ix + N * ci + 18;
    let ly = iy + 14;
    frame(ctx, lx, ly - 6, 12, 12, palette.accent, 2.5);
    label(ctx, U.reach.centre, lx + 20, ly, palette.ink, 12);
    ly += 30;
    frame(ctx, lx, ly - 6, 12, 12, dist > 0 ? palette.anomaly : palette.dotOff, 2.5);
    label(ctx, U.reach.poked, lx + 20, ly, dist > 0 ? palette.ink : palette.muted, 12);
    ly += 22;
    if (dist > 0) {
      label(ctx, U.reach.where[0], lx, ly, palette.muted, 11);
      label(ctx, `${dist}${U.reach.where[1]}`, lx, ly + 17, palette.muted, 11);
      label(ctx, U.reach.value, lx, ly + 38, palette.anomaly, 12);
    } else {
      U.reach.nothing.forEach((s, i) => label(ctx, s, lx, ly + i * 17, palette.muted, 11));
    }
    ctx.fillStyle = `rgba(${palette.anomalyRgb},0.62)`;
    ctx.fillRect(lx, ly + 56, 12, 12);
    label(ctx, U.reach.red, lx + 20, ly + 62, dist > 0 ? palette.ink : palette.muted, 12);

    // three layers: cells whose value differs from the unchanged run are red
    const gap = portrait ? 10 : 16;
    const cm = Math.min(13, (w - 2 * PAD - 2 * gap) / (3 * N));
    const mw = N * cm, rowW = 3 * mw + 2 * gap, mx0 = (w - rowW) / 2;
    const my = iy + N * ci + 42 + g;
    for (let l = 1; l <= 3; l++) {
      const x = mx0 + (l - 1) * (mw + gap);
      label(ctx, `${l}${U.reach.layer}`, x + mw / 2, my - 13, palette.ink, 12, "center");
      cells(ctx, x, my, cm, N, N, (r, c) => gray(now[l].d[r * N + c]), 1);
      for (let i = 0; i < N * N; i++) {
        if (Math.abs(now[l].d[i] - base[l].d[i]) < 1e-9) continue;
        ctx.fillStyle = `rgba(${palette.anomalyRgb},0.62)`;
        ctx.fillRect(x + (i % N) * cm + 0.5, my + Math.floor(i / N) * cm + 0.5, cm - 1, cm - 1);
      }
      frame(ctx, x + POKE_MID * cm, my + POKE_MID * cm, cm, cm, palette.accent, 2.5);
      const before = base[l].d[MID], after = now[l].d[MID], changed = Math.abs(after - before) > 1e-9;
      const ty = my + mw + 16;
      label(ctx, U.reach.mid, x + mw / 2, ty, palette.muted, 11, "center");
      label(ctx, `${before.toFixed(3)} → ${after.toFixed(3)}`, x + mw / 2, ty + 18, palette.ink, 12, "center");
      if (dist > 0) label(ctx, changed ? U.reach.differs : U.reach.same, x + mw / 2, ty + 38, changed ? palette.anomaly : palette.mint, 13, "center");
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.reach.poke}>
          <span>{U.reach.poke}</span>
          {[0, 1, 2, 3, 4].map((d) => (
            <button key={d} type="button" className={dist === d ? "on" : ""} onClick={() => setDist(d)}>{d === 0 ? U.reach.none : `${d}${U.reach.cells}`}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
