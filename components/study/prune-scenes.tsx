"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { frame, line, rbox } from "./kit";
import { pruneCopy } from "./prune-copy";
import {
  AMBER, BLUE, GREEN, PAD, RED, ax, axesFrame, ay, dot, drawHead, fix, hbar, isPortrait, pct, pct2, polyline, swatch, tint, weightTable,
  type Axes,
} from "./prune-kit";
import {
  BG_CELL, BIG_BITS, CURVE_MAG, CURVE_OBD, CUT_MAX, DENSE, DL_W1, EYE_CELL, HEAD_LABEL, HEAD_RGB, INIT, ITERATIVE, M24_W2, MAG_ORDER_W1, MB, MU50_W2,
  NET_24, NET_U50, RETRAIN, SAL_W1, TICKET_ROWS, W1_FLAT, W2SPARSE, accuracy, bits24, colourOf, correct, csrBits, cutFirst, denseBits,
  eyeCorrect, magMask, oneShot, pass, unitOf,
} from "./prune-math";

const U = pruneCopy.ui;
const PARTS = U.parts;
const RGB = U.rgb;

/* ------------------------------------------------------------------ */
/* 01 · cutting the smallest first-layer weights, one cell at a time    */
/* ------------------------------------------------------------------ */

const MAG_K = 8;
const MAG_NETS = Array.from({ length: MAG_K + 1 }, (_, k) => cutFirst(MAG_ORDER_W1, k));
const MAG_SCORE = MAG_NETS.map((n) => ({ correct: correct(n), eye: eyeCorrect(n) }));

