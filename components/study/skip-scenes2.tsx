"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, frame, line, rbox, type Ctx } from "./kit";
import { skipCopy } from "./skip-copy";
import {
  BLOBS, BLOB_SD, GUIDE, SCHEDULES, START, STEPS, branchError, controlWalk, meanGains, norm, smoothWalk, sub, tauFor, walk,
  type SchedKey, type Vec,
} from "./skip-math";

const U = skipCopy.ui;
const PAD = 18;
const isPortrait = (w: number, h: number) => h > w * 1.15;
const PICK = palette.accent;
const BAD = palette.anomaly;
const GREY = "rgba(91,100,116,0.6)";

/* ---- shared: a zoomed piece of the plane, with a small map of the whole plane in its corner ---- */

type View = { cx: number; cy: number; s: number };
type Rect = { x: number; y: number; w: number; h: number };
const toPx = (v: View, p: Vec): [number, number] => [v.cx + p[0] * v.s, v.cy - p[1] * v.s];
/** The part of the plane where the followed point walks. */
const ZOOM_C: Vec = [0.4, -0.08];
const zoomView = (r: Rect): View => {
  const s = Math.min(r.w / 1.25, r.h / 1.0);
  return { cx: r.x + r.w / 2 - ZOOM_C[0] * s, cy: r.y + r.h / 2 + ZOOM_C[1] * s, s };
};

function drawBlobs(ctx: Ctx, v: View, small = false) {
  BLOBS.forEach((m, i) => {
    const [x, y] = toPx(v, m), tone = i === 0 ? palette.normalRgb : palette.accentRgb;
    ctx.save();
    ctx.fillStyle = `rgba(${tone},0.12)`; ctx.strokeStyle = `rgba(${tone},0.55)`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, 2 * BLOB_SD * v.s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (small) label(ctx, i === 0 ? "A" : "B", x, y, i === 0 ? palette.normal : palette.accent, 10, "center");
  });
}

function drawPath(ctx: Ctx, v: View, xs: Vec[], color: string, lw: number) {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath();
  xs.forEach((p, i) => { const [x, y] = toPx(v, p); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke(); ctx.restore();
}

function dots(ctx: Ctx, v: View, xs: Vec[], fresh: boolean[], color: string) {
  fresh.forEach((f, k) => {
    const [x, y] = toPx(v, xs[k]);
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2);
    if (f) { ctx.fillStyle = color; ctx.fill(); } else { ctx.fillStyle = "#ffffff"; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.stroke(); }
    ctx.restore();
  });
}

function endMark(ctx: Ctx, v: View, p: Vec, color: string) {
  const [x, y] = toPx(v, p);
  ctx.save(); ctx.fillStyle = color; ctx.beginPath();
  ctx.moveTo(x, y - 7); ctx.lineTo(x + 7, y); ctx.lineTo(x, y + 7); ctx.lineTo(x - 7, y); ctx.closePath(); ctx.fill(); ctx.restore();
}

/** Clip to the zoom rectangle, draw the blobs and whatever `inside` draws, then the frame and a map of the whole plane. */
function plane(ctx: Ctx, r: Rect, inside: (v: View) => void, mapPath: Vec[]) {
  const v = zoomView(r);
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,0.7)"; ctx.fillRect(r.x, r.y, r.w, r.h);
  drawBlobs(ctx, v);
  inside(v);
  ctx.restore();
  frame(ctx, r.x, r.y, r.w, r.h, palette.frame, 1);
  // the blob labels, kept inside the frame
  BLOBS.forEach((m, i) => {
    const [x, y] = toPx(v, m), lx = Math.min(r.x + r.w - 12, Math.max(r.x + 12, x)), ly = Math.min(r.y + r.h - 12, Math.max(r.y + 12, y));
    const inside2 = x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h;
    if (inside2 || i === 1) label(ctx, i === 0 ? "A" : "B", lx, ly, i === 0 ? palette.normal : palette.accent, 14, "center");
  });
  // the whole plane in the corner, with the zoomed part outlined
  const mw = 66, mx = r.x + 6, my = r.y + 6, ms = mw / 2.8;
  const mv: View = { cx: mx + mw / 2, cy: my + mw / 2, s: ms };
  rbox(ctx, mx, my, mw, mw, 4, "#ffffff", palette.frame, 1);
  drawBlobs(ctx, mv, true);
  drawPath(ctx, mv, mapPath, palette.ink, 1);
  const [ax, ay] = toPx(mv, [ZOOM_C[0] - r.w / (2 * v.s), ZOOM_C[1] + r.h / (2 * v.s)]);
  frame(ctx, ax, ay, (r.w / v.s) * ms, (r.h / v.s) * ms, palette.ink, 1, [2, 2]);
}

