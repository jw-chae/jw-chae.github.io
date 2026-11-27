"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { bar, line, signed } from "./kit";
import { LA_GRAY64, LA_RGB32 } from "./la-cat";
import { laCopy } from "./la-copy";
import {
  CELLS32, GRAY_SHUFFLED, NO_BG, ORDER, PAD, approx, blit, cellFrame, fitSize, fix, isPortrait, pc, pcaOf, picture, recon, rgbCss,
  rgbFromCss, svdOf, swatch, tag, thousands, vec, vecFix,
} from "./la-draw";
import {
  CELLS, EYE64, KS, LAYERS, YCC, YCC_INV, add, cell, coords, dot, invisibleStep, isBg, matVec, mean, rankOf, scale, stored, type LayerKey, type Mat, type Vec,
} from "./la-math";

const U = laCopy.ui;
const EYE = cell(LA_RGB32, "eyeL");
const [ER, EC] = CELLS.eyeL;
const [TR, TC] = CELLS.twin;
const TWIN = cell(LA_RGB32, "twin");

/* ------------------------------------------------------------------ */
/* 05 · What a layer cannot see                                         */
/* ------------------------------------------------------------------ */

const LAYER_KEYS: LayerKey[] = ["y", "cc", "ycc", "ycc4"];
const Y_MEAN = mean(CELLS32.map((v) => [dot(YCC[0], v)]))[0];
/** The picture as the layer's output alone can show it: gray for the brightness row, colour at the picture's mean brightness for Cb and Cr. */
function seenAs(key: LayerKey, v: Vec): Vec {
  if (key === "y") { const g = dot(YCC[0], v); return [g, g, g]; }
  if (key === "cc") return matVec(YCC_INV, [Y_MEAN, dot(YCC[1], v), dot(YCC[2], v)]);
  return v;
}

