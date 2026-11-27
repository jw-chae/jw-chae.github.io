"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { line, rbox } from "./kit";
import { attnCopy } from "./attn-copy";
import {
  CONTEXTS, CROP_OUT, DEVICE, EYE_CELL, FOUR_KIND, FOUR_X, KIND, LIN_KS, LMS, METHODS, SITUATIONS, X, cacheBytes, chooseRows, intensity,
  kvPerToken, linformer, quadShare, sharesAt, stateFirst, tableFirst, type MethodKey,
} from "./attn-math";
import { KIND_DOT, PAD, bytes, comma, drawCrop, fix, hbar, isPortrait, ms, num, pc, plane, tag, textW, tint, useCatImage, vec } from "./attn-draw";

const U = attnCopy.ui;
const KERN = palette.accent2;

/* ------------------------------------------------------------------ */
/* 06 · Linformer: the eye's row over k pooled keys                     */
/* ------------------------------------------------------------------ */

const PX: [number, number] = [-3.0, 1.4], PY: [number, number] = [-2.0, 1.5];

export function LowRankScene() {
  const [k, setK] = useState(16);
  const T = U.lowrank;
  const img = useCatImage();
  const L = linformer(k);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), fs = w < 420 ? 11 : 12;
    label(ctx, `${T.row}: ${k} ${U.wall.cells} · k = ${k}`, PAD, 16, palette.ink, 13);

    // the crop with the pooling groups tinted
    const S = portrait ? 128 : Math.min(176, w * 0.32), cx = PAD, cy = 34, c = S / 4;
    drawCrop(ctx, img.current, cx, cy, S);
    if (k < 16) L.groups.forEach((g, gi) => g.forEach((i) => {
      const x = cx + (i % 4) * c, y = cy + Math.floor(i / 4) * c;
      ctx.fillStyle = tint(gi, 0.16); ctx.fillRect(x, y, c, c);
      ctx.save(); ctx.strokeStyle = tint(gi, 0.95); ctx.lineWidth = 2; ctx.strokeRect(x + 2.5, y + 2.5, c - 5, c - 5); ctx.restore();
    }));
    ctx.save(); ctx.strokeStyle = "rgba(20,24,33,0.35)"; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(cx + i * c, cy); ctx.lineTo(cx + i * c, cy + S); ctx.moveTo(cx, cy + i * c); ctx.lineTo(cx + S, cy + i * c); ctx.stroke(); }
    ctx.strokeStyle = palette.mint; ctx.lineWidth = 3;
    ctx.strokeRect(cx + (EYE_CELL % 4) * c + 1, cy + Math.floor(EYE_CELL / 4) * c + 1, c - 2, c - 2);
    ctx.restore();
    tag(ctx, U.reach.eye, cx + (EYE_CELL % 4 + 0.5) * c, cy + Math.floor(EYE_CELL / 4) * c + c - 9, palette.mint, 11);

    // the plane: 16 patches, pooled keys with the eye's share, exact read and current read
    const qx = portrait ? PAD : cx + S + 20, qy = portrait ? cy + S + 26 : cy, qw = w - PAD - qx, qh = portrait ? h - (cy + S + 26) - 96 : h - cy - 92;
    label(ctx, T.plane, qx, qy - 11, palette.muted, 11);
    const at = plane(ctx, qx, qy, qw, qh, PX, PY);
    { const [x1, y1] = at([PX[1], 0]), [x2, y2] = at([0, PY[1]]); label(ctx, T.axisX, x1 - 5, y1 + 10, palette.muted, 11, "right"); label(ctx, T.axisY, x2 - 5, y2 + 10, palette.muted, 11, "right"); }
    X.forEach((v, i) => { const [x, y] = at(v); ctx.fillStyle = KIND_DOT[KIND[i]]; ctx.globalAlpha = 0.65; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; });
    const showShares = k <= 8;
    L.keys.forEach((kk, gi) => {
      const [x, y] = at(kk), r = 5 + 2.2 * Math.sqrt(L.groups[gi].length);
      if (k < 16) L.groups[gi].forEach((i) => { const [mx, my] = at(X[i]); line(ctx, mx, my, x, y, `rgba(${palette.inkRgb},0.15)`, 1); });
      ctx.fillStyle = k < 16 ? tint(gi, 0.55) : "#ffffff"; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = palette.ink; ctx.lineWidth = 1.2; ctx.stroke();
      if (showShares && L.w[gi] >= 0.05) label(ctx, pc(L.w[gi], 0), x + r + 3, y - 7, palette.normal, 11);
    });
    const [ex, ey] = at(CROP_OUT), [nx, ny] = at(L.out);
    if (L.err > 1e-6) line(ctx, ex, ey, nx, ny, palette.anomaly, 1.6, [4, 3]);
    ctx.fillStyle = palette.mint; ctx.beginPath(); ctx.arc(ex, ey, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = palette.accent; ctx.beginPath(); ctx.arc(nx, ny, 5, 0, Math.PI * 2); ctx.fill();

    // what the eye reads
    const yT = h - 64;
    line(ctx, PAD, yT - 16, w - PAD, yT - 16, palette.frame, 1);
    label(ctx, `${T.exact} ${vec(CROP_OUT)}`, PAD, yT, palette.mint, fs);
    label(ctx, `${T.now} ${vec(L.out)}`, PAD, yT + 22, palette.accent, fs);
    label(ctx, `${T.gap} ${fix(L.err)}`, w - PAD, yT + 22, L.err > 0.25 ? palette.anomaly : palette.mint, fs, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.k}>
          <span>{T.k}</span>
          {LIN_KS.map((v) => <button key={v} type="button" className={k === v ? "on" : ""} onClick={() => setK(v)}>{v}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · Linear attention: order of multiplication, and the shares      */
/* ------------------------------------------------------------------ */

const SIZES: Record<string, { N: number; d: number }> = { four: { N: 4, d: 2 }, k1: { N: 4096, d: 64 }, k2: { N: 16384, d: 64 } };
const madds = (v: number) => (v >= 1e8 ? `${num(v / 1e8, 1)}억` : v >= 1e4 ? `${comma(v / 1e4)}만` : comma(v));

export function LinearScene() {
  const [size, setSize] = useState("four");
  const [c, setC] = useState(1);
  const T = U.linear;
  const { N, d } = SIZES[size];
  const sh = sharesAt(c);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), narrow = w < 420, fs = narrow ? 11 : 12;
    label(ctx, `N = ${comma(N)}, d = ${d}`, PAD, 16, palette.ink, 13);

    // two orders: the middle table is N × N or d × d, drawn to scale against a fixed box
    const box = narrow ? 64 : 76, y0 = 34;
    const rows: [string, number, string, number, string][] = [
      [T.tableFirst, N, `${comma(N)} × ${comma(N)}`, tableFirst(N, d), palette.anomaly],
      [T.stateFirst, d, `${d} × ${d}`, stateFirst(N, d), palette.mint],
    ];
    const colW = (w - 2 * PAD) / 2;
    rows.forEach(([name, side, dims, m, col], i) => {
      const x = PAD + i * colW;
      label(ctx, name, x, y0, palette.ink, fs);
      const s = Math.max(4, (side / N) * box);
      ctx.fillStyle = i === 0 ? `rgba(${palette.anomalyRgb},0.25)` : `rgba(15,157,106,0.3)`; ctx.fillRect(x, y0 + 14, s, s);
      ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y0 + 14.5, s - 1, s - 1);
      label(ctx, `${T.middle} ${dims}`, x, y0 + box + 28, palette.muted, 11);
      label(ctx, `${T.madds} ${madds(m)}`, x, y0 + box + 46, col, fs);
    });

    // the eye's shares over the four tokens: softmax against the kernel
    const y1 = y0 + box + (portrait ? 84 : 74);
    line(ctx, PAD, y1 - 16, w - PAD, y1 - 16, palette.frame, 1);
    label(ctx, `${T.shares} · q × ${num(c, 1)}`, PAD, y1, palette.ink, fs);
    const nameW = narrow ? 44 : 56, barX = PAD + nameW, barW = w - PAD - barX - 52, rh = portrait ? 46 : 40;
    FOUR_KIND.forEach((kd, j) => {
      const y = y1 + 20 + j * rh;
      label(ctx, T.names[kd], PAD, y + 9, palette.ink, 11);
      hbar(ctx, barX, y, barW, 9, sh.soft[j], palette.normal);
      label(ctx, pc(sh.soft[j]), w - PAD, y + 4, palette.normal, 11, "right");
      hbar(ctx, barX, y + 13, barW, 9, sh.kern[j], KERN);
      label(ctx, pc(sh.kern[j]), w - PAD, y + 18, KERN, 11, "right");
    });
    const yL = y1 + 20 + 4 * rh + 4;
    ctx.fillStyle = palette.normal; ctx.fillRect(PAD, yL - 5, 10, 10); label(ctx, T.soft, PAD + 14, yL, palette.muted, 11);
    const kx = PAD + textW(ctx, T.soft) + 34;
    ctx.fillStyle = KERN; ctx.fillRect(kx, yL - 5, 10, 10); label(ctx, T.kern, kx + 14, yL, palette.muted, 11);

    // what the eye reads under each
    const read = (wts: number[]) => [0, 1].map((dd) => wts.reduce((s, wi, i) => s + wi * FOUR_X[i][dd], 0));
    const yR = h - 22;
    label(ctx, `${T.reads}: ${vec(read(sh.soft))}`, PAD, yR - (narrow ? 20 : 0), palette.normal, fs);
    label(ctx, vec(read(sh.kern)), w - PAD, yR, KERN, fs, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.size} style={{ flexWrap: "wrap" }}>
          {Object.keys(SIZES).map((s) => <button key={s} type="button" className={size === s ? "on" : ""} onClick={() => setSize(s)}>{T.sizes[s]}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{T.scale} <b>{num(c, 1)}</b></span>
          <input type="range" min={0.5} max={4} step={0.5} value={c} onChange={(e) => setC(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · Decoding: K, V heads and the cache against context length      */
/* ------------------------------------------------------------------ */

const ctxName = (n: number) => `${n / 1024}K`;

export function DecodeScene() {
  const [mi, setMi] = useState(0);
  const [ci, setCi] = useState(1);
  const T = U.decode;
  const m = LMS[mi], n = CONTEXTS[ci];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), narrow = w < 420, fs = narrow ? 11 : 12;
    label(ctx, `${T.names[m.key]} · ${T.ctx} ${ctxName(n)}`, PAD, 16, palette.ink, 13);

    // 32 query heads and the K, V heads they share
    const y0 = 40, cell = Math.min(12, (w - 2 * PAD) / 32 - 2), stepX = (w - 2 * PAD) / 32;
    label(ctx, T.qHeads, PAD, y0 - 8, palette.muted, 11);
    const group = m.heads / m.kv, kvStep = (w - 2 * PAD) / m.kv;
    for (let i = 0; i < m.heads; i++) {
      const x = PAD + i * stepX + (stepX - cell) / 2, kv = Math.floor(i / group), kx = PAD + kv * kvStep + kvStep / 2;
      line(ctx, x + cell / 2, y0 + cell + 2, kx, y0 + 40, `rgba(${palette.normalRgb},0.35)`, 1);
      ctx.fillStyle = `rgba(${palette.accentRgb},0.75)`; ctx.fillRect(x, y0 + 2, cell, cell);
    }
    const kvW = Math.min(cell * Math.max(1, group * 0.6), kvStep - 3);
    for (let j = 0; j < m.kv; j++) {
      const kx = PAD + j * kvStep + kvStep / 2;
      ctx.fillStyle = palette.normal; ctx.fillRect(kx - kvW / 2, y0 + 40, kvW, cell);
    }
    label(ctx, `${T.kvHeads} ${m.kv}`, PAD, y0 + 40 + cell + 14, palette.normal, 11);

    // cache against context length, both axes doubling per step
    const gx = PAD + (narrow ? 34 : 40), gy = y0 + 80, gw = w - PAD - gx - (narrow ? 60 : 78), gh = portrait ? 190 : h - gy - 96;
    const xs = [10, 17], ys = [24, 37]; // log2 of 1K..128K tokens and of 16MB..128GB
    const X0 = (t: number) => gx + ((Math.log2(t) - xs[0]) / (xs[1] - xs[0])) * gw, Y0 = (b: number) => gy + gh - ((Math.log2(b) - ys[0]) / (ys[1] - ys[0])) * gh;
    ctx.fillStyle = "#ffffff"; ctx.fillRect(gx, gy, gw, gh);
    ctx.strokeStyle = palette.frame; ctx.strokeRect(gx + 0.5, gy + 0.5, gw - 1, gh - 1);
    [2 ** 24, 2 ** 27, 2 ** 30, 2 ** 33, 2 ** 36].forEach((b) => { line(ctx, gx, Y0(b), gx + gw, Y0(b), palette.grid, 1); label(ctx, bytes(b), gx - 4, Y0(b), palette.muted, 11, "right"); });
    CONTEXTS.forEach((t) => label(ctx, ctxName(t), X0(t), gy + gh + 12, palette.muted, 11, "center"));
    label(ctx, T.axisX, gx + gw, gy + gh + 28, palette.muted, 11, "right");
    LMS.forEach((mm, i) => {
      const on = i === mi;
      ctx.save(); ctx.strokeStyle = on ? palette.accent : "rgba(20,24,33,0.3)"; ctx.lineWidth = on ? 2.6 : 1.2;
      ctx.beginPath();
      for (let s = 0; s <= 70; s++) { const t = 2 ** (xs[0] + (s / 70) * (xs[1] - xs[0])), x = X0(t), y = Y0(cacheBytes(mm, t)); if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke(); ctx.restore();
      const yEnd = Y0(cacheBytes(mm, 2 ** xs[1]));
      label(ctx, T.names[mm.key].replace(" 가정", ""), gx + gw + 8, yEnd + (mm.key === "mistral" ? 8 : mm.key === "mqa" ? -2 : 0), on ? palette.accent : palette.muted, 11);
    });
    const cx = X0(n), cy = Y0(cacheBytes(m, n));
    ctx.fillStyle = palette.accent; ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();
    if (n > m.trained) tag(ctx, T.outside, Math.min(cx, gx + gw - 44), cy - 16, palette.anomaly, 11);

    // numbers
    const yN = gy + gh + (portrait ? 50 : 46), cache = cacheBytes(m, n);
    const items: [string, string, string][] = [
      [T.perToken, bytes(kvPerToken(m)), palette.ink],
      [T.cache, bytes(cache), palette.accent],
      [T.step, ms(cache / DEVICE.bw), palette.normal],
      [T.intensity, num(intensity(m, n), 1), palette.ink],
    ];
    if (portrait) items.forEach(([a, b, col], i) => { label(ctx, a, PAD, yN + i * 20, palette.muted, 11); label(ctx, b, w - PAD, yN + i * 20, col, fs, "right"); });
    else items.forEach(([a, b, col], i) => { const x = PAD + (i % 2) * (w - 2 * PAD) / 2, y = yN + Math.floor(i / 2) * 22; label(ctx, `${a} ${b}`, x, y, col, fs); });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.model} style={{ flexWrap: "wrap" }}>
          {LMS.map((mm, i) => <button key={mm.key} type="button" className={mi === i ? "on" : ""} onClick={() => setMi(i)}>{T.names[mm.key]}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{T.ctx} <b>{ctxName(n)}</b></span>
          <input type="range" min={0} max={CONTEXTS.length - 1} step={1} value={ci} onChange={(e) => setCi(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 · Choosing: one situation, six methods                           */
/* ------------------------------------------------------------------ */

export function ChooseScene() {
  const [si, setSi] = useState(1);
  const T = U.choose;
  const s = SITUATIONS[si], R = chooseRows(s);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const narrow = w < 420, fs = narrow ? 11 : 12;
    label(ctx, T.names[s.key], PAD, 16, palette.ink, 13);

    // the baseline: nothing done
    const memName = s.decode ? T.cache : s.train ? T.tables : T.layerTables;
    rbox(ctx, PAD, 30, w - 2 * PAD, narrow ? 50 : 32, 8, "rgba(20,24,33,0.04)", palette.frame, 1);
    label(ctx, T.none, PAD + 10, 46, palette.muted, 11);
    const base = s.decode ? `${memName} ${bytes(R.baseMemory)}` : `${T.share} ${pc(quadShare(s.N))} · ${memName} ${bytes(R.baseMemory)}`;
    label(ctx, base, narrow ? PAD + 10 : w - PAD - 10, narrow ? 66 : 46, palette.ink, fs, narrow ? "left" : "right");

    // the table
    const cols = narrow ? [PAD, PAD + 112, PAD + 160, PAD + 248, w - PAD] : [PAD, PAD + 180, PAD + 262, PAD + 360, w - PAD];
    const yH = narrow ? 102 : 88;
    [T.method, T.exact, narrow ? T.retrainShort : T.retrain, T.compute, T.memory].forEach((t, i) => label(ctx, t, cols[i], yH, palette.muted, 11, i >= 3 ? "right" : "left"));
    line(ctx, PAD, yH + 11, w - PAD, yH + 11, palette.frame, 1);
    const rh = Math.min(48, (h - yH - 30) / METHODS.length);
    R.rows.forEach((r, i) => {
      const y = yH + 14 + (i + 0.5) * rh;
      if (i % 2 === 1) { ctx.fillStyle = "rgba(20,24,33,0.03)"; ctx.fillRect(PAD, y - rh / 2, w - 2 * PAD, rh); }
      label(ctx, T.methods[r.key as MethodKey], cols[0], y, palette.ink, 11);
      label(ctx, r.exact ? T.yes : T.no, cols[1], y, r.exact ? palette.mint : palette.muted, 11);
      label(ctx, r.retrain === "no" ? T.no : r.retrain === "part" ? T.part : T.yes, cols[2], y, r.retrain === "no" ? palette.mint : palette.muted, 11);
      const cmp = r.compute === null ? T.na : pc(r.compute);
      label(ctx, cmp, cols[3], y, r.compute !== null && r.compute < 0.6 ? palette.mint : palette.ink, fs, "right");
      const mem = r.memory === null ? T.na : bytes(r.memory);
      label(ctx, mem, cols[4], y, r.memory !== null && r.memory <= R.baseMemory / 4 ? palette.mint : palette.ink, fs, "right");
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.situation} style={{ flexWrap: "wrap" }}>
          {SITUATIONS.map((x, i) => <button key={x.key} type="button" className={si === i ? "on" : ""} onClick={() => setSi(i)}>{T.names[x.key]}</button>)}
        </div>
      </div>
    </div>
  );
}