const FULL = walk(START, SCHEDULES.all);
const CHANGE = FULL.us.map((u, k) => (k === 0 ? 0 : norm(sub(u, FULL.us[k - 1]))));
const endDev = (xs: Vec[]) => norm(sub(xs[STEPS], FULL.xs[STEPS]));

/* ------------------------------------------------------------------ */
/* 07 · Reuse the last answer on some steps                            */
/* ------------------------------------------------------------------ */

const KEYS: SchedKey[] = ["all", "two", "three", "early", "late"];

export function CacheScene() {
  const [key, setKey] = useState<SchedKey>("three");
  const T = U.cache;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), wk = walk(START, SCHEDULES[key]);
    const r: Rect = port ? { x: PAD, y: 14, w: w - 2 * PAD, h: 260 } : { x: PAD, y: 14, w: Math.min(320, w * 0.58), h: 250 };
    plane(ctx, r, (v) => {
      drawPath(ctx, v, FULL.xs, GREY, 1.6);
      drawPath(ctx, v, wk.xs, palette.ink, 2.2);
      dots(ctx, v, wk.xs, wk.fresh, palette.ink);
      endMark(ctx, v, FULL.xs[STEPS], GREY);
      endMark(ctx, v, wk.xs[STEPS], PICK);
      const [sx, sy] = toPx(v, START);
      label(ctx, T.start, sx + 10, sy - 10, palette.muted, 11);
    }, FULL.xs);

    // numbers: beside the plane on wide screens, under it on phones
    const tx = port ? PAD : r.x + r.w + 16, ty = port ? r.y + r.h + 20 : 34;
    label(ctx, `${T.calls} ${wk.calls} / ${STEPS}`, tx, ty, palette.ink, 13);
    label(ctx, `${T.dev} ${endDev(wk.xs).toFixed(3)}`, port ? w / 2 : tx, port ? ty : ty + 24, key === "all" ? palette.muted : BAD, 13);
    if (!port) {
      line(ctx, tx, ty + 56, tx + 22, ty + 56, GREY, 1.6);
      label(ctx, T.full, tx + 28, ty + 56, palette.muted, 11);
      line(ctx, tx, ty + 76, tx + 22, ty + 76, palette.ink, 2.2);
      label(ctx, T.path, tx + 28, ty + 76, palette.ink, 11);
      dots(ctx, { cx: tx + 6, cy: ty + 98, s: 1 }, [[0, 0]], [true], palette.ink);
      label(ctx, T.called, tx + 16, ty + 98, palette.muted, 11);
      dots(ctx, { cx: tx + 6, cy: ty + 116, s: 1 }, [[0, 0]], [false], palette.ink);
      label(ctx, T.reused, tx + 16, ty + 116, palette.muted, 11);
    }

    // per-step change of the answer, measured on the full walk
    const yB = port ? ty + 40 : r.y + r.h + 36, bh = Math.max(64, h - yB - 34), bw = (w - 2 * PAD) / STEPS, mx = Math.max(...CHANGE);
    label(ctx, T.change, PAD, yB - 12, palette.normal, 11);
    CHANGE.forEach((c, k) => {
      const hh = (c / mx) * bh, x0 = PAD + k * bw;
      ctx.fillStyle = wk.fresh[k] ? palette.normal : `rgba(${palette.normalRgb},0.22)`;
      ctx.fillRect(x0 + 2, yB + bh - hh, bw - 4, hh);
      if (wk.fresh[k]) { ctx.fillStyle = PICK; ctx.fillRect(x0 + 2, yB + bh + 3, bw - 4, 4); }
      if (k % 5 === 0) label(ctx, String(k), x0 + bw / 2, yB + bh + 16, palette.muted, 10, "center");
    });
    label(ctx, T.step, w - PAD, yB + bh + 16, palette.muted, 11, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.sched}>
          <span>{T.sched}</span>
          {KEYS.map((k) => <button key={k} type="button" className={key === k ? "on" : ""} onClick={() => setKey(k)}>{T[k]}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · PoSTCache: spread the next anchor's correction back, re-walk    */
/* ------------------------------------------------------------------ */

const SMOOTH: Record<3 | 4, ReturnType<typeof smoothWalk>> = { 3: smoothWalk(START, 3), 4: smoothWalk(START, 4) };

export function PostScene() {
  const [step, setStep] = useState(0);
  const [gap, setGap] = useState<3 | 4>(3);
  const T = U.post;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), sm = SMOOTH[gap], fw = sm.forward;
    const r: Rect = port ? { x: PAD, y: 14, w: w - 2 * PAD, h: 210 } : { x: PAD, y: 14, w: Math.min(260, w * 0.5), h: 190 };
    plane(ctx, r, (v) => {
      drawPath(ctx, v, FULL.xs, GREY, 1.6);
      drawPath(ctx, v, fw.xs, BAD, 1.8);
      endMark(ctx, v, FULL.xs[STEPS], GREY);
      endMark(ctx, v, fw.xs[STEPS], BAD);
      if (step >= 2) { drawPath(ctx, v, sm.xs, PICK, 2.4); endMark(ctx, v, sm.xs[STEPS], PICK); }
    }, FULL.xs);

    const tx = port ? PAD : r.x + r.w + 16, ty = port ? r.y + r.h + 18 : 34;
    const lines: [string, string][] = [
      [`${T.calls} ${fw.calls} / ${STEPS}`, palette.ink],
      [`${T.reuse} ${T.dev} ${endDev(fw.xs).toFixed(3)}`, BAD],
    ];
    if (step >= 2) lines.push([`${T.fixed} ${T.dev} ${endDev(sm.xs).toFixed(3)}`, PICK]);
    lines.forEach(([t, c], i) => label(ctx, t, tx, ty + i * (port ? 20 : 24), c, 12));

    // the horizontal component of the answer used at each step
    const yC = port ? ty + 3 * 20 + 18 : r.y + r.h + 34, ch = Math.max(90, h - yC - 30), cw = (w - 2 * PAD - 30) / (STEPS - 1);
    const series: [Vec[], string, number][] = [[FULL.us, GREY, 1.6], [fw.us, BAD, 1.8]];
    if (step >= 1) series.push([sm.us, PICK, 2.4]);
    const all = series.flatMap(([us]) => us.map((u) => u[0]));
    const lo = Math.min(...all) - 0.1, hi = Math.max(...all) + 0.1;
    const X = (k: number) => PAD + 30 + k * cw, Y = (val: number) => yC + ch - ((val - lo) / (hi - lo)) * ch;
    label(ctx, T.comp, PAD, yC - 12, palette.muted, 11);
    line(ctx, PAD + 30, yC + ch, w - PAD, yC + ch, palette.frame, 1);
    line(ctx, PAD + 30, Y(0), w - PAD, Y(0), palette.frame, 1, [3, 3]);
    label(ctx, "0", PAD + 24, Y(0), palette.muted, 10, "right");
    fw.fresh.forEach((f, k) => { if (f) line(ctx, X(k), yC, X(k), yC + ch, `rgba(${palette.accentRgb},0.25)`, 1); });
    series.forEach(([us, color, lw], si) => {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
      us.forEach((u, k) => {
        if (si === 1 && k > 0) { ctx.lineTo(X(k), Y(us[k - 1][0])); ctx.lineTo(X(k), Y(u[0])); }
        else if (k === 0) ctx.moveTo(X(k), Y(u[0]));
        else ctx.lineTo(X(k), Y(u[0]));
      });
      ctx.stroke(); ctx.restore();
    });
    fw.fresh.forEach((f, k) => { if (f) { ctx.fillStyle = PICK; ctx.beginPath(); ctx.arc(X(k), Y(fw.us[k][0]), 3.5, 0, Math.PI * 2); ctx.fill(); } });
    [0, 5, 10, 15, 19].forEach((k) => label(ctx, String(k), X(k), yC + ch + 14, palette.muted, 10, "center"));
    const lx = w - PAD, ly = yC - 12;
    label(ctx, T.truth, lx, ly, palette.muted, 11, "right");
    label(ctx, T.reuse, lx, ly + 15, BAD, 11, "right");
    if (step >= 1) label(ctx, T.fixed, lx, ly + 30, PICK, 11, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.step}>
          <span>{T.step}</span>
          {T.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.gap}>
          <span>{T.gap}</span>
          <button type="button" className={gap === 3 ? "on" : ""} onClick={() => setGap(3)}>{T.g3}</button>
          <button type="button" className={gap === 4 ? "on" : ""} onClick={() => setGap(4)}>{T.g4}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 · RA-CFGCache: branch errors, guided error, propagation, control  */
/* ------------------------------------------------------------------ */

const GUIDED = walk(START, SCHEDULES.all, GUIDE);
const ERRS = Array.from({ length: STEPS }, (_, k) => (k === 0 ? null : branchError(GUIDED.xs, k)));
const GAINS = meanGains(40);
const REFRESHES = 10;
const CONTROL = (["branch", "guided"] as const).map((crit) => {
  const w = controlWalk(START, crit, tauFor(START, crit, REFRESHES, GAINS), GAINS);
  return { crit, fresh: w.fresh, dev: norm(sub(w.xs[STEPS], GUIDED.xs[STEPS])) };
});
/** Errors are drawn after turning the plane so that "towards B" points right; the shapes are unchanged. */
const AB = sub(BLOBS[1], BLOBS[0]);
const ROT = -Math.atan2(AB[1], AB[0]);
const turn = (d: Vec): Vec => [d[0] * Math.cos(ROT) - d[1] * Math.sin(ROT), d[0] * Math.sin(ROT) + d[1] * Math.cos(ROT)];

export function CfgScene() {
  const [step, setStep] = useState(0);
  const [k, setK] = useState(7);
  const T = U.cfg;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), fs = w < 420 ? 11 : 12, s = GUIDE.s;
    label(ctx, `s = ${s}   p = u + s(c − u)   δp = (1 − s)δu + s·δc`, PAD, 18, palette.ink, w < 420 ? 11 : 12);

    if (step === 0) {
      const e = ERRS[k]!;
      const lw = port ? 0 : 120, x0 = PAD + lw + (w - 2 * PAD - lw) * 0.36, sc = ((w - 2 * PAD - lw) * 0.6) / 0.68;
      const at = (d: Vec, from: Vec = [0, 0]): [number, number, number, number] => {
        const a = turn(from), b = turn(d);
        return [x0 + a[0] * sc, -a[1] * sc, x0 + (a[0] + b[0]) * sc, -(a[1] + b[1]) * sc];
      };
      const rowY = (i: number) => (port ? 70 : 58) + i * (port ? 52 : 44);
      line(ctx, x0, rowY(0) - 18, x0, rowY(3) + 16, palette.frame, 1, [3, 3]);
      label(ctx, T.towardA, PAD + lw, rowY(0) - (port ? 34 : 24), palette.normal, 11);
      label(ctx, T.towardB, w - PAD, rowY(0) - (port ? 34 : 24), palette.accent, 11, "right");
      const draw = (i: number, name: string, d: Vec, color: string, lwid: number, from: Vec = [0, 0], dy = 0) => {
        const [ax, ay, bx, by] = at(d, from), y = rowY(i) + dy;
        if (dy) line(ctx, ax, y - dy + ay, ax, y + ay, color, 1);
        if (name) label(ctx, name, PAD, port ? y - 18 : y, color, fs);
        if (Math.hypot(bx - ax, by - ay) > 2) arrow(ctx, ax, y + ay, bx, y + by, color, lwid);
        else { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(bx, y + by, 2.5, 0, Math.PI * 2); ctx.fill(); }
      };
      const scU = e.du.map((v) => v * (1 - s)), scC = e.dc.map((v) => v * s);
      draw(0, "δu", e.du, "rgba(91,100,116,0.95)", 2);
      draw(1, "δc", e.dc, palette.normal, 2);
      draw(2, `(1 − s)δu + s·δc`, scU, "rgba(91,100,116,0.95)", 2);
      draw(2, "", scC, palette.normal, 2, scU, 7);
      draw(3, "δp", e.dp, BAD, 2.8);

      const ty = rowY(3) + 44, col2 = port ? PAD : w / 2;
      label(ctx, `${T.k} ${k}`, PAD, ty, palette.ink, 13);
      label(ctx, `${T.rho} = ${e.rho.toFixed(2)}`, port ? w / 2 : col2, ty, palette.ink, fs);
      label(ctx, `${T.du} ${norm(e.du).toFixed(3)}`, PAD, ty + 24, palette.muted, fs);
      label(ctx, `${T.dc} ${norm(e.dc).toFixed(3)}`, PAD, ty + 46, palette.normal, fs);
      label(ctx, `${T.mean} ${e.branch.toFixed(3)}`, port ? PAD : col2, port ? ty + 68 : ty + 24, palette.ink, fs);
      label(ctx, `${T.dp} ${e.guided.toFixed(3)}`, port ? PAD : col2, port ? ty + 90 : ty + 46, BAD, fs);
      return;
    }

    if (step === 1) {
      const yT = 48, ch = h - yT - 84, bw = (w - 2 * PAD) / (STEPS - 1), mx = Math.max(...ERRS.map((e) => (e ? Math.max(e.guided, e.branch) : 0)));
      const gmx = Math.max(...GAINS);
      line(ctx, PAD, yT + ch, w - PAD, yT + ch, palette.frame, 1);
      for (let j = 1; j < STEPS; j++) {
        const e = ERRS[j]!, x0 = PAD + (j - 1) * bw;
        const h1 = (e.branch / mx) * ch, h2 = (e.guided / mx) * ch;
        ctx.fillStyle = "rgba(91,100,116,0.45)"; ctx.fillRect(x0 + 2, yT + ch - h1, bw / 2 - 2, h1);
        ctx.fillStyle = `rgba(${palette.anomalyRgb},0.75)`; ctx.fillRect(x0 + bw / 2, yT + ch - h2, bw / 2 - 2, h2);
        if (j % 3 === 1 && j < 19) label(ctx, String(j), x0 + bw / 2, yT + ch + 14, palette.muted, 10, "center");
      }
      ctx.save(); ctx.strokeStyle = PICK; ctx.lineWidth = 2; ctx.beginPath();
      for (let j = 1; j < STEPS; j++) { const x = PAD + (j - 0.5) * bw, y = yT + ch - (GAINS[j] / gmx) * ch; if (j === 1) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke(); ctx.restore();
      label(ctx, T.k, w - PAD, yT + ch + 14, palette.muted, 11, "right");
      const ly = yT + ch + 36;
      rbox(ctx, PAD, ly - 6, 12, 12, 2, "rgba(91,100,116,0.45)", null);
      label(ctx, T.mean, PAD + 18, ly, palette.muted, 11);
      rbox(ctx, PAD, ly + 14, 12, 12, 2, `rgba(${palette.anomalyRgb},0.75)`, null);
      label(ctx, T.dp, PAD + 18, ly + 20, BAD, 11);
      line(ctx, PAD, ly + 40, PAD + 12, ly + 40, PICK, 2);
      label(ctx, `${T.gain} ${GAINS[1].toFixed(3)} … ${GAINS[STEPS - 1].toFixed(3)}`, PAD + 18, ly + 40, PICK, 11);
      return;
    }

    // step 2: where the same ten refreshes go under each rule
    const cw = (w - 2 * PAD) / STEPS, yR = 70;
    label(ctx, T.budget, PAD, 44, palette.muted, 11);
    CONTROL.forEach((c, r) => {
      const y = yR + r * 100;
      label(ctx, r === 0 ? T.byBranch : T.byGuided, PAD, y, r === 0 ? palette.ink : BAD, fs);
      label(ctx, `${T.dev} ${c.dev.toFixed(4)}`, w - PAD, y, r === 0 ? palette.ink : BAD, fs, "right");
      c.fresh.forEach((f, j) => {
        rbox(ctx, PAD + j * cw + 1, y + 14, cw - 2, 30, 3, f ? `rgba(${palette.accentRgb},0.75)` : "#ffffff", palette.frame, 1);
        if (j % 5 === 0) label(ctx, String(j), PAD + j * cw + cw / 2, y + 58, palette.muted, 10, "center");
      });
    });
    const yL = yR + 2 * 100;
    rbox(ctx, PAD, yL, 14, 14, 3, `rgba(${palette.accentRgb},0.75)`, palette.frame, 1);
    label(ctx, T.refresh, PAD + 22, yL + 7, palette.muted, 11);
    rbox(ctx, PAD, yL + 22, 14, 14, 3, "#ffffff", palette.frame, 1);
    label(ctx, T.reuse, PAD + 22, yL + 29, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.step}>
          <span>{T.step}</span>
          {T.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        {step === 0 ? (
          <label className="ad-ctl">
            <span>{T.k} <b>{k}</b></span>
            <input type="range" min={1} max={STEPS - 1} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} />
          </label>
        ) : null}
      </div>
    </div>
  );
}
