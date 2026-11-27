"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clamp, drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { diffCopy } from "./diff-copy";
import {
  BELL, DDPM, GUIDE_T, GUIDE_X, PHOTO_CELL, PHOTO_N, PHOTO_SEED, SIX, TOY, TRACK, TRAIN_EPS, TRAIN_T, TWO_BUMPS, TWO_CLASSES,
  drawSamples, guideAt, guidedStats, histogram, landing, meanNearest, mulberry, normal, normalPdf, pixelNoise,
  posterior, reverseTrace, sampleGuided, sampleReverse, smiley, spiral, stats, trainStep, type Mixture, type P2,
} from "./diff-math";
import { arrow, bar, frame, line, type Ctx } from "./kit";

const U = diffCopy.ui;
const PAD = 18;
const MINT_RGB = "15,157,106";
const isPortrait = (w: number, h: number) => h > w * 1.15;

const num = (v: number, digits = 2) => { const s = v.toFixed(digits); return (Number(s) === 0 ? (0).toFixed(digits) : s).replace("-", "−"); };
const vec = (p: P2) => `[${num(p[0])}, ${num(p[1])}]`;
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

/** Stroke y = f(x) across a plot box. */
function curve(ctx: Ctx, f: (x: number) => number, lo: number, hi: number, X: (x: number) => number, Y: (y: number) => number, color: string, lw = 2) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
  for (let i = 0; i <= 160; i++) {
    const x = lo + ((hi - lo) * i) / 160;
    if (i === 0) ctx.moveTo(X(x), Y(f(x))); else ctx.lineTo(X(x), Y(f(x)));
  }
  ctx.stroke();
  ctx.restore();
}

function dot(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

function ring(ctx: Ctx, x: number, y: number, r: number, color: string, lw = 2) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function diamond(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color; ctx.fillRect(-s, -s, 2 * s, 2 * s);
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.strokeRect(-s, -s, 2 * s, 2 * s);
  ctx.restore();
}

/** Arrow that stops `gap` px short of its target, so the head stays visible next to a dot drawn there. */
function arrowTo(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, lw: number, gap = 8) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  if (d < gap + 4) { line(ctx, x1, y1, x2, y2, color, lw); return; }
  arrow(ctx, x1, y1, x2 - ((x2 - x1) / d) * gap, y2 - ((y2 - y1) / d) * gap, color, lw);
}

/** A plot of the plane above a strip of text. Points outside the box are held at its edge. */
function plane(w: number, h: number, below: number, rx: number, ry: number) {
  const pw = w - 2 * PAD, room = h - 10 - below, sc = Math.min(pw / 2 / rx, room / 2 / ry);
  // on a tall canvas the width limits the scale: take only the height the plot needs and centre plot and text together
  const ph = Math.min(room, 2 * ry * sc + 12), top = 10 + (room - ph) / 2;
  const cx = w / 2, cy = top + ph / 2, mx = pw / 2 - 6, my = ph / 2 - 6;
  return {
    X: (p: P2) => cx + clamp(p[0] * sc, -mx, mx),
    Y: (p: P2) => cy - clamp(p[1] * sc, -my, my),
    bottom: top + ph,
  };
}

type Row = [text: string, color: string, tag?: string];

/** Text rows under a plot. A row given in two parts stays on one line when wide and breaks in two when narrow. */
function rows(portrait: boolean) {
  const list: Row[] = [];
  const add = (color: string, a: string, b?: string, tag?: string) => {
    if (b && portrait) { list.push([a, color, tag], [`   ${b}`, color]); } else list.push([b ? `${a} ${b}` : a, color, tag]);
  };
  const draw = (ctx: Ctx, w: number, y: number, gap = 19) => {
    list.forEach(([text, color, tag], i) => {
      label(ctx, text, PAD, y + i * gap, color, 12);
      if (tag) label(ctx, tag, w - PAD, y + i * gap, palette.mint, 11, "right");
    });
  };
  return { add, draw };
}

/** The six training pictures, numbered. */
function sixDots(ctx: Ctx, X: (p: P2) => number, Y: (p: P2) => number, r: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  SIX.mu.forEach((m, j) => {
    dot(ctx, X(m), Y(m), r, palette.normal);
    label(ctx, String(j + 1), X(m), Y(m) + 0.5, "#ffffff", 11, "center");
  });
  ctx.restore();
}

const SIX_MID: P2 = [SIX.mu.reduce((a, m) => a + m[0], 0) / SIX.mu.length, SIX.mu.reduce((a, m) => a + m[1], 0) / SIX.mu.length];

