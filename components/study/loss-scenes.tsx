"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { frame, line, rbox } from "./kit";
import { lossCopy } from "./loss-copy";
import {
  BAD, GT, OUT, PAD, READ, cropPic, curve, dot, drawBox, drawPicture, fitLabel, isPortrait, num, pct, plot, ticks, zoomL,
} from "./loss-draw";
import {
  BAD_LABEL, BATCH_P, CAT_W, ETAS, GOOD_LABELS, GT_CAT, MSE_PEAK, STEPS_MAX, STEP_CASES, Z0, ZC_RANGE, bestWidth, gradOf,
  labelsWith, pushAt, softmax, stepFactor, widthRun, type Box, type RegKind,
} from "./loss-math";

const U = lossCopy.ui;

/** A row of buttons where exactly one is on. */
export function Seg({ name, items, value, onPick }: { name: string; items: string[]; value: number; onPick: (i: number) => void }) {
  return (
    <div className="ad-ctl ad-seg" role="group" aria-label={name}>
      <span>{name}</span>
      {items.map((it, i) => <button key={it} type="button" className={value === i ? "on" : ""} onClick={() => onPick(i)}>{it}</button>)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 01 · One number, one weight, one step                               */
/* ------------------------------------------------------------------ */

const CX = (GT_CAT[0] + GT_CAT[2]) / 2;
const W_AXIS: [number, number] = [0, 45];
const L_AXIS: [number, number] = [0, 1600];

export function StepScene() {
  const [ei, setEi] = useState(0);
  const [hi, setHi] = useState(0);
  const [t, setT] = useState(0);
  const T = U.step;
  const c = STEP_CASES[hi], eta = ETAS[ei], run = widthRun(c, eta), s = run[t];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const ps = port ? 150 : 176, L = port ? { px: (w - ps) / 2, py: 30, s: ps } : { px: PAD, py: 40, s: ps };
    drawPicture(ctx, L, { loading: U.loading });
    drawBox(ctx, L, GT_CAT, GT, { lw: 2, tag: T.answer, tagAt: "tl" });
    const wd = s.width, inPic = wd > 0 && wd < 160;
    if (wd > 0) {
      const b: Box = [Math.max(0, CX - wd / 2), GT_CAT[1], Math.min(160, CX + wd / 2), GT_CAT[3]];
      drawBox(ctx, L, b, OUT, { lw: 2.5, tag: `${T.pred} ${num(wd, 2)}`, tagAt: "bl" });
    }
    if (!inPic) label(ctx, T.out, L.px + L.s / 2, L.py + L.s + 12, BAD, 11, "center");

    // the loss as a function of w, with every step so far
    const px = port ? 52 : L.px + L.s + 54, py = port ? L.py + L.s + 44 : 46, pw = w - px - PAD - 4, ph = port ? 150 : 196;
    const P = plot(ctx, px, py, pw, ph, W_AXIS, L_AXIS);
    label(ctx, T.curve, px, py - 12, palette.ink, 11.5);
    ticks(ctx, P, [0, 15, 30, 45], [0, 441, 1600], (u) => num(u), (v) => num(v));
    label(ctx, T.w, px + pw, py + ph + 26, palette.muted, 11, "right");
    curve(ctx, P, (u) => (u * c.h - CAT_W) ** 2, palette.ink, 1.6);
    const clampX = (u: number) => Math.max(W_AXIS[0], Math.min(W_AXIS[1], u)), clampY = (v: number) => Math.min(L_AXIS[1], v);
    for (let k = 1; k <= t; k++) {
      const a = run[k - 1], b = run[k];
      line(ctx, P.X(clampX(a.w)), P.Y(clampY(a.loss)), P.X(clampX(b.w)), P.Y(clampY(b.loss)), `rgba(${palette.accentRgb},0.55)`, 1.2);
    }
    for (let k = 0; k <= t; k++) {
      const q = run[k], off = q.w < W_AXIS[0] || q.w > W_AXIS[1] || q.loss > L_AXIS[1];
      dot(ctx, P.X(clampX(q.w)), P.Y(clampY(q.loss)), k === t ? 6 : 3.5, off ? BAD : k === t ? OUT : `rgba(${palette.accentRgb},0.6)`);
    }
    if (s.w < W_AXIS[0] || s.w > W_AXIS[1] || s.loss > L_AXIS[1]) label(ctx, T.outPlot, P.X(clampX(s.w)) + (s.w > 30 ? -8 : 8), P.Y(clampY(s.loss)) + 14, BAD, 11, s.w > 30 ? "right" : "left");

    // readouts
    const ry = port ? py + ph + 44 : py + ph + 52, fs = port ? 12 : 12.5, col2 = port ? PAD + 168 : PAD + 250;
    label(ctx, `${T.t} ${t} · w = ${num(s.w, 3)}`, PAD, ry, palette.ink, fs);
    label(ctx, `${T.width} = ${num(s.width, 2)}`, col2, ry, OUT, fs);
    label(ctx, `${T.err} = ${num(s.err, 2)}`, PAD, ry + 24, palette.ink, fs);
    label(ctx, `${T.loss} = ${num(s.loss, 2)}`, col2, ry + 24, palette.ink, fs);
    label(ctx, `${T.slope} dL/dw = ${num(s.slope, 2)}`, PAD, ry + 48, READ, fs);
    const f = stepFactor(c.h, eta);
    fitLabel(ctx, `${T.factor} = ${num(f, 3)}`, PAD, ry + 76, w - 2 * PAD, Math.abs(f) > 1 ? BAD : palette.muted, 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <Seg name={T.eta} items={ETAS.map((e) => String(e))} value={ei} onPick={(i) => { setEi(i); }} />
        <Seg name={T.h} items={STEP_CASES.map((q) => `h = ${q.h}`)} value={hi} onPick={(i) => { setHi(i); }} />
        <label className="ad-ctl">
          <span>{T.t} <b>{t}</b></span>
          <input type="range" min={0} max={STEPS_MAX} step={1} value={t} onChange={(e) => setT(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · The name: three scores, −log p(answer)                         */
/* ------------------------------------------------------------------ */

export function NameScene() {
  const [zDog, setZDog] = useState(Z0[1]);
  const [plus, setPlus] = useState(false);
  const T = U.name;
  const z = [Z0[0], zDog, Z0[2]].map((v) => v + (plus ? 3 : 0)), p = softmax(z), loss = -Math.log(p[0]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const tw0 = port ? 62 : 80, th0 = port ? 108 : 140;
    label(ctx, T.crop, PAD, 18, palette.muted, 11);
    cropPic(ctx, GT_CAT, PAD, 30, tw0, th0, GT, U.loading);

    // −ln p over p in (0, 1]
    const px = PAD + tw0 + (port ? 40 : 52), py = 34, pw = w - px - PAD - 4, ph = 150;
    const P = plot(ctx, px, py, pw, ph, [0, 1], [0, 7]);
    label(ctx, T.curve, px + 6, py + 10, palette.ink, 11.5);
    ticks(ctx, P, [0, 0.5, 1], [0, 2.3, 4.6], (u) => num(u), (v) => num(v));
    curve(ctx, P, (u) => -Math.log(Math.max(u, 1e-4)), palette.ink, 1.6, 400);
    const cx = P.X(p[0]), cy = P.Y(Math.min(7, loss));
    line(ctx, cx, cy, cx, py + ph, `rgba(${palette.accentRgb},0.5)`, 1, [3, 3]);
    dot(ctx, cx, cy, 6, OUT);
    label(ctx, num(loss, 3), cx + (p[0] > 0.6 ? -9 : 9), cy - 12, OUT, 12, p[0] > 0.6 ? "right" : "left");

    // three rows: name, score, bar, share
    const ry = py + ph + 60, rh = port ? 30 : 32, nameW = port ? 54 : 64, scoreW = port ? 66 : 84;
    const bx = PAD + nameW + scoreW, bw = w - bx - PAD - (port ? 58 : 66);
    label(ctx, T.score, PAD + nameW, ry - 18, palette.muted, 11);
    label(ctx, T.prob, bx, ry - 18, palette.muted, 11);
    T.names.forEach((nm, i) => {
      const y = ry + i * rh;
      if (i === 0) rbox(ctx, PAD - 6, y - 13, w - 2 * PAD + 12, 26, 6, null, GT, 1.5);
      label(ctx, nm, PAD, y, i === 0 ? GT : palette.ink, 12.5);
      label(ctx, num(z[i], 2), PAD + nameW, y, palette.ink, 12.5);
      ctx.fillStyle = palette.track; ctx.fillRect(bx, y - 6, bw, 12);
      ctx.fillStyle = i === 0 ? OUT : `rgba(${palette.normalRgb},0.55)`; ctx.fillRect(bx, y - 6, bw * p[i], 12);
      label(ctx, pct(p[i], p[i] < 0.01 ? 2 : 1), bx + bw + 8, y, palette.ink, 12.5);
    });
    if (port) label(ctx, T.answer, w - PAD, ry - 18, GT, 11, "right");

    // the loss, then the batch of three
    const ly = ry + 3 * rh + 14;
    const pf = (v: number) => num(v, v < 0.01 ? 4 : 3);
    label(ctx, `${T.loss} = −ln ${pf(p[0])} = ${num(loss, 3)}`, PAD, ly, OUT, port ? 12.5 : 13);
    const bp = [p[0], BATCH_P[1], BATCH_P[2]], prod = bp[0] * bp[1] * bp[2], parts = bp.map((v) => -Math.log(v));
    label(ctx, `${T.batch}: ${pf(bp[0])} × ${num(bp[1])} × ${num(bp[2])} = ${pf(prod)}`, PAD, ly + 30, palette.muted, port ? 11.5 : 12);
    fitLabel(ctx, `−ln ${pf(prod)} = ${num(-Math.log(prod), 3)} = ${parts.map((v) => num(v, 3)).join(" + ")}`, PAD, ly + 52, w - 2 * PAD, palette.ink, port ? 11.5 : 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{T.dog} <b>{num(zDog, 1)}</b></span>
          <input type="range" min={-2} max={6} step={0.5} value={zDog} onChange={(e) => setZDog(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.plus}>
          <button type="button" className={plus ? "on" : ""} onClick={() => setPlus(!plus)}>{T.plus}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Squared error on probabilities versus cross-entropy             */
/* ------------------------------------------------------------------ */

export function PushScene() {
  const [zc, setZc] = useState(-3);
  const T = U.push;
  const r = pushAt(zc);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const px = port ? 44 : 52, pw = w - px - PAD - 4, ph = port ? 128 : 112;
    const y1 = port ? 54 : 50, y2 = y1 + ph + (port ? 52 : 50);
    const ZR = ZC_RANGE as [number, number];

    const top = plot(ctx, px, y1, pw, ph, ZR, [0, 8.5]);
    label(ctx, T.lossTitle, px, y1 - 14, palette.ink, 11.5);
    ticks(ctx, top, [], [0, 4, 8]);
    curve(ctx, top, (u) => pushAt(u).ce, OUT, 2);
    curve(ctx, top, (u) => pushAt(u).mse, READ, 2);

    const bot = plot(ctx, px, y2, pw, ph, ZR, [0, 1.05]);
    label(ctx, T.gradTitle, px, y2 - 14, palette.ink, 11.5);
    ticks(ctx, bot, [-6, -3, 0, 3, 6], [0, 0.5, 1]);
    curve(ctx, bot, (u) => Math.abs(pushAt(u).gCe), OUT, 2);
    curve(ctx, bot, (u) => Math.abs(pushAt(u).gMse), READ, 2);
    // the squared-error peak
    const pk = bot.X(MSE_PEAK.zc), pky = bot.Y(Math.abs(MSE_PEAK.g));
    const ly0 = bot.Y(0.97);
    line(ctx, pk, pky - 4, pk + 10, ly0 + 7, READ, 1);
    label(ctx, `${T.peak} ${num(MSE_PEAK.zc, 2)}`, pk + 12, ly0, READ, 11, "left");

    // where we are
    [top, bot].forEach((P) => line(ctx, P.X(zc), P.y, P.X(zc), P.y + P.h, palette.muted, 1, [4, 4]));
    dot(ctx, top.X(zc), top.Y(r.ce), 4.5, OUT);
    dot(ctx, top.X(zc), top.Y(r.mse), 4.5, READ);
    dot(ctx, bot.X(zc), bot.Y(Math.abs(r.gCe)), 4.5, OUT);
    dot(ctx, bot.X(zc), bot.Y(Math.abs(r.gMse)), 4.5, READ);

    // legend and probabilities
    const lx = port ? px : px + pw - 4;
    const al = port ? "left" : "right";
    label(ctx, `${T.probs} [${r.p.map((v) => pct(v, v < 0.01 ? 2 : 1)).join(", ")}]`, lx, port ? 18 : y1 + 12, palette.muted, 11.5, al);

    const ry = y2 + ph + (port ? 38 : 36), fs = port ? 12 : 12.5;
    label(ctx, `${T.ce} ${num(r.ce, 3)}`, PAD, ry, OUT, fs);
    label(ctx, `${T.grad} ${num(r.gCe, 4)}`, w - PAD, ry, OUT, fs, "right");
    label(ctx, `${T.se} ${num(r.mse, 3)}`, PAD, ry + 22, READ, fs);
    label(ctx, `${T.grad} ${num(r.gMse, 4)}`, w - PAD, ry + 22, READ, fs, "right");
    label(ctx, `${T.ratioTitle} ${num(r.gCe / r.gMse, 1)}${T.ratio}`, PAD, ry + 46, palette.ink, fs);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{T.zc} <b>{num(zc, 1)}</b></span>
          <input type="range" min={ZC_RANGE[0]} max={ZC_RANGE[1]} step={0.5} value={zc} onChange={(e) => setZc(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · Five labels for the width, one mistyped                         */
/* ------------------------------------------------------------------ */

const KINDS: RegKind[] = ["sq", "abs", "huber"];

export function RobustScene() {
  const [ki, setKi] = useState(0);
  const [bad, setBad] = useState(BAD_LABEL);
  const T = U.robust;
  const ys = labelsWith(bad), kind = KINDS[ki], est = bestWidth(kind, ys), gs = ys.map((y) => gradOf(kind, est - y));
  const others = KINDS.map((k) => bestWidth(k, ys));

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    // a zoomed view of the cat: the four close labels (green), the mistyped one (red, dashed), where training stops (amber)
    const zr = port ? [(w - 160) / 2, 22, 160, 170] : [PAD, 30, 170, 196];
    const { L, clip } = zoomL([-2, 24, 98, 146], zr[0], zr[1], zr[2], zr[3]);
    const boxAt = (wd: number): Box => [CX - wd / 2, GT_CAT[1], CX + wd / 2, GT_CAT[3]];
    ctx.save();
    ctx.beginPath(); ctx.rect(clip[0], clip[1], clip[2], clip[3]); ctx.clip();
    drawPicture(ctx, L, { loading: U.loading });
    drawBox(ctx, L, GT_CAT, GT, { lw: 2 });
    if (bad > 0) drawBox(ctx, L, boxAt(bad), BAD, { lw: 1.6, dash: [5, 3] });
    drawBox(ctx, L, boxAt(est), OUT, { lw: 2.6 });
    ctx.restore();
    frame(ctx, clip[0], clip[1], clip[2], clip[3], palette.frame, 1);
    label(ctx, `${T.stop} ${num(est, 2)}`, clip[0] + clip[2] / 2, clip[1] + clip[3] + 13, OUT, 12, "center");

    // gradient each label puts on the width, at the stopping point
    const gx = port ? PAD : clip[0] + clip[2] + 24, gy = port ? zr[1] + zr[3] + 58 : 54, gw = w - gx - PAD, rh = port ? 23 : 25;
    label(ctx, T.pull, gx, gy - 18, palette.ink, 11.5);
    const half = (gw - 40 - 48) / 2, zx = gx + 40 + half, gmax = Math.max(1e-9, ...gs.map(Math.abs));
    line(ctx, zx, gy - 8, zx, gy + 5 * rh - 10, palette.frame, 1);
    ys.forEach((y, i) => {
      const yy = gy + i * rh, g = gs[i], len = (Math.abs(g) / gmax) * half, col = i === 4 ? BAD : GT;
      label(ctx, num(y, 0), gx, yy, col, 12);
      if (len > 1.5) {
        ctx.fillStyle = i === 4 ? `rgba(${palette.anomalyRgb},0.55)` : "rgba(15,157,106,0.5)";
        ctx.fillRect(g > 0 ? zx : zx - len, yy - 6, len, 12);
      }
      label(ctx, num(g, 2), g >= 0 ? zx + len + 5 : zx - len - 5, yy, palette.ink, 11.5, g >= 0 ? "left" : "right");
    });
    fitLabel(ctx, T.sign, gx, gy + 5 * rh + 2, gw, palette.muted, 11);

    // the number line: the five labels and where training stops
    const ny = port ? 474 : 336, nx0 = PAD + 6, nx1 = w - PAD - 6, X = (v: number) => nx0 + (Math.max(0, Math.min(200, v)) / 200) * (nx1 - nx0);
    label(ctx, T.labels, nx0, ny - 76, palette.ink, 11.5);
    line(ctx, nx0, ny, nx1, ny, palette.ink, 1);
    [0, 50, 100, 150, 200].forEach((v) => { line(ctx, X(v), ny, X(v), ny + 4, palette.ink, 1); label(ctx, String(v), X(v), ny + 14, palette.muted, 11, "center"); });
    GOOD_LABELS.forEach((y, i) => dot(ctx, X(y), ny - 8 - i * 7, 3.8, GT));
    dot(ctx, X(bad), ny - 8, 5, BAD);
    const nm = [T.mean, T.median, T.huber];
    line(ctx, X(est), ny - 58, X(est), ny + 4, OUT, 2.5);
    const leftHalf = X(est) < (nx0 + nx1) / 2;
    label(ctx, `${nm[ki]} ${num(est, 2)}`, X(est) + (leftHalf ? 6 : -6), ny - 52, OUT, 12, leftHalf ? "left" : "right");
    const othersText = others.map((v, k) => (k === ki ? null : `${nm[k]} ${num(v, 2)}`)).filter(Boolean).join(" · ");
    label(ctx, othersText, nx1, ny + 34, palette.muted, 11, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <Seg name={T.kind} items={T.kinds} value={ki} onPick={setKi} />
        <label className="ad-ctl">
          <span>{T.bad} <b>{bad}</b></span>
          <input type="range" min={0} max={200} step={1} value={bad} onChange={(e) => setBad(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

