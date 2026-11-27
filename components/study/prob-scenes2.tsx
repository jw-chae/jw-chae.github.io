"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { bar, line, type Ctx } from "./kit";
import { probCopy } from "./prob-copy";
import { PAD, axis, fix, isPortrait, partColor, pc, swatch, tag } from "./prob-draw";
import {
  ALL_X, EAR_STEPS, LOOKS, MEAN_ALL, MODELS, MU_STEPS, N_STEPS, PARTS, PICKS, P_DARK, REPS, ROW8, ROW8_SWAP, SAMPLES, SD_ALL, SIG7, SWAP_AT, TRACK_X,
  crossEntropy, entropy, gaussPdf, kl, lik, logLik, lookAt, looked, meanOf, qOf, relHeight, sdMeasured, sdTheory, surprise, zOf, type Look, type ModelKey,
} from "./prob-math";

const U = probCopy.ui;
const NAMES = PARTS.map((p) => U.parts[p]);
const BLUE = palette.normal, AMBER = palette.accent, MINT = palette.mint;
const BAND = `rgba(${palette.normalRgb},0.12)`;
const HIST = "rgba(91,100,116,0.42)";

/** A vertical bar of a histogram, clipped at `cap` cells with the count written above when it is cut.
 *  `lift` raises the count label so that neighbouring labels do not run into each other. */
function histBar(ctx: Ctx, x: number, w: number, base: number, n: number, cap: number, H: number, lift = 0) {
  if (n <= 0) return;
  const hh = (Math.min(n, cap) / cap) * H;
  ctx.fillStyle = HIST; ctx.fillRect(x, base - hh, w, hh);
  if (n > cap) {
    ctx.save(); ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 1, base - hh + 10); ctx.lineTo(x + w + 1, base - hh + 4); ctx.stroke(); ctx.restore();
    label(ctx, `${n}`, x + w / 2, base - hh - 8 - lift, palette.muted, 11, "center");
  }
}
/** Lift for the i-th cut label when the previous cut bar is closer than `room` px. */
function lifts(counts: number[], cap: number, step: number, room = 26) {
  let last = -1e9, up = false;
  return counts.map((c, i) => {
    if (c <= cap) return 0;
    const x = i * step, near = x - last < room;
    up = near ? !up : false; last = x;
    return up ? 13 : 0;
  });
}

/* ------------------------------------------------------------------ */
/* 05 · expectation, spread, and the spread of a mean of n cells        */
/* ------------------------------------------------------------------ */