/** One short text per training picture, set on the outer side of its dot so it stays clear of the middle. */
function sixNotes(ctx: Ctx, X: (p: P2) => number, Y: (p: P2) => number, text: (j: number) => string | null, color: string, size = 12) {
  SIX.mu.forEach((m, j) => {
    const t = text(j);
    if (t === null) return;
    const dx = m[0] - SIX_MID[0], dy = m[1] - SIX_MID[1], d = Math.hypot(dx, dy);
    label(ctx, t, X(m) + (dx / d) * 26, Y(m) - (dy / d) * 22, color, size, "center");
  });
}

/* ------------------------------------------------------------------ */
/* 01 · A distribution, and samples drawn from it                       */
/* ------------------------------------------------------------------ */

const COUNTS = [10, 30, 100, 300, 1000, 3000];

export function SampleScene() {
  const [two, setTwo] = useState(true);
  const [ni, setNi] = useState(2);
  const [seed, setSeed] = useState(16);
  const d = two ? TWO_BUMPS : BELL, n = COUNTS[ni];
  const calc = useMemo(() => {
    const xs = drawSamples(d, n, seed);
    return { xs, hist: histogram(xs, -4, 4, 32), st: stats(xs) };
  }, [d, n, seed]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const x0 = PAD + 6, x1 = w - PAD - 6, yb = h - 122, yt = 44, top = two ? 1 : 0.56;
    const X = (x: number) => x0 + ((x + 4) / 8) * (x1 - x0), Y = (v: number) => yb - (Math.min(v, top) / top) * (yb - yt);
    const bw = (x1 - x0) / 32;
    calc.hist.forEach((v, i) => {
      ctx.fillStyle = `rgba(${palette.accentRgb},0.55)`;
      ctx.fillRect(x0 + i * bw + 1, Y(v), bw - 2, yb - Y(v));
    });
    curve(ctx, d.pdf, -4, 4, X, Y, palette.normal, 2.5);
    line(ctx, x0, yb, x1, yb, palette.frame, 1);
    // where the true mean sits: on the peak of the bell, in the valley between the two bumps
    line(ctx, X(d.mean), yt + 8, X(d.mean), yb, palette.ink, 1, [3, 3]);
    label(ctx, U.dist.mean, X(d.mean), yt - 2, palette.ink, 11, "center");
    if (n <= 300) for (const x of calc.xs) if (x > -4 && x < 4) line(ctx, X(x), yb + 3, X(x), yb + 11, `rgba(${palette.inkRgb},0.45)`, 1);
    for (const v of [-4, -2, 0, 2, 4]) label(ctx, String(v), X(v), yb + 22, palette.muted, 11, "center");
    label(ctx, U.dist.truth, x0, yt - 18, palette.normal, 11);
    label(ctx, `${U.dist.sample} ${n}`, x1, yt - 18, palette.accent, 11, "right");

    const ty = h - 74, mid = w / 2;
    label(ctx, `${U.dist.mean}`, x0, ty, palette.muted, 11);
    label(ctx, `${U.dist.sample} ${calc.st.mean.toFixed(2)}`, mid - 10, ty, palette.accent, 12, "right");
    label(ctx, `${U.dist.real} ${d.mean.toFixed(2)}`, mid + 10, ty, palette.normal, 12);
    label(ctx, `${U.dist.sd}`, x0, ty + 24, palette.muted, 11);
    label(ctx, `${U.dist.sample} ${calc.st.sd.toFixed(2)}`, mid - 10, ty + 24, palette.accent, 12, "right");
    label(ctx, `${U.dist.real} ${d.sd.toFixed(2)}`, mid + 10, ty + 24, palette.normal, 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.dist.shape}>
          <span>{U.dist.shape}</span>
          <button type="button" className={two ? "on" : ""} onClick={() => setTwo(true)}>{U.dist.two}</button>
          <button type="button" className={!two ? "on" : ""} onClick={() => setTwo(false)}>{U.dist.bell}</button>
        </div>
        <label className="ad-ctl">
          <span>{U.dist.n} <b>{n}</b></span>
          <input type="range" min={0} max={COUNTS.length - 1} step={1} value={ni} onChange={(e) => setNi(Number(e.target.value))} />
        </label>
        <button type="button" className="ad-btn" onClick={() => setSeed((s) => s + 1)}>{U.dist.again}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · From the observation back to the cause                          */
/* ------------------------------------------------------------------ */

export function BayesScene() {
  const [x, setX] = useState(0.5);
  const [sigma, setSigma] = useState(1);
  const [prior, setPrior] = useState(0.5);
  const p = useMemo(() => posterior(x, sigma, prior), [x, sigma, prior]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const x0 = PAD + 4, x1 = w - PAD - 4, yt = 40, yb = h - 150, lo = -3.6, hi = 3.6;
    const top = Math.max(prior, 1 - prior) * normalPdf(0, 0, sigma) * 1.12;
    const X = (v: number) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0), Y = (v: number) => yb - (v / top) * (yb - yt);
    const fa = (v: number) => prior * normalPdf(v, -1, sigma), fb = (v: number) => (1 - prior) * normalPdf(v, 1, sigma);

    curve(ctx, fa, lo, hi, X, Y, palette.normal, 2.5);
    curve(ctx, fb, lo, hi, X, Y, palette.accent, 2.5);
    line(ctx, x0, yb, x1, yb, palette.frame, 1);
    for (const v of [-3, -2, -1, 0, 1, 2, 3]) label(ctx, String(v), X(v), yb + 14, palette.muted, 11, "center");
    label(ctx, U.bayes.a, X(-1), yt - 14, palette.normal, 11, "center");
    label(ctx, U.bayes.b, X(1), yt - 14, palette.accent, 11, "center");

    line(ctx, X(x), yt, X(x), yb, palette.ink, 1.5, [4, 4]);
    dot(ctx, X(x), Y(fa(x)), 5, palette.normal);
    dot(ctx, X(x), Y(fb(x)), 5, palette.accent);
    label(ctx, `x = ${x.toFixed(1)}`, X(x) + (x > 2 ? -8 : 8), yt + 6, palette.ink, 12, x > 2 ? "right" : "left");
    diamond(ctx, X(p.mean), yb, 6, palette.mint);

    const by = yb + 44, bx = x0 + 64, bwid = x1 - bx - 50;
    label(ctx, U.bayes.post, x0, by - 16, palette.muted, 11);
    label(ctx, "P(A | x)", x0, by + 6, palette.normal, 11);
    bar(ctx, bx, by, bwid, 12, p.pA, palette.normal);
    label(ctx, `${(p.pA * 100).toFixed(0)}%`, x1, by + 6, palette.ink, 12, "right");
    label(ctx, "P(B | x)", x0, by + 30, palette.accent, 11);
    bar(ctx, bx, by + 24, bwid, 12, p.pB, palette.accent);
    label(ctx, `${(p.pB * 100).toFixed(0)}%`, x1, by + 30, palette.ink, 12, "right");
    label(ctx, `${U.bayes.answer}: ${p.pA.toFixed(2)} × (−1) + ${p.pB.toFixed(2)} × (+1) = ${p.mean.toFixed(2)}`, w / 2, by + 62, palette.mint, 12, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.bayes.x} <b>{x.toFixed(1)}</b></span>
          <input type="range" min={-3} max={3} step={0.1} value={x} onChange={(e) => setX(Number(e.target.value))} />
        </label>
        <label className="ad-ctl">
          <span>{U.bayes.sigma} <b>{sigma.toFixed(1)}</b></span>
          <input type="range" min={0.3} max={2} step={0.1} value={sigma} onChange={(e) => setSigma(Number(e.target.value))} />
        </label>
        <label className="ad-ctl">
          <span>{U.bayes.prior} <b>{(prior * 100).toFixed(0)}%</b></span>
          <input type="range" min={0.1} max={0.9} step={0.1} value={prior} onChange={(e) => setPrior(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · The forward process on a real photograph, and on one number of it */
/* ------------------------------------------------------------------ */

const IMG_N = PHOTO_N;
const IMG_SRC = ["/anomaly/hazelnut-good.webp", "/anomaly/leather-good.webp"];
const PIX_NOISE = pixelNoise(PHOTO_N, PHOTO_SEED);
const CELL = (PHOTO_CELL[0] * PHOTO_N + PHOTO_CELL[1]) * 3;      // the red value of the marked cell

export function NoiseImageScene() {
  const [t, setT] = useState(100);
  const [which, setWhich] = useState(0);
  const clean = useRef<(Float32Array | null)[]>([null, null]);
  const buf = useRef<{ key: string; canvas: HTMLCanvasElement | null; hist: number[] }>({ key: "", canvas: null, hist: [] });

  useEffect(() => {
    IMG_SRC.forEach((src, i) => {
      const img = new window.Image();
      img.src = src;
      img.onload = () => {
        const off = document.createElement("canvas");
        off.width = IMG_N; off.height = IMG_N;
        const c = off.getContext("2d");
        if (!c) return;
        c.drawImage(img, 0, 0, IMG_N, IMG_N);
        const d = c.getImageData(0, 0, IMG_N, IMG_N).data, a = new Float32Array(IMG_N * IMG_N * 3);
        for (let p = 0; p < IMG_N * IMG_N; p++) for (let ch = 0; ch < 3; ch++) a[p * 3 + ch] = d[p * 4 + ch] / 127.5 - 1;   // pixel values in [−1, 1]
        clean.current[i] = a;
      };
    });
  }, []);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const src = clean.current[which];
    const ab = DDPM.abar[t], sa = Math.sqrt(ab), sn = Math.sqrt(1 - ab);
    const portrait = isPortrait(w, h);
    const S = portrait ? Math.min(w - 2 * PAD, h * 0.38) : Math.min(h - 124, w * 0.46);
    const ix = portrait ? (w - S) / 2 : PAD, iy = portrait ? 34 : Math.max(30, (h - 64 - S) / 2);

    label(ctx, `t = ${t}`, ix, iy - 14, palette.ink, 12);
    if (!src) {
      ctx.fillStyle = palette.track; ctx.fillRect(ix, iy, S, S);
      label(ctx, U.forward.loading, ix + S / 2, iy + S / 2, palette.muted, 12, "center");
      return;
    }
    const key = `${which}:${t}`;
    if (buf.current.key !== key) {
      const off = buf.current.canvas ?? document.createElement("canvas");
      off.width = IMG_N; off.height = IMG_N;
      const c = off.getContext("2d");
      if (!c) return;
      const im = c.createImageData(IMG_N, IMG_N), vals: number[] = [];
      for (let p = 0; p < IMG_N * IMG_N; p++) {
        for (let ch = 0; ch < 3; ch++) {
          const v = sa * src[p * 3 + ch] + sn * PIX_NOISE[p * 3 + ch];      // x_t = √ᾱ·x0 + √(1−ᾱ)·ε
          vals.push(v);
          im.data[p * 4 + ch] = clamp((v + 1) * 127.5, 0, 255);
        }
        im.data[p * 4 + 3] = 255;
      }
      c.putImageData(im, 0, 0);
      buf.current = { key, canvas: off, hist: histogram(vals, -3, 3, 36) };
    }
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf.current.canvas!, ix, iy, S, S);
    ctx.restore();
    frame(ctx, ix, iy, S, S, palette.frame, 1);
    // the one cell the text follows
    const mx = ix + ((PHOTO_CELL[1] + 0.5) * S) / IMG_N, my = iy + ((PHOTO_CELL[0] + 0.5) * S) / IMG_N;
    ring(ctx, mx, my, 8, "#ffffff", 3.5);
    ring(ctx, mx, my, 8, palette.ink, 1.5);

    const rx = portrait ? PAD : ix + S + 24, rw = w - rx - PAD;
    let y = portrait ? iy + S + 30 : iy + 6;
    label(ctx, U.forward.signal, rx, y, palette.normal, 11);
    label(ctx, sa.toFixed(2), rx + rw, y, palette.ink, 12, "right");
    bar(ctx, rx, y + 10, rw, 10, sa, palette.normal);
    y += 40;
    label(ctx, U.forward.noise, rx, y, palette.anomaly, 11);
    label(ctx, sn.toFixed(2), rx + rw, y, palette.ink, 12, "right");
    bar(ctx, rx, y + 10, rw, 10, sn, palette.anomaly);
    y += 46;

    label(ctx, U.forward.pixels, rx, y, palette.muted, 11);
    const hy0 = y + 14, hy1 = portrait ? h - 76 : iy + S - 4, top = 0.75;
    const X = (v: number) => rx + ((v + 3) / 6) * rw, Y = (v: number) => hy1 - (Math.min(v, top) / top) * (hy1 - hy0);
    const bw = rw / 36;
    buf.current.hist.forEach((v, i) => {
      ctx.fillStyle = `rgba(${palette.accentRgb},0.6)`;
      ctx.fillRect(rx + i * bw + 0.5, Y(v), Math.max(1, bw - 1), hy1 - Y(v));
    });
    curve(ctx, (v) => normalPdf(v, 0, 1), -3, 3, X, Y, palette.normal, 2);
    line(ctx, rx, hy1, rx + rw, hy1, palette.frame, 1);

    // the marked cell, written out: the same two coefficients as the bars, applied to one number
    const v0 = src[CELL], e = PIX_NOISE[CELL], vt = sa * v0 + sn * e, par = (s: string, neg: boolean) => (neg ? `(${s})` : s);
    const ry = portrait ? h - 50 : h - 46;
    label(ctx, `${U.forward.cell}: ${U.forward.orig} ${num(v0)} · ${U.forward.drawn} ${num(e)}`, PAD, ry, palette.muted, 11);
    label(ctx, `${U.forward.now} = ${sa.toFixed(2)} × ${par(num(v0), v0 < 0)} + ${sn.toFixed(2)} × ${par(num(e), e < 0)} = ${num(vt)}`, PAD, ry + 22, palette.ink, portrait ? 11 : 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.forward.step} <b>{t}</b> / 1000</span>
          <input type="range" min={0} max={1000} step={10} value={t} onChange={(e) => setT(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.forward.image}>
          <span>{U.forward.image}</span>
          <button type="button" className={which === 0 ? "on" : ""} onClick={() => setWhich(0)}>{U.forward.hazelnut}</button>
          <button type="button" className={which === 1 ? "on" : ""} onClick={() => setWhich(1)}>{U.forward.leather}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · One training problem, one quantity per step                     */
/* ------------------------------------------------------------------ */

export function DenoiseScene() {
  const [step, setStep] = useState(0);
  const [t, setT] = useState(TRAIN_T);
  const [seed, setSeed] = useState(0);              // 0 = the noise quoted in the text
  const s = useMemo(() => {
    let eps: P2 = TRAIN_EPS;
    if (seed > 0) { const r = mulberry(seed * 31 + 7); eps = [normal(r), normal(r)]; }
    return { eps, ...trainStep(SIX, TOY, TRACK, eps, t) };
  }, [t, seed]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const { X, Y, bottom } = plane(w, h, portrait ? 150 : 104, 1.25, 1);
    const D = U.denoise, me = SIX.mu[TRACK];
    const tailGuess: P2 = [s.ra * s.x0Hat[0], s.ra * s.x0Hat[1]];
    const known = step <= 1 || step === 4;          // what only the maker of the problem can see

    // 6 · every picture that could have produced this point, and the noise it would have taken
    if (step === 5) SIX.mu.forEach((m, j) => {
      if (s.w[j] < 0.005) return;
      const from: P2 = [s.ra * m[0], s.ra * m[1]];
      arrowTo(ctx, X(from), Y(from), X(s.xt), Y(s.xt), `rgba(${palette.normalRgb},${0.25 + 0.7 * s.w[j]})`, 1 + 4 * s.w[j]);
    });
    sixDots(ctx, X, Y, 8, step === 2 ? 0.3 : 1);
    if (step === 5) sixNotes(ctx, X, Y, (j) => (s.w[j] >= 0.005 ? pct(s.w[j]) : null), palette.normal);

    if (known) {
      ring(ctx, X(me), Y(me), 13, palette.ink);
      label(ctx, D.clean, X(me) + 18, Y(me) - 14, palette.ink, 11);
    }
    // 2, 5 · the noise that was really mixed in: from the shrunk original to the noisy point
    if (step === 1 || step === 4) {
      line(ctx, X(me), Y(me), X(s.shrunk), Y(s.shrunk), palette.dotOff, 1, [3, 3]);
      arrowTo(ctx, X(s.shrunk), Y(s.shrunk), X(s.xt), Y(s.xt), palette.mint, 2.5);
    }
    // 4 onward · the answer: guessed noise, and the original it implies
    if (step >= 3) {
      line(ctx, X(s.x0Hat), Y(s.x0Hat), X(tailGuess), Y(tailGuess), palette.dotOff, 1, [3, 3]);
      arrowTo(ctx, X(tailGuess), Y(tailGuess), X(s.xt), Y(s.xt), palette.accent, 2.5);
      if (step === 4) {
        // the error: the gap between where the two arrows start, drawn to one side so the ring and the diamond do not cover it
        const ax = X(s.shrunk), ay = Y(s.shrunk), bx = X(tailGuess), by = Y(tailGuess), d = Math.hypot(bx - ax, by - ay);
        if (d > 1) {
          const nx = -(by - ay) / d, ny = (bx - ax) / d, side = (X(s.xt) - ax) * nx + (Y(s.xt) - ay) * ny > 0 ? -16 : 16;
          line(ctx, ax + nx * side, ay + ny * side, bx + nx * side, by + ny * side, palette.anomaly, 3.5);
        }
      }
      diamond(ctx, X(s.x0Hat), Y(s.x0Hat), 6, palette.accent);
      label(ctx, D.guess, X(s.x0Hat) - 12, Y(s.x0Hat) + 13, palette.accent, 11, "right");
    }
    if (step >= 1) {
      dot(ctx, X(s.xt), Y(s.xt), 6, palette.ink);
      label(ctx, D.noisy, X(s.xt), Y(s.xt) + 17, palette.ink, 11, "center");
    }

    const R = rows(portrait);
    if (step === 0) {
      R.add(palette.ink, `${D.clean}: 3번 ${vec(me)}`);
      R.add(palette.muted, `t = ${t} / 40`, `${D.shareOrig} ${num(s.ra)} · ${D.shareNoise} ${num(s.rn)}`);
      R.add(palette.muted, D.notYet);
    } else if (step === 1) {
      R.add(palette.mint, `${D.drawn} ${vec(s.eps)}`);
      R.add(palette.ink, `${D.noisy} = ${num(s.ra)} × ${D.clean} + ${num(s.rn)} × ${D.noise}`, `= ${vec(s.xt)}`);
      R.add(palette.muted, D.makerKnows);
    } else if (step === 2) {
      R.add(palette.ink, `${D.given}: ${D.noisy} ${vec(s.xt)}, t = ${t}`);
      R.add(palette.muted, D.notGiven);
    } else if (step === 3) {
      R.add(palette.accent, `${D.out}: ${D.guessNoise} ${vec(s.epsHat)}`);
      R.add(palette.accent, `${D.guess} = (${D.noisy} − ${num(s.rn)} × ${D.ans}) ÷ ${num(s.ra)}`, `= ${vec(s.x0Hat)}`);
    } else if (step === 4) {
      R.add(palette.mint, `${D.answer}: ${D.drawn} ${vec(s.eps)}`);
      R.add(palette.accent, `${D.out}: ${D.guessNoise} ${vec(s.epsHat)}`);
      R.add(palette.anomaly, `${D.loss} = ${num(Math.abs(s.epsHat[0] - s.eps[0]))}² + ${num(Math.abs(s.epsHat[1] - s.eps[1]))}² = ${num(s.loss)}`);
      R.add(palette.anomaly, D.fixes);
    } else {
      R.add(palette.normal, D.cand1);
      R.add(palette.normal, D.cand2);
      R.add(palette.accent, D.cand3);
    }
    R.draw(ctx, w, bottom + 20);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.denoise.step}>
          <span>{U.denoise.step}</span>
          {U.denoise.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{U.denoise.t} <b>{t}</b> / 40</span>
          <input type="range" min={1} max={40} step={1} value={t} onChange={(e) => setT(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group">
          <button type="button" className="ad-btn" onClick={() => setSeed((v) => v + 1)}>{U.denoise.again}</button>
          {seed > 0 ? <button type="button" className="ad-btn" onClick={() => setSeed(0)}>{U.denoise.first}</button> : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · Walking back: one point with every number shown, then a crowd   */
/* ------------------------------------------------------------------ */

const SHAPES: Mixture[] = [SIX, { mu: spiral(), s: 0.035 }, { mu: smiley(), s: 0.035 }];
const REV_SEED = 352;

export function ReverseScene() {
  const [many, setMany] = useState(false);
  const [shape, setShape] = useState(0);
  const [seed, setSeed] = useState(REV_SEED);
  const [k, setK] = useState<number | null>(0);     // reverse steps taken; null = playing
  const kRef = useRef(0);
  const mix = SHAPES[shape];
  const trace = useMemo(() => reverseTrace(SIX, TOY, seed), [seed]);
  const frames = useMemo(() => sampleReverse(mix, TOY, 240, seed), [mix, seed]);
  const dists = useMemo(() => frames.map((f) => meanNearest(f, mix)), [frames, mix]);
  const counts = useMemo(() => landing(frames[TOY.T], SIX), [frames]);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), M = U.sample;
    const kk = k ?? Math.min(40, Math.floor(tt * 8) % 62);
    kRef.current = kk;

    if (!many) {
      const { X, Y, bottom } = plane(w, h, portrait ? 172 : 104, 1.6, 1.45);
      const st = kk < 40 ? trace[kk] : null, cur = st ? st.x : trace[39].next;
      label(ctx, M.noAnswer, PAD, 20, palette.muted, 11);
      // where the point has been
      ctx.save();
      ctx.strokeStyle = `rgba(${palette.inkRgb},0.16)`; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i <= Math.min(kk, 39); i++) { const q = trace[i].x; if (i === 0) ctx.moveTo(X(q), Y(q)); else ctx.lineTo(X(q), Y(q)); }
      if (kk === 40) ctx.lineTo(X(cur), Y(cur));
      ctx.stroke();
      ctx.restore();
      sixDots(ctx, X, Y, 8);
      const R = rows(portrait);
      if (st) {
        sixNotes(ctx, X, Y, (j) => pct(st.w[j]), palette.normal);
        line(ctx, X(cur), Y(cur), X(st.x0), Y(st.x0), `rgba(${palette.accentRgb},0.5)`, 1, [3, 3]);
        diamond(ctx, X(st.x0), Y(st.x0), 6, palette.accent);
        arrow(ctx, X(cur), Y(cur), X(st.mean), Y(st.mean), palette.accent, 2.5);
        if (st.sigma > 0) arrowTo(ctx, X(st.mean), Y(st.mean), X(st.next), Y(st.next), palette.muted, 1.5, 6);
        ring(ctx, X(st.next), Y(st.next), 5, palette.ink, 1.5);
        R.add(palette.ink, `t = ${st.t} · ${M.now} ${vec(st.x)}`);
        R.add(palette.accent, `${M.guessNoise} ${vec(st.eps)},`, `${M.allOff} ${vec(st.x0)}`);
        R.add(palette.accent, `${M.part}: (${M.nowShort} − ${num(st.cut, 3)} × ${M.guessShort}) × ${num(st.grow, 3)}`, `= ${vec(st.mean)}`);
        if (st.sigma > 0) R.add(palette.muted, `${M.fresh}: + ${num(st.sigma, 3)} × ${vec(st.z)}`, `= ${M.next} ${vec(st.next)}`);
        else R.add(palette.muted, M.noFresh, `${M.next} ${vec(st.next)}`);
      } else {
        const at = landing([cur], SIX).indexOf(1) + 1;
        R.add(palette.ink, `t = 0 · ${M.arrived} ${vec(cur)}`);
        R.add(palette.normal, `${at}${M.picture}`);
      }
      if (st) dot(ctx, X(cur), Y(cur), 6, palette.ink); else ring(ctx, X(cur), Y(cur), 13, palette.ink, 2.5);
      R.draw(ctx, w, bottom + 20, portrait ? 18 : 19);
      return;
    }

    const { X, Y } = plane(w, h, 70, shape === 0 ? 1.6 : 2.1, shape === 0 ? 1.45 : 1.9);
    if (shape === 0) sixDots(ctx, X, Y, 8, 0.45); else for (const m of mix.mu) dot(ctx, X(m), Y(m), 3, `rgba(${palette.normalRgb},0.3)`);
    // a few trails so the path of a single sample is visible
    ctx.save();
    ctx.strokeStyle = `rgba(${palette.accentRgb},0.28)`; ctx.lineWidth = 1;
    for (let p = 0; p < 60; p++) {
      ctx.beginPath();
      for (let s = Math.max(0, kk - 3); s <= kk; s++) { const q = frames[s][p]; if (s === Math.max(0, kk - 3)) ctx.moveTo(X(q), Y(q)); else ctx.lineTo(X(q), Y(q)); }
      ctx.stroke();
    }
    ctx.restore();
    for (const p of frames[kk]) dot(ctx, X(p), Y(p), 2.4, `rgba(${palette.accentRgb},0.9)`);
    if (shape === 0 && kk === 40) {
      sixNotes(ctx, X, Y, (j) => `${counts[j]}`, palette.accent, 13);
      label(ctx, M.counts, PAD, 20, palette.accent, 11);
    }

    const ty = h - 44, tNow = 40 - kk;
    label(ctx, `t = ${tNow}${tNow === 40 ? `  (${M.noise})` : tNow === 0 ? `  (${M.done})` : ""}`, PAD, ty, palette.ink, 13);
    label(ctx, `${M.dist} ${dists[kk].toFixed(2)}`, w - PAD, ty, palette.accent, 12, "right");
    bar(ctx, PAD, ty + 16, w - 2 * PAD, 5, kk / 40, palette.accent);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.sample.follow}>
          <span>{U.sample.follow}</span>
          <button type="button" className={!many ? "on" : ""} onClick={() => { setMany(false); setK(0); }}>{U.sample.one}</button>
          <button type="button" className={many ? "on" : ""} onClick={() => { setMany(true); setK(null); }}>{U.sample.many}</button>
        </div>
        {many ? (
          <div className="ad-ctl ad-seg" role="group" aria-label={U.sample.data}>
            <span>{U.sample.data}</span>
            {[U.sample.six, U.sample.spiral, U.sample.face].map((name, i) => <button key={name} type="button" className={shape === i ? "on" : ""} onClick={() => setShape(i)}>{name}</button>)}
          </div>
        ) : null}
        <label className="ad-ctl">
          <span>{U.sample.step} <b>{k === null ? "…" : 40 - k}</b> / 40</span>
          <input type="range" min={0} max={40} step={1} value={k ?? 0} onChange={(e) => setK(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group">
          {many
            ? <button type="button" className="ad-btn" onClick={() => setK(k === null ? kRef.current : null)}>{k === null ? U.sample.pause : U.sample.play}</button>
            : <button type="button" className="ad-btn" onClick={() => setK((v) => Math.min(40, (v ?? 0) + 1))}>{U.sample.oneStep}</button>}
          <button type="button" className="ad-btn" onClick={() => setSeed((v) => v + 1)}>{U.sample.again}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · Guidance: two predictions at one point, then a crowd            */
/* ------------------------------------------------------------------ */

export function GuideScene() {
  const [many, setMany] = useState(false);
  const [cls, setCls] = useState(0);
  const [wg, setWg] = useState(1);
  const one = useMemo(() => guideAt(GUIDE_X, GUIDE_T, cls, wg), [cls, wg]);
  const calc = useMemo(() => {
    const xs = sampleGuided(TWO_CLASSES, TOY, 160, 4, cls, wg);
    return { xs, st: guidedStats(xs, TWO_CLASSES, cls) };
  }, [cls, wg]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), G = U.guide;
    const { X, Y, bottom } = plane(w, h, many ? 70 : portrait ? 150 : 104, 1.75, 1.3);
    const shapeColor = cls === 0 ? palette.normal : palette.mint;

    TWO_CLASSES.mu.forEach((m, i) => dot(ctx, X(m), Y(m), 4, TWO_CLASSES.cls![i] === 0 ? `rgba(${palette.normalRgb},0.32)` : `rgba(${MINT_RGB},0.36)`));
    label(ctx, G.ring, X([-1, 0.18]), Y([-1, 0.18]), palette.normal, 11, "center");
    label(ctx, G.bar, X([0.62, -0.7]), Y([0.62, -0.7]), palette.mint, 11, "center");

    if (!many) {
      // each diamond: where that prediction would land if all of its noise were taken out at once
      line(ctx, X(one.x0u), Y(one.x0u), X(one.x0g), Y(one.x0g), `rgba(${palette.accentRgb},0.55)`, 1.5, [4, 3]);
      line(ctx, X(GUIDE_X), Y(GUIDE_X), X(one.x0u), Y(one.x0u), palette.dotOff, 1, [2, 3]);
      dot(ctx, X(GUIDE_X), Y(GUIDE_X), 6, palette.ink);
      label(ctx, `${G.point} (t = ${GUIDE_T})`, X(GUIDE_X) + 11, Y(GUIDE_X) - 11, palette.ink, 11);
      diamond(ctx, X(one.x0u), Y(one.x0u), 5.5, palette.muted);
      label(ctx, G.unMark, X(one.x0u) - 9, Y(one.x0u) + 15, palette.muted, 11, "right");
      diamond(ctx, X(one.x0c), Y(one.x0c), 5.5, shapeColor);
      label(ctx, G.coMark, X(one.x0c), Y(one.x0c) + 18, shapeColor, 11, "center");
      diamond(ctx, X(one.x0g), Y(one.x0g), 7, palette.accent);
      label(ctx, `${G.finalMark} w = ${wg.toFixed(1)}`, X(one.x0g), Y(one.x0g) - 17, palette.accent, 11, "center");

      const R = rows(portrait);
      R.add(palette.muted, `${G.un} ${vec(one.eu)}`, undefined, G.same);
      R.add(shapeColor, `${G.co} ${vec(one.ec)}`, undefined, G.same);
      R.add(palette.ink, `${G.diff} ${vec(one.diff)}`);
      R.add(palette.accent, `${G.final} = ${G.un} + ${wg.toFixed(1)} × ${G.diff}`, `= ${vec(one.e)}`);
      R.draw(ctx, w, bottom + 20);
      return;
    }

    for (const p of calc.xs) {
      const q: P2 = [clamp(p[0], -1.72, 1.72), clamp(p[1], -1.72, 1.72)];
      dot(ctx, X(q), Y(q), 2.6, `rgba(${palette.accentRgb},0.9)`);
    }
    const mood = wg === 0 ? G.ignore : wg <= 1 ? G.exact : wg <= 3 ? G.strong : G.broken;
    const ty = h - 44;
    label(ctx, `w = ${wg.toFixed(1)}  ·  ${mood}`, PAD, ty, palette.ink, 13);
    label(ctx, `${G.hit} ${(calc.st.hit * 100).toFixed(0)}%`, w - PAD, ty, calc.st.hit > 0.9 ? palette.mint : palette.anomaly, 12, "right");
    bar(ctx, PAD, ty + 16, w - 2 * PAD, 5, calc.st.hit, calc.st.hit > 0.9 ? palette.mint : palette.anomaly);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.guide.follow}>
          <span>{U.guide.follow}</span>
          <button type="button" className={!many ? "on" : ""} onClick={() => setMany(false)}>{U.guide.one}</button>
          <button type="button" className={many ? "on" : ""} onClick={() => setMany(true)}>{U.guide.many}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.guide.ask}>
          <span>{U.guide.ask}</span>
          <button type="button" className={cls === 0 ? "on" : ""} onClick={() => setCls(0)}>{U.guide.ring}</button>
          <button type="button" className={cls === 1 ? "on" : ""} onClick={() => setCls(1)}>{U.guide.bar}</button>
        </div>
        <label className="ad-ctl">
          <span>{U.guide.w} <b>{wg.toFixed(1)}</b></span>
          <input type="range" min={0} max={5} step={0.5} value={wg} onChange={(e) => setWg(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}
