"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, frame, rbox, type Ctx } from "./kit";
import { repCopy } from "./rep-copy";
import {
  BIAS_BN, BN0, BN1, BN3, B3_MAP, CENTER, ID_PAD, K1, K1_PAD, K3, K_BN, K_MERGED, MERGED_MAP, OTHER_A, OTHER_B,
  SPOTS, SUM_MAP, X, addG, bnAt, branchesAt, convMap, foldBias, foldScale, poke, trainModeCentre, window3, type Bn, type Grid,
} from "./rep-math";

const U = repCopy.ui;
export const PAD = 18;
export const isPortrait = (w: number, h: number) => h > w * 1.15;
export const TINT = `rgba(${palette.accentRgb},0.16)`;
export const COOL = `rgba(${palette.normalRgb},0.08)`;
export const MINT_TINT = "rgba(15,157,106,0.14)";
export const RED_TINT = `rgba(${palette.anomalyRgb},0.12)`;

/** Up to `d` decimals, trailing zeros dropped, real minus sign. */
export const num = (v: number, d = 2) => {
  const s = v.toFixed(d).replace(/\.?0+$/, "");
  return s === "-0" || s === "" ? "0" : s.replace("-", "−");
};
/** Fixed decimals, real minus sign, negative zero shown as zero. */
export const fix = (v: number, d = 3) => (Math.abs(v) < 0.5 * 10 ** -d ? (0).toFixed(d) : v.toFixed(d)).replace("-", "−");

export type GridOpt = { caption?: string; tone?: string; fill?: (r: number, c: number) => string | null; text?: (r: number, c: number) => string; color?: (r: number, c: number) => string; size?: number; lw?: number };

/** A small matrix as cells with a number in each. */
export function numGrid(ctx: Ctx, m: Grid, x: number, y: number, cell: number, o: GridOpt = {}) {
  const tone = o.tone ?? palette.ink;
  m.forEach((row, r) => row.forEach((v, c) => {
    ctx.fillStyle = o.fill?.(r, c) ?? "#ffffff";
    ctx.fillRect(x + c * cell, y + r * cell, cell, cell);
    ctx.strokeStyle = palette.frame; ctx.lineWidth = 1;
    ctx.strokeRect(x + c * cell + 0.5, y + r * cell + 0.5, cell - 1, cell - 1);
    const s = o.text ? o.text(r, c) : num(v);
    const size = o.size ?? (s.length <= 2 ? Math.min(13, Math.max(11, Math.floor(cell * 0.42))) : s.length <= 4 ? Math.min(12, Math.max(10, Math.floor(cell * 0.36))) : 10);
    label(ctx, s, x + c * cell + cell / 2, y + r * cell + cell / 2 + 0.5, o.color?.(r, c) ?? palette.ink, size, "center");
  }));
  frame(ctx, x, y, m[0].length * cell, m.length * cell, tone, o.lw ?? 1.5);
  if (o.caption) label(ctx, o.caption, x + (m[0].length * cell) / 2, y - 12, tone, 11, "center");
}

/** The 5×5 image with its ring of zero padding, and an amber 3×3 window at (r, c). */
function paddedImage(ctx: Ctx, img: Grid, x: number, y: number, cell: number, r: number, c: number, hi?: (rr: number, cc: number) => boolean) {
  for (let rr = -1; rr <= 5; rr++) for (let cc = -1; cc <= 5; cc++) {
    const inside = rr >= 0 && cc >= 0 && rr < 5 && cc < 5;
    const px = x + (cc + 1) * cell, py = y + (rr + 1) * cell;
    ctx.fillStyle = inside ? (hi?.(rr, cc) ? TINT : "#ffffff") : palette.cell;
    ctx.fillRect(px, py, cell, cell);
    ctx.strokeStyle = inside ? palette.frame : palette.track; ctx.lineWidth = 1;
    ctx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
    label(ctx, inside ? num(img[rr][cc]) : "0", px + cell / 2, py + cell / 2 + 0.5, inside ? palette.ink : palette.dotOff, inside ? 12 : 10, "center");
  }
  frame(ctx, x + cell, y + cell, 5 * cell, 5 * cell, palette.ink, 1.2);
  frame(ctx, x + c * cell, y + r * cell, 3 * cell, 3 * cell, palette.accent, 2.5);
}

