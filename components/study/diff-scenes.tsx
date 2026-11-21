"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { clamp, drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { diffCopy } from "./diff-copy";
import {
  BELL, DDPM, TOY, TWO_BUMPS, TWO_CLASSES, denoise, drawSamples, guidedStats, histogram, meanNearest, mulberry, noised, normal, normalPdf,
  posterior, sampleGuided, sampleReverse, smiley, spiral, stats, walkPaths, type Mixture, type P2,
} from "./diff-math";
import { arrow, bar, frame, line, type Ctx } from "./kit";

const U = diffCopy.ui;
const PAD = 18;
const MINT_RGB = "15,157,106";
const isPortrait = (w: number, h: number) => h > w * 1.15;

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

function diamond(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = color; ctx.fillRect(-s, -s, 2 * s, 2 * s);
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.strokeRect(-s, -s, 2 * s, 2 * s);
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 01 · A distribution, and samples drawn from it                       */
/* ------------------------------------------------------------------ */

const COUNTS = [10, 30, 100, 300, 1000, 3000];

export function SampleScene() {
  const [two, setTwo] = useState(false);
  const [ni, setNi] = useState(2);
  const [seed, setSeed] = useState(7);
  const d = two ? TWO_BUMPS : BELL, n = COUNTS[ni];
  const calc = useMemo(() => {
    const xs = drawSamples(d, n, seed);
    return { xs, hist: histogram(xs, -4, 4, 32), st: stats(xs) };
  }, [d, n, seed]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const x0 = PAD + 6, x1 = w - PAD - 6, yb = h - 122, yt = 44, top = 0.56;
    const X = (x: number) => x0 + ((x + 4) / 8) * (x1 - x0), Y = (v: number) => yb - (Math.min(v, top) / top) * (yb - yt);
    const bw = (x1 - x0) / 32;
    calc.hist.forEach((v, i) => {
      ctx.fillStyle = `rgba(${palette.accentRgb},0.55)`;
      ctx.fillRect(x0 + i * bw + 1, Y(v), bw - 2, yb - Y(v));
    });
    curve(ctx, d.pdf, -4, 4, X, Y, palette.normal, 2.5);
    line(ctx, x0, yb, x1, yb, palette.frame, 1);
    if (n <= 300) for (const x of calc.xs) if (x > -4 && x < 4) line(ctx, X(x), yb + 3, X(x), yb + 11, `rgba(${palette.inkRgb},0.45)`, 1);
    for (const v of [-4, -2, 0, 2, 4]) label(ctx, String(v), X(v), yb + 22, palette.muted, 10, "center");
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
          <button type="button" className={!two ? "on" : ""} onClick={() => setTwo(false)}>{U.dist.bell}</button>
          <button type="button" className={two ? "on" : ""} onClick={() => setTwo(true)}>{U.dist.two}</button>
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
/* 02 · Many small pushes add up to a bell                              */
/* ------------------------------------------------------------------ */

const WALK = walkPaths(600, 64, 3);

export function WalkScene() {
  const [k, setK] = useState<number | null>(null);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const kk = k ?? Math.min(64, Math.floor(tt * 7) % 84);
    const x0 = PAD, x1 = w - PAD, R = 26;
    const X = (v: number) => x0 + ((v + R) / (2 * R)) * (x1 - x0);
    const py0 = 40, py1 = h * 0.42, hy0 = py1 + 34, hy1 = h - 62;

    label(ctx, U.gauss.paths, x0, py0 - 16, palette.muted, 11);
    line(ctx, X(0), py0, X(0), py1, palette.frame, 1, [3, 3]);
    ctx.save();
    ctx.strokeStyle = `rgba(${palette.accentRgb},0.38)`; ctx.lineWidth = 1;
    for (let p = 0; p < 46; p++) {
      ctx.beginPath();
      for (let s = 0; s <= kk; s++) {
        const x = X(WALK[p][s]), y = py0 + (s / 64) * (py1 - py0);
        if (s === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    const yk = py0 + (kk / 64) * (py1 - py0);
    for (let p = 0; p < 46; p++) dot(ctx, X(WALK[p][kk]), yk, 2, palette.accent);

    // histogram of all 600 particles; positions share the parity of k, so bins are 2 wide
    label(ctx, U.gauss.hist, x0, hy0 - 16, palette.muted, 11);
    const counts = new Map<number, number>();
    for (const p of WALK) counts.set(p[kk], (counts.get(p[kk]) ?? 0) + 1);
    const sdT = Math.sqrt(Math.max(kk, 0.0001));
    const peak = kk === 0 ? 0.5 : Math.max(normalPdf(0, 0, sdT) * 1.25, 0.02);
    const Y = (v: number) => hy1 - (Math.min(v, peak) / peak) * (hy1 - hy0);
    const bw = X(2) - X(0);
    counts.forEach((c, pos) => {
      const dens = c / (600 * 2);
      ctx.fillStyle = `rgba(${palette.accentRgb},0.6)`;
      ctx.fillRect(X(pos) - bw / 2 + 0.5, Y(dens), Math.max(1, bw - 1), hy1 - Y(dens));
    });
    if (kk > 0) curve(ctx, (x) => normalPdf(x, 0, sdT), -R, R, X, Y, palette.normal, 2.5);
    line(ctx, x0, hy1, x1, hy1, palette.frame, 1);

    const sd = stats(WALK.map((p) => p[kk])).sd;
    label(ctx, `k = ${kk}`, x0, h - 34, palette.ink, 13);
    label(ctx, `${U.gauss.measured} ${sd.toFixed(2)}`, w / 2, h - 34, palette.accent, 12, "center");
    label(ctx, `${U.gauss.theory} = ${sdT < 0.01 ? "0.00" : sdT.toFixed(2)}`, x1, h - 34, palette.normal, 12, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.gauss.steps} <b>{k ?? "…"}</b></span>
          <input type="range" min={0} max={64} step={1} value={k ?? 0} onChange={(e) => setK(Number(e.target.value))} />
        </label>
        <button type="button" className="ad-btn" onClick={() => setK(null)}>{U.gauss.auto}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · From the observation back to the cause                          */
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
    for (const v of [-3, -2, -1, 0, 1, 2, 3]) label(ctx, String(v), X(v), yb + 14, palette.muted, 10, "center");
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
/* 04 · The forward process on a real photograph                        */
/* ------------------------------------------------------------------ */

const IMG_N = 72;
const IMG_SRC = ["/anomaly/hazelnut-good.webp", "/anomaly/leather-good.webp"];
const PIX_NOISE: Float32Array = (() => {
  const r = mulberry(99), a = new Float32Array(IMG_N * IMG_N * 3);
  for (let i = 0; i < a.length; i++) a[i] = normal(r);
  return a;
})();

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
    const S = portrait ? Math.min(w - 2 * PAD, h * 0.42) : Math.min(h - 70, w * 0.46);
    const ix = portrait ? (w - S) / 2 : PAD, iy = portrait ? 34 : (h - S) / 2;

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
    const hy0 = y + 14, hy1 = portrait ? h - 24 : iy + S - 4, top = 0.75;
    const X = (v: number) => rx + ((v + 3) / 6) * rw, Y = (v: number) => hy1 - (Math.min(v, top) / top) * (hy1 - hy0);
    const bw = rw / 36;
    buf.current.hist.forEach((v, i) => {
      ctx.fillStyle = `rgba(${palette.accentRgb},0.6)`;
      ctx.fillRect(rx + i * bw + 0.5, Y(v), Math.max(1, bw - 1), hy1 - Y(v));
    });
    curve(ctx, (v) => normalPdf(v, 0, 1), -3, 3, X, Y, palette.normal, 2);
    line(ctx, rx, hy1, rx + rw, hy1, palette.frame, 1);
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
/* 05 · One training step: mix in noise, guess it back                  */
/* ------------------------------------------------------------------ */

const SIX: Mixture = { mu: [[-0.7, 0.5], [0, 0.75], [0.7, 0.45], [-0.6, -0.45], [0.05, -0.7], [0.7, -0.35]], s: 0.04 };

export function DenoiseScene() {
  const [t, setT] = useState(10);
  const [seed, setSeed] = useState(3);
  const calc = useMemo(() => {
    const r = mulberry(seed * 31 + 7);
    const i = Math.floor(r() * SIX.mu.length), eps: P2 = [normal(r), normal(r)];
    const ab = TOY.abar[t], xt = noised(SIX.mu[i], eps, ab), d = denoise(xt, ab, SIX);
    const top = d.w.indexOf(Math.max(...d.w));
    return { i, eps, ab, xt, d, top, loss: (d.eps[0] - eps[0]) ** 2 + (d.eps[1] - eps[1]) ** 2 };
  }, [t, seed]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const S = Math.min(w - 2 * PAD, h - 96), cx = w / 2, cy = 14 + S / 2, sc = S / 2 / 1.55;
    const X = (p: P2) => cx + clamp(p[0], -1.5, 1.5) * sc, Y = (p: P2) => cy - clamp(p[1], -1.5, 1.5) * sc;
    const { i, ab, xt, d, top, loss } = calc;
    const ra = Math.sqrt(ab), shrunk: P2 = [ra * SIX.mu[i][0], ra * SIX.mu[i][1]];

    // how strongly each training point is "blamed" for the noisy point
    SIX.mu.forEach((m, j) => {
      if (d.w[j] > 0.01) line(ctx, X(xt), Y(xt), X(m), Y(m), `rgba(${palette.accentRgb},${0.25 + 0.7 * d.w[j]})`, 1 + 9 * d.w[j]);
    });
    SIX.mu.forEach((m, j) => {
      dot(ctx, X(m), Y(m), 8, palette.normal);
      label(ctx, String(j + 1), X(m), Y(m) + 0.5, "#ffffff", 10, "center");
    });
    ctx.save();
    ctx.strokeStyle = palette.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(X(SIX.mu[i]), Y(SIX.mu[i]), 13, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // x_t = √ᾱ·x0 + √(1−ᾱ)·ε : the red arrow is the noise that was actually mixed in
    line(ctx, X(SIX.mu[i]), Y(SIX.mu[i]), X(shrunk), Y(shrunk), palette.dotOff, 1, [3, 3]);
    dot(ctx, X(shrunk), Y(shrunk), 3, palette.muted);
    arrow(ctx, X(shrunk), Y(shrunk), X(xt), Y(xt), palette.anomaly, 2);
    dot(ctx, X(xt), Y(xt), 6, palette.ink);
    label(ctx, "x_t", X(xt) + 9, Y(xt) - 9, palette.ink, 11);
    diamond(ctx, X(d.x0), Y(d.x0), 6, palette.mint);
    label(ctx, U.denoise.guess, X(d.x0) + 10, Y(d.x0) + 12, palette.mint, 11);

    const ty = h - 74;
    label(ctx, `${U.denoise.truth}: ${i + 1}`, PAD, ty, palette.ink, 12);
    label(ctx, `${U.denoise.suspect}: ${top + 1} (${(d.w[top] * 100).toFixed(0)}%)`, PAD, ty + 22, top === i ? palette.mint : palette.anomaly, 12);
    label(ctx, `${U.denoise.loss} ${loss.toFixed(2)}`, w - PAD, ty + 22, palette.muted, 12, "right");
    label(ctx, `t = ${t} / 40`, w - PAD, ty, palette.muted, 12, "right");
    label(ctx, `→ ${U.denoise.added}`, PAD, ty + 44, palette.anomaly, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.denoise.step} <b>{t}</b></span>
          <input type="range" min={1} max={40} step={1} value={t} onChange={(e) => setT(Number(e.target.value))} />
        </label>
        <button type="button" className="ad-btn" onClick={() => setSeed((s) => s + 1)}>{U.denoise.again}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · Walking back from noise to data                                 */
/* ------------------------------------------------------------------ */

const SHAPES: Mixture[] = [{ mu: spiral(), s: 0.035 }, { mu: smiley(), s: 0.035 }];

export function ReverseScene() {
  const [shape, setShape] = useState(0);
  const [seed, setSeed] = useState(11);
  const [k, setK] = useState<number | null>(null);
  const kRef = useRef(0);
  const mix = SHAPES[shape];
  const frames = useMemo(() => sampleReverse(mix, TOY, 240, seed), [mix, seed]);
  const dists = useMemo(() => frames.map((f) => meanNearest(f, mix)), [frames, mix]);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const kk = k ?? Math.min(40, Math.floor(tt * 8) % 62);
    kRef.current = kk;
    const S = Math.min(w - 2 * PAD, h - 84), cx = w / 2, cy = 14 + S / 2, sc = S / 2 / 2.0;
    const X = (p: P2) => cx + clamp(p[0], -2, 2) * sc, Y = (p: P2) => cy - clamp(p[1], -2, 2) * sc;

    for (const m of mix.mu) dot(ctx, X(m), Y(m), 3, `rgba(${palette.normalRgb},0.3)`);
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

    const ty = h - 44, tNow = 40 - kk;
    label(ctx, `t = ${tNow}${tNow === 40 ? `  (${U.sample.noise})` : tNow === 0 ? `  (${U.sample.done})` : ""}`, PAD, ty, palette.ink, 13);
    label(ctx, `${U.sample.dist} ${dists[kk].toFixed(2)}`, w - PAD, ty, palette.accent, 12, "right");
    bar(ctx, PAD, ty + 16, w - 2 * PAD, 5, kk / 40, palette.accent);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.sample.shape}>
          <span>{U.sample.shape}</span>
          <button type="button" className={shape === 0 ? "on" : ""} onClick={() => setShape(0)}>{U.sample.spiral}</button>
          <button type="button" className={shape === 1 ? "on" : ""} onClick={() => setShape(1)}>{U.sample.face}</button>
        </div>
        <label className="ad-ctl">
          <span>{U.sample.step} <b>{k ?? "…"}</b> / 40</span>
          <input type="range" min={0} max={40} step={1} value={k ?? 0} onChange={(e) => setK(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group">
          <button type="button" className="ad-btn" onClick={() => setK(k === null ? kRef.current : null)}>{k === null ? U.sample.pause : U.sample.play}</button>
          <button type="button" className="ad-btn" onClick={() => setSeed((s) => s + 1)}>{U.sample.again}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · Classifier-free guidance on two shapes                          */
/* ------------------------------------------------------------------ */

export function GuideScene() {
  const [cls, setCls] = useState(0);
  const [wg, setWg] = useState(1);
  const calc = useMemo(() => {
    const xs = sampleGuided(TWO_CLASSES, TOY, 160, 4, cls, wg);
    return { xs, st: guidedStats(xs, TWO_CLASSES, cls) };
  }, [cls, wg]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const S = Math.min(w - 2 * PAD, h - 84), cx = w / 2, cy = 14 + S / 2, sc = S / 2 / 1.75;
    const X = (p: P2) => cx + p[0] * sc, Y = (p: P2) => cy - p[1] * sc;

    TWO_CLASSES.mu.forEach((m, i) => dot(ctx, X(m), Y(m), 4, TWO_CLASSES.cls![i] === 0 ? `rgba(${palette.normalRgb},0.32)` : `rgba(${MINT_RGB},0.36)`));
    label(ctx, U.guide.ring, X([-0.5, 0.74]), Y([-0.5, 0.74]), palette.normal, 11, "center");
    label(ctx, U.guide.bar, X([0.62, -0.66]), Y([0.62, -0.66]), palette.mint, 11, "center");
    for (const p of calc.xs) {
      const q: P2 = [clamp(p[0], -1.72, 1.72), clamp(p[1], -1.72, 1.72)];
      dot(ctx, X(q), Y(q), 2.6, `rgba(${palette.accentRgb},0.9)`);
    }
    const mood = wg === 0 ? U.guide.ignore : wg <= 1 ? U.guide.exact : wg <= 3 ? U.guide.strong : U.guide.broken;
    const ty = h - 44;
    label(ctx, `w = ${wg.toFixed(1)}  ·  ${mood}`, PAD, ty, palette.ink, 13);
    label(ctx, `${U.guide.hit} ${(calc.st.hit * 100).toFixed(0)}%`, w - PAD, ty, calc.st.hit > 0.9 ? palette.mint : palette.anomaly, 12, "right");
    bar(ctx, PAD, ty + 16, w - 2 * PAD, 5, calc.st.hit, calc.st.hit > 0.9 ? palette.mint : palette.anomaly);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
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
