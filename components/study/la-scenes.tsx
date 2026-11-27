"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { bar, line, type Ctx } from "./kit";
import { LA_RGB32 } from "./la-cat";
import { laCopy } from "./la-copy";
import {
  CELLS32, PAD, YCC32, blit, cellFrame, fitSize, fix, isPortrait, num, picture, swatch, tag, thousands, useHeadImage, vec, vecFix,
} from "./la-draw";
import {
  AVG_ROW, CELLS, QUAD, YCC, YCC_INV, cell, compareTable, dot, macs, matMul, matVec, mean, norm, relu, roundTrip, scale, type Vec,
} from "./la-math";

const U = laCopy.ui;
const CH = [palette.anomaly, palette.mint, palette.normal];          // bar colours for red, green, blue channels
const EYE = cell(LA_RGB32, "eyeL");
const [ER, EC] = CELLS.eyeL;

/** Draw a list of [text, colour] pieces one after another from x. Returns the end x. */
function pieces(ctx: Ctx, parts: [string, string][], x: number, y: number, size: number) {
  ctx.save();
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  let cx = x;
  parts.forEach(([t, c]) => { label(ctx, t, cx, y, c, size); cx += ctx.measureText(t).width; });
  ctx.restore();
  return cx;
}

/** Three channel bars for one colour vector. */
function channelBars(ctx: Ctx, v: Vec, x: number, y: number, bw: number, names: string[], fs: number, step = 22) {
  v.forEach((c, i) => {
    const yy = y + i * step;
    label(ctx, names[i], x, yy, palette.muted, 11);
    bar(ctx, x + 30, yy - 6, bw, 12, c, CH[i]);
    label(ctx, num(c, 4), x + 36 + bw, yy, palette.ink, fs);
  });
}

/* ------------------------------------------------------------------ */
/* 01 · The picture as a table, one cell as a vector                    */
/* ------------------------------------------------------------------ */