export function MagScene() {
  const [which, setWhich] = useState(0);
  const [k, setK] = useState(0);
  const S = U.mag;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const tall = isPortrait(w, h);
    const cell = which === 0 ? EYE_CELL : BG_CELL;
    const x = HEAD_RGB[cell], truth = HEAD_LABEL[cell];
    const base = pass(DENSE, x), now = pass(MAG_NETS[k], x);
    const cutSet = new Set(MAG_ORDER_W1.slice(0, k)), last = k > 0 ? MAG_ORDER_W1[k - 1] : -1;

    // the picture, the cell's colour and the last cut
    const hs = tall ? 84 : 96;
    drawHead(ctx, PAD, 8, hs, cell, which === 0 ? BLUE : AMBER);
    const tx = PAD + hs + 12;
    label(ctx, S.colour, tx, 16, palette.muted, 11);
    swatch(ctx, x, tx, 26, 24, 24);
    label(ctx, x.map((v, j) => `${RGB[j]} ${fix(v)}`).join("  "), tx + 30, 38, palette.ink, 11);
    const lastText = last < 0 ? S.none : `${unitOf(last) + 1}번 ${U.unit}  ${RGB[colourOf(last)]}  ${fix(W1_FLAT[last])}`;
    label(ctx, S.last, tx, 62, palette.muted, 11);
    label(ctx, lastText, tx, 80, last < 0 ? palette.muted : RED, 12);

    // the cell's five probabilities
    const pTop = tall ? hs + 22 : 14, pLeft = tall ? PAD : Math.max(tx + 150, w / 2 + 20);
    const pW = (tall ? w - PAD - 58 : w - PAD - 58) - pLeft - 56;
    label(ctx, S.probs, pLeft, pTop - 4, palette.muted, 11);
    PARTS.forEach((name, c) => {
      const yy = pTop + 8 + c * 17;
      label(ctx, name, pLeft, yy + 6, c === truth ? GREEN : palette.ink, 11);
      hbar(ctx, pLeft + 56, yy, pW, 11, now.q[c], tint(palette.accentRgb, 0.8), pct2(now.q[c]), c === truth ? GREEN : palette.ink);
    });

    // first-layer table and the cell's eight sums
    const tTop = tall ? pTop + 8 + 5 * 17 + 40 : 146, ch = tall ? 26 : 24, cw = tall ? 38 : 44, tLeft = PAD + 22;
    label(ctx, S.layer, PAD, tTop - 22, palette.muted, 11);
    RGB.forEach((c, j) => label(ctx, c, tLeft + j * cw + cw / 2, tTop - 8, palette.muted, 11, "center"));
    const mask = DENSE.W1.map((r, i) => r.map((_, j) => (cutSet.has(i * 3 + j) ? 0 : 1)));
    weightTable(ctx, DENSE.W1, tLeft, tTop, cw, ch, { mask, max: 7.1, mark: (r, c) => (r * 3 + c === last ? RED : null) });
    for (let i = 0; i < 8; i++) label(ctx, `${i + 1}`, PAD + 8, tTop + i * ch + ch / 2, palette.muted, 11, "center");

    const bx = tLeft + 3 * cw + 16, bw = w - PAD - 84 - bx, zero = bx + bw / 2, sc = bw / 2 / 8;
    label(ctx, S.sums, bx, tTop - 22, palette.muted, 11);
    line(ctx, zero, tTop - 4, zero, tTop + 8 * ch, palette.frame, 1);
    label(ctx, "0", zero, tTop - 8, palette.muted, 10, "center");
    for (let i = 0; i < 8; i++) {
      const yy = tTop + i * ch + 5, bh = ch - 10, a0 = base.a[i], a1 = now.a[i];
      const x0 = zero + Math.min(0, a0) * sc;
      ctx.strokeStyle = "rgba(15,23,42,0.28)"; ctx.lineWidth = 1;
      ctx.strokeRect(x0 + 0.5, yy + 0.5, Math.abs(a0) * sc, bh);
      const on = a1 > 0;
      ctx.fillStyle = on ? tint(palette.normalRgb, 0.7) : "rgba(91,100,116,0.35)";
      ctx.fillRect(zero + Math.min(0, a1) * sc, yy + 2, Math.abs(a1) * sc, bh - 4);
      label(ctx, fix(a1), bx + bw + 8, yy + bh / 2, on ? palette.ink : palette.muted, 11);
      if (!on) label(ctx, S.off, w - PAD, yy + bh / 2, palette.muted, 10, "right");
    }

    // what this cut does to the whole picture
    const sY = tTop + 8 * ch + 26, sc0 = MAG_SCORE[k];
    label(ctx, `${U.acc}  ${sc0.correct} / 256  (${pct(sc0.correct / 256)})`, PAD, sY, palette.ink, 12);
    label(ctx, `${U.eye11}  ${sc0.eye} / 11`, PAD, sY + 20, palette.ink, 12);
    label(ctx, `${S.legend} · ${U.measured}`, PAD, h - 12, palette.muted, 10);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={S.cell}>
          <span>{S.cell}</span>
          {S.cells.map((name, i) => <button key={name} type="button" className={which === i ? "on" : ""} onClick={() => setWhich(i)}>{name}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{S.cut} <b>{k}</b></span>
          <input type="range" min={0} max={MAG_K} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · OBD: size versus predicted and real rise of the loss           */
/* ------------------------------------------------------------------ */

const PAIR = [6 * 3 + 0, 7 * 3 + 0];     // unit 7 R and unit 8 R

export function ObdScene() {
  const [axis, setAxis] = useState(0);
  const [k, setK] = useState(5);
  const S = U.obd;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const tall = isPortrait(w, h);
    const lg = (v: number) => Math.log10(Math.max(v, 1e-4));
    const A: Axes = { x: PAD + 40, y: 30, w: w - 2 * PAD - 50, h: tall ? 210 : 170, x0: 0, x1: 7.5, y0: -3.3, y1: 1.6 };
    label(ctx, `${axis === 0 ? S.pred : S.real}  (${S.log})`, PAD, 14, palette.muted, 11);
    axesFrame(ctx, A, [-3, -2, -1, 0, 1], (v) => (v >= 0 ? `${10 ** v}` : `0.${"0".repeat(-v - 1)}1`));
    [0, 2, 4, 6].forEach((v) => label(ctx, `${v}`, ax(A, v), A.y + A.h + 10, palette.muted, 10, "center"));
    label(ctx, S.size, A.x + A.w, A.y + A.h + 24, palette.muted, 11, "right");
    W1_FLAT.forEach((wv, f) => {
      const sal = SAL_W1[unitOf(f)][colourOf(f)], real = DL_W1[f];
      const px = ax(A, Math.abs(wv)), pyS = ay(A, lg(sal)), pyR = ay(A, lg(real));
      if (axis === 1) line(ctx, px, pyS, px, pyR, "rgba(42,111,214,0.3)", 1, [2, 2]);
      if (axis === 1) dot(ctx, px, pyS, 2.2, "rgba(42,111,214,0.3)", null);
      const py = axis === 0 ? pyS : pyR;
      dot(ctx, px, py, 4, tint(palette.normalRgb, 0.85));
      const pi = PAIR.indexOf(f);
      if (pi >= 0) {
        ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.stroke();
        const txt = `${unitOf(f) + 1}번 ${U.unit} R  ${fix(axis === 0 ? sal : real, 4)}`, ly = py + (pi === 0 ? -20 : 20);
        rbox(ctx, px + 8, ly - 9, txt.length * 7.4 + 8, 18, 4, "rgba(255,255,255,0.92)", AMBER, 1);
        label(ctx, txt, px + 12, ly, AMBER, 11);
      }
    });

    // accuracy as weights are cut in each order
    const B: Axes = { x: PAD + 40, y: A.y + A.h + 64, w: w - 2 * PAD - 50, h: tall ? 150 : 118, x0: 0, x1: CUT_MAX, y0: 0.3, y1: 1 };
    label(ctx, S.curve, PAD, B.y - 18, palette.muted, 11);
    axesFrame(ctx, B, [0.4, 0.6, 0.8, 1], (v) => `${Math.round(v * 100)}%`);
    [0, 4, 8, 12].forEach((v) => label(ctx, `${v}`, ax(B, v), B.y + B.h + 10, palette.muted, 10, "center"));
    line(ctx, ax(B, k), B.y, ax(B, k), B.y + B.h, AMBER, 1.5, [4, 3]);
    polyline(ctx, CURVE_MAG.map((v, i) => [ax(B, i), ay(B, v)] as [number, number]), "rgba(91,100,116,0.8)", 2);
    polyline(ctx, CURVE_OBD.map((v, i) => [ax(B, i), ay(B, v)] as [number, number]), BLUE, 2);
    dot(ctx, ax(B, k), ay(B, CURVE_MAG[k]), 4, palette.muted);
    dot(ctx, ax(B, k), ay(B, CURVE_OBD[k]), 4, BLUE);
    const ry = B.y + B.h + 30;
    label(ctx, `${S.byMag} ${pct(CURVE_MAG[k])}`, PAD, ry, palette.muted, 12);
    label(ctx, `${S.byObd} ${pct(CURVE_OBD[k])}`, tall ? PAD : PAD + 170, tall ? ry + 20 : ry, BLUE, 12);
    label(ctx, U.measured, w - PAD, h - 12, palette.muted, 10, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={S.axis}>
          <span>{S.axis}</span>
          {S.axes.map((name, i) => <button key={name} type="button" className={axis === i ? "on" : ""} onClick={() => setAxis(i)}>{name}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{S.k} <b>{k}</b></span>
          <input type="range" min={0} max={CUT_MAX} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · prune, then retrain                                             */
/* ------------------------------------------------------------------ */

const ONESHOT_ACC = RETRAIN.map((r) => accuracy(oneShot(r.s)));

export function RetrainScene() {
  const [i, setI] = useState(5);
  const [view, setView] = useState(2);
  const S = U.retrain;
  const row = RETRAIN[i];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const tall = isPortrait(w, h);
    const m1 = magMask(DENSE.W1, row.s), m2 = magMask(DENSE.W2, row.s);
    const c = tall ? 15 : 16;
    const drawMask = (m: number[][], x: number, y: number, name: string) => {
      label(ctx, name, x, y - 10, palette.muted, 11);
      m.forEach((r, ri) => r.forEach((v, ci) => {
        ctx.fillStyle = v ? tint(palette.accentRgb, 0.75) : "rgba(15,23,42,0.05)";
        ctx.fillRect(x + ci * c + 1, y + ri * c + 1, c - 2, c - 2);
      }));
    };
    drawMask(m1, PAD, 30, S.w1);
    drawMask(m2, PAD + 3 * c + 40, 30, S.w2);
    const mx = PAD + 3 * c + 40 + 8 * c + 28;
    label(ctx, `${S.kept} ${row.kept} / 64`, tall ? PAD : mx, tall ? 30 + 8 * c + 14 : 40, palette.ink, 12);
    label(ctx, `W1 ${row.keptW1} / 24 · W2 ${row.keptW2} / 40`, tall ? PAD : mx, tall ? 30 + 8 * c + 32 : 60, palette.muted, 11);

    const top = tall ? 30 + 8 * c + 70 : 30 + 8 * c + 36;
    const A: Axes = { x: PAD + 40, y: top, w: w - 2 * PAD - 50, h: tall ? 200 : 150, x0: 0, x1: 0.9, y0: 0, y1: 1 };
    axesFrame(ctx, A, [0, 0.25, 0.5, 0.75, 1], (v) => `${Math.round(v * 100)}%`);
    [0, 0.3, 0.6, 0.9].forEach((v) => label(ctx, `${Math.round(v * 100)}%`, ax(A, v), A.y + A.h + 10, palette.muted, 10, "center"));
    label(ctx, S.axisX, A.x + A.w, A.y + A.h + 24, palette.muted, 11, "right");
    line(ctx, ax(A, row.s), A.y, ax(A, row.s), A.y + A.h, AMBER, 1.5, [4, 3]);
    polyline(ctx, RETRAIN.map((r, j) => [ax(A, r.s), ay(A, ONESHOT_ACC[j])] as [number, number]), "rgba(91,100,116,0.8)", 2);
    RETRAIN.forEach((r, j) => dot(ctx, ax(A, r.s), ay(A, ONESHOT_ACC[j]), j === i ? 4.5 : 3, palette.muted));
    if (view >= 1) {
      polyline(ctx, RETRAIN.map((r) => [ax(A, r.s), ay(A, r.retrain)] as [number, number]), AMBER, 2);
      RETRAIN.forEach((r, j) => dot(ctx, ax(A, r.s), ay(A, r.retrain), j === i ? 5 : 3.5, AMBER));
    }
    if (view >= 2) ITERATIVE.forEach((r) => dot(ctx, ax(A, 1 - r.kept / 64), ay(A, r.acc), 3.5, GREEN));

    const ly = A.y + A.h + 40;
    label(ctx, `${S.once} ${pct(ONESHOT_ACC[i])}`, PAD, ly, palette.muted, 12);
    if (view >= 1) label(ctx, `${S.re} ${pct(row.retrain)} · ${U.eye11} ${row.eye}`, tall ? PAD : PAD + 150, tall ? ly + 20 : ly, AMBER, 12);
    if (view >= 2) { dot(ctx, PAD + 4, tall ? ly + 40 : ly + 20, 3.5, GREEN); label(ctx, S.iter, PAD + 14, tall ? ly + 40 : ly + 20, GREEN, 11); }
    label(ctx, U.measured, w - PAD, h - 12, palette.muted, 10, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={S.view}>
          <span>{S.view}</span>
          {S.views.map((name, j) => <button key={name} type="button" className={view === j ? "on" : ""} onClick={() => setView(j)}>{name}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{S.s} <b>{Math.round(row.s * 100)}%</b></span>
          <input type="range" min={0} max={RETRAIN.length - 1} step={1} value={i} onChange={(e) => setI(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · lottery ticket                                                  */
/* ------------------------------------------------------------------ */

const TRACK = { unit: 5, col: 2 };          // unit 6, B: the largest first-layer weight, it survives every round

export function TicketScene() {
  const [view, setView] = useState(2);
  const [r, setR] = useState(7);
  const S = U.ticket;
  const row = TICKET_ROWS[r];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const tall = isPortrait(w, h);

    // one weight's three values
    label(ctx, S.weight, PAD, 14, palette.muted, 11);
    const vals: [string, number | null, string][] = [
      [S.init, INIT.W1[TRACK.unit][TRACK.col], palette.muted],
      [S.trained, DENSE.W1[TRACK.unit][TRACK.col], palette.ink],
      [S.start, INIT.W1[TRACK.unit][TRACK.col], AMBER],
    ];
    if (view >= 1) vals.push([S.restart, null, BLUE]);
    const bw = tall ? (w - 2 * PAD - 8) / 2 : (w - 2 * PAD - 3 * 10) / 4;
    vals.forEach(([name, v, tone], j) => {
      const bx = tall ? PAD + (j % 2) * (bw + 8) : PAD + j * (bw + 10), by = tall ? 26 + Math.floor(j / 2) * 46 : 26;
      rbox(ctx, bx, by, bw, 38, 6, "#ffffff", tone, 1.4);
      label(ctx, name, bx + 8, by + 12, palette.muted, 10);
      label(ctx, v === null ? S.random : fix(v), bx + 8, by + 27, tone, v === null ? 11 : 13);
    });

    const top = tall ? 26 + 2 * 46 + 30 : 26 + 38 + 40;
    const n = TICKET_ROWS.length;
    const A: Axes = { x: PAD + 40, y: top, w: w - 2 * PAD - 50, h: tall ? 220 : 196, x0: 0, x1: n - 1, y0: 0.4, y1: 1 };
    axesFrame(ctx, A, [0.4, 0.6, 0.8, 1], (v) => `${Math.round(v * 100)}%`);
    TICKET_ROWS.forEach((t, j) => { if (j % (tall ? 2 : 1) === 0 || j === n - 1) label(ctx, `${t.kept}`, ax(A, j), A.y + A.h + 10, palette.muted, 10, "center"); });
    label(ctx, S.axisX, A.x + A.w, A.y + A.h + 24, palette.muted, 11, "right");
    line(ctx, A.x, ay(A, 0.98046875), A.x + A.w, ay(A, 0.98046875), "rgba(15,157,106,0.6)", 1, [3, 3]);
    line(ctx, ax(A, r), A.y, ax(A, r), A.y + A.h, AMBER, 1.2, [4, 3]);
    if (view >= 2) {
      polyline(ctx, TICKET_ROWS.map((t, j) => [ax(A, j), ay(A, t.randMean)] as [number, number]), "rgba(91,100,116,0.8)", 2);
      TICKET_ROWS.forEach((t, j) => dot(ctx, ax(A, j), ay(A, t.randMean), 3, palette.muted));
    }
    if (view >= 1) {
      ctx.fillStyle = tint(palette.normalRgb, 0.12);
      ctx.beginPath();
      TICKET_ROWS.forEach((t, j) => (j ? ctx.lineTo(ax(A, j), ay(A, t.reinitMax)) : ctx.moveTo(ax(A, j), ay(A, t.reinitMax))));
      for (let j = n - 1; j >= 0; j--) ctx.lineTo(ax(A, j), ay(A, TICKET_ROWS[j].reinitMin));
      ctx.closePath(); ctx.fill();
      polyline(ctx, TICKET_ROWS.map((t, j) => [ax(A, j), ay(A, t.reinitMean)] as [number, number]), BLUE, 2);
      TICKET_ROWS.forEach((t, j) => dot(ctx, ax(A, j), ay(A, t.reinitMean), 3, BLUE));
    }
    polyline(ctx, TICKET_ROWS.map((t, j) => [ax(A, j), ay(A, t.ticket)] as [number, number]), AMBER, 2.2);
    TICKET_ROWS.forEach((t, j) => dot(ctx, ax(A, j), ay(A, t.ticket), j === r ? 5 : 3.5, AMBER));

    const ly = A.y + A.h + 42, gap = 19;
    label(ctx, `${S.ticket}  ${pct(row.ticket)}`, PAD, ly, AMBER, 12);
    if (view >= 1) label(ctx, `${S.reinit}  ${pct(row.reinitMean)}  (${pct(row.reinitMin)}–${pct(row.reinitMax)})`, PAD, ly + gap, BLUE, 12);
    if (view >= 2) label(ctx, `${S.rand}  ${pct(row.randMean)}`, PAD, ly + 2 * gap, palette.muted, 12);
    label(ctx, U.measured, w - PAD, h - 12, palette.muted, 10, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={S.view}>
          <span>{S.view}</span>
          {S.views.map((name, j) => <button key={name} type="button" className={view === j ? "on" : ""} onClick={() => setView(j)}>{name}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{S.round} <b>{row.round}</b></span>
          <input type="range" min={0} max={TICKET_ROWS.length - 1} step={1} value={r} onChange={(e) => setR(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · storing zeros: dense, CSR, 2:4                                  */
/* ------------------------------------------------------------------ */

const EYE_H = pass(DENSE, HEAD_RGB[EYE_CELL]).h;
const SP_ACC = { oneshot: [accuracy(DENSE), accuracy(NET_U50), accuracy(NET_24)], retrain: [null, W2SPARSE.unstr, W2SPARSE.r24] };
const SIZE_TOY = [denseBits(5, 8), csrBits(5, 20), bits24(5, 8)];
const SIZE_BIG = [BIG_BITS.dense, BIG_BITS.csr50, BIG_BITS.w24];

export function SparseScene() {
  const [fmt, setFmt] = useState(1);
  const [big, setBig] = useState(0);
  const S = U.sparse;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const tall = isPortrait(w, h);
    const mask = fmt === 0 ? DENSE.W2.map((r) => r.map(() => 1)) : fmt === 1 ? MU50_W2 : M24_W2;
    const lw = 46, cw = Math.min(54, (w - 2 * PAD - lw) / 8), ch = tall ? 26 : 22, tx = PAD + lw, ty = 30;
    label(ctx, S.table, PAD, 12, palette.muted, 11);
    for (let j = 0; j < 8; j++) label(ctx, `${j + 1}`, tx + j * cw + cw / 2, ty - 8, palette.muted, 10, "center");
    PARTS.forEach((p, i) => label(ctx, p, PAD, ty + i * ch + ch / 2, i === 4 ? BLUE : palette.muted, 10));
    weightTable(ctx, DENSE.W2, tx, ty, cw, ch, { mask, max: 7.2, size: cw < 40 ? 9 : undefined });
    if (fmt === 2) for (let i = 0; i < 5; i++) for (let g = 0; g < 2; g++) frame(ctx, tx + g * 4 * cw + 1, ty + i * ch + 1, 4 * cw - 2, ch - 2, AMBER, 1.2, [3, 2]);
    frame(ctx, tx - 1, ty + 4 * ch - 1, 8 * cw + 2, ch + 2, BLUE, 1.6);

    // the eye cell's eight unit values, and which of them the eye row reads
    const hy = ty + 5 * ch + 34;
    label(ctx, S.eyeRow, PAD, hy - 16, palette.muted, 11);
    for (let j = 0; j < 8; j++) {
      const read = mask[4][j] === 1, cx = tx + j * cw;
      ctx.fillStyle = read ? tint(palette.normalRgb, 0.18) : "rgba(15,23,42,0.04)";
      ctx.fillRect(cx + 2, hy, cw - 4, ch - 2);
      frame(ctx, cx + 2.5, hy + 0.5, cw - 5, ch - 3, read ? BLUE : palette.frame, read ? 1.4 : 1);
      label(ctx, fix(EYE_H[j]), cx + cw / 2, hy + ch / 2, read ? palette.ink : palette.muted, cw < 40 ? 9 : 10, "center");
      if (read) line(ctx, cx + cw / 2, ty + 5 * ch + 2, cx + cw / 2, hy - 2, tint(palette.normalRgb, 0.6), 1.2);
    }

    // what gets stored
    const sy = hy + ch + 26, box = tall ? 6 : 7, gapB = 1, sx = PAD + 70;
    const strip = (n: number, y: number, color: string, name: string, bh = box) => {
      label(ctx, name, PAD, y + bh / 2, palette.muted, 10);
      for (let i = 0; i < n; i++) { ctx.fillStyle = color; ctx.fillRect(sx + i * (box + gapB), y, box, bh); }
    };
    if (fmt === 0) strip(40, sy, tint(palette.accentRgb, 0.8), S.values);
    if (fmt === 1) { strip(20, sy, tint(palette.accentRgb, 0.8), S.values); strip(20, sy + 14, tint(palette.normalRgb, 0.7), S.cols); strip(6, sy + 28, "rgba(91,100,116,0.6)", S.ptr); }
    if (fmt === 2) { strip(20, sy, tint(palette.accentRgb, 0.8), S.values); strip(20, sy + 14, tint(palette.normalRgb, 0.7), S.pos, 3); }

    // sizes of the three ways, the chosen one dark
    const by = sy + 70, sizes = big ? SIZE_BIG : SIZE_TOY, bmax = Math.max(...sizes), bw = w - 2 * PAD - lw - 90;
    label(ctx, `${S.stored} (${big ? "MB" : S.bits})`, PAD, by - 12, palette.muted, 11);
    S.fmts.forEach((name, j) => {
      const yy = by + j * 18;
      label(ctx, name, PAD, yy + 6, j === fmt ? palette.ink : palette.muted, 10);
      const val = sizes[j], txt = big ? fix(MB(val), 2) : `${val}`;
      hbar(ctx, tx, yy, bw, 12, val / bmax, j === fmt ? tint(palette.accentRgb, 0.85) : "rgba(91,100,116,0.35)", txt, j === fmt ? palette.ink : palette.muted);
    });

    // multiplications for the eye row, accuracy
    const ry = by + 3 * 18 + 22, reads = mask[4].reduce((a, b) => a + b, 0);
    const mulText = fmt === 0 ? `${S.mults} 8` : fmt === 1 ? `${S.mults} ${reads} + ${S.cols} ${reads}` : `${S.mults} ${reads} + ${S.pos} ${reads}`;
    label(ctx, mulText, PAD, ry, palette.ink, 11);
    const re = SP_ACC.retrain[fmt];
    label(ctx, `${S.oneshot} ${pct(SP_ACC.oneshot[fmt])}${re === null ? "" : ` · ${S.retrained} ${pct(re)}`}`, PAD, ry + 18, palette.ink, 11);
    label(ctx, U.measured, w - PAD, h - 12, palette.muted, 10, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={S.fmt}>
          <span>{S.fmt}</span>
          {S.fmts.map((name, j) => <button key={name} type="button" className={fmt === j ? "on" : ""} onClick={() => setFmt(j)}>{name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={S.size}>
          <span>{S.size}</span>
          {S.sizes.map((name, j) => <button key={name} type="button" className={big === j ? "on" : ""} onClick={() => setBig(j)}>{name}</button>)}
        </div>
      </div>
    </div>
  );
}
