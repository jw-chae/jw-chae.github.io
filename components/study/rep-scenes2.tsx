"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, frame, line, rbox, type Ctx } from "./kit";
import { repCopy } from "./rep-copy";
import {
  CENTER, CHECKPOINTS, DW_K1, DW_K3, DW_MERGED, FAR, FAR_TO, ID_PAD, K3, K_TARGET, LS_CELL, PAPER, SMALLS, X, X_FAR,
  addG, convAt, lossGrad, K_MERGED, lsAt, lsWeightMap, lsWeights, padTo3, smallCheck, trainBranches, trainMerged, wideMean, type Grid,
} from "./rep-math";
import { COOL, MINT_TINT, PAD, RED_TINT, TINT, fix, isPortrait, num, numGrid } from "./rep-scenes";

const U = repCopy.ui;
const signedTint = (v: number) => (Math.abs(v) < 1e-9 ? "#ffffff" : v > 0 ? `rgba(${palette.normalRgb},${0.1 + Math.min(0.3, Math.abs(v) * 0.1)})` : `rgba(${palette.anomalyRgb},${0.1 + Math.min(0.3, Math.abs(v) * 0.1)})`);

/** One horizontal bar with its value written after it. */
function hbar(ctx: Ctx, x: number, y: number, maxW: number, hgt: number, frac: number, color: string, text: string, strong = true) {
  ctx.fillStyle = palette.track;
  ctx.fillRect(x, y, maxW, hgt);
  ctx.fillStyle = color;
  ctx.globalAlpha = strong ? 1 : 0.45;
  ctx.fillRect(x, y, Math.max(2, maxW * Math.min(1, Math.max(0, frac))), hgt);
  ctx.globalAlpha = 1;
  label(ctx, text, x + Math.max(2, maxW * Math.min(1, Math.max(0, frac))) + 6, y + hgt / 2, palette.ink, 11);
}

/* ------------------------------------------------------------------ */
/* 04 · RepVGG: four layers of a stage, before and after merging        */
/* ------------------------------------------------------------------ */