/** Product terms of window × kernel that are not zero, written out: "3 + 2 − 2 + 2 + 2". */
export function nonzeroTerms(win: Grid, k: Grid): string {
  const t: number[] = [];
  win.forEach((row, u) => row.forEach((v, j) => { const p = v * k[u][j]; if (Math.abs(p) > 1e-12) t.push(p); }));
  if (!t.length) return "0";
  return t.map((p, i) => (i === 0 ? num(p) : p < 0 ? `− ${num(-p)}` : `+ ${num(p)}`)).join(" ");
}

const signedTint = (v: number) => (Math.abs(v) < 1e-9 ? "#ffffff" : v > 0 ? `rgba(${palette.normalRgb},${0.1 + Math.min(0.3, Math.abs(v) * 0.1)})` : `rgba(${palette.anomalyRgb},${0.1 + Math.min(0.3, Math.abs(v) * 0.1)})`);

/* ------------------------------------------------------------------ */
/* 01 · One block, three branches, one output position                 */
/* ------------------------------------------------------------------ */

const POKED = poke(CENTER[0], CENTER[1]);

export function BranchScene() {
  const [step, setStep] = useState(0);
  const [spot, setSpot] = useState(0);
  const [poked, setPoked] = useState(false);
  const T = U.branches;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const img = poked ? POKED.x : X;
    const [r, c] = SPOTS[spot];
    const b = branchesAt(r, c, img);
    const sum = poked ? convMap(img, K_MERGED, 1, 1) : SUM_MAP;

    // left: the padded image; the output map beside or below it
    const ic = portrait ? 20 : w >= 560 ? 26 : 24, ix = PAD, iy = 34;
    label(ctx, `${U.common.input}, 5×5`, ix, 18, palette.ink, 12);
    paddedImage(ctx, img, ix, iy, ic, r, c, (rr, cc) => poked && rr === CENTER[0] && cc === CENTER[1]);
    label(ctx, T.outside, ix + 3.5 * ic, iy + 7 * ic + 12, palette.muted, 11, "center");

    const oc = portrait ? 22 : 24;
    const ox = portrait ? ix + 7 * ic + 26 : ix + 1 * ic, oy = portrait ? 56 : iy + 7 * ic + 44;
    label(ctx, U.common.out, ox + 2.5 * oc, oy - 12, palette.muted, 11, "center");
    numGrid(ctx, sum, ox, oy, oc, {
      tone: palette.ink,
      text: (rr, cc) => (step === 2 ? num(sum[rr][cc]) : rr === r && cc === c ? "?" : ""),
      fill: (rr, cc) => (step === 2 && poked && Math.abs(sum[rr][cc] - SUM_MAP[rr][cc]) > 1e-9 ? TINT : rr === r && cc === c ? COOL : null),
      color: (rr, cc) => (rr === r && cc === c ? palette.accent : palette.ink),
      size: 11,
    });
    frame(ctx, ox + c * oc, oy + r * oc, oc, oc, palette.accent, 2.2);
    if (step === 2 && poked) {
      for (let rr = 0; rr < 5; rr++) for (let cc = 0; cc < 5; cc++) if (Math.abs(sum[rr][cc] - SUM_MAP[rr][cc]) > 1e-9) frame(ctx, ox + cc * oc + 2, oy + rr * oc + 2, oc - 4, oc - 4, palette.accent, 1.2);
      label(ctx, `${T.moved}: ${POKED.movedMerged}`, ox + 2.5 * oc, oy + 5 * oc + 14, palette.accent, 11, "center");
    }

    // right (or below): the three branches, top to bottom
    const rx = portrait ? PAD : ix + 7 * ic + 30, ry = portrait ? 214 : 40;
    const kc = portrait ? 24 : Math.min(28, (w - rx - PAD - 64) / 6), fs = portrait ? 12 : 13;
    const on1 = step >= 1;
    label(ctx, T.b3, rx, ry, palette.ink, 12);
    numGrid(ctx, b.win, rx, ry + 14, kc, { tone: palette.accent });
    label(ctx, "×", rx + 3 * kc + 12, ry + 14 + 1.5 * kc, palette.muted, 15, "center");
    numGrid(ctx, K3, rx + 3 * kc + 24, ry + 14, kc, { tone: palette.normal, fill: (u, v) => signedTint(K3[u][v]) });
    label(ctx, "=", rx + 6 * kc + 36, ry + 14 + 1.5 * kc, palette.muted, 15, "center");
    label(ctx, num(b.b3), rx + 6 * kc + 52, ry + 14 + 1.5 * kc, palette.ink, 16);
    label(ctx, `${T.nonzero}: ${nonzeroTerms(b.win, K3)}`, rx, ry + 14 + 3 * kc + 16, palette.muted, 11);

    const pc = portrait ? 28 : 30;
    const yB = ry + 14 + 3 * kc + 44, yC = yB + pc + 34;
    const dim = (s: string) => (on1 ? s : "?");
    ctx.save(); ctx.globalAlpha = on1 ? 1 : 0.45;
    label(ctx, T.b1, rx, yB, palette.ink, 12);
    numGrid(ctx, [[img[r][c]]], rx, yB + 12, pc, { tone: palette.accent });
    label(ctx, `× ${num(K1)} =`, rx + pc + 12, yB + 12 + pc / 2, palette.muted, fs);
    label(ctx, dim(num(b.b1)), rx + pc + 70, yB + 12 + pc / 2, palette.ink, 16);
    label(ctx, T.b0, rx, yC, palette.ink, 12);
    numGrid(ctx, [[img[r][c]]], rx, yC + 12, pc, { tone: palette.accent });
    label(ctx, "=", rx + pc + 12, yC + 12 + pc / 2, palette.muted, fs);
    label(ctx, dim(num(b.b0)), rx + pc + 70, yC + 12 + pc / 2, palette.ink, 16);
    ctx.restore();

    const yS = yC + pc + 44;
    label(ctx, T.sum, rx, yS - 4, palette.muted, 11);
    const parts = step === 0 ? `${num(b.b3)} + ? + ?` : `${num(b.b3)} + ${num(b.b1)} + ${num(b.b0)}`;
    label(ctx, `${parts} = ${step === 2 ? num(b.sum) : "?"}`, rx, yS + 18, step === 2 ? palette.accent : palette.ink, portrait ? 15 : 17);
    if (step < 2) label(ctx, T.waiting, rx, yS + 42, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.common.step}>
          <span>{U.common.step}</span>
          {T.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.spot}>
          <span>{T.spot}</span>
          {T.spots.map((name, i) => <button key={name} type="button" className={spot === i ? "on" : ""} onClick={() => setSpot(i)}>{name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.poke}>
          <span>{T.poke}</span>
          <button type="button" className={!poked ? "on" : ""} onClick={() => setPoked(false)}>{T.pokeOff}</button>
          <button type="button" className={poked ? "on" : ""} onClick={() => setPoked(true)}>{T.pokeOn}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · Rewrite 1×1 and identity as 3×3, add, compare at 25 positions   */
/* ------------------------------------------------------------------ */

const DIFF_MAP = addG(MERGED_MAP, SUM_MAP, -1);
const CW = window3(X, CENTER[0], CENTER[1]);
const CB = branchesAt(CENTER[0], CENTER[1]);

export function MergeScene() {
  const [step, setStep] = useState(0);
  const T = U.merge;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);

    // top row, the same place in every step: k3 + pad(k1) + I = merged
    const kc = portrait ? 20 : 30, gap = portrait ? 16 : 28, rowW = 4 * 3 * kc + 3 * gap;
    const x0 = (w - rowW) / 2, y0 = portrait ? 52 : 50;
    const kx = (i: number) => x0 + i * (3 * kc + gap);
    const centreFill = (r: number, c: number) => (r === 1 && c === 1 ? TINT : null);
    numGrid(ctx, K3, kx(0), y0, kc, { caption: T.k3, tone: palette.normal, fill: (r, c) => (r === 1 && c === 1 ? TINT : signedTint(K3[r][c])) });
    numGrid(ctx, K1_PAD, kx(1), y0, kc, { caption: portrait ? T.k1Short : T.k1, tone: palette.normal, fill: centreFill, color: (r, c) => (r === 1 && c === 1 ? palette.ink : palette.dotOff) });
    numGrid(ctx, ID_PAD, kx(2), y0, kc, { caption: portrait ? T.idShort : T.id, tone: palette.normal, fill: centreFill, color: (r, c) => (r === 1 && c === 1 ? palette.ink : palette.dotOff) });
    ["+", "+", "="].forEach((s, i) => label(ctx, s, kx(i) + 3 * kc + gap / 2, y0 + 1.5 * kc, palette.muted, 15, "center"));
    numGrid(ctx, K_MERGED, kx(3), y0, kc, {
      caption: T.merged, tone: palette.accent,
      text: (r, c) => (step >= 1 ? num(K_MERGED[r][c]) : "?"),
      fill: (r, c) => (step >= 1 ? (r === 1 && c === 1 ? TINT : signedTint(K_MERGED[r][c])) : palette.cell),
      color: () => (step >= 1 ? palette.ink : palette.muted),
    });
    if (step >= 1) frame(ctx, kx(3) + kc + 1, y0 + kc + 1, kc - 2, kc - 2, palette.accent, 2);
    const yNote = y0 + 3 * kc + 18;
    label(ctx, `${T.centre}: ${num(K3[1][1])} + ${num(K1)} + 1 = ${step >= 1 ? num(K_MERGED[1][1]) : "?"}`, w / 2, yNote, step >= 1 ? palette.accent : palette.muted, 12, "center");

    if (step === 1) {
      const wc = portrait ? 26 : 28, wy = yNote + (portrait ? 40 : 36);
      numGrid(ctx, CW, PAD, wy, wc, { caption: U.common.window, tone: palette.accent });
      const tx = portrait ? PAD : PAD + 3 * wc + 26, ty = portrait ? wy + 3 * wc + 30 : wy + 4;
      label(ctx, T.twoWays, tx, ty, palette.muted, 11);
      label(ctx, `${T.branches}: ${num(CB.b3)} + ${num(CB.b1)} + ${num(CB.b0)} = ${num(CB.sum)}`, tx, ty + 26, palette.ink, portrait ? 12 : 13);
      label(ctx, `${T.one}: ${nonzeroTerms(CW, K_MERGED)} = ${num(CB.merged)}`, tx, ty + 52, palette.accent, portrait ? 12 : 13);
      label(ctx, U.common.same, tx, ty + 78, palette.mint, 12);
    }
    if (step === 2) {
      const mc = portrait ? 24 : 26, mw = 5 * mc;
      const maps: [Grid, string, string][] = [[SUM_MAP, T.sumMap, palette.ink], [MERGED_MAP, T.mergedMap, palette.accent], [DIFF_MAP, T.diffMap, palette.mint]];
      const pos = portrait
        ? [[(w - 2 * mw - 24) / 2, yNote + 44], [(w - 2 * mw - 24) / 2 + mw + 24, yNote + 44], [(w - mw) / 2, yNote + 44 + mw + 40]]
        : [0, 1, 2].map((i) => [(w - 3 * mw - 2 * 26) / 2 + i * (mw + 26), yNote + 48]);
      maps.forEach(([m, cap, tone], i) => numGrid(ctx, m, pos[i][0], pos[i][1], mc, { caption: cap, tone, size: 11, fill: () => (i === 2 ? MINT_TINT : null) }));
      const ly = portrait ? pos[2][1] + mw + 24 : pos[0][1] + mw + 26;
      label(ctx, T.allZero, w / 2, ly, palette.mint, 12, "center");
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.common.step}>
          <span>{U.common.step}</span>
          {T.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · BatchNorm at inference folds into weight and bias               */
/* ------------------------------------------------------------------ */

const BNC = bnAt(CENTER[0], CENTER[1]);
const TRAIN_A = trainModeCentre(OTHER_A), TRAIN_B = trainModeCentre(OTHER_B);

export function BnScene() {
  const [mode, setMode] = useState<"infer" | "train">("infer");
  const [step, setStep] = useState(0);
  const [other, setOther] = useState(0);
  const T = U.bn;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const fs = portrait ? 12 : 13;

    if (mode === "infer") {
      label(ctx, `${U.common.center} (2, 2)`, PAD, 18, palette.ink, 12);
      const rows: { name: string; z: number; bn: Bn; y: number; fold: string; folded: number }[] = [
        { name: T.rows[0], z: BNC.z3, bn: BN3, y: BNC.y3, fold: `${T.scale} ${num(foldScale(BN3))}`, folded: BNC.folded3 },
        { name: T.rows[1], z: BNC.z1, bn: BN1, y: BNC.y1, fold: `${T.scale} ${num(foldScale(BN1))}`, folded: BNC.folded1 },
        { name: T.rows[2], z: BNC.z0, bn: BN0, y: BNC.y0, fold: `${T.scale} ${num(foldScale(BN0))}`, folded: BNC.folded0 },
      ];
      const biases = [foldBias(BN3), foldBias(BN1), foldBias(BN0)];
      const rh = portrait ? 78 : 64, top = 44;
      const zx = PAD, bx = portrait ? PAD + 78 : PAD + 150, bw = portrait ? w - PAD - bx - 64 : 230, vx = bx + bw + 22;
      rows.forEach((row, i) => {
        const y = top + i * rh;
        label(ctx, row.name, PAD, y, palette.ink, 12);
        const by = y + 12;
        rbox(ctx, zx, by, portrait ? 60 : 120, 30, 6, "#ffffff", palette.frame, 1);
        label(ctx, `${portrait ? "z" : T.conv} = ${num(row.z)}`, zx + (portrait ? 30 : 60), by + 15, palette.ink, fs, "center");
        arrow(ctx, zx + (portrait ? 60 : 120) + 4, by + 15, bx - 4, by + 15, palette.muted, 1.2);
        if (step === 0) {
          rbox(ctx, bx, by, bw, 30, 6, COOL, palette.normal, 1.2);
          label(ctx, `μ ${num(row.bn.mu)}  σ ${num(row.bn.sigma)}  γ ${num(row.bn.gamma)}  β ${num(row.bn.beta)}`, bx + bw / 2, by + 15, palette.normal, portrait ? 11 : 12, "center");
        } else {
          rbox(ctx, bx, by, bw, 30, 6, TINT, palette.accent, 1.2);
          label(ctx, `${row.fold}, ${T.bias} ${num(biases[i])}`, bx + bw / 2, by + 15, palette.accent, portrait ? 11 : 12, "center");
        }
        arrow(ctx, bx + bw + 4, by + 15, vx - 2, by + 15, palette.muted, 1.2);
        label(ctx, num(step === 0 ? row.y : row.folded), vx + 4, by + 15, palette.ink, 15);
      });
      const yS = top + 3 * rh + 8;
      label(ctx, `${T.total}: ${num(BNC.y3)} + ${num(BNC.y1)} + ${num(BNC.y0)} = ${num(BNC.sum)}`, PAD, yS, palette.ink, fs + 1);
      if (step === 1) {
        const kc = portrait ? 24 : 26, ky = yS + 34;
        label(ctx, T.mergedLine, PAD, ky - 12, palette.accent, 11);
        numGrid(ctx, K_BN, PAD, ky, kc, { tone: palette.accent, fill: (r, c) => (r === 1 && c === 1 ? TINT : signedTint(K_BN[r][c])) });
        const tx = PAD + 3 * kc + 22;
        label(ctx, `${T.bias} = ${num(foldBias(BN3))} + (${num(foldBias(BN1))}) + ${num(foldBias(BN0))} = ${num(BIAS_BN)}`, tx, ky + 10, palette.ink, portrait ? 11 : 12);
        label(ctx, `${nonzeroTerms(CW, K_BN)} = ${num(BNC.merged - BIAS_BN)}`, tx, ky + 34, palette.ink, portrait ? 11 : 12);
        label(ctx, `${num(BNC.merged - BIAS_BN)} + (${num(BIAS_BN)}) = ${num(BNC.merged)}`, tx, ky + 58, palette.accent, fs + 1);
        label(ctx, U.common.same, tx, ky + 80, palette.mint, 12);
      }
    } else {
      const oth = other === 0 ? OTHER_A : OTHER_B, st = other === 0 ? TRAIN_A : TRAIN_B;
      label(ctx, T.batch, PAD, 18, palette.ink, 12);
      const ic = portrait ? 22 : 24, gy = 50;
      numGrid(ctx, X, PAD, gy, ic, { caption: T.ours, tone: palette.accent, size: 11, fill: (r, c) => (Math.abs(r - 2) <= 1 && Math.abs(c - 2) <= 1 ? TINT : null) });
      const ox = PAD + 5 * ic + 30;
      numGrid(ctx, oth, ox, gy, ic, { caption: other === 0 ? T.otherA : T.otherB, tone: palette.muted, size: 11 });
      const ty = gy + 5 * ic + 34;
      label(ctx, `${T.rows[0]}, ${U.common.center}: z = ${num(B3_MAP[2][2])}`, PAD, ty, palette.ink, fs);
      label(ctx, T.batchStats, PAD, ty + 28, palette.muted, 11);
      label(ctx, `μ = ${fix(st.mean, 2)},  σ = ${fix(st.std, 2)}`, PAD, ty + 50, palette.normal, fs);
      label(ctx, `(${num(B3_MAP[2][2])} − ${fix(st.mean, 2)}) / ${fix(st.std, 2)} × ${num(BN3.gamma)} + ${num(BN3.beta)} = ${fix(st.value, 2)}`, PAD, ty + 78, palette.anomaly, fs);
      label(ctx, T.fixed, PAD, ty + 112, palette.muted, 11);
      label(ctx, `(${num(B3_MAP[2][2])} − ${num(BN3.mu)}) / ${num(BN3.sigma)} × ${num(BN3.gamma)} + ${num(BN3.beta)} = ${num(BNC.y3)}`, PAD, ty + 134, palette.mint, fs);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.mode}>
          <span>{T.mode}</span>
          <button type="button" className={mode === "infer" ? "on" : ""} onClick={() => setMode("infer")}>{T.infer}</button>
          <button type="button" className={mode === "train" ? "on" : ""} onClick={() => setMode("train")}>{T.train}</button>
        </div>
        {mode === "infer" ? (
          <div className="ad-ctl ad-seg" role="group" aria-label={U.common.step}>
            <span>{U.common.step}</span>
            {T.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
          </div>
        ) : (
          <div className="ad-ctl ad-seg" role="group" aria-label={T.other}>
            <span>{T.other}</span>
            <button type="button" className={other === 0 ? "on" : ""} onClick={() => setOther(0)}>{T.otherA}</button>
            <button type="button" className={other === 1 ? "on" : ""} onClick={() => setOther(1)}>{T.otherB}</button>
          </div>
        )}
      </div>
    </div>
  );
}