export function TableScene() {
  const [mode, setMode] = useState(0);
  const img = useHeadImage();
  const T = U.table;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), fs = w < 420 ? 11 : 12;
    const S = Math.min((w - 2 * PAD - 16) / 2, port ? 160 : 180), xA = PAD, xB = PAD + S + 16, yT = 30;
    label(ctx, T.picture, xA, 14, palette.muted, 11);
    label(ctx, T.grid, xB, 14, palette.muted, 11);
    ctx.save();
    ctx.fillStyle = "#fdece2"; ctx.fillRect(xA, yT, S, S);
    if (img.current) ctx.drawImage(img.current, xA, yT, S, S);
    ctx.strokeStyle = palette.frame; ctx.strokeRect(xA + 0.5, yT + 0.5, S - 1, S - 1);
    ctx.restore();
    blit(ctx, picture("la-rgb32", 32, 32, (r, c) => LA_RGB32[r][c]), xB, yT, S);
    [xA, xB].forEach((x) => (mode === 2 ? cellFrame(ctx, x, yT, S, 32, 22, 14, 24, 16) : cellFrame(ctx, x, yT, S, 32, ER, EC)));
    label(ctx, T.count1, xA, yT + S + 14, palette.muted, fitSize(ctx, T.count1, S, 12, 11));
    label(ctx, T.count2, xB, yT + S + 14, palette.ink, fitSize(ctx, T.count2, S, 12, 11));

    const y0 = yT + S + 40, sw = port ? 46 : 52;
    if (mode === 0) {
      swatch(ctx, EYE, PAD, y0, sw, sw, palette.accent, 2);
      label(ctx, T.eye, PAD + sw + 14, y0 + 6, palette.ink, fs);
      label(ctx, `x = ${vec(EYE)}`, PAD + sw + 14, y0 + 28, palette.accent, 13);
      const bw = Math.min(220, w - 2 * PAD - 90);
      channelBars(ctx, EYE, PAD, y0 + sw + 26, bw, T.channels, fs);
      label(ctx, `${T.ratio} = ${(EYE[2] / EYE[0]).toFixed(2)}`, PAD, y0 + sw + 26 + 3 * 22 + 6, palette.muted, fs);
    } else if (mode === 1) {
      const colW = (w - 2 * PAD) / 2, bw = Math.max(40, colW - 84);
      [[EYE, T.names[0]], [scale(EYE, 0.5), `${T.names[0]} ${T.shade}`]].forEach(([v, name], i) => {
        const x = PAD + i * colW, vv = v as Vec;
        swatch(ctx, vv, x, y0, sw, sw, i === 0 ? palette.accent : palette.ink, i === 0 ? 2 : 1.5);
        label(ctx, name as string, x + sw + 10, y0 + 10, palette.ink, fs);
        label(ctx, vec(vv, 3), x + sw + 10, y0 + 32, i === 0 ? palette.accent : palette.ink, fitSize(ctx, vec(vv, 3), colW - sw - 14, 12, 10));
        channelBars(ctx, vv, x, y0 + sw + 24, bw, T.channels, fs);
        label(ctx, `${T.ratio} = ${(vv[2] / vv[0]).toFixed(2)}`, x, y0 + sw + 24 + 3 * 22 + 6, palette.muted, fs);
      });
      label(ctx, T.same, PAD, y0 + sw + 24 + 3 * 22 + 30, palette.mint, 12);
    } else {
      const vs = QUAD.map(([r, c]) => LA_RGB32[r][c]), m = mean(vs), cw = (w - 2 * PAD) / 5, s2 = Math.min(cw - 14, 40);
      [...vs, m].forEach((v, i) => {
        const x = PAD + i * cw + (i === 4 ? 4 : 0);
        swatch(ctx, v, x, y0, s2, s2, i === 0 ? palette.accent : i === 4 ? palette.ink : palette.frame, i === 0 || i === 4 ? 2 : 1);
        label(ctx, i === 4 ? T.mix : T.names[i], x, y0 + s2 + 14, i === 4 ? palette.ink : palette.muted, 11);
        v.forEach((c, j) => label(ctx, num(c, 4), x, y0 + s2 + 34 + j * 17, CH[j], fs));
      });
      label(ctx, "=", PAD + 4 * cw - (cw - s2) / 2 - 2, y0 + s2 / 2, palette.ink, 14, "center");
      label(ctx, T.quad, PAD, y0 + s2 + 34 + 3 * 17 + 14, palette.ink, fs);
      label(ctx, "(a + b + c + d) ÷ 4", PAD, y0 + s2 + 34 + 3 * 17 + 34, palette.muted, fs);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.view}>
          <span>{T.view}</span>
          {T.steps.map((s, i) => <button key={s} type="button" className={mode === i ? "on" : ""} onClick={() => setMode(i)}>{i + 1}. {s}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · Dot product, cosine and distance; a shade on the eye            */
/* ------------------------------------------------------------------ */

const DOT_MAX = Math.max(...compareTable(LA_RGB32, 1).map((r) => r.dot));

export function DotScene() {
  const [shade, setShade] = useState(10);
  const [unitMode, setUnitMode] = useState(false);
  const T = U.dot;
  const s = shade / 10;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), fs = w < 420 ? 11 : 12;
    const rows = compareTable(LA_RGB32, s), e = scale(EYE, s);
    // the tracked eye, shaded
    const sw = 40;
    swatch(ctx, e, PAD, 24, sw, sw, palette.accent, 2);
    label(ctx, `${T.eye} × ${s.toFixed(1)}`, PAD + sw + 12, 32, palette.accent, 13);
    label(ctx, `a = ${vec(e, 3)}`, PAD + sw + 12, 52, palette.ink, fitSize(ctx, `a = ${vec(e, 3)}`, w - 2 * PAD - sw - 12, 12, 10));
    label(ctx, `${T.len} ‖a‖ = ${fix(norm(e), 3)}`, PAD + sw + 12, 72, palette.muted, 11);

    // the table: one row per compared cell, three measures
    const top = port ? 116 : 104, rh = port ? 64 : 54, nameW = port ? 90 : 108, colW = (w - 2 * PAD - nameW) / 3;
    const cols = [T.cols[0], T.cols[1], unitMode ? T.unitCol : T.cols[2]];
    cols.forEach((c, j) => label(ctx, c, PAD + nameW + j * colW, top - 12, j === 2 && unitMode ? palette.normal : palette.muted, 11));
    const bestDot = rows.reduce((b, r) => (r.dot > b.dot ? r : b)), bestCos = rows.reduce((b, r) => (r.cos > b.cos ? r : b));
    const dv = (r: (typeof rows)[number]) => (unitMode ? r.unitDist : r.dist);
    const bestDist = rows.reduce((b, r) => (dv(r) < dv(b) ? r : b));
    rows.forEach((r, i) => {
      const y = top + i * rh;
      line(ctx, PAD, y - 2, w - PAD, y - 2, palette.frame, 1);
      swatch(ctx, r.v, PAD, y + 6, 22, 22);
      label(ctx, T.names[r.key], PAD + 28, y + 12, palette.ink, fs);
      label(ctx, `${T.len} ${fix(r.len, 3)}`, PAD + 28, y + 30, palette.muted, 11);
      const cells: [string, number, boolean][] = [
        [fix(r.dot, 3), r.dot / DOT_MAX, r === bestDot],
        [`${fix(r.cos, 4)}`, r.cos, r === bestCos],
        [fix(dv(r), 3), dv(r) / 1.3, r === bestDist],
      ];
      cells.forEach(([t, v, best], j) => {
        const x = PAD + nameW + j * colW;
        label(ctx, t, x + 4, y + 12, palette.ink, fs);
        if (j === 1) label(ctx, `${r.angle.toFixed(1)}°`, port ? x + 4 : x + colW - 8, port ? y + 44 : y + 12, palette.muted, 10, port ? "left" : "right");
        bar(ctx, x + 4, y + 24, colW - 14, 7, v, j === 0 ? palette.accent : j === 1 ? palette.normal : palette.muted);
        if (best) { ctx.save(); ctx.strokeStyle = palette.mint; ctx.lineWidth = 2; ctx.strokeRect(x, y + 1, colW - 6, rh - 10); ctx.restore(); }
      });
    });
    const yb = top + 5 * rh + 8;
    label(ctx, "a · b = ‖a‖ ‖b‖ cos θ", PAD, yb, palette.muted, fs);
    if (unitMode) label(ctx, "‖a/‖a‖ − b/‖b‖‖² = 2 − 2 cos θ", PAD, yb + 20, palette.normal, fs);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{T.shade} <b>{s.toFixed(1)}</b></span>
          <input type="range" min={3} max={10} step={1} value={shade} onChange={(e) => setShade(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.distMode}>
          <span>{T.distMode}</span>
          <button type="button" className={!unitMode ? "on" : ""} onClick={() => setUnitMode(false)}>{T.raw}</button>
          <button type="button" className={unitMode ? "on" : ""} onClick={() => setUnitMode(true)}>{T.unit}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · A matrix times a vector: the JPEG colour matrix on one cell     */
/* ------------------------------------------------------------------ */

const INPUT_KEYS = ["eyeL", "cream", "mask"] as const;
/** Y, Cb, Cr maps of the whole picture: the same matrix applied to every cell. Cb and Cr are shown as colour alone: brightness fixed at
 *  0.6, the one number doubled so it shows, everything else zero, turned back into a colour. */
const MAP_Y = 0.6, MAP_GAIN = 2;

export function LayerScene() {
  const [inp, setInp] = useState(0);
  const [avg, setAvg] = useState(false);
  const [row, setRow] = useState(0);
  const T = U.layer;
  const W = avg ? [AVG_ROW, YCC[1], YCC[2]] : YCC;
  const x = cell(LA_RGB32, INPUT_KEYS[inp]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), small = w < 420;
    const y = matVec(W, x);
    const cw = small ? 50 : 64, chh = 30, xc = small ? 46 : 52, yc = small ? 66 : 76, gap = small ? 12 : 22;
    const total = 3 * cw + gap + xc + gap + 14 + gap + yc;
    const x0 = PAD + Math.max(0, (w - 2 * PAD - total - (small ? 0 : 92)) / 2), top = 62;
    const xX = x0 + 3 * cw + gap, xEq = xX + xc + gap, xY = xEq + 14 + gap;
    // input swatch above x
    swatch(ctx, x, xX + (xc - 26) / 2, 14, 26, 26, palette.accent, 2);
    label(ctx, T.w, x0 + 1.5 * cw, top - 12, palette.ink, 12, "center");
    label(ctx, T.y, xY + yc / 2, top - 12, palette.ink, 12, "center");
    // the matrix W
    W.forEach((r, i) => r.forEach((v, j) => {
      const cx = x0 + j * cw, cy = top + i * chh;
      ctx.fillStyle = i === row ? `rgba(${palette.normalRgb},0.10)` : avg && i === 0 ? `rgba(${palette.accentRgb},0.16)` : "#ffffff";
      ctx.fillRect(cx, cy, cw, chh);
      ctx.strokeStyle = palette.frame; ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, chh - 1);
      label(ctx, fix(v, 3), cx + cw / 2, cy + chh / 2, palette.ink, small ? 11 : 12, "center");
    }));
    ctx.save(); ctx.strokeStyle = palette.normal; ctx.lineWidth = 2; ctx.strokeRect(x0, top + row * chh, 3 * cw, chh); ctx.restore();
    // x and y columns
    x.forEach((v, i) => {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(xX, top + i * chh, xc, chh);
      ctx.strokeStyle = palette.frame; ctx.strokeRect(xX + 0.5, top + i * chh + 0.5, xc - 1, chh - 1);
      label(ctx, num(v, 2), xX + xc / 2, top + i * chh + chh / 2, CH[i], 12, "center");
    });
    label(ctx, "=", xEq + 7, top + 1.5 * chh, palette.ink, 15, "center");
    y.forEach((v, i) => {
      ctx.fillStyle = avg && i === 0 ? `rgba(${palette.accentRgb},0.16)` : "#ffffff"; ctx.fillRect(xY, top + i * chh, yc, chh);
      ctx.strokeStyle = i === row ? palette.normal : palette.frame; ctx.lineWidth = i === row ? 2 : 1;
      ctx.strokeRect(xY + 0.5, top + i * chh + 0.5, yc - 1, chh - 1); ctx.lineWidth = 1;
      label(ctx, fix(v, 4), xY + yc / 2, top + i * chh + chh / 2, palette.ink, 12, "center");
      if (!small) label(ctx, T.outNames[i], xY + yc + 8, top + i * chh + chh / 2, palette.muted, 11);
    });
    if (avg) label(ctx, T.changed, x0, top + 3 * chh + 14, palette.accent, 11);

    // the chosen row, written out
    const yCalc = top + 3 * chh + (avg ? 40 : 32);
    const terms = W[row].map((v, j) => `${fix(v, 3)}×${num(x[j], 2)}`).join(" + ");
    label(ctx, `${T.rows[row]} · x`, PAD, yCalc, palette.normal, 11);
    label(ctx, terms, PAD, yCalc + 20, palette.ink, fitSize(ctx, terms, w - 2 * PAD, 12, 9));
    label(ctx, `= ${fix(dot(W[row], x), 4)}`, PAD, yCalc + 40, palette.normal, 13);

    // the same W on every cell: three small maps
    const mTop = yCalc + 76, ms = Math.min((w - 2 * PAD - 20) / 3, h - mTop - 12, 150);
    label(ctx, T.maps, PAD, mTop - 16, palette.muted, 11);
    const first = (v: Vec) => (avg ? dot(AVG_ROW, v) : dot(YCC[0], v));
    const maps = [
      picture(avg ? "la-map-avg" : "la-map-y", 32, 32, (r, c) => { const g = first(LA_RGB32[r][c]); return [g, g, g]; }),
      picture("la-map-cb", 32, 32, (r, c) => matVec(YCC_INV, [MAP_Y, MAP_GAIN * YCC32[r * 32 + c][1], 0])),
      picture("la-map-cr", 32, 32, (r, c) => matVec(YCC_INV, [MAP_Y, 0, MAP_GAIN * YCC32[r * 32 + c][2]])),
    ];
    const [ir, ic] = CELLS[INPUT_KEYS[inp]];
    maps.forEach((p, i) => {
      const mx = PAD + i * (ms + 10);
      blit(ctx, p, mx, mTop, ms);
      cellFrame(ctx, mx, mTop, ms, 32, ir, ic, ir + 1, ic + 1, i === row ? palette.normal : palette.accent, 1.8);
      tag(ctx, port || small ? ["Y", "Cb", "Cr"][i] : T.outNames[i], mx + 4, mTop + 10, avg && i === 0 ? palette.accent : palette.ink, 11, "left");
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.input}>
          <span>{T.input}</span>
          {T.inputs.map((s, i) => <button key={s} type="button" className={inp === i ? "on" : ""} onClick={() => setInp(i)}>{s}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.first}>
          <span>{T.first}</span>
          {T.firsts.map((s, i) => <button key={s} type="button" className={avg === (i === 1) ? "on" : ""} onClick={() => setAvg(i === 1)}>{s}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.row}>
          <span>{T.row}</span>
          {T.rows.map((s, i) => <button key={s} type="button" className={row === i ? "on" : ""} onClick={() => setRow(i)}>{s}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · A matrix times a matrix: every cell at once, two layers, ReLU    */
/* ------------------------------------------------------------------ */

const FOLD = matMul(YCC_INV, YCC);
const NEG = YCC32.filter((h) => h[1] < 0 || h[2] < 0).length;
const AMBER: Vec = [194 / 255, 115 / 255, 0];
let afterLin: Vec[] | null = null, afterRelu: Vec[] | null = null;
const AFTER_LIN = () => (afterLin ??= CELLS32.map((v) => roundTrip(v, false)));
const AFTER_RELU = () => (afterRelu ??= CELLS32.map((v) => roundTrip(v, true)));

export function ComposeScene() {
  const [withRelu, setWithRelu] = useState(false);
  const T = U.compose;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), fs = w < 420 ? 11 : 12, small = w < 420;
    const P = Math.min((w - 2 * PAD - 20) / 3, port ? 108 : 132), yT = 28;
    const after = withRelu ? AFTER_RELU() : AFTER_LIN();
    const pics = [
      picture("la-orig", 32, 32, (r, c) => LA_RGB32[r][c]),
      picture(withRelu ? "la-rt-relu" : "la-rt-lin", 32, 32, (r, c) => after[r * 32 + c]),
      picture(withRelu ? "la-df-relu" : "la-df-lin", 32, 32, (r, c) => {
        const d = Math.min(1, (Math.abs(after[r * 32 + c][0] - LA_RGB32[r][c][0]) + Math.abs(after[r * 32 + c][1] - LA_RGB32[r][c][1]) + Math.abs(after[r * 32 + c][2] - LA_RGB32[r][c][2])) / 0.3);
        return AMBER.map((a) => 1 - d * (1 - a));
      }),
    ];
    [T.orig, T.after, T.diff].forEach((name, i) => {
      const x = PAD + i * (P + 10);
      label(ctx, name, x, yT - 12, i === 1 && withRelu ? palette.anomaly : palette.muted, 11);
      blit(ctx, pics[i], x, yT, P);
      cellFrame(ctx, x, yT, P, 32, ER, EC, ER + 1, EC + 1, palette.accent, 1.8);
    });

    // the eye cell through W, the gap between the layers, and D
    const hh = matVec(YCC, EYE), mid = withRelu ? relu(hh) : hh, out = matVec(YCC_INV, mid);
    const y0 = yT + P + 30, step = port ? 24 : 22, nameW = small ? 78 : 84;
    label(ctx, T.eye, PAD, y0 - 2, palette.accent, 11);
    const rows: [string, [string, string][]][] = [
      ["x", [[vec(EYE), palette.ink]]],
      ["W x", [[vecFix(hh), palette.ink]]],
      [withRelu ? "ReLU" : T.between, withRelu
        ? [["[", palette.ink], ...mid.flatMap((v, i): [string, string][] => [[fix(v, 4), hh[i] < 0 ? palette.anomaly : palette.ink], [i < 2 ? ", " : "]", palette.ink]])]
        : [[`${T.modes[0]}`, palette.muted]]],
      ["D (·)", [[vecFix(out), withRelu ? palette.anomaly : palette.ink]]],
    ];
    rows.forEach(([name, parts], i) => {
      const y = y0 + 18 + i * step;
      label(ctx, name, PAD, y, i === 2 && withRelu ? palette.anomaly : palette.muted, 11);
      const end = pieces(ctx, parts, PAD + nameW, y, fs);
      if (i === 0 || i === 3) swatch(ctx, i === 0 ? EYE : out, Math.min(end + 10, w - PAD - 18), y - 8, 16, 16);
    });

    // the folded matrix and the multiply-add count
    const yF = y0 + 18 + 4 * step + 14;
    if (!withRelu) {
      label(ctx, T.fold, PAD, yF, palette.mint, 11);
      const cw = Math.min(84, (w - 2 * PAD) / 3), chh = 22;
      FOLD.forEach((r, i) => r.forEach((v, j) => {
        const cx = PAD + j * cw, cy = yF + 12 + i * chh;
        ctx.fillStyle = i === j ? `rgba(15,157,106,0.10)` : "#ffffff"; ctx.fillRect(cx, cy, cw, chh);
        ctx.strokeStyle = palette.frame; ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, chh - 1);
        label(ctx, fix(v, 7), cx + cw / 2, cy + chh / 2, palette.ink, small ? 10 : 11, "center");
      }));
      const yc = yF + 12 + 3 * chh + 18;
      const two = `${T.cost2}: 18 × ${thousands(1024)} = ${thousands(2 * macs(1024, 3, 3))}${T.per}`;
      const one = `${T.costFold}: 27 + 9 × ${thousands(1024)} = ${thousands(macs(3, 3, 3) + macs(1024, 3, 3))}${T.per}`;
      if (yc + 22 < h) {
        label(ctx, two, PAD, yc, palette.muted, fitSize(ctx, two, w - 2 * PAD, 12, 11));
        label(ctx, one, PAD, yc + 20, palette.mint, fitSize(ctx, one, w - 2 * PAD, 12, 11));
      }
    } else {
      ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = palette.anomaly; ctx.strokeRect(PAD + 0.5, yF - 8.5, Math.min(252, w - 2 * PAD) - 1, 52); ctx.restore();
      label(ctx, T.noFold, PAD + 10, yF + 6, palette.anomaly, 12);
      label(ctx, `${T.neg}: ${thousands(NEG)} / ${thousands(1024)}`, PAD + 10, yF + 28, palette.ink, fs);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.between}>
          <span>{T.between}</span>
          {T.modes.map((s, i) => <button key={s} type="button" className={withRelu === (i === 1) ? "on" : ""} onClick={() => setWithRelu(i === 1)}>{s}</button>)}
        </div>
      </div>
    </div>
  );
}