export function RepvggScene() {
  const [view, setView] = useState(0);
  const T = U.repvgg;
  const P = PAPER.repvgg;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);

    if (view < 2) {
      const train = view === 0;
      label(ctx, T.stage, PAD, 18, palette.ink, 12);
      const colW = (w - 2 * PAD - 20) / 4, bw = portrait ? 34 : 46, bh = portrait ? 20 : 24;
      const yT = portrait ? 74 : 72, yM = yT + (portrait ? 40 : 44), yB = yM + (portrait ? 40 : 44);
      const yMid = yM + bh / 2;
      label(ctx, "x", PAD, yMid, palette.muted, 12);
      for (let i = 0; i < 4; i++) {
        const cx = PAD + 14 + i * colW, plusX = cx + colW - (portrait ? 18 : 24);
        if (i === 0) label(ctx, T.stride, cx + 4, yT - 16, palette.muted, 11);
        if (train) {
          const lanes: [number, string][] = [[yT, "3×3"], [yM, "1×1"]];
          lanes.forEach(([ly, name]) => {
            line(ctx, cx, yMid, cx + 6, ly + bh / 2, palette.frame, 1.2);
            rbox(ctx, cx + 6, ly, bw, bh, 5, ly === yT ? COOL : "#ffffff", palette.normal, 1.3);
            label(ctx, name, cx + 6 + bw / 2, ly + bh / 2, palette.normal, 11, "center");
            line(ctx, cx + 6 + bw, ly + bh / 2, plusX - 8, yMid, palette.frame, 1.2);
          });
          if (i > 0) {
            line(ctx, cx, yMid, cx + 6, yB + bh / 2, palette.frame, 1.2);
            line(ctx, cx + 6, yB + bh / 2, cx + 6 + bw, yB + bh / 2, palette.mint, 1.6);
            if (!portrait || i === 1) label(ctx, T.identity, cx + 6 + bw / 2, yB + bh / 2 + 13, palette.mint, 11, "center");
            line(ctx, cx + 6 + bw, yB + bh / 2, plusX - 8, yMid, palette.frame, 1.2);
          }
          ctx.save(); ctx.strokeStyle = palette.accent; ctx.lineWidth = 1.5; ctx.fillStyle = "#ffffff";
          ctx.beginPath(); ctx.arc(plusX, yMid, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
          label(ctx, T.add, plusX, yMid + 0.5, palette.accent, 12, "center");
        } else {
          line(ctx, cx, yMid, cx + 6, yMid, palette.frame, 1.2);
          rbox(ctx, cx + 6, yM, bw + 8, bh, 5, TINT, palette.accent, 1.5);
          label(ctx, "3×3", cx + 6 + (bw + 8) / 2, yMid, palette.accent, 11, "center");
          line(ctx, cx + 14 + bw, yMid, plusX + 8, yMid, palette.frame, 1.2);
        }
        if (i < 3) arrow(ctx, plusX + 9, yMid, PAD + 14 + (i + 1) * colW - 1, yMid, palette.muted, 1.3);
        label(ctx, T.relu, plusX + 2, yMid - (portrait ? 20 : 22), palette.muted, 11, "center");
      }
      const note = train ? T.trainNote : T.deployNote;
      (portrait ? note.split(", ") : [note]).forEach((part, i) => label(ctx, part, PAD, yB + bh + 30 + i * 18, train ? palette.normal : palette.accent, 12));

      // the paper's measurement of the same B0 in both shapes
      const by = yB + bh + (portrait ? 108 : 74), bmax = w - 2 * PAD - (portrait ? 70 : 170);
      label(ctx, T.speed, PAD, by, palette.muted, 11);
      const bars: [string, number, boolean][] = [[T.trainShape, P.ablation[3].speed, train], [T.deployShape, P.ablation[0].speed, !train]];
      bars.forEach(([name, v, on], i) => {
        const y = by + 18 + i * (portrait ? 52 : 34);
        if (portrait) {
          label(ctx, name, PAD, y + 6, on ? palette.ink : palette.muted, 11);
          hbar(ctx, PAD, y + 18, bmax, 14, v / 2000, i === 0 ? palette.normal : palette.accent, `${v}`, on);
        } else {
          label(ctx, name, PAD, y + 7, on ? palette.ink : palette.muted, 12);
          hbar(ctx, PAD + 130, y, bmax, 14, v / 2000, i === 0 ? palette.normal : palette.accent, `${v}`, on);
        }
      });
      label(ctx, `${T.acc}`, PAD, by + 18 + 2 * (portrait ? 52 : 34) + 10, palette.mint, 12);
      label(ctx, U.common.paper, w - PAD, h - 14, palette.muted, 11, "right");
    } else {
      label(ctx, T.table, PAD, 18, palette.ink, 12);
      const rowH = portrait ? 112 : 88, top = 44;
      const nameW = portrait ? 0 : 108, half = (w - 2 * PAD - nameW - 20) / 2;
      const ax = PAD + nameW, sx = ax + half + 20, barW = half - 52;
      label(ctx, T.top1, ax, top - 6 + (portrait ? 0 : 0), palette.muted, 11);
      label(ctx, T.tput, sx, top - 6, palette.muted, 11);
      P.pairs.forEach((p, i) => {
        const y = top + 12 + i * rowH;
        const yA = portrait ? y + 22 : y, yB = yA + 20;
        if (portrait) label(ctx, `${p.a} / ${p.b}`, PAD, y + 6, palette.ink, 11);
        else { label(ctx, p.a, PAD, yA + 7, palette.accent, 11); label(ctx, p.b, PAD, yB + 7, palette.muted, 11); }
        hbar(ctx, ax, yA, barW, 14, (p.accA - 70) / 10, palette.accent, num(p.accA));
        hbar(ctx, ax, yB, barW, 14, (p.accB - 70) / 10, palette.dotOff, num(p.accB));
        hbar(ctx, sx, yA, barW, 14, p.spA / 3500, palette.accent, `${p.spA}`);
        hbar(ctx, sx, yB, barW, 14, p.spB / 3500, palette.dotOff, `${p.spB}`);
      });
      label(ctx, T.from70, PAD, top + 12 + 4 * rowH + 4, palette.muted, 11);
      label(ctx, U.common.paper, w - PAD, h - 14, palette.muted, 11, "right");
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.common.step}>
          <span>{U.common.step}</span>
          {T.views.map((name, i) => <button key={name} type="button" className={view === i ? "on" : ""} onClick={() => setView(i)}>{i + 1}. {name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · Same reachable kernels, different steps; then the paper's runs  */
/* ------------------------------------------------------------------ */

const RUN_M = trainMerged(), RUN_B = trainBranches();
const G0 = lossGrad(K_MERGED).g;

export function WhyScene() {
  const [view, setView] = useState(0);
  const [ci, setCi] = useState(1);
  const T = U.why;
  const P = PAPER.repvgg;
  const t = CHECKPOINTS[ci];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);

    if (view === 0) {
      const m = RUN_M[t].k, b = RUN_B[t].k, d = addG(b, m, -1);
      label(ctx, `${T.steps} ${t}`, PAD, 18, palette.ink, 13);
      const kc = portrait ? 44 : 40, gap = portrait ? 16 : 36, y0 = 56;
      const dec = (v: number) => fix(v, 3);
      const pos = portrait
        ? [[(w - 6 * kc - gap) / 2, y0], [(w - 6 * kc - gap) / 2 + 3 * kc + gap, y0], [(w - 3 * kc) / 2, y0 + 3 * kc + 28]]
        : [0, 1, 2].map((i) => [(w - 9 * kc - 2 * gap) / 2 + i * (3 * kc + gap), y0]);
      numGrid(ctx, m, pos[0][0], pos[0][1], kc, { caption: T.direct, tone: palette.normal, text: (r, c) => dec(m[r][c]), size: 11 });
      numGrid(ctx, b, pos[1][0], pos[1][1], kc, { caption: T.viaBranch, tone: palette.accent, text: (r, c) => dec(b[r][c]), size: 11 });
      numGrid(ctx, d, pos[2][0], pos[2][1], kc, {
        caption: T.diff, tone: palette.anomaly, text: (r, c) => dec(d[r][c]), size: 11,
        fill: (r, c) => (Math.abs(d[r][c]) >= 0.0005 ? RED_TINT : MINT_TINT),
      });
      const ty = pos[2][1] + 3 * kc + (portrait ? 22 : 36);
      label(ctx, `${T.loss}: ${T.direct} ${fix(RUN_M[t].loss, 4)}`, PAD, ty, palette.normal, portrait ? 11 : 12);
      label(ctx, `${T.loss}: ${T.viaBranch} ${fix(RUN_B[t].loss, 4)}`, PAD, ty + 22, palette.accent, portrait ? 11 : 12);
      const tc = portrait ? 20 : 24, tyK = ty + (portrait ? 44 : 56);
      numGrid(ctx, K_TARGET, PAD, tyK + 12, tc, { caption: T.target, tone: palette.mint, size: 11 });
      const tx = PAD + 3 * tc + 20;
      label(ctx, `${T.grad} = ${num(G0[1][1])}`, tx, tyK + 14, palette.muted, 11);
      label(ctx, T.firstStep, tx, tyK + 36, palette.muted, 11);
      label(ctx, `${portrait ? "" : `${T.direct}: `}2 − 0.05 × ${num(G0[1][1])} = ${fix(RUN_M[1].k[1][1], 3)}`, tx, tyK + 56, palette.normal, 11);
      label(ctx, `${portrait ? "" : `${T.viaBranch}: `}2 − 2 × 0.05 × ${num(G0[1][1])} = ${fix(RUN_B[1].k[1][1], 3)}`, tx, tyK + 76, palette.accent, 11);
      label(ctx, U.common.hand, w - PAD, h - 14, palette.muted, 11, "right");
    } else {
      label(ctx, T.table, PAD, 18, palette.ink, 12);
      const lw = portrait ? 0 : 190, bx = PAD + lw, bmax = w - bx - PAD - (portrait ? 110 : 130);
      const frac = (v: number) => (v - 72) / 4;
      let y = 46;
      label(ctx, T.t6, PAD, y, palette.muted, 11);
      P.ablation.forEach((a, i) => {
        y += portrait ? 34 : 26;
        if (portrait) { label(ctx, T.rows6[i], PAD, y - 4, palette.ink, 11); hbar(ctx, PAD, y + 6, bmax, 12, frac(a.acc), palette.accent, num(a.acc)); }
        else { label(ctx, T.rows6[i], PAD, y + 6, palette.ink, 11); hbar(ctx, bx, y, bmax, 12, frac(a.acc), palette.accent, num(a.acc)); }
      });
      y += portrait ? 46 : 40;
      label(ctx, T.t7, PAD, y, palette.muted, 11);
      const v7 = [P.variants.trivial, P.variants.postAddBn, P.variants.identityNoBn, P.variants.full, P.variants.reluInBranch];
      v7.forEach((v, i) => {
        y += portrait ? 34 : 26;
        const col = i === 4 ? palette.anomaly : i === 3 ? palette.accent : palette.normal;
        const txt = i === 4 ? `${num(v)}  ${T.cannot}` : num(v);
        if (portrait) { label(ctx, T.rows7[i], PAD, y - 4, palette.ink, 11); hbar(ctx, PAD, y + 6, bmax, 12, frac(v), col, txt); }
        else { label(ctx, T.rows7[i], PAD, y + 6, palette.ink, 11); hbar(ctx, bx, y, bmax, 12, frac(v), col, txt); }
      });
      label(ctx, T.from72, PAD, y + (portrait ? 40 : 34), palette.muted, 11);
      label(ctx, U.common.paper, w - PAD, h - 14, palette.muted, 11, "right");
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.common.step}>
          <span>{U.common.step}</span>
          {T.views.map((name, i) => <button key={name} type="button" className={view === i ? "on" : ""} onClick={() => setView(i)}>{i + 1}. {name}</button>)}
        </div>
        {view === 0 ? (
          <label className="ad-ctl">
            <span>{T.steps} <b>{t}</b></span>
            <input type="range" min={0} max={CHECKPOINTS.length - 1} step={1} value={ci} onChange={(e) => setCi(Number(e.target.value))} />
          </label>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · RepViT: depthwise merge per channel; the MobileNetV3 roadmap    */
/* ------------------------------------------------------------------ */

export function RepvitScene() {
  const [view, setView] = useState(0);
  const [st, setSt] = useState(1);
  const T = U.repvit;
  const R = PAPER.repvit.roadmap;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);

    if (view === 0) {
      const kc = portrait ? 18 : 24, gap = portrait ? 16 : 26, lw = portrait ? 0 : 74;
      const rowW = 12 * kc + 3 * gap, x0 = PAD + lw + Math.max(0, (w - 2 * PAD - lw - rowW) / 2);
      const rh = portrait ? 116 : 104, y0 = portrait ? 56 : 46;
      DW_K3.forEach((k, c) => {
        const y = y0 + c * rh + (portrait ? 18 : 12);
        const name = `${T.channel} ${c + 1}${c === 0 ? `, ${T.ours}` : ""}`;
        if (portrait) label(ctx, name, PAD, y - (c === 0 ? 34 : 22), c === 0 ? palette.accent : palette.ink, 11);
        else label(ctx, name.split(", ")[0], PAD, y + 1.5 * kc, c === 0 ? palette.accent : palette.ink, 12);
        if (!portrait && c === 0) label(ctx, T.ours, PAD, y + 1.5 * kc + 18, palette.accent, 11);
        const kx = (i: number) => x0 + i * (3 * kc + gap);
        const cf = (r: number, cc: number) => (r === 1 && cc === 1 ? TINT : null);
        numGrid(ctx, k, kx(0), y, kc, { caption: c === 0 ? T.k3 : undefined, tone: palette.normal, fill: (r, cc) => (r === 1 && cc === 1 ? TINT : signedTint(k[r][cc])), size: 11 });
        numGrid(ctx, padTo3([[DW_K1[c]]], 0, 0), kx(1), y, kc, { caption: c === 0 ? T.k1 : undefined, tone: palette.normal, fill: cf, size: 11, color: (r, cc) => (r === 1 && cc === 1 ? palette.ink : palette.dotOff) });
        numGrid(ctx, ID_PAD, kx(2), y, kc, { caption: c === 0 ? T.id : undefined, tone: palette.normal, fill: cf, size: 11, color: (r, cc) => (r === 1 && cc === 1 ? palette.ink : palette.dotOff) });
        numGrid(ctx, DW_MERGED[c], kx(3), y, kc, { caption: c === 0 ? T.merged : undefined, tone: palette.accent, fill: (r, cc) => (r === 1 && cc === 1 ? TINT : signedTint(DW_MERGED[c][r][cc])), size: 11 });
        ["+", "+", "="].forEach((s, i) => label(ctx, s, kx(i) + 3 * kc + gap / 2, y + 1.5 * kc, palette.muted, 14, "center"));
      });
      label(ctx, T.noMix, PAD, y0 + 3 * rh + (portrait ? 8 : 4), palette.mint, portrait ? 11 : 12);
    } else {
      // latency on x, top-1 on y, one point per roadmap step
      const left = PAD + 34, right = w - PAD - 10, top = 40, bottom = h - (portrait ? 150 : 96);
      const xOf = (ms: number) => left + ((ms - 0.7) / 0.35) * (right - left);
      const yOf = (acc: number) => bottom - ((acc - 67) / 11) * (bottom - top);
      line(ctx, left, bottom, right, bottom, palette.frame, 1);
      line(ctx, left, top, left, bottom, palette.frame, 1);
      [0.7, 0.8, 0.9, 1.0].forEach((ms) => { label(ctx, num(ms), xOf(ms), bottom + 12, palette.muted, 11, "center"); line(ctx, xOf(ms), bottom, xOf(ms), bottom + 4, palette.frame, 1); });
      [68, 72, 76].forEach((a) => { label(ctx, `${a}`, left - 6, yOf(a), palette.muted, 11, "right"); line(ctx, left - 3, yOf(a), left, yOf(a), palette.frame, 1); });
      label(ctx, T.xAxis, right, bottom + 30, palette.muted, 11, "right");
      label(ctx, T.yAxis, left - 4, top - 14, palette.muted, 11);
      for (let i = 1; i <= st; i++) line(ctx, xOf(R[i - 1].ms), yOf(R[i - 1].acc), xOf(R[i].ms), yOf(R[i].acc), palette.dotOff, 1.2);
      for (let i = 0; i <= st; i++) {
        const x = xOf(R[i].ms), y = yOf(R[i].acc), cur = i === st;
        ctx.save(); ctx.fillStyle = cur ? palette.accent : palette.normal; ctx.beginPath(); ctx.arc(x, y, cur ? 6 : 4, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        if (i === 1) { ctx.save(); ctx.strokeStyle = palette.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
        label(ctx, `${i + 1}`, x + 9, y - 10, cur ? palette.accent : palette.muted, 11);
      }
      const p = R[st], ly = bottom + (portrait ? 56 : 52);
      label(ctx, `${st + 1}. ${T.names[st]}`, PAD, ly, palette.accent, 13);
      label(ctx, `${num(p.ms)} ms, top-1 ${num(p.acc, 1)}%`, PAD, ly + 22, palette.ink, 12);
      label(ctx, T.source, w - PAD, portrait ? ly + 50 : ly + 22, palette.muted, 11, "right");
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.common.step}>
          <span>{U.common.step}</span>
          {T.views.map((name, i) => <button key={name} type="button" className={view === i ? "on" : ""} onClick={() => setView(i)}>{i + 1}. {name}</button>)}
        </div>
        {view === 1 ? (
          <label className="ad-ctl">
            <span>{T.stepLabel} <b>{st + 1} / {R.length}</b></span>
            <input type="range" min={0} max={R.length - 1} step={1} value={st} onChange={(e) => setSt(Number(e.target.value))} />
          </label>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · Small kernels off the centre still merge (PBConv's building block) */
/* ------------------------------------------------------------------ */

export function PbScene() {
  const [si, setSi] = useState(1);
  const T = U.pbconv;
  const s = SMALLS[si];
  const chk = smallCheck(s);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const [r0, c0] = CENTER;
    // which pixels the small kernel reads at the centre position
    const reads = (r: number, c: number) => r >= r0 - s.pt && r < r0 - s.pt + s.k.length && c >= c0 - s.pl && c < c0 - s.pl + s.k[0].length;

    const ic = portrait ? 22 : 28, ix = PAD, iy = 40;
    numGrid(ctx, X, ix, iy, ic, { caption: U.common.input, tone: palette.ink, size: 12, fill: (r, c) => (reads(r, c) ? TINT : Math.abs(r - r0) <= 1 && Math.abs(c - c0) <= 1 ? COOL : null) });
    frame(ctx, ix + (c0 - 1) * ic, iy + (r0 - 1) * ic, 3 * ic, 3 * ic, palette.normal, 2.2);
    frame(ctx, ix + (c0 - s.pl) * ic, iy + (r0 - s.pt) * ic, s.k[0].length * ic, s.k.length * ic, palette.accent, 2.2);
    label(ctx, T.sees, ix, iy + 5 * ic + 16, palette.accent, 11);

    const kc = portrait ? 20 : 26;
    const ax = ix + 5 * ic + (portrait ? 20 : 34), ay = iy + 4;
    numGrid(ctx, s.k, ax, ay, kc, { caption: T.small, tone: palette.accent, fill: () => TINT });
    const px = ax + Math.max(3, s.k[0].length) * kc + (portrait ? 26 : 40);
    arrow(ctx, ax + s.k[0].length * kc + 6, ay + 1.5 * kc, px - 6, ay + 1.5 * kc, palette.muted, 1.3);
    numGrid(ctx, chk.padded, px, ay, kc, { caption: T.placed, tone: palette.accent, fill: (r, c) => (Math.abs(chk.padded[r][c]) > 1e-12 || padTo3(s.k.map((row) => row.map(() => 1)), s.pt, s.pl)[r][c] ? TINT : null), color: (r, c) => (padTo3(s.k.map((row) => row.map(() => 1)), s.pt, s.pl)[r][c] ? palette.ink : palette.dotOff) });

    // the merge row sits right of the image on wide canvases; shrink its cells when the column is narrow
    const gap = portrait ? 22 : 30, mc = portrait ? 24 : Math.max(20, Math.min(28, Math.floor((w - PAD - ax - 2 * gap) / 9))), rowW = 9 * mc + 2 * gap;
    const my = portrait ? iy + 5 * ic + 58 : ay + 3 * kc + 50, mx = portrait ? (w - rowW) / 2 : ax;
    numGrid(ctx, K3, mx, my, mc, { caption: T.base, tone: palette.normal, fill: (r, c) => signedTint(K3[r][c]) });
    label(ctx, "+", mx + 3 * mc + gap / 2, my + 1.5 * mc, palette.muted, 14, "center");
    numGrid(ctx, chk.padded, mx + 3 * mc + gap, my, mc, { caption: T.placed, tone: palette.accent, color: (r, c) => (Math.abs(chk.padded[r][c]) > 1e-12 ? palette.ink : palette.dotOff) });
    label(ctx, "=", mx + 6 * mc + 1.5 * gap, my + 1.5 * mc, palette.muted, 14, "center");
    numGrid(ctx, chk.merged, mx + 6 * mc + 2 * gap, my, mc, { caption: T.merged, tone: palette.accent, fill: (r, c) => (Math.abs(chk.padded[r][c]) > 1e-12 ? TINT : signedTint(chk.merged[r][c])) });

    const ty = my + 3 * mc + (portrait ? 34 : 36);
    label(ctx, `${T.twoWays}: ${T.separate} ${num(chk.base)} + ${num(chk.branch)} = ${num(chk.sum)}`, PAD, ty, palette.ink, portrait ? 12 : 13);
    label(ctx, `${T.one} ${num(chk.onePath)}`, PAD, ty + 24, palette.accent, portrait ? 12 : 13);
    label(ctx, U.common.same, PAD + (portrait ? 150 : 180), ty + 24, palette.mint, 12);
    label(ctx, `${T.gap}: ${num(chk.gap)}`, PAD, ty + 50, palette.mint, 12);
    label(ctx, U.common.hand, w - PAD, h - 14, palette.muted, 11, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.pick}>
          <span>{T.pick}</span>
          {T.names.map((name, i) => <button key={name} type="button" className={si === i ? "on" : ""} onClick={() => setSi(i)}>{name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · A kernel computed from the input around it cannot be pre-merged */
/* ------------------------------------------------------------------ */

const MAP_BASE = lsWeightMap(X);

export function LsScene() {
  const [ls, setLs] = useState(true);
  const [far, setFar] = useState(false);
  const T = U.lsnet;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const img = far ? X_FAR : X;
    const [r0, c0] = CENTER;
    const wts: Grid = ls ? lsWeights(img, r0, c0) : K3;
    const y = ls ? lsAt(img, r0, c0) : convAt(img, K3, 1, 1, r0, c0);
    const isFar = (r: number, c: number) => r === FAR[0] && c === FAR[1];

    const ic = portrait ? 24 : 28, ix = PAD, iy = 40;
    numGrid(ctx, img, ix, iy, ic, {
      caption: U.common.input, tone: palette.ink, size: 12,
      fill: (r, c) => (isFar(r, c) && far ? RED_TINT : Math.abs(r - r0) <= 1 && Math.abs(c - c0) <= 1 ? TINT : null),
      color: (r, c) => (isFar(r, c) && far ? palette.anomaly : palette.ink),
    });
    if (ls) frame(ctx, ix - 3, iy - 3, 5 * ic + 6, 5 * ic + 6, palette.normal, 1.6, [5, 4]);
    frame(ctx, ix + (c0 - 1) * ic, iy + (r0 - 1) * ic, 3 * ic, 3 * ic, palette.accent, 2.4);

    const wx = ix + 5 * ic + (portrait ? 22 : 40), wc = portrait ? 28 : 34;
    label(ctx, ls ? `${T.wide} = ${num(wideMean(img, r0, c0))}` : T.noWide, wx, iy - 2, ls ? palette.normal : palette.muted, 11);
    numGrid(ctx, wts, wx, iy + 26, wc, {
      caption: undefined, tone: palette.accent,
      fill: (r, c) => (ls && r === LS_CELL[0] && c === LS_CELL[1] ? TINT : signedTint(wts[r][c])),
    });
    label(ctx, T.weights, wx, iy + 26 + 3 * wc + 14, palette.muted, 11);
    label(ctx, `${T.output} = ${num(y)}`, wx, iy + 26 + 3 * wc + 40, palette.accent, portrait ? 15 : 17);

    // the top-middle weight used at each of the 25 positions
    const mc = portrait ? 32 : 32, my = portrait ? iy + 5 * ic + 128 : iy + 5 * ic + 64;
    const map = ls ? lsWeightMap(img) : X.map((row) => row.map(() => K3[LS_CELL[0]][LS_CELL[1]]));
    label(ctx, T.map, PAD, my - 14, palette.muted, 11);
    numGrid(ctx, map, PAD, my, mc, {
      tone: palette.normal, size: 11, text: (r, c) => num(map[r][c], 1),
      fill: (r, c) => (r === r0 && c === c0 ? TINT : ls ? `rgba(${palette.normalRgb},${0.06 + 0.12 * (map[r][c] - 1.8)})` : null),
    });
    if (ls && far) {
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) if (Math.abs(map[r][c] - MAP_BASE[r][c]) > 1e-9) frame(ctx, PAD + c * mc + 2, my + r * mc + 2, mc - 4, mc - 4, palette.anomaly, 1.4);
    }
    const nx = portrait ? PAD : PAD + 5 * mc + 24, ny = portrait ? my + 5 * mc + 20 : my + 10;
    if (ls && far) label(ctx, `${T.changed}: 9`, nx, ny, palette.anomaly, 12);
    if (!ls) label(ctx, T.sameAll, nx, ny, palette.muted, 12);
    if (ls) label(ctx, T.formula, nx, ny + 24, palette.muted, 11);
    label(ctx, U.common.hand, w - PAD, h - 14, palette.muted, 11, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.calc}>
          <span>{T.calc}</span>
          <button type="button" className={!ls ? "on" : ""} onClick={() => setLs(false)}>{T.fixed}</button>
          <button type="button" className={ls ? "on" : ""} onClick={() => setLs(true)}>{T.ls}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.far}>
          <span>{T.far}</span>
          <button type="button" className={!far ? "on" : ""} onClick={() => setFar(false)}>1</button>
          <button type="button" className={far ? "on" : ""} onClick={() => setFar(true)}>{FAR_TO}</button>
        </div>
      </div>
    </div>
  );
}
