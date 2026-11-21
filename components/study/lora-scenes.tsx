"use client";

import { useMemo, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, bar, cells, frame, line, rbox, signed, type Ctx } from "./kit";
import { loraCopy } from "./lora-copy";
import {
  ADAPTERS, BASE_W, BYTES_FP16, LLM7, MODELS, RN, SIZES_B, TABLES, TABLE_SVD, TARGET, TN, adapterParams, bestError, gb, matMul, matVec,
  mergeCheck, moduleParams, residual, trainLora, trainMemory, truncate, addScaled, type Mat, type ModuleKey,
} from "./lora-math";

const U = loraCopy.ui;
const PAD = 18;
const isPortrait = (w: number, h: number) => h > w * 1.15;
const maxAbs = (m: Mat) => Math.max(1e-9, ...m.flat().map(Math.abs));

/** A matrix as a block of signed-colour cells with an optional caption above it. */
function heat(ctx: Ctx, m: Mat, x: number, y: number, cell: number, scale: number, caption?: string, tone: string = palette.muted) {
  cells(ctx, x, y, cell, m.length, m[0].length, (r, c) => signed(m[r][c], scale), cell > 8 ? 1 : 0.5);
  frame(ctx, x - 1, y - 1, m[0].length * cell + 2, m.length * cell + 2, palette.frame, 1);
  if (caption) label(ctx, caption, x + (m[0].length * cell) / 2, y - 12, tone, 11, "center");
}

const size = (g: number) => (g >= 1000 ? `${Math.round(g).toLocaleString("en-US")}GB` : g >= 10 ? `${g.toFixed(0)}GB` : g >= 1 ? `${g.toFixed(1)}GB` : `${(g * 1000).toFixed(g * 1000 >= 10 ? 0 : 1)}MB`);

/* ------------------------------------------------------------------ */
/* 01 · One full copy per task, or one base and small files             */
/* ------------------------------------------------------------------ */

const TASKS = [1, 2, 5, 10, 20, 50, 100];