export function MeanScene() {
  const [n, setN] = useState(4);
  const [many, setMany] = useState(false);
  const T = U.expect;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const x0 = PAD + 6, x1 = w - PAD - 6, X = (v: number) => x0 + v * (x1 - x0);
    const yA = port ? 214 : 186, HA = port ? 140 : 116, yB = port ? 432 : 352, HB = port ? 150 : 104;
    label(ctx, T.hist, PAD, 20, palette.ink, 12);
    label(ctx, `${T.mean} ${fix(MEAN_ALL, 3)} · ${T.sd} ${fix(SD_ALL, 3)}`, w - PAD, 20, palette.ink, 12, "right");

    // ±σ band, then the histogram of all 256 cells in steps of 0.05
    const bandL = X(Math.max(0, MEAN_ALL - SD_ALL)), bandR = X(Math.min(1, MEAN_ALL + SD_ALL));
    ctx.fillStyle = BAND; ctx.fillRect(bandL, yA - HA - 6, bandR - bandL, HA + 6);
    const bins = new Array<number>(20).fill(0);
    ALL_X.forEach((x) => { bins[Math.min(19, Math.floor(x * 20 + 1e-9))]++; });
    const bw = (x1 - x0) / 20;
    const lift = lifts(bins, 30, bw);
    bins.forEach((c, i) => histBar(ctx, x0 + i * bw + 1, bw - 2, yA, c, 30, HA, lift[i]));
    axis(ctx, x0, x1, yA, 0, 1, 0.1, 1);
    line(ctx, X(MEAN_ALL), yA - HA - 10, X(MEAN_ALL), yA, palette.ink, 2);
    // the followed cell
    line(ctx, X(TRACK_X), yA - 46, X(TRACK_X), yA, AMBER, 2);
    tag(ctx, `${U.track} ${fix(TRACK_X)}`, X(TRACK_X), yA - 54, AMBER, 11);

    // the means of n cells
    const s = SAMPLES[n];
    label(ctx, `${T.means}, n = ${n}`, PAD, yB - HB - 14, palette.ink, 12);
    if (!many) {
      const picks = s.picks[0].map((i) => ALL_X[i]), seen = new Map<number, number>();
      picks.forEach((v) => {
        const k = seen.get(v) ?? 0; seen.set(v, k + 1);
        ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(X(v), yA - 6 - k * 9, 4, 0, Math.PI * 2); ctx.fill();
      });
      const m = s.means[0];
      ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(X(m), yB - 8, 6, 0, Math.PI * 2); ctx.fill();
      tag(ctx, `${T.mean} ${fix(m, 3)}`, X(m), yB - 26, AMBER, 12);
      label(ctx, `${picks.map((v) => fix(v)).join(", ")}`, PAD, yB - HB + 12, palette.muted, 11);
    } else {
      // 200 means stacked in steps of 0.01
      const r = port ? 2.1 : 2.2, stack = new Map<number, number>(), cap = Math.floor((HB - 10) / (2 * r));
      const over = new Map<number, number>();
      s.means.forEach((m) => {
        const b = Math.round(m * 100), k = stack.get(b) ?? 0; stack.set(b, k + 1);
        if (k < cap) { ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(X(b / 100), yB - r - 1 - k * 2 * r, r, 0, Math.PI * 2); ctx.fill(); }
        else over.set(b, k + 1);
      });
      let lastX = -1e9, up = false;
      [...over.entries()].sort((a, b) => a[0] - b[0]).forEach(([b, c]) => {
        const x = X(b / 100), near = x - lastX < 22;
        up = near ? !up : false; lastX = x;
        label(ctx, `${c}`, x, yB - r - cap * 2 * r - 8 - (up ? 13 : 0), palette.muted, 11, "center");
      });
    }
    axis(ctx, x0, x1, yB, 0, 1, 0.1, 1);
    line(ctx, X(MEAN_ALL), yB - HB, X(MEAN_ALL), yB, palette.ink, 1.5, [4, 3]);

    const ty = yB + 34;
    if (many) {
      label(ctx, `n = ${n} · ${REPS}${T.times} · ${T.measured} ${fix(sdMeasured(n), 3)}`, PAD, ty, AMBER, 12);
      label(ctx, `${T.theory} = ${fix(SD_ALL, 3)} ÷ √${n} = ${fix(sdTheory(n), 3)}`, PAD, ty + 22, palette.ink, 12);
    } else {
      label(ctx, `${T.theory} = ${fix(sdTheory(n), 3)}`, PAD, ty, palette.ink, 12);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.n}>
          <span>{T.n}</span>
          {N_STEPS.map((k) => <button key={k} type="button" className={n === k ? "on" : ""} onClick={() => setN(k)}>{k}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.reps}>
          <span>{T.reps}</span>
          <button type="button" className={!many ? "on" : ""} onClick={() => setMany(false)}>{T.one}</button>
          <button type="button" className={many ? "on" : ""} onClick={() => setMany(true)}>{T.many}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · the Gaussian on the body fur, and z                              */
/* ------------------------------------------------------------------ */

const G_LO = 0.2, G_HI = 1.0, G_BIN = 0.025;
const relText = (rel: number) => { const v = rel * 100; return `${v >= 10 ? v.toFixed(0) : v >= 0.1 ? v.toFixed(1) : v.toPrecision(1)}%`; };

export function GaussScene() {
  const [pick, setPick] = useState(0);
  const [look, setLook] = useState<Look>("same");
  const T = U.gauss;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const L = looked(look), v = lookAt(PICKS[pick], look), z = zOf(v, L.mu, L.sd);
    const x0 = PAD + 6, x1 = w - PAD - 6, X = (x: number) => x0 + ((x - G_LO) / (G_HI - G_LO)) * (x1 - x0);
    const yA = port ? 320 : 280, H = port ? 236 : 200, perCount = H / 10;
    label(ctx, T.hist, PAD, 20, palette.ink, 12);
    label(ctx, `μ = ${fix(L.mu, 3)} · σ = ${fix(L.sd, 3)}`, w - PAD, 20, BLUE, 12, "right");

    const nb = Math.round((G_HI - G_LO) / G_BIN), bins = new Array<number>(nb).fill(0);
    L.xs.forEach((x) => { const b = Math.floor((x - G_LO) / G_BIN + 1e-9); if (b >= 0 && b < nb) bins[b]++; });
    const bw = (x1 - x0) / nb;
    bins.forEach((c, i) => histBar(ctx, x0 + i * bw + 0.5, bw - 1, yA, c, 10, H));
    // the bell, in the same units as the bars: cells per bin
    ctx.save(); ctx.strokeStyle = BLUE; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 240; i++) {
      const x = G_LO + ((G_HI - G_LO) * i) / 240, y = yA - L.xs.length * G_BIN * gaussPdf(x, L.mu, L.sd) * perCount;
      if (i === 0) ctx.moveTo(X(x), y); else ctx.lineTo(X(x), y);
    }
    ctx.stroke(); ctx.restore();
    axis(ctx, x0, x1, yA, G_LO, G_HI, 0.1, 1);

    // the same positions read as z
    const yZ = yA + (port ? 44 : 40);
    line(ctx, x0, yZ + 0.5, x1, yZ + 0.5, palette.frame, 1);
    label(ctx, T.zAxis, x0 - 8, yZ + 1, BLUE, 11, "right");
    for (let k = -7; k <= 3; k++) {
      const xv = L.mu + k * L.sd;
      if (xv < G_LO || xv > G_HI) continue;
      line(ctx, X(xv), yZ - 4, X(xv), yZ + 4, BLUE, 1);
      label(ctx, k === 0 ? "0" : `${k}`.replace("-", "−"), X(xv), yZ + 14, BLUE, 11, "center");
    }

    // the chosen cell
    line(ctx, X(v), yA - H + 6, X(v), yZ, AMBER, 2);
    const rel = relHeight(z);
    const tx = X(v), right = tx < (x0 + x1) / 2;
    tag(ctx, `${T.picks[pick]} ${fix(v, 3)}`, tx + (right ? 6 : -6), yA - H + 14, AMBER, 12, right ? "left" : "right");
    tag(ctx, `z = ${fix(z, 2)}`, tx + (right ? 6 : -6), yA - H + 36, AMBER, 12, right ? "left" : "right");
    const iy = yZ + (port ? 46 : 40);
    label(ctx, `z = (${fix(v, 3)} − ${fix(L.mu, 3)}) ÷ ${fix(L.sd, 3)} = ${fix(z, 2)}`, PAD, iy, palette.ink, port ? 11 : 12);
    label(ctx, `${T.height}: ${T.peak} ${relText(rel)}`, PAD, iy + 22, palette.muted, port ? 11 : 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.pick}>
          <span>{T.pick}</span>
          {T.picks.map((name, i) => <button key={name} type="button" className={pick === i ? "on" : ""} onClick={() => setPick(i)}>{name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.look}>
          <span>{T.look}</span>
          {LOOKS.map((l) => <button key={l} type="button" className={look === l ? "on" : ""} onClick={() => setLook(l)}>{T.looks[l]}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · likelihood: the same formula read two ways                      */
/* ------------------------------------------------------------------ */

const M_LO = 0.6, M_HI = 1.0;
const sig3 = (v: number) => (v >= 100 ? v.toFixed(0) : v.toPrecision(3));

export function MleScene() {
  const [mi, setMi] = useState(MU_STEPS.indexOf(0.8));
  const [logView, setLogView] = useState(false);
  const [swap, setSwap] = useState(false);
  const T = U.mle;
  const mu = MU_STEPS[mi];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const xs = swap ? ROW8_SWAP : ROW8, mean = meanOf(xs);
    const yT = port ? 196 : 166, HT = port ? 132 : 104, yB = port ? 438 : 362, HB = port ? 150 : 100;
    const x0 = PAD + 6, x1 = w - PAD - 6;

    // top: μ fixed, height read at each x
    label(ctx, T.top, PAD, 20, palette.ink, port ? 11 : 12);
    const XT = (v: number) => x0 + ((v - 0.3) / 0.7) * (x1 - x0), peak = gaussPdf(0, 0, SIG7);
    ctx.save(); ctx.strokeStyle = BLUE; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i <= 200; i++) { const x = 0.3 + (0.7 * i) / 200, y = yT - (gaussPdf(x, mu, SIG7) / peak) * HT; if (i === 0) ctx.moveTo(XT(x), y); else ctx.lineTo(XT(x), y); }
    ctx.stroke(); ctx.restore();
    axis(ctx, x0, x1, yT, 0.3, 1.0, 0.1, 1);
    xs.forEach((x, i) => {
      const hgt = gaussPdf(x, mu, SIG7), y = yT - (hgt / peak) * HT, moved = swap && i === SWAP_AT;
      ctx.fillStyle = AMBER; ctx.fillRect(XT(x) - 2, y, 4, yT - y);
      ctx.fillStyle = moved ? palette.anomaly : palette.ink; ctx.beginPath(); ctx.arc(XT(x), yT, 4, 0, Math.PI * 2); ctx.fill();
      if (moved) tag(ctx, `${U.track} ${fix(x)}`, XT(x), yT - 30, palette.anomaly, 11);
    });
    label(ctx, `μ = ${fix(mu, 3)}`, XT(mu), yT - HT - 12, BLUE, 12, "center");
    const heights = xs.map((x) => gaussPdf(x, mu, SIG7));
    label(ctx, `${heights.map((v) => (v >= 0.01 ? v.toFixed(2) : v.toPrecision(2))).join(" × ")} = ${sig3(lik(xs, mu))}`, PAD, yT + 32, palette.muted, port ? 11 : 12);

    // bottom: data fixed, the likelihood read at each μ
    label(ctx, T.bottom, PAD, yB - HB - 36, palette.ink, port ? 11 : 12);
    const XB = (v: number) => x0 + ((v - M_LO) / (M_HI - M_LO)) * (x1 - x0);
    const f = (m: number) => (logView ? logLik(xs, m) : lik(xs, m));
    const vals = Array.from({ length: 201 }, (_, i) => f(M_LO + ((M_HI - M_LO) * i) / 200));
    const top = Math.max(...vals), bottom = logView ? Math.min(...vals) : 0, Y = (v: number) => yB - ((v - bottom) / (top - bottom || 1)) * HB;
    ctx.save(); ctx.strokeStyle = palette.ink; ctx.lineWidth = 2; ctx.beginPath();
    vals.forEach((v, i) => { const x = XB(M_LO + ((M_HI - M_LO) * i) / 200); if (i === 0) ctx.moveTo(x, Y(v)); else ctx.lineTo(x, Y(v)); });
    ctx.stroke(); ctx.restore();
    axis(ctx, x0, x1, yB, M_LO, M_HI, 0.05, 2);
    line(ctx, XB(mean), yB - HB - 6, XB(mean), yB, MINT, 1.5, [4, 3]);
    tag(ctx, `${T.peak} μ = ${fix(mean, 3)}`, XB(mean), yB - HB - 14, MINT, 12);
    ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(XB(mu), Y(f(mu)), 5, 0, Math.PI * 2); ctx.fill();

    const ty = yB + 34;
    label(ctx, `μ = ${fix(mu, 3)} · ${logView ? `${T.log} = ${fix(logLik(xs, mu), 2)}` : `${T.product} = ${sig3(lik(xs, mu))}`}`, PAD, ty, BLUE, 12);
    label(ctx, `${T.mean} = (${xs.map((v) => fix(v)).join(" + ")}) ÷ 5 = ${fix(mean, 3)}`, PAD, ty + 22, MINT, port ? 11 : 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{T.mu} <b>{fix(mu, 3)}</b></span>
          <input type="range" min={0} max={MU_STEPS.length - 1} step={1} value={mi} onChange={(e) => setMi(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.view}>
          <button type="button" className={!logView ? "on" : ""} onClick={() => setLogView(false)}>{T.product}</button>
          <button type="button" className={logView ? "on" : ""} onClick={() => setLogView(true)}>{T.log}</button>
        </div>
        <button type="button" className="ad-btn" onClick={() => setSwap((v) => !v)}>{swap ? T.restore : T.swap}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · surprise, entropy, cross-entropy, KL                            */
/* ------------------------------------------------------------------ */

/** Shares below 0.1% get two decimals, so 0.03% does not read as 0.0%. */
const small = (v: number) => (v > 0 && v < 0.001 ? `${(v * 100).toFixed(2)}%` : pc(v));

export function EntropyScene() {
  const [model, setModel] = useState<ModelKey>("hand");
  const [ei, setEi] = useState(EAR_STEPS.indexOf(0));
  const T = U.ent;
  const earScore = EAR_STEPS[ei];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const p = P_DARK, q = qOf(model, earScore);
    const ce = crossEntropy(p, q), H = entropy(p), d = kl(p, q);
    const nameW = port ? 74 : 86, sW = port ? 54 : 64, bw = w - 2 * PAD - nameW - sW - 50, top = 44, rowH = port ? 38 : 33;
    label(ctx, `${T.p}`, PAD + nameW, 20, MINT, 12);
    label(ctx, `${T.q}`, PAD + nameW + (port ? 80 : 100), 20, AMBER, 12);
    label(ctx, `${T.surprise} −log q`, w - PAD, 20, palette.muted, 11, "right");

    PARTS.forEach((part, i) => {
      const y = top + i * rowH + rowH / 2 - 4, ear = part === "ear";
      swatch(ctx, PAD, y, 11, partColor(i));
      label(ctx, NAMES[i], PAD + 16, y, ear ? AMBER : palette.ink, 12);
      bar(ctx, PAD + nameW, y - 10, bw, 8, p[i], MINT);
      bar(ctx, PAD + nameW, y + 1, bw, 8, q[i], AMBER);
      label(ctx, small(p[i]), PAD + nameW + bw + 6, y - 6, MINT, 11);
      label(ctx, small(q[i]), PAD + nameW + bw + 6, y + 6, AMBER, 11);
      const s = surprise(q[i]);
      label(ctx, Number.isFinite(s) ? s.toFixed(2) : "∞", w - PAD, y, ear ? AMBER : p[i] > 0 ? palette.ink : palette.muted, 12, "right");
    });
    const earY = top + 4 * rowH + rowH / 2 - 4;
    label(ctx, U.track, PAD + 16, earY + 13, AMBER, 11);

    const ly = top + 6 * rowH + 18;
    label(ctx, `${T.ce} = ${ce.toFixed(3)}`, PAD, ly, AMBER, 12);
    label(ctx, `${T.h} = ${H.toFixed(3)}`, PAD, ly + 22, MINT, 12);
    label(ctx, `${T.kl} = ${ce.toFixed(3)} − ${H.toFixed(3)} = ${d.toFixed(3)}`, PAD, ly + 44, d < 5e-4 ? MINT : palette.anomaly, 12);
    if (model !== "hand") label(ctx, T.avg, PAD, ly + 72, palette.muted, 11);

    // cross-entropy as the ear score moves, for the hand-set model
    const cy0 = ly + 66, cy1 = h - 26, cx0 = PAD + 6, cx1 = w - PAD - 6;
    if (model === "hand" && cy1 - cy0 > 50) {
      const vals = EAR_STEPS.map((e) => crossEntropy(p, qOf("hand", e))), lo = H - 0.05, hi = Math.max(...vals);
      const X = (e: number) => cx0 + ((e - EAR_STEPS[0]) / (EAR_STEPS[EAR_STEPS.length - 1] - EAR_STEPS[0])) * (cx1 - cx0);
      const Y = (v: number) => cy1 - ((v - lo) / (hi - lo)) * (cy1 - cy0 - 14);
      label(ctx, T.curve, PAD, cy0, palette.muted, 11);
      line(ctx, cx0, Y(H), cx1, Y(H), MINT, 1.2, [4, 3]);
      label(ctx, T.floor, cx1, Y(H) - 9, MINT, 11, "right");
      ctx.save(); ctx.strokeStyle = AMBER; ctx.lineWidth = 2; ctx.beginPath();
      EAR_STEPS.forEach((e, i) => { if (i === 0) ctx.moveTo(X(e), Y(vals[i])); else ctx.lineTo(X(e), Y(vals[i])); });
      ctx.stroke(); ctx.restore();
      ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(X(earScore), Y(ce), 5, 0, Math.PI * 2); ctx.fill();
      line(ctx, cx0, cy1 + 0.5, cx1, cy1 + 0.5, palette.frame, 1);
      [-2, -1, 0, 1, 2].forEach((e) => label(ctx, `${e}`.replace("-", "−"), X(e), cy1 + 12, palette.muted, 11, "center"));
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.model}>
          <span>{T.model}</span>
          {MODELS.map((m) => <button key={m} type="button" className={model === m ? "on" : ""} onClick={() => setModel(m)}>{T.models[m]}</button>)}
        </div>
        {model === "hand" ? (
          <label className="ad-ctl">
            <span>{T.earScore} <b>{fix(earScore, 1)}</b></span>
            <input type="range" min={0} max={EAR_STEPS.length - 1} step={1} value={ei} onChange={(e) => setEi(Number(e.target.value))} />
          </label>
        ) : null}
      </div>
    </div>
  );
}
