"use client";

import { useState } from "react";
import { clamp, drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, line, rbox, type Ctx } from "./kit";
import { cmpCopy } from "./cmp-copy";
import { CLASS_RGB, PAD, classColor, fix, isPortrait, num, pct, sgn, tint, valueGrid, vec } from "./cmp-kit";
import { FEAT_P, FEAT_S, FEAT_T, HARD, LOGIT_STEPS, P_A, T_MAX, Z_A, Z_B, featCheck, ratioAt, softmax, trainLogits } from "./cmp-math";

const U = cmpCopy.ui;
const NAMES = U.classes;
const GREEN = palette.mint, AMBER = palette.accent, BLUE = palette.normal;

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
const sup = (n: number) => String(n).split("").map((ch) => SUP[ch] ?? ch).join("");

/** A cat face in a few strokes. Droopy ears for photo A (a little dog-like), pointed ears for photo B. */
function drawCat(ctx: Ctx, x: number, y: number, s: number, droopy: boolean) {
  const cx = x + s / 2, cy = y + s * 0.56, r = s * 0.3;
  ctx.save();
  ctx.fillStyle = "#f4efe6"; ctx.strokeStyle = palette.ink; ctx.lineWidth = 1.6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    if (droopy) ctx.ellipse(cx + side * r * 0.92, cy + r * 0.12, r * 0.26, r * 0.66, -side * 0.18, 0, Math.PI * 2);
    else { ctx.moveTo(cx + side * r * 0.2, cy - r * 0.9); ctx.lineTo(cx + side * r * 0.85, cy - r * 1.5); ctx.lineTo(cx + side * r * 0.95, cy - r * 0.4); ctx.closePath(); }
    ctx.fill(); ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = palette.ink;
  for (const side of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + side * r * 0.38, cy - r * 0.12, r * 0.09, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath(); ctx.moveTo(cx - r * 0.12, cy + r * 0.16); ctx.lineTo(cx + r * 0.12, cy + r * 0.16); ctx.lineTo(cx, cy + r * 0.3); ctx.closePath(); ctx.fill();
  ctx.restore();
  for (const side of [-1, 1]) for (const dy of [0.22, 0.38]) line(ctx, cx + side * r * 0.25, cy + r * dy, cx + side * r * 0.95, cy + r * (dy + 0.06 * side * side), palette.muted, 1);
}

/* ------------------------------------------------------------------ */
/* 01 · The hard label and the teacher's three probabilities            */
/* ------------------------------------------------------------------ */

export function LabelScene() {
  const [photo, setPhoto] = useState(0);
  const [view, setView] = useState(0);
  const T = U.label;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const g = Math.max(0, (h - 440) / 4), small = w < 420;
    const z = photo === 0 ? Z_A : Z_B, p = softmax(z);
    const ps = small ? 84 : 96, px = PAD, py = 14;
    rbox(ctx, px, py, ps, ps, 10, "#ffffff", palette.frame, 1.2);
    drawCat(ctx, px, py + 4, ps, photo === 0);
    label(ctx, photo === 0 ? T.photoA : T.photoB, px + ps / 2, py + ps + 13, palette.muted, 11, "center");

    const tx = px + ps + 18;
    label(ctx, `${T.labelCol} = [1, 0, 0]`, tx, py + 18, GREEN, 13);
    label(ctx, T.same, tx, py + 38, palette.muted, 11);
    if (view >= 1) label(ctx, `${T.logitCol} = ${vec(z)}`, tx, py + 62, AMBER, 13);
    else label(ctx, T.say0, tx, py + 62, palette.muted, 11);
    if (view === 1) label(ctx, T.say1, tx, py + 82, palette.muted, 11);
    if (view === 2) label(ctx, T.hand, tx, py + 82, palette.muted, 11);

    // three rows: name, label cell, logit, probability bar
    const y0 = py + ps + 52 + g, rh = 44 + g / 2;
    const cLab = PAD + 62, cLog = cLab + 54, bx = cLog + 46, bw = Math.max(60, w - PAD - 58 - bx);
    label(ctx, T.labelCol, cLab + 17, y0 - 16, GREEN, 11, "center");
    if (view >= 1) label(ctx, T.logitCol, cLog + 12, y0 - 16, AMBER, 11, "center");
    if (view >= 2) label(ctx, T.probCol, bx, y0 - 16, AMBER, 11);
    NAMES.forEach((name, i) => {
      const y = y0 + i * rh;
      label(ctx, name, PAD, y + 15, palette.ink, 13);
      rbox(ctx, cLab, y + 1, 34, 28, 6, HARD[i] ? tint("15,157,106", 0.18) : "#ffffff", GREEN, 1.3);
      label(ctx, String(HARD[i]), cLab + 17, y + 15.5, palette.ink, 13, "center");
      if (view >= 1) label(ctx, num(z[i]), cLog + 12, y + 15.5, AMBER, 14, "center");
      if (view >= 2) {
        ctx.fillStyle = palette.track; ctx.fillRect(bx, y + 6, bw, 18);
        ctx.fillStyle = tint(palette.accentRgb, 0.75); ctx.fillRect(bx, y + 6, bw * p[i], 18);
        label(ctx, pct(p[i]), w - PAD, y + 15.5, palette.ink, 13, "right");
      }
    });

    const yb = y0 + 3 * rh + 8 + g / 2;
    if (view >= 2) {
      const terms = z.map((v) => `e${sup(v)} = ${fix(Math.exp(v), 2)}`), sum = z.reduce((s, v) => s + Math.exp(v), 0);
      if (small) {
        label(ctx, terms.join("  "), PAD, yb, palette.muted, 11);
        label(ctx, `${T.sumWord} ${fix(sum, 2)}`, PAD, yb + 18, palette.muted, 11);
      } else label(ctx, `${terms.join("   ")}   ${T.sumWord} ${fix(sum, 2)}`, PAD, yb, palette.muted, 12);
      label(ctx, `${T.ratio} = ${fix(p[1] / p[2], 1)}`, PAD, yb + (small ? 44 : 30), AMBER, 13);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.photo}>
          <span>{T.photo}</span>
          {T.photos.map((name, i) => <button key={name} type="button" className={photo === i ? "on" : ""} onClick={() => setPhoto(i)}>{name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.view}>
          <span>{T.view}</span>
          {T.views.map((name, i) => <button key={name} type="button" className={view === i ? "on" : ""} onClick={() => setView(i)}>{i + 1}. {name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · Temperature: divide the logits, then softmax                     */
/* ------------------------------------------------------------------ */

export function TempScene() {
  const [t2, setT2] = useState(2);
  const T = t2 / 2;
  const S = U.temp;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const small = w < 420, portrait = isPortrait(w, h), colors = classColor();
    const p = softmax(Z_A, T);
    label(ctx, `${S.probs} (T = ${num(T, 1)})`, PAD, 18, palette.ink, 12);

    const y0 = 44, rh = 28, cDiv = PAD + 54, bx = PAD + (small ? 160 : 176), bw = Math.max(60, w - PAD - 52 - bx);
    label(ctx, S.divided, cDiv, y0 - 12, palette.muted, 11);
    NAMES.forEach((name, i) => {
      const y = y0 + i * rh;
      label(ctx, name, PAD, y + 9, colors[i], 12);
      label(ctx, `${num(Z_A[i])} ÷ ${num(T, 1)} = ${fix(Z_A[i] / T, 2)}`, cDiv, y + 9, palette.muted, 11);
      ctx.fillStyle = palette.track; ctx.fillRect(bx, y + 1, bw, 16);
      ctx.fillStyle = tint(CLASS_RGB[i], 0.75); ctx.fillRect(bx, y + 1, bw * p[i], 16);
      label(ctx, pct(p[i]), w - PAD, y + 9.5, palette.ink, 12, "right");
    });

    // the two ratios: they move towards 1 but the logit difference inside them does not change
    const yr = y0 + 3 * rh + 10;
    const r1 = `${S.dogCar} = e^(3/${num(T, 1)}) = ${fix(ratioAt(Z_A, 1, 2, T), 2)}`, r2 = `${S.catDog} = e^(1/${num(T, 1)}) = ${fix(ratioAt(Z_A, 0, 1, T), 2)}`;
    if (portrait || small) { label(ctx, r1, PAD, yr, palette.ink, 11); label(ctx, r2, PAD, yr + 18, palette.ink, 11); }
    else { label(ctx, r1, PAD, yr, palette.ink, 12); label(ctx, r2, w / 2 + 10, yr, palette.ink, 12); }

    // probability against temperature
    const top = yr + (portrait || small ? 56 : 40), bot = h - 46, lx = PAD + 34, rx = w - PAD - 6;
    const X = (t: number) => lx + ((t - 1) / (T_MAX - 1)) * (rx - lx), Y = (v: number) => bot - v * (bot - top);
    label(ctx, S.curve, PAD, top - 14, palette.muted, 11);
    [0, 0.5, 1].forEach((v) => { line(ctx, lx, Y(v), rx, Y(v), palette.frame, 1, v === 0 ? undefined : [3, 4]); label(ctx, `${v * 100}%`, lx - 6, Y(v), palette.muted, 11, "right"); });
    [1, 2, 4, 6, 8, 10].forEach((t) => label(ctx, String(t), X(t), bot + 13, palette.muted, 11, "center"));
    label(ctx, S.axis, rx, bot + 28, palette.muted, 11, "right");
    for (let i = 0; i < 3; i++) {
      ctx.save(); ctx.strokeStyle = colors[i]; ctx.lineWidth = 2; ctx.beginPath();
      for (let t = 1; t <= T_MAX + 1e-9; t += 0.05) { const v = softmax(Z_A, t)[i]; if (t === 1) ctx.moveTo(X(t), Y(v)); else ctx.lineTo(X(t), Y(v)); }
      ctx.stroke(); ctx.restore();
      ctx.fillStyle = colors[i]; ctx.beginPath(); ctx.arc(X(T), Y(p[i]), 4, 0, Math.PI * 2); ctx.fill();
    }
    line(ctx, X(T), top - 4, X(T), bot, palette.ink, 1, [4, 4]);
    // legend in the upper right of the chart, away from the curves' left ends
    NAMES.forEach((name, i) => label(ctx, name, rx - (2 - i) * (small ? 50 : 58), top + 4, colors[i], 11, "right"));
    label(ctx, S.order, PAD, h - 12, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{S.t} <b>{num(T, 1)}</b></span>
          <input type="range" min={2} max={2 * T_MAX} step={1} value={t2} onChange={(e) => setT2(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · What each loss pushes, and where the student stops               */
/* ------------------------------------------------------------------ */

const MODES = ["hard", "soft", "mix"] as const;
const RUNS = MODES.map((m) => [1, 2].map((T) => trainLogits(m, T)));

export function LossScene() {
  const [mode, setMode] = useState(0);
  const [tIdx, setTIdx] = useState(0);
  const [step, setStep] = useState(0);
  const S = U.loss;
  const run = RUNS[mode][mode === 0 ? 0 : tIdx];
  const snap = run[step];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const g = Math.max(0, (h - 440) / 4), small = w < 420;
    label(ctx, `${S.step} ${step}`, PAD, 18, palette.ink, 12);
    label(ctx, `${S.loss} = ${fix(snap.loss, 3)}`, w - PAD, 18, palette.anomaly, 12, "right");

    const y0 = 50, rh = 46 + g / 2, tx = PAD + 56, pushW = small ? 70 : 86, tw = w - PAD - pushW - tx - 58;
    label(ctx, S.push, w - PAD, y0 - 14, palette.muted, 11, "right");
    NAMES.forEach((name, i) => {
      const y = y0 + i * rh, q = snap.q[i];
      label(ctx, name, PAD, y + 12, palette.ink, 13);
      ctx.fillStyle = palette.track; ctx.fillRect(tx, y + 4, tw, 16);
      ctx.fillStyle = tint(palette.normalRgb, 0.75); ctx.fillRect(tx, y + 4, tw * q, 16);
      label(ctx, pct(q), tx + tw + 8, y + 12.5, BLUE, 12);
      // where the label and the teacher stand on the same 0..100% track
      const lx = tx + tw * HARD[i], ax = tx + tw * P_A[i];
      line(ctx, lx, y - 1, lx, y + 25, GREEN, 2.5);
      line(ctx, ax, y - 1, ax, y + 25, AMBER, 2.5);
      // the push on this logit; the logit moves the opposite way
      const gr = snap.grad[i], ax2 = w - PAD - 8, len = clamp(Math.abs(gr) * 36, 3, 20);
      label(ctx, sgn(gr, 3), ax2 - 14, y + 12, Math.abs(gr) < 0.0005 ? palette.muted : palette.anomaly, 12, "right");
      if (Math.abs(gr) >= 0.0005) arrow(ctx, ax2, y + 12 + (gr < 0 ? len / 2 : -len / 2), ax2, y + 12 + (gr < 0 ? -len / 2 : len / 2), palette.anomaly, 1.6);
    });
    const yl = y0 + 3 * rh + 4;
    line(ctx, PAD, yl, PAD + 14, yl, GREEN, 2.5); label(ctx, S.label, PAD + 20, yl, palette.muted, 11);
    line(ctx, PAD + 76, yl, PAD + 90, yl, AMBER, 2.5); label(ctx, S.teacher, PAD + 96, yl, palette.muted, 11);
    ctx.fillStyle = tint(palette.normalRgb, 0.75); ctx.fillRect(PAD + (small ? 186 : 200), yl - 5, 14, 10);
    label(ctx, S.student, PAD + (small ? 206 : 220), yl, palette.muted, 11);

    // the student's dog share across all steps of this run
    const top = yl + 40 + g, bot = h - 30, lx = PAD + 34, rx = w - PAD - 6, vmax = 0.4;
    const X = (s: number) => lx + (s / LOGIT_STEPS) * (rx - lx), Y = (v: number) => bot - (v / vmax) * (bot - top);
    label(ctx, S.curve, PAD, top - 14, palette.muted, 11);
    line(ctx, lx, Y(0), rx, Y(0), GREEN, 1.5);
    line(ctx, lx, Y(P_A[1]), rx, Y(P_A[1]), AMBER, 1.5, [5, 4]);
    label(ctx, "0%", lx - 6, Y(0), palette.muted, 11, "right");
    label(ctx, pct(P_A[1]), lx - 6, Y(P_A[1]), AMBER, 11, "right");
    [0, 20, 40, 60, 80].forEach((s) => label(ctx, String(s), X(s), bot + 13, palette.muted, 11, "center"));
    ctx.save(); ctx.strokeStyle = BLUE; ctx.lineWidth = 2; ctx.beginPath();
    run.forEach((r, s) => { if (s === 0) ctx.moveTo(X(s), Y(r.q[1])); else ctx.lineTo(X(s), Y(r.q[1])); });
    ctx.stroke(); ctx.restore();
    ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(X(step), Y(snap.q[1]), 4.5, 0, Math.PI * 2); ctx.fill();
    label(ctx, pct(snap.q[1]), Math.min(X(step) + 8, rx - 40), Y(snap.q[1]) - 12, BLUE, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={S.target}>
          <span>{S.target}</span>
          {S.targets.map((name, i) => <button key={name} type="button" className={mode === i ? "on" : ""} onClick={() => setMode(i)}>{name}</button>)}
        </div>
        {mode !== 0 ? (
          <div className="ad-ctl ad-seg" role="group" aria-label={S.temp}>
            <span>{S.temp}</span>
            {S.temps.map((name, i) => <button key={name} type="button" className={tIdx === i ? "on" : ""} onClick={() => setTIdx(i)}>{name}</button>)}
          </div>
        ) : null}
        <label className="ad-ctl">
          <span>{S.step} <b>{step}</b></span>
          <input type="range" min={0} max={LOGIT_STEPS} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · Matching a middle vector through a small learned table           */
/* ------------------------------------------------------------------ */

export function FeatureScene() {
  const [step, setStep] = useState(0);
  const [dbl, setDbl] = useState(false);
  const S = U.feature;
  const c = featCheck(dbl && step === 2 ? 2 : 1);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const small = w < 420, g = Math.max(0, (h - 440) / 3);
    const cw = small ? 36 : 46, ch = small ? 30 : 34, gap = small ? 13 : 22, near = small ? 7 : 12;
    const total = 2 * cw + gap + cw + gap + cw + near + cw + near + cw;
    const x0 = (w - total) / 2, xP = x0, xS = xP + 2 * cw + gap, xPs = xS + cw + gap, xT = xPs + cw + near, xD = xT + cw + near;
    const y0 = 58 + g / 2, ys = y0 + ch;
    const BLUE_T = tint(palette.normalRgb, 0.1), AMB_T = tint(palette.accentRgb, 0.16);

    const col = (v: number[]) => v.map((x) => [x]);
    label(ctx, "s", xS + cw / 2, ys - 14, AMBER, 12, "center");
    valueGrid(ctx, col(c.s), xS, ys, cw, ch, { tone: AMBER, fill: () => AMB_T });
    label(ctx, "t", xT + cw / 2, y0 - 14, BLUE, 12, "center");
    valueGrid(ctx, col(FEAT_T), xT, y0, cw, ch, { tone: BLUE, fill: () => BLUE_T });
    if (step >= 1) {
      label(ctx, "P", xP + cw, y0 - 14, AMBER, 12, "center");
      valueGrid(ctx, FEAT_P, xP, y0, cw, ch, { tone: AMBER, fill: () => AMB_T });
      label(ctx, "×", xS - gap / 2, y0 + 2 * ch, palette.muted, 15, "center");
      label(ctx, "=", xPs - gap / 2, y0 + 2 * ch, palette.muted, 15, "center");
      label(ctx, "P·s", xPs + cw / 2, y0 - 14, AMBER, 12, "center");
      valueGrid(ctx, col(c.ps), xPs, y0, cw, ch, { tone: AMBER, fill: () => AMB_T });
    }
    if (step >= 2) {
      label(ctx, "P·s − t", xD + cw / 2, y0 - 14, palette.anomaly, 11, "center");
      valueGrid(ctx, col(c.diff), xD, y0, cw, ch, { tone: palette.anomaly, fill: (r) => tint(palette.anomalyRgb, Math.min(0.45, Math.abs(c.diff[r]) * 0.7)) });
    }

    // the legend for the short column names
    const yl = y0 + 4 * ch + 26 + g / 3;
    label(ctx, `t: ${S.t}`, PAD, yl, BLUE, 11);
    label(ctx, `s: ${S.s}`, PAD + (small ? 150 : 180), yl, AMBER, 11);
    if (step >= 1) label(ctx, `P: ${S.p}`, PAD, yl + 18, AMBER, 11);

    const yt = yl + 50 + g / 3;
    if (step === 0) {
      label(ctx, `t = ${vec(FEAT_T, 1)}`, PAD, yt, BLUE, 12);
      label(ctx, `s = ${vec(FEAT_S, 1)}`, PAD, yt + 22, AMBER, 12);
      label(ctx, S.noPair, PAD, yt + 48, palette.anomaly, 12);
    } else if (step === 1) {
      label(ctx, `P·s = ${vec(c.ps, 2)}`, PAD, yt, AMBER, 12);
      label(ctx, `t   = ${vec(FEAT_T, 2)}`, PAD, yt + 22, BLUE, 12);
      label(ctx, S.trained, PAD, yt + 48, AMBER, 11);
    } else {
      const sq = c.diff.map((d) => fix(d * d, 2)).join(" + ");
      label(ctx, `${S.l2} = ${sq} = ${fix(c.l2, 2)}`, PAD, yt, palette.anomaly, small ? 11 : 12);
      label(ctx, `${S.cos} = ${fix(c.cos, 3)}`, PAD, yt + 22, palette.ink, small ? 11 : 12);
      label(ctx, S.fixed, PAD, yt + 48, BLUE, 11);
      label(ctx, S.trained, PAD, yt + 66, AMBER, 11);
      label(ctx, S.noLabel, PAD, yt + 84, palette.muted, 11);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={S.step}>
          <span>{S.step}</span>
          {S.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        {step === 2 ? (
          <div className="ad-ctl ad-seg" role="group" aria-label={S.scale}>
            <span>{S.scale}</span>
            {S.scales.map((name, i) => <button key={name} type="button" className={(dbl ? 1 : 0) === i ? "on" : ""} onClick={() => setDbl(i === 1)}>{name}</button>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