export function WallScene() {
  const [mi, setMi] = useState(2);
  const [ti, setTi] = useState(3);
  const m = MODELS[mi], tasks = TASKS[ti];
  const one = gb(m.params * BYTES_FP16), ad = gb(adapterParams(m, 4) * BYTES_FP16);
  const full = tasks * one, lora = one + tasks * ad;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const x0 = PAD, bw = w - 2 * PAD, bh = 34, y1 = 86, y2 = y1 + (isPortrait(w, h) ? 170 : 138);
    label(ctx, U.wall.full, x0, y1 - 20, palette.anomaly, 12);
    label(ctx, size(full), w - PAD, y1 - 20, palette.ink, 14, "right");
    ctx.fillStyle = palette.track; ctx.fillRect(x0, y1, bw, bh);
    // one segment per stored copy of the whole model
    const seg = bw / tasks;
    for (let i = 0; i < tasks; i++) {
      ctx.fillStyle = `rgba(${palette.anomalyRgb},0.8)`;
      ctx.fillRect(x0 + i * seg + (seg > 4 ? 1 : 0), y1, Math.max(1, seg - (seg > 4 ? 2 : 0)), bh);
    }
    label(ctx, `${m.name} × ${tasks}`, x0, y1 + bh + 16, palette.muted, 11);

    label(ctx, U.wall.lora, x0, y2 - 20, palette.mint, 12);
    label(ctx, size(lora), w - PAD, y2 - 20, palette.ink, 14, "right");
    ctx.fillStyle = palette.track; ctx.fillRect(x0, y2, bw, bh);
    const baseW = bw * (one / full), adW = Math.max(2, bw * ((tasks * ad) / full));
    ctx.fillStyle = `rgba(${palette.normalRgb},0.8)`; ctx.fillRect(x0, y2, Math.max(2, baseW), bh);
    ctx.fillStyle = palette.accent; ctx.fillRect(x0 + Math.max(2, baseW), y2, adW, bh);
    label(ctx, `${U.wall.base} ${size(one)}`, x0, y2 + bh + 16, palette.normal, 11);
    label(ctx, `${U.wall.adapters} ${tasks} × ${size(ad)} = ${size(tasks * ad)}`, x0, y2 + bh + 36, palette.accent, 11);

    label(ctx, `${(full / lora).toFixed(full / lora >= 9.95 ? 0 : 1)}${U.wall.ratio}`, w / 2, y2 + bh + 84, palette.ink, 16, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.wall.model}>
          <span>{U.wall.model}</span>
          {MODELS.map((md, i) => <button key={md.name} type="button" className={mi === i ? "on" : ""} onClick={() => setMi(i)}>{md.name}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{U.wall.tasks} <b>{tasks}</b></span>
          <input type="range" min={0} max={TASKS.length - 1} step={1} value={ti} onChange={(e) => setTi(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · A matrix moves points; fine-tuning nudges the matrix            */
/* ------------------------------------------------------------------ */

const W2: Mat = [[1.1, 0.35], [-0.25, 0.9]];
const DW2: Mat = [[0.498, 0.3], [0.332, 0.2]];          // u·vᵀ with u = (0.6, 0.4), v = (0.83, 0.5): pushes along one direction only
const SHAPE: [number, number][] = [[-1, -1], [1, -1], [1, -0.2], [0, -0.2], [0, 1], [-1, 1]];   // an "L", so orientation is visible

export function MatrixScene() {
  const [s, setS] = useState(0.6);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const S = Math.min(w - 2 * PAD, h - 130), cx = w / 2, cy = 16 + S / 2, sc = S / 2 / 2.3;
    const X = (p: number[]) => cx + p[0] * sc, Y = (p: number[]) => cy - p[1] * sc;
    const Wn = addScaled(W2, DW2, s);
    const poly = (pts: number[][], stroke: string, fill: string | null, lw: number, dash?: number[]) => {
      ctx.save();
      ctx.beginPath();
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(X(p), Y(p)) : ctx.lineTo(X(p), Y(p))));
      ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.strokeStyle = stroke; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash); ctx.stroke();
      ctx.restore();
    };
    line(ctx, cx - S / 2, cy, cx + S / 2, cy, palette.frame, 1); line(ctx, cx, cy - S / 2, cx, cy + S / 2, palette.frame, 1);
    poly(SHAPE, palette.dotOff, null, 1, [4, 4]);
    const a = SHAPE.map((p) => matVec(W2, p)), b = SHAPE.map((p) => matVec(Wn, p));
    poly(a, palette.normal, `rgba(${palette.normalRgb},0.12)`, 2);
    poly(b, palette.accent, `rgba(${palette.accentRgb},0.14)`, 2.5);
    a.forEach((p, i) => { if (s > 0.05) line(ctx, X(p), Y(p), X(b[i]), Y(b[i]), `rgba(${palette.accentRgb},0.6)`, 1); });
    line(ctx, PAD, 22, PAD + 16, 22, palette.normal, 2); label(ctx, U.matrix.before, PAD + 22, 22, palette.normal, 11);
    line(ctx, PAD, 40, PAD + 16, 40, palette.accent, 2.5); label(ctx, U.matrix.after, PAD + 22, 40, palette.accent, 11);

    const ty = 16 + S + 26, row = (m: Mat) => `[ ${m[0].map((v) => v.toFixed(2)).join("  ")} ;  ${m[1].map((v) => v.toFixed(2)).join("  ")} ]`;
    label(ctx, `${U.matrix.w}   ${row(W2)}`, PAD, ty, palette.normal, 12);
    label(ctx, `${U.matrix.dw}        ${row(DW2.map((r) => r.map((v) => v * s)))}`, PAD, ty + 24, palette.muted, 12);
    label(ctx, `${U.matrix.sum}    ${row(Wn)}`, PAD, ty + 48, palette.accent, 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.matrix.amount} <b>{s.toFixed(1)}</b></span>
          <input type="range" min={0} max={1.5} step={0.1} value={s} onChange={(e) => setS(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Stacking rank-one layers                                        */
/* ------------------------------------------------------------------ */

type TableKey = "times" | "pattern" | "noise";
const TABLE_KEYS: TableKey[] = ["times", "pattern", "noise"];

export function RankScene() {
  const [key, setKey] = useState<TableKey>("pattern");
  const [r, setR] = useState(1);
  const d = TABLE_SVD[key], T = TABLES[key];
  const approx = useMemo(() => truncate(d, r), [d, r]);
  const diff = useMemo(() => addScaled(T, approx, -1), [T, approx]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const gap = 16, cell = Math.min(18, (w - 2 * PAD - 2 * gap) / (3 * RN), (h - 230) / RN);
    const S = RN * cell, x0 = (w - 3 * S - 2 * gap) / 2, y0 = 46, sc = maxAbs(T);
    heat(ctx, T, x0, y0, cell, sc, U.rank.original);
    heat(ctx, approx, x0 + S + gap, y0, cell, sc, `${U.rank.sum} (${r})`, palette.accent);
    heat(ctx, diff, x0 + 2 * (S + gap), y0, cell, sc, U.rank.diff);

    const ty = y0 + S + 28, left = residual(d, r);
    label(ctx, `${U.rank.left} ${(left * 100).toFixed(left < 0.1 && left > 0 ? 1 : 0)}%`, PAD, ty, left < 0.05 ? palette.mint : palette.anomaly, 14);
    label(ctx, `${U.rank.numbers} ${r * 2 * RN} / ${RN * RN}`, w - PAD, ty, palette.ink, 12, "right");

    // how strong each layer is; the ones already stacked are filled
    const by = ty + 34, bh = Math.max(40, h - by - 30), bw = (w - 2 * PAD) / RN, top = d.S[0];
    label(ctx, U.rank.strength, PAD, by - 6, palette.muted, 11);
    d.S.forEach((sv, i) => {
      const hh = (sv / top) * (bh - 14);
      ctx.fillStyle = i < r ? palette.accent : palette.track2;
      ctx.fillRect(PAD + i * bw + 4, by + bh - hh, bw - 8, Math.max(1, hh));
      label(ctx, String(i + 1), PAD + (i + 0.5) * bw, by + bh + 12, i < r ? palette.accent : palette.muted, 10, "center");
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.rank.table}>
          <span>{U.rank.table}</span>
          {TABLE_KEYS.map((k) => <button key={k} type="button" className={key === k ? "on" : ""} onClick={() => setKey(k)}>{U.rank[k]}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{U.rank.layers} <b>{r}</b></span>
          <input type="range" min={0} max={RN} step={1} value={r} onChange={(e) => setR(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · The frozen path and the trainable side path                     */
/* ------------------------------------------------------------------ */

const DS = [768, 4096, 12288], RS = [1, 2, 4, 8, 16, 64];

export function LoraScene() {
  const [di, setDi] = useState(1);
  const [ri, setRi] = useState(3);
  const d = DS[di], r = RS[ri];
  const frozen = d * d, train = 2 * d * r;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const xin = PAD + 26, xout = w - PAD - 26, cx = w / 2, yMain = 78, ySide = 186, xPlus = xout - 44, xFork = xin + 34;
    // main path
    line(ctx, xin, yMain, xPlus - 13, yMain, palette.normal, 2);
    rbox(ctx, cx - 44, yMain - 30, 88, 60, 8, `rgba(${palette.normalRgb},0.12)`, palette.normal, 2);
    label(ctx, "W  ❄", cx, yMain - 6, palette.normal, 14, "center");
    label(ctx, `${d} × ${d}`, cx, yMain + 13, palette.normal, 10, "center");
    label(ctx, U.lora.main, xFork + 8, yMain - 14, palette.muted, 11);
    // side path: a flat A (r × d) then a thin B (d × r)
    const thick = 10 + 16 * (Math.log2(r) / 6);
    line(ctx, xFork, yMain, xFork, ySide, palette.accent, 2);
    line(ctx, xFork, ySide, cx - 84, ySide, palette.accent, 2);
    rbox(ctx, cx - 84, ySide - thick / 2, 74, thick, 4, `rgba(${palette.accentRgb},0.18)`, palette.accent, 2);
    label(ctx, `A  ${r} × ${d}`, cx - 47, ySide - thick / 2 - 12, palette.accent, 11, "center");
    arrow(ctx, cx - 10, ySide, cx + 22, ySide, palette.accent, 2);
    rbox(ctx, cx + 24, ySide - 37, thick, 74, 4, `rgba(${palette.accentRgb},0.18)`, palette.accent, 2);
    label(ctx, `B  ${d} × ${r}`, cx + 24 + thick + 8, ySide + 30, palette.accent, 11);
    line(ctx, cx + 24 + thick, ySide, xPlus, ySide, palette.accent, 2);
    arrow(ctx, xPlus, ySide, xPlus, yMain + 14, palette.accent, 2);
    label(ctx, U.lora.side, xFork + 8, ySide + 24, palette.muted, 11);
    // input, sum, output
    label(ctx, "x", xin - 12, yMain, palette.ink, 14, "center");
    ctx.save(); ctx.fillStyle = "#ffffff"; ctx.strokeStyle = palette.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(xPlus, yMain, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    label(ctx, "+", xPlus, yMain + 0.5, palette.ink, 15, "center");
    arrow(ctx, xPlus + 13, yMain, xout - 4, yMain, palette.ink, 2);
    label(ctx, "h", xout + 8, yMain, palette.ink, 14, "center");

    const by = ySide + 76, bw = w - 2 * PAD;
    label(ctx, `${U.lora.frozen}  ${frozen.toLocaleString("en-US")}`, PAD, by, palette.normal, 12);
    bar(ctx, PAD, by + 12, bw, 10, 1, `rgba(${palette.normalRgb},0.8)`);
    label(ctx, `${U.lora.train}  ${train.toLocaleString("en-US")}`, PAD, by + 44, palette.accent, 12);
    label(ctx, `${U.lora.ratio} ${((train / frozen) * 100).toFixed(2)}%`, w - PAD, by + 44, palette.ink, 12, "right");
    ctx.fillStyle = palette.track; ctx.fillRect(PAD, by + 56, bw, 10);
    ctx.fillStyle = palette.accent; ctx.fillRect(PAD, by + 56, Math.max(2, bw * (train / frozen)), 10);
    label(ctx, U.lora.zero, PAD, by + 96, palette.muted, 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.lora.d}>
          <span>{U.lora.d}</span>
          {DS.map((v, i) => <button key={v} type="button" className={di === i ? "on" : ""} onClick={() => setDi(i)}>{v}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.lora.r}>
          <span>{U.lora.r}</span>
          {RS.map((v, i) => <button key={v} type="button" className={ri === i ? "on" : ""} onClick={() => setRi(i)}>{v}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · Training a small LoRA: rank sets the floor, α/r sets the pace   */
/* ------------------------------------------------------------------ */

const TR = [1, 2, 4, 8], SCALES = [0.5, 1, 2, 4, 12];

export function TrainScene() {
  const [ri, setRi] = useState(1);
  const [si, setSi] = useState(1);
  const r = TR[ri], scale = SCALES[si];
  const run = useMemo(() => trainLora(r, scale), [r, scale]);
  const floor = bestError(r);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const cell = portrait ? Math.min(14, (w - 2 * PAD - 24) / (2 * TN)) : 12, mapS = TN * cell;
    const px0 = PAD + 34, px1 = portrait ? w - PAD : w - PAD - mapS - 26, py0 = 44, py1 = portrait ? h - mapS - 110 : h - 76;
    const X = (t: number) => px0 + (t / 240) * (px1 - px0), Y = (v: number) => py1 - (Math.min(v, 1.1) / 1.1) * (py1 - py0);
    label(ctx, U.train.loss, px0, py0 - 18, palette.muted, 11);
    for (const v of [0, 0.5, 1]) { line(ctx, px0, Y(v), px1, Y(v), palette.frame, 1); label(ctx, `${v * 100}%`, px0 - 6, Y(v), palette.muted, 10, "right"); }
    line(ctx, px0, Y(floor), px1, Y(floor), palette.mint, 1.5, [5, 4]);
    label(ctx, `${U.train.floor} ${(floor * 100).toFixed(floor < 0.01 ? 1 : 0)}%`, px1, Y(floor) - 10, palette.mint, 11, "right");
    ctx.save(); ctx.strokeStyle = run.diverged ? palette.anomaly : palette.accent; ctx.lineWidth = 2.5; ctx.beginPath();
    run.loss.forEach((v, t) => (t === 0 ? ctx.moveTo(X(t), Y(v)) : ctx.lineTo(X(t), Y(v))));
    ctx.stroke(); ctx.restore();
    if (run.diverged) {
      const te = run.loss.length - 1;
      ctx.save(); ctx.fillStyle = palette.anomaly; ctx.beginPath(); ctx.arc(X(te), Y(run.loss[te]), 5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      label(ctx, `${te}${U.train.stepUnit}`, X(te) + 10, Y(run.loss[te]) + 2, palette.anomaly, 11);
    }
    label(ctx, `${U.train.steps} 0`, px0, py1 + 14, palette.muted, 11);
    label(ctx, "240", px1, py1 + 14, palette.muted, 10, "right");

    const last = run.loss[run.loss.length - 1];
    const ty = portrait ? py1 + 38 : h - 34;
    label(ctx, run.diverged ? U.train.diverged : `${U.train.final} ${(last * 100).toFixed(last < 0.01 ? 1 : 0)}%`, PAD, ty, run.diverged ? palette.anomaly : palette.ink, 13);

    const sc = maxAbs(TARGET);
    if (portrait) {
      const mx = (w - 2 * mapS - 24) / 2, my = h - mapS - 26;
      heat(ctx, TARGET, mx, my, cell, sc, U.train.target);
      heat(ctx, run.diverged ? TARGET.map((row) => row.map(() => 0)) : run.delta, mx + mapS + 24, my, cell, sc, U.train.learned, palette.accent);
    } else {
      const mx = w - PAD - mapS, my = py0 + 4;
      heat(ctx, TARGET, mx, my, cell, sc, U.train.target);
      heat(ctx, run.diverged ? TARGET.map((row) => row.map(() => 0)) : run.delta, mx, my + mapS + 40, cell, sc, U.train.learned, palette.accent);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.train.r}>
          <span>{U.train.r}</span>
          {TR.map((v, i) => <button key={v} type="button" className={ri === i ? "on" : ""} onClick={() => setRi(i)}>{v}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.train.scale}>
          <span>{U.train.scale}</span>
          {SCALES.map((v, i) => <button key={v} type="button" className={si === i ? "on" : ""} onClick={() => setSi(i)}>{v}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · Merging adapters into the base matrix                           */
/* ------------------------------------------------------------------ */

const DELTAS = ADAPTERS.map((a) => matMul(a.B, a.A));

export function MergeScene() {
  const [w1, setW1] = useState(1);
  const [w2, setW2] = useState(0);
  const mc = useMemo(() => mergeCheck(w1, w2), [w1, w2]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const n = BASE_W.length, gap = 22, cell = Math.min(17, (w - 2 * PAD - 3 * gap) / (4 * n)), S = n * cell;
    const x0 = (w - 4 * S - 3 * gap) / 2, y0 = 60, sc = Math.max(maxAbs(BASE_W), maxAbs(mc.merged));
    const xs = [0, 1, 2, 3].map((i) => x0 + i * (S + gap));
    heat(ctx, BASE_W, xs[0], y0, cell, sc, U.merge.base, palette.normal);
    heat(ctx, DELTAS[0].map((row) => row.map((v) => v * w1)), xs[1], y0, cell, sc, `${w1.toFixed(1)} × ${U.merge.a1}`, palette.accent);
    heat(ctx, DELTAS[1].map((row) => row.map((v) => v * w2)), xs[2], y0, cell, sc, `${w2.toFixed(1)} × ${U.merge.a2}`, palette.accent2);
    heat(ctx, mc.merged, xs[3], y0, cell, sc, U.merge.merged, palette.ink);
    ["+", "+", "="].forEach((s, i) => label(ctx, s, xs[i] + S + gap / 2, y0 + S / 2, palette.muted, 15, "center"));

    const ty = y0 + S + 40, fs = w < 420 ? 12 : 13, fmtRow = (v: number[]) => v.map((q) => q.toFixed(2).padStart(6)).join("");
    label(ctx, `Wx + w₁B₁A₁x + w₂B₂A₂x`, PAD, ty, palette.muted, 12);
    label(ctx, fmtRow(mc.twoPath), PAD - 6, ty + 24, palette.ink, fs);
    label(ctx, `W'x`, PAD, ty + 60, palette.muted, 12);
    label(ctx, fmtRow(mc.onePath), PAD - 6, ty + 84, palette.ink, fs);
    label(ctx, U.merge.gap, PAD, ty + 124, palette.mint, 11);
    label(ctx, mc.gap.toFixed(3), PAD, ty + 150, palette.mint, 20);
    if (w1 === 0 && w2 === 0) label(ctx, U.merge.same, w - PAD, ty + 150, palette.normal, 13, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.merge.w1} <b>{w1.toFixed(1)}</b></span>
          <input type="range" min={0} max={1.5} step={0.1} value={w1} onChange={(e) => setW1(Number(e.target.value))} />
        </label>
        <label className="ad-ctl">
          <span>{U.merge.w2} <b>{w2.toFixed(1)}</b></span>
          <input type="range" min={0} max={1.5} step={0.1} value={w2} onChange={(e) => setW2(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · Which matrices get an adapter, and what it costs                */
/* ------------------------------------------------------------------ */

const KEYS: ModuleKey[] = ["q", "k", "v", "o", "mlp"];
const WR = [4, 8, 16, 64];

export function WhereScene() {
  const [on, setOn] = useState<Record<ModuleKey, boolean>>({ q: true, k: false, v: true, o: false, mlp: false });
  const [ri, setRi] = useState(1);
  const r = WR[ri];
  const total = LLM7.layers * KEYS.reduce((s, k) => s + (on[k] ? moduleParams(k, r) : 0), 0);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    // one Transformer block: four attention matrices and the feed-forward part
    const bw = Math.min(84, (w - 2 * PAD - 4 * 10) / 5), bh = 46, y0 = 66, x0 = (w - (5 * bw + 4 * 10)) / 2;
    rbox(ctx, x0 - 12, y0 - 30, 4 * bw + 3 * 10 + 18, bh + 46, 10, null, palette.frame, 1);
    label(ctx, "attention", x0 - 4, y0 - 16, palette.muted, 10);
    KEYS.forEach((k, i) => {
      const x = x0 + i * (bw + 10) + (k === "mlp" ? 6 : 0), active = on[k];
      rbox(ctx, x, y0, bw - (k === "mlp" ? 6 : 0), bh, 8, active ? `rgba(${palette.accentRgb},0.18)` : "#ffffff", active ? palette.accent : palette.dotOff, active ? 2.5 : 1.5);
      label(ctx, U.where.names[k], x + (bw - (k === "mlp" ? 6 : 0)) / 2, y0 + bh / 2 - (active ? 7 : 0), active ? palette.ink : palette.muted, 12, "center");
      if (active) label(ctx, `+ r = ${r}`, x + (bw - (k === "mlp" ? 6 : 0)) / 2, y0 + bh / 2 + 10, palette.accent, 10, "center");
    });
    label(ctx, `× ${LLM7.layers}`, w - PAD, y0 + bh + 30, palette.muted, 12, "right");

    const share = total / LLM7.params, ty = y0 + bh + 74;
    label(ctx, U.where.count, PAD, ty, palette.muted, 12);
    label(ctx, total.toLocaleString("en-US"), w - PAD, ty, palette.ink, 15, "right");
    label(ctx, U.where.share, PAD, ty + 34, palette.muted, 12);
    label(ctx, `${(share * 100).toFixed(share < 0.001 ? 3 : 2)}%`, w - PAD, ty + 34, palette.accent, 15, "right");
    ctx.fillStyle = palette.track; ctx.fillRect(PAD, ty + 50, w - 2 * PAD, 10);
    ctx.fillStyle = palette.accent; ctx.fillRect(PAD, ty + 50, Math.max(total > 0 ? 2 : 0, (w - 2 * PAD) * share), 10);
    label(ctx, "0%", PAD, ty + 72, palette.muted, 10); label(ctx, "100%", w - PAD, ty + 72, palette.muted, 10, "right");
    label(ctx, U.where.file, PAD, ty + 104, palette.muted, 12);
    label(ctx, size(gb(total * BYTES_FP16)), w - PAD, ty + 104, palette.ink, 15, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.where.modules}>
          <span>{U.where.modules}</span>
          {KEYS.map((k) => <button key={k} type="button" className={on[k] ? "on" : ""} aria-pressed={on[k]} onClick={() => setOn((s) => ({ ...s, [k]: !s[k] }))}>{U.where.names[k]}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.where.r}>
          <span>{U.where.r}</span>
          {WR.map((v, i) => <button key={v} type="button" className={ri === i ? "on" : ""} onClick={() => setRi(i)}>{v}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · Training memory against one GPU                                 */
/* ------------------------------------------------------------------ */

const MODES: { key: "full" | "lora" | "qlora"; color: string }[] = [
  { key: "full", color: palette.anomaly }, { key: "lora", color: palette.normal }, { key: "qlora", color: palette.mint },
];

export function QloraScene() {
  const [si, setSi] = useState(3);
  const sizeB = SIZES_B[si];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    // log axis: every tick is ten times the one before
    const x0 = PAD, x1 = w - PAD - 8, X = (g: number) => x0 + ((Math.log10(Math.max(g, 1)) - 0) / 3) * (x1 - x0);
    const y0 = 70, rh = Math.min(118, Math.max(96, (h - y0 - 50) / 3)), yb = y0 + 3 * rh - 8;
    const gpus: [number, string][] = [[24, U.qlora.gpu24], [48, U.qlora.gpu48]];
    for (const [g, name] of gpus) {
      line(ctx, X(g), y0 - 24, X(g), y0 - 12, palette.ink, 1.5);
      label(ctx, name, X(g) + (g === 24 ? -5 : 5), y0 - 30, palette.ink, 11, g === 24 ? "right" : "left");
    }
    MODES.forEach((md, i) => {
      const m = trainMemory(sizeB, md.key), total = m.weights + m.extra, y = y0 + i * rh;
      const fit = gpus.find(([g]) => total <= g);
      label(ctx, U.qlora[md.key], x0, y + 4, md.color, 12);
      label(ctx, `${total.toFixed(total < 100 ? 1 : 0)}GB`, x1, y + 4, palette.ink, 14, "right");
      ctx.fillStyle = palette.track; ctx.fillRect(x0, y + 18, x1 - x0, 22);
      ctx.fillStyle = md.color; ctx.fillRect(x0, y + 18, Math.max(3, X(total) - x0), 22);
      // the two GPU limits cross the bars only, so they never run through the text rows
      for (const [g] of gpus) line(ctx, X(g), y + 12, X(g), y + 46, palette.ink, 1.5, [4, 3]);
      label(ctx, `${U.qlora.weights} ${m.weights.toFixed(1)} + ${U.qlora.extra} ${m.extra.toFixed(1)}`, x0, y + 60, palette.muted, 11);
      if (fit) label(ctx, `✓ ${fit[1]} ${U.qlora.fits}`, x0, y + 78, palette.mint, 11);
    });
    for (const g of [1, 10, 100, 1000]) { line(ctx, X(g), yb, X(g), yb + 6, palette.frame, 1); label(ctx, `${g}GB`, X(g), yb + 18, palette.muted, 10, g === 1 ? "left" : g === 1000 ? "right" : "center"); }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.qlora.size}>
          <span>{U.qlora.size}</span>
          {SIZES_B.map((b, i) => <button key={b} type="button" className={si === i ? "on" : ""} onClick={() => setSi(i)}>{b * 10}{U.qlora.billion}</button>)}
        </div>
      </div>
    </div>
  );
}