export function NullScene() {
  const [li, setLi] = useState(0);
  const [amt, setAmt] = useState(0);
  const T = U.rank;
  const key = LAYER_KEYS[li], W = LAYERS[key], step = invisibleStep(LA_RGB32, key);
  const t = step ? amt / 20 : 0;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), fs = w < 420 ? 11 : 12;
    const x1 = step ? add(EYE, scale(step, t)) : EYE;
    const P = port ? Math.min(w - 2 * PAD, 190) : Math.min(210, w * 0.42), yT = 32;
    label(ctx, T.seen, PAD, 16, palette.muted, fitSize(ctx, T.seen, port ? w - 2 * PAD : P + 60, 12, 11));
    blit(ctx, picture(`la-seen-${key}`, 32, 32, (r, c) => seenAs(key, LA_RGB32[r][c])), PAD, yT, P);
    // the changed eye cell, as this layer shows it: identical to before, because the output is identical
    const k32 = P / 32;
    ctx.fillStyle = rgbCss(seenAs(key, x1)); ctx.fillRect(PAD + EC * k32, yT + ER * k32, k32, k32);
    cellFrame(ctx, PAD, yT, P, 32, ER, EC, ER + 1, EC + 1, palette.accent, 2);
    if (key === "y") cellFrame(ctx, PAD, yT, P, 32, TR, TC, TR + 1, TC + 1, palette.mint, 2);

    const x2 = port ? PAD : PAD + P + 20, y2 = port ? yT + P + 22 : yT, sw = 34;
    const swatchRow = (v: Vec, name: string, y: number, strong: boolean) => {
      swatch(ctx, v, x2, y, sw, sw, strong ? palette.accent : palette.frame, strong ? 2 : 1);
      label(ctx, name, x2 + sw + 10, y + 9, strong ? palette.accent : palette.muted, 11);
      label(ctx, vecFix(v, 4), x2 + sw + 10, y + 27, palette.ink, fitSize(ctx, vecFix(v, 4), w - x2 - sw - 10 - PAD, 12, 9));
    };
    swatchRow(EYE, T.before, y2, false);
    swatchRow(x1, T.after, y2 + sw + 12, t > 0);
    const rowsUsed = key === "y" ? 3 : 2;
    if (key === "y") {
      swatch(ctx, TWIN, x2, y2 + 2 * (sw + 12), sw, sw, palette.mint, 2);
      label(ctx, `${T.twin} ${fix(dot(YCC[0], TWIN), 4)}`, x2 + sw + 10, y2 + 2 * (sw + 12) + 9, palette.mint, 11);
      label(ctx, vecFix(TWIN, 4), x2 + sw + 10, y2 + 2 * (sw + 12) + 27, palette.ink, fitSize(ctx, vecFix(TWIN, 4), w - x2 - sw - 10 - PAD, 12, 9));
    }

    // the layer's outputs for the changed cell; they never move
    const yo = y2 + rowsUsed * (sw + 12) + 22, out = matVec(W, x1), outBefore = matVec(W, EYE);
    label(ctx, T.out, x2, yo, palette.muted, 11);
    out.forEach((v, i) => {
      const y = yo + 20 + i * 20;
      label(ctx, `${i + 1}${T.n}`, x2, y, palette.muted, 11);
      label(ctx, fix(v, 4), x2 + 30, y, palette.ink, fs);
      if (t > 0 && Math.abs(v - outBefore[i]) < 1e-9) label(ctx, "=", x2 + 96, y, palette.mint, fs);
      if (key === "ycc4" && i === 3) label(ctx, T.sum, x2 + 112, y, palette.mint, 11);
    });

    // rank and the invisible directions
    const r = rankOf(W), yr = Math.min(h - 40, yo + 20 + out.length * 20 + 18);
    label(ctx, `${T.rank} ${r} · ${T.hidden} 3 − ${r} = ${3 - r}`, x2, yr, palette.ink, fs);
    if (!step) label(ctx, T.none, x2, yr + 20, palette.normal, 11);
    else if (!port) W.forEach((row, i) => label(ctx, `${i + 1}: ${vecFix(row, 3)}`, x2, yr + 20 + i * 18, palette.muted, 10));
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.layer}>
          <span>{T.layer}</span>
          {T.layers.map((s, i) => <button key={s} type="button" className={li === i ? "on" : ""} onClick={() => { setLi(i); setAmt(0); }}>{s}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{T.amount} <b>{(amt / 20).toFixed(2)}</b></span>
          <input type="range" min={0} max={20} step={1} value={step ? amt : 0} disabled={!step} onChange={(e) => setAmt(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · Singular value decomposition of the 64 × 64 gray table          */
/* ------------------------------------------------------------------ */

const LOG_LO = Math.log10(0.002), LOG_HI = Math.log10(60);
/** Rows of the shuffled table that hold the eye block's rows. */
const EYE_ROWS_SHUFFLED = ORDER.map((src, pos) => (src >= EYE64.r0 && src < EYE64.r1 ? pos : -1)).filter((p) => p >= 0);

function rmsRows(A: Mat, B: Mat, rows: number[], c0: number, c1: number) {
  let s = 0, n = 0;
  rows.forEach((i) => { for (let j = c0; j < c1; j++) { s += (A[i][j] - B[i][j]) ** 2; n++; } });
  return Math.sqrt(s / n);
}

export function SvdScene() {
  const [ki, setKi] = useState(0);
  const [shuf, setShuf] = useState(false);
  const T = U.svd;
  const k = KS[ki];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const d = svdOf(shuf), A = shuf ? GRAY_SHUFFLED : LA_GRAY64, Ak = approx(shuf, k), tag2 = shuf ? "s" : "o";
    const gap = 12, strip = 12;
    const P = port ? Math.min((w - 2 * PAD - gap - strip) / 2, 150) : Math.min((w - 2 * PAD - 2 * gap - strip) / 3, 150);
    const yT = 44, xo = PAD, xm = PAD + P + gap + strip;
    const xd = port ? PAD : xm + P + gap, yd = port ? yT + P + 34 : yT;
    const gray = (v: number): Vec => [v, v, v];
    blit(ctx, picture(`la-g64-${tag2}`, 64, 64, (r, c) => gray(A[r][c])), xo, yT, P);
    blit(ctx, picture(`la-ak-${tag2}-${k}`, 64, 64, (r, c) => gray(Ak[r][c])), xm, yT, P);
    blit(ctx, picture(`la-dk-${tag2}-${k}`, 64, 64, (r, c) => rgbFromCss(signed(A[r][c] - Ak[r][c], 0.4))), xd, yd, P);
    label(ctx, T.orig, xo, yT - 22, palette.muted, 11);
    label(ctx, `${k}${T.approx}`, xm, yT - 22, palette.accent, 12);
    label(ctx, T.diff, xd, yd - (port ? 10 : 22), palette.muted, 11);
    // the newest sheet's column profile (left of the middle picture) and row profile (above it)
    const ui = d.U.map((row) => row[k - 1]), vi = d.V.map((row) => row[k - 1]);
    const mu = Math.max(...ui.map(Math.abs)), mv = Math.max(...vi.map(Math.abs)), c = P / 64;
    ui.forEach((v, i) => { ctx.fillStyle = signed(v, mu); ctx.fillRect(xm - strip, yT + i * c, strip - 3, Math.max(1, c)); });
    vi.forEach((v, j) => { ctx.fillStyle = signed(v, mv); ctx.fillRect(xm + j * c, yT - strip, Math.max(1, c), strip - 3); });
    if (!shuf) [[xo, yT], [xm, yT], [xd, yd]].forEach(([x, y]) => cellFrame(ctx, x, y, P, 64, EYE64.r0, EYE64.c0, EYE64.r1, EYE64.c1, palette.accent, 1.6));

    // numbers for this k
    const err = Math.sqrt(A.reduce((s, row, i) => s + row.reduce((q, v, j) => q + (v - Ak[i][j]) ** 2, 0), 0) / 4096);
    const rows = shuf ? EYE_ROWS_SHUFFLED : Array.from({ length: EYE64.r1 - EYE64.r0 }, (_, i) => EYE64.r0 + i);
    const eyeErr = rmsRows(A, Ak, rows, EYE64.c0, EYE64.c1);
    const tx = port ? PAD + P + gap + 6 : PAD, ty = port ? yd + 10 : yT + P + 26;
    const over = stored(k) > 4096 ? palette.anomaly : palette.muted;
    const lines: [string, string][] = [
      [`${T.err} ${fix(err, 3)}`, palette.ink],
      [`${T.eye} ${fix(eyeErr, 3)}`, palette.accent],
      [`${T.stored} ${thousands(stored(k))}`, over],
      [`${T.of} 4,096`, palette.muted],
    ];
    if (port) lines.forEach(([s, col], i) => label(ctx, s, tx, ty + i * 22, col, 12));
    else lines.forEach(([s, col], i) => label(ctx, s, tx + (i % 2 === 1 ? (w - 2 * PAD) / 2 : 0), ty + (i >= 2 ? 22 : 0), col, 12));

    // the strengths, log scale
    const bTop = port ? yd + P + 52 : ty + 62, bH = Math.max(60, Math.min(port ? 110 : 96, h - bTop - 26)), bw = (w - 2 * PAD) / 64;
    label(ctx, T.sigma, PAD, bTop - (port ? 28 : 10), palette.muted, 11);
    line(ctx, PAD, bTop + bH, w - PAD, bTop + bH, palette.frame, 1);
    d.S.forEach((s, i) => {
      const hh = Math.max(1, ((Math.log10(Math.max(s, 0.002)) - LOG_LO) / (LOG_HI - LOG_LO)) * bH);
      ctx.fillStyle = i < k ? palette.accent : palette.track2;
      ctx.fillRect(PAD + i * bw + 0.5, bTop + bH - hh, Math.max(1, bw - 1), hh);
    });
    label(ctx, `σ = ${d.S.slice(0, 5).map((v) => v.toFixed(1)).join(", ")} …`, port ? PAD : w - PAD, bTop - 10, palette.ink, 11, port ? "left" : "right");
    label(ctx, "1", PAD, bTop + bH + 12, palette.muted, 10);
    label(ctx, "64", w - PAD, bTop + bH + 12, palette.muted, 10, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.k}>
          <span>{T.k}</span>
          {KS.map((v, i) => <button key={v} type="button" className={ki === i ? "on" : ""} onClick={() => setKi(i)}>{v}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.order}>
          <span>{T.order}</span>
          {T.orders.map((s, i) => <button key={s} type="button" className={shuf === (i === 1) ? "on" : ""} onClick={() => setShuf(i === 1)}>{s}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · Covariance, eigenvectors, and what the first direction keeps    */
/* ------------------------------------------------------------------ */

const coordCache = new Map<string, Vec[]>();
function coordsOf(noBg: boolean): Vec[] {
  const key = noBg ? "n" : "a";
  let m = coordCache.get(key);
  if (!m) { const p = pcaOf(noBg); m = (noBg ? NO_BG : CELLS32).map((v) => coords(p, v)); coordCache.set(key, m); }
  return m;
}
const EYE_R = cell(LA_RGB32, "eyeR");

export function PcaScene() {
  const [k, setK] = useState(1);
  const [noBg, setNoBg] = useState(false);
  const T = U.pca;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), fs = w < 420 ? 11 : 12;
    const p = pcaOf(noBg), cs = coordsOf(noBg), set = noBg ? NO_BG : CELLS32;
    // the cloud: first coordinate across, second up; each dot painted in its cell's colour
    const Sw = port ? w - 2 * PAD : Math.min(w * 0.48, 270), Sh = port ? 180 : 250, sx = PAD, sy = 30;
    const xs = cs.map((c) => c[0]), ys = cs.map((c) => c[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const mx = (x1 - x0) * 0.06, my = (y1 - y0) * 0.08;
    const px = (v: number) => sx + ((v - x0 + mx) / (x1 - x0 + 2 * mx)) * Sw, py = (v: number) => sy + Sh - ((v - y0 + my) / (y1 - y0 + 2 * my)) * Sh;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(sx, sy, Sw, Sh);
    ctx.strokeStyle = palette.frame; ctx.strokeRect(sx + 0.5, sy + 0.5, Sw - 1, Sh - 1);
    line(ctx, px(0), sy, px(0), sy + Sh, palette.grid, 1); line(ctx, sx, py(0), sx + Sw, py(0), palette.grid, 1);
    set.forEach((v, i) => { ctx.fillStyle = rgbCss(v); ctx.beginPath(); ctx.arc(px(cs[i][0]), py(cs[i][1]), 2.8, 0, Math.PI * 2); ctx.fill(); });
    [[EYE, 2.4, 7], [EYE_R, 1.2, 6]].forEach(([v, lw, r]) => {
      const c = coords(p, v as Vec);
      ctx.save(); ctx.strokeStyle = palette.accent; ctx.lineWidth = lw as number; ctx.beginPath(); ctx.arc(px(c[0]), py(c[1]), r as number, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    });
    label(ctx, `${T.cloud} · ${thousands(set.length)}${T.cells}`, sx, 14, palette.muted, 11);
    label(ctx, T.ax1, sx + Sw - 4, sy + Sh - 10, palette.muted, 11, "right");
    label(ctx, T.ax2, sx + 6, sy + 12, palette.muted, 11);
    const ce = coords(p, EYE);
    tag(ctx, `${fix(ce[0], 3)}, ${fix(ce[1], 3)}`, px(ce[0]) - 10, py(ce[1]) + 16, palette.accent, 10, "right");
    if (!noBg) {
      // the 406 background cells sit almost on one point; name the spot
      const bgc = mean(CELLS32.filter(isBg).map((v) => coords(p, v)));
      tag(ctx, `${T.bgSpot} ${thousands(CELLS32.length - NO_BG.length)}${T.cells}`, px(bgc[0]) - 8, py(bgc[1]) - 14, palette.muted, 11, "right");
      ctx.save(); ctx.strokeStyle = palette.muted; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(px(bgc[0]), py(bgc[1]), 6, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }

    // the picture rebuilt from the first k directions, the eye before and after, and each direction's share
    const xr = port ? PAD : sx + Sw + 18, yr = port ? sy + Sh + 28 : 30, P = Math.min(port ? 140 : 150, w - xr - PAD);
    label(ctx, T.recon, xr, yr - 14, palette.muted, fitSize(ctx, T.recon, port ? w - 2 * PAD : w - xr - PAD, 12, 11));
    const rec = recon(noBg, k);
    blit(ctx, picture(`la-pca-${noBg ? 1 : 0}-${k}`, 32, 32, (r, c) => rec[r * 32 + c]), xr, yr, P);
    cellFrame(ctx, xr, yr, P, 32, ER, EC, ER + 1, EC + 1, palette.accent, 2);
    const xs2 = port ? xr + P + 14 : xr, ys2 = port ? yr : yr + P + 16, sw = 28;
    const eyeRec = rec[ER * 32 + EC];
    [[EYE, T.eyeOrig], [eyeRec, `${T.eyeRec}, k = ${k}`]].forEach(([v, name], i) => {
      const y = ys2 + i * (sw + 12);
      swatch(ctx, v as Vec, xs2, y, sw, sw, i === 1 ? palette.accent : palette.frame, i === 1 ? 2 : 1);
      label(ctx, name as string, xs2 + sw + 8, y + 7, palette.muted, fitSize(ctx, name as string, w - xs2 - sw - 8 - PAD, 12, 11));
      label(ctx, vec(v as Vec, 3), xs2 + sw + 8, y + 23, palette.ink, fitSize(ctx, vec(v as Vec, 3), w - xs2 - sw - 8 - PAD, 12, 9));
    });
    const yb = port ? yr + P + 22 : sy + Sh + 26, xb = PAD, bw = (port ? w - 2 * PAD : Sw) - 96;
    label(ctx, T.share, xb, yb, palette.muted, 11);
    p.share.forEach((s, i) => {
      const y = yb + 20 + i * 36, on = i < k;
      label(ctx, T.dirs[i], xb, y, on ? palette.accent : palette.muted, 11);
      bar(ctx, xb + 34, y - 5, bw, 10, s, on ? palette.accent : palette.muted);
      label(ctx, pc(s), xb + 40 + bw, y, on ? palette.ink : palette.muted, fs);
      label(ctx, vecFix(p.dirs[i], 3), xb + 34, y + 16, palette.muted, 10);
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.k}>
          <span>{T.k}</span>
          {[1, 2, 3].map((v) => <button key={v} type="button" className={k === v ? "on" : ""} onClick={() => setK(v)}>{v}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.set}>
          <span>{T.set}</span>
          {T.sets.map((s, i) => <button key={s} type="button" className={noBg === (i === 1) ? "on" : ""} onClick={() => setNoBg(i === 1)}>{s}</button>)}
        </div>
      </div>
    </div>
  );
}
