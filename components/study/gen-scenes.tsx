"use client";

import { useMemo, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { frame, gray, line, rbox, type Ctx } from "./kit";
import { genCopy } from "./gen-copy";
import {
  BLOBS, IMG, NP, PICTURE, PS, VIDEO_SIZES, bind, imageTokens, learnedRecon, lost, nearest, quantize, sampleClip, shrinkRecon, videoTokens, walk,
  type Img, type P2, type Road,
} from "./gen-math";

const U = genCopy.ui;
const PAD = 18;
const isPortrait = (w: number, h: number) => h > w * 1.15;
const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.01 ? 1 : 0)}%`;

/** Large counts in Korean units: 만 (1e4), 억 (1e8), 조 (1e12). */
function ko(n: number): string {
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}${U.dit.unit.jo}`;
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}${U.dit.unit.eok}`;
  if (n >= 1e5) return `${Math.floor(n / 1e4).toLocaleString("en-US")}${U.dit.unit.man}`;
  return Math.round(n).toLocaleString("en-US");
}

const bitmaps = new WeakMap<Img, HTMLCanvasElement>();
/** A grayscale image drawn once into a small off-screen canvas, then scaled up with hard pixel edges. */
function picture(ctx: Ctx, img: Img, x: number, y: number, S: number) {
  let c = bitmaps.get(img);
  if (!c) {
    c = document.createElement("canvas");
    c.width = img[0].length; c.height = img.length;
    const g = c.getContext("2d");
    if (g) {
      const d = g.createImageData(c.width, c.height), cw = c.width;
      img.forEach((row, yy) => row.forEach((v, xx) => {
        const q = Math.round(28 + Math.min(1, Math.max(0, v)) * 210), i = 4 * (yy * cw + xx);
        d.data[i] = q; d.data[i + 1] = q; d.data[i + 2] = q + 4; d.data[i + 3] = 255;
      }));
      g.putImageData(d, 0, 0);
    }
    bitmaps.set(img, c);
  }
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(c, x, y, S, S); ctx.restore();
  frame(ctx, x, y, S, S, palette.frame, 1);
}

/* ------------------------------------------------------------------ */
/* 01 · Shrinking by averaging, or by directions learned from the data  */
/* ------------------------------------------------------------------ */

const KEEP = [1, 2, 4, 8];

export function LatentScene() {
  const [ki, setKi] = useState(2);
  const k = KEEP[ki];
  const shrunk = useMemo(() => shrinkRecon(k), [k]);
  const learned = useMemo(() => learnedRecon(k), [k]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const items: [Img, string, string, number | null][] = [
      [PICTURE, U.latent.original, palette.muted, null],
      [shrunk, U.latent.shrink, palette.anomaly, lost(shrunk)],
      [learned, U.latent.learned, palette.mint, lost(learned)],
    ];
    const cap = (x: number, y: number, S: number, it: [Img, string, string, number | null]) => {
      label(ctx, it[1], x + S / 2, y - 12, it[2], 12, "center");
      picture(ctx, it[0], x, y, S);
      if (it[3] !== null) label(ctx, `${U.latent.lost} ${pct(it[3])}`, x + S / 2, y + S + 16, it[2], 13, "center");
    };
    let bottom = 0;
    if (isPortrait(w, h)) {
      const gap = 16, S = Math.min((w - 2 * PAD - gap) / 2, (h - 150) / 2);
      cap((w - S) / 2, 34, S, items[0]);
      const y2 = 34 + S + 44, x0 = (w - 2 * S - gap) / 2;
      cap(x0, y2, S, items[1]); cap(x0 + S + gap, y2, S, items[2]);
      bottom = y2 + S + 50;
    } else {
      const gap = 14, S = Math.min((w - 2 * PAD - 2 * gap) / 3, h - 150), x0 = (w - 3 * S - 2 * gap) / 2, y0 = 44;
      items.forEach((it, i) => cap(x0 + i * (S + gap), y0, S, it));
      bottom = y0 + S + 58;
    }
    label(ctx, `${U.latent.total}  ${(NP * NP * PS * PS).toLocaleString("en-US")} → ${(NP * NP * k).toLocaleString("en-US")}`, w / 2, bottom, palette.ink, 13, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.latent.keep}>
          <span>{U.latent.keep}</span>
          {KEEP.map((v, i) => <button key={v} type="button" className={ki === i ? "on" : ""} onClick={() => setKi(i)}>{v}</button>)}
          <span>{U.latent.of}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · A picture as a grid of tokens                                   */
/* ------------------------------------------------------------------ */

const SIDES = [256, 512, 1024, 2048], PATCH = [1, 2, 4];

export function DitScene() {
  const [si, setSi] = useState(2);
  const [packed, setPacked] = useState(true);
  const [pi, setPi] = useState(1);
  const side = SIDES[si], p = PATCH[pi], f = packed ? 8 : 1;
  const tokens = imageTokens(side, f, p), n = Math.sqrt(tokens);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const S = Math.min(w - 2 * PAD, h - 140), x0 = (w - S) / 2, y0 = 30;
    picture(ctx, PICTURE, x0, y0, S);
    if (n <= 64) {
      const c = S / n;
      for (let i = 1; i < n; i++) {
        line(ctx, x0 + i * c, y0, x0 + i * c, y0 + S, `rgba(${palette.accentRgb},0.75)`, n > 32 ? 0.5 : 1);
        line(ctx, x0, y0 + i * c, x0 + S, y0 + i * c, `rgba(${palette.accentRgb},0.75)`, n > 32 ? 0.5 : 1);
      }
      label(ctx, `${n} × ${n}  ·  ${U.dit.cell}`, w / 2, y0 - 12, palette.accent, 11, "center");
    } else {
      ctx.fillStyle = `rgba(${palette.accentRgb},0.55)`; ctx.fillRect(x0, y0, S, S);
      label(ctx, `${n.toLocaleString("en-US")} × ${n.toLocaleString("en-US")}`, w / 2, y0 + S / 2 - 12, "#ffffff", 16, "center");
      label(ctx, U.dit.dense, w / 2, y0 + S / 2 + 14, "#ffffff", 12, "center");
    }
    const ty = y0 + S + 30;
    label(ctx, U.dit.tokens, PAD, ty, palette.muted, 12);
    label(ctx, tokens.toLocaleString("en-US"), w - PAD, ty, palette.ink, 16, "right");
    label(ctx, U.dit.pairs, PAD, ty + 34, palette.muted, 12);
    label(ctx, ko(tokens * tokens), w - PAD, ty + 34, tokens > 20000 ? palette.anomaly : palette.mint, 16, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.dit.side}>
          <span>{U.dit.side}</span>
          {SIDES.map((v, i) => <button key={v} type="button" className={si === i ? "on" : ""} onClick={() => setSi(i)}>{v}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.dit.compress}>
          <span>{U.dit.compress}</span>
          <button type="button" className={packed ? "on" : ""} onClick={() => setPacked(true)}>{U.dit.on}</button>
          <button type="button" className={!packed ? "on" : ""} onClick={() => setPacked(false)}>{U.dit.off}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.dit.patch}>
          <span>{U.dit.patch}</span>
          {PATCH.map((v, i) => <button key={v} type="button" className={pi === i ? "on" : ""} onClick={() => setPi(i)}>{v}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Two roads from noise to data, walked with the same denoiser     */
/* ------------------------------------------------------------------ */

const STEPS = [1, 2, 4, 8, 16, 64];
const ROADS: Road[] = ["curved", "straight"];

export function FlowScene() {
  const [kind, setKind] = useState<Road>("straight");
  const [si, setSi] = useState(2);
  const steps = STEPS[si];
  const paths = useMemo(() => walk(kind, steps, 400, 7), [kind, steps]);
  const dist = useMemo(() => nearest(paths.map((p) => p[p.length - 1])), [paths]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const S = Math.min(w - 2 * PAD, h - 84), cx = w / 2, cy = 12 + S / 2, sc = S / 2 / 2.7;
    const X = (p: P2) => cx + p[0] * sc, Y = (p: P2) => cy - p[1] * sc;
    for (const m of BLOBS.mu) {
      ctx.save(); ctx.fillStyle = "rgba(15,157,106,0.16)"; ctx.strokeStyle = palette.mint; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(m), Y(m), 2.5 * BLOBS.s * sc, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    ctx.save(); ctx.strokeStyle = `rgba(${palette.accentRgb},0.32)`; ctx.lineWidth = 1;
    paths.slice(0, 70).forEach((p) => { ctx.beginPath(); p.forEach((q, i) => (i === 0 ? ctx.moveTo(X(q), Y(q)) : ctx.lineTo(X(q), Y(q)))); ctx.stroke(); });
    ctx.restore();
    paths.slice(0, 70).forEach((p) => { ctx.fillStyle = palette.dotOff; ctx.beginPath(); ctx.arc(X(p[0]), Y(p[0]), 2, 0, Math.PI * 2); ctx.fill(); });
    paths.forEach((p, i) => {
      const e = p[p.length - 1];
      ctx.fillStyle = i < 70 ? palette.accent : `rgba(${palette.accentRgb},0.35)`;
      ctx.beginPath(); ctx.arc(X(e), Y(e), i < 70 ? 2.6 : 1.6, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = palette.dotOff; ctx.beginPath(); ctx.arc(PAD + 4, 18, 3, 0, Math.PI * 2); ctx.fill(); label(ctx, U.flow.start, PAD + 12, 18, palette.muted, 11);
    ctx.fillStyle = palette.accent; ctx.beginPath(); ctx.arc(PAD + 4, 36, 3, 0, Math.PI * 2); ctx.fill(); label(ctx, U.flow.end, PAD + 12, 36, palette.accent, 11);
    const ty = 12 + S + 24, good = dist < 0.18;
    label(ctx, U.flow.dist, PAD, ty, palette.muted, 12);
    label(ctx, dist.toFixed(2), PAD, ty + 28, good ? palette.mint : palette.anomaly, 20);
    label(ctx, U.flow.ideal, w - PAD, ty + 28, palette.muted, 12, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.flow.road}>
          <span>{U.flow.road}</span>
          {ROADS.map((r) => <button key={r} type="button" className={kind === r ? "on" : ""} onClick={() => setKind(r)}>{U.flow[r]}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.flow.steps}>
          <span>{U.flow.steps}</span>
          {STEPS.map((v, i) => <button key={v} type="button" className={si === i ? "on" : ""} onClick={() => setSi(i)}>{v}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · Which word gives the ball its colour                            */
/* ------------------------------------------------------------------ */

const RED = [224, 49, 79], BLUE = [42, 111, 214];
const mix = (red: number, a = 1) => `rgba(${RED.map((v, i) => Math.round(v * red + BLUE[i] * (1 - red))).join(",")},${a})`;

export function TextScene() {
  const [c, setC] = useState(0);
  const b = useMemo(() => bind(c), [c]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const n = 4, gap = 12, bw = Math.min(104, (w - 2 * PAD - (n - 1) * gap) / n), x0 = (w - n * bw - (n - 1) * gap) / 2, y0 = 44, bh = 40;
    label(ctx, U.text.prompt, x0, y0 - 16, palette.muted, 11);
    // what colour each token carries: adjectives always, nouns only as far as the encoder read the context
    const carried = [mix(1), mix(1, c), mix(0), mix(0, c)];
    U.text.words.forEach((word, i) => {
      const x = x0 + i * (bw + gap);
      rbox(ctx, x, y0, bw, bh, 8, "#ffffff", palette.frame, 1.5);
      label(ctx, word, x + bw / 2, y0 + bh / 2, palette.ink, 14, "center");
      ctx.fillStyle = palette.track; ctx.fillRect(x + 8, y0 + bh + 8, bw - 16, 8);
      ctx.fillStyle = carried[i]; ctx.fillRect(x + 8, y0 + bh + 8, bw - 16, 8);
    });
    label(ctx, U.text.carries, x0 + n * bw + (n - 1) * gap, y0 - 16, palette.muted, 11, "right");

    const ay = y0 + bh + 44, ah = Math.min(90, h * 0.2);
    label(ctx, U.text.attn, x0, ay, palette.muted, 11);
    b[0].w.forEach((wt, i) => {
      const x = x0 + i * (bw + gap), hh = Math.max(2, wt * ah);
      ctx.fillStyle = palette.track; ctx.fillRect(x + bw / 2 - 12, ay + 14, 24, ah);
      ctx.fillStyle = palette.accent; ctx.fillRect(x + bw / 2 - 12, ay + 14 + ah - hh, 24, hh);
      label(ctx, `${Math.round(wt * 100)}%`, x + bw / 2, ay + ah + 28, palette.ink, 11, "center");
    });

    const ry = ay + ah + 58, R = Math.min(40, (h - ry - 46) / 2), cy = ry + 14 + R, bx = w / 2 - R * 2.2, sx = w / 2 + R * 2.2;
    label(ctx, U.text.result, x0, ry, palette.muted, 11);
    ctx.fillStyle = mix(b[0].red); ctx.beginPath(); ctx.arc(bx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = mix(b[1].red); ctx.fillRect(sx - R, cy - R, 2 * R, 2 * R);
    label(ctx, `${U.text.ball}: ${U.text.red} ${Math.round(b[0].red * 100)}%`, bx, cy + R + 16, palette.ink, 12, "center");
    label(ctx, `${U.text.box}: ${U.text.blue} ${Math.round((1 - b[1].red) * 100)}%`, sx, cy + R + 16, palette.ink, 12, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.text.context} <b>{c.toFixed(2)}</b></span>
          <input type="range" min={0} max={1} step={0.05} value={c} onChange={(e) => setC(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · A picture written as code numbers, one after another            */
/* ------------------------------------------------------------------ */

const BOOKS = [4, 16, 64];

export function NativeScene() {
  const [bi, setBi] = useState(1);
  const [n, setN] = useState(120);
  const K = BOOKS[bi];
  const q = useMemo(() => quantize(K), [K]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), cols = Math.sqrt(K);
    const S = portrait ? Math.min(w - 2 * PAD, 232) : Math.min(260, h - 130), px = S / IMG, cell = px * PS;
    const x0 = portrait ? (w - S) / 2 : PAD + 4, y0 = 36;
    label(ctx, U.native.picture, x0, y0 - 14, palette.muted, 11);
    ctx.fillStyle = palette.track; ctx.fillRect(x0, y0, S, S);
    for (let t = 0; t < n; t++) {
      const code = q.book[q.ids[t]], cx = x0 + (t % NP) * cell, cy = y0 + Math.floor(t / NP) * cell;
      for (let j = 0; j < PS; j++) for (let i = 0; i < PS; i++) { ctx.fillStyle = gray(code[j * PS + i]); ctx.fillRect(cx + i * px, cy + j * px, px + 0.5, px + 0.5); }
    }
    frame(ctx, x0, y0, S, S, palette.frame, 1);
    if (n > 0) frame(ctx, x0 + ((n - 1) % NP) * cell, y0 + Math.floor((n - 1) / NP) * cell, cell, cell, palette.accent, 2);

    // the codebook: K typical patches, with the one just written marked
    const bx = portrait ? PAD : x0 + S + 26, by = portrait ? y0 + S + 34 : y0;
    const availW = portrait ? w - 2 * PAD : w - PAD - bx, availH = portrait ? h - by - 70 : S;
    const tile = Math.min(40, availW / cols, availH / cols), tp = (tile - 3) / PS, cur = n > 0 ? q.ids[n - 1] : -1;
    label(ctx, `${U.native.codebook} ${K}`, bx, by - 14, palette.muted, 11);
    q.book.forEach((code, kk) => {
      const tx = bx + (kk % cols) * tile, ty = by + Math.floor(kk / cols) * tile;
      for (let j = 0; j < PS; j++) for (let i = 0; i < PS; i++) { ctx.fillStyle = gray(code[j * PS + i]); ctx.fillRect(tx + i * tp, ty + j * tp, tp + 0.4, tp + 0.4); }
      if (kk === cur) frame(ctx, tx - 1, ty - 1, tile - 1, tile - 1, palette.accent, 2.5);
    });

    const ty = portrait ? h - 44 : y0 + S + 28;
    const tail = q.ids.slice(Math.max(0, n - 7), n).join("  ");
    label(ctx, `${U.native.seq}  ${n > 7 ? "…  " : ""}${tail}`, PAD, ty, palette.ink, 12);
    label(ctx, `${U.native.lost} ${pct(q.lost)}`, w - PAD, ty + 26, q.lost < 0.06 ? palette.mint : palette.anomaly, 13, "right");
    if (cur >= 0) label(ctx, `${U.native.next} ${cur}`, PAD, ty + 26, palette.accent, 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.native.book}>
          <span>{U.native.book}</span>
          {BOOKS.map((v, i) => <button key={v} type="button" className={bi === i ? "on" : ""} onClick={() => setBi(i)}>{v}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{U.native.written} <b>{n}</b></span>
          <input type="range" min={0} max={NP * NP} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · A video as a block of space-time tokens                         */
/* ------------------------------------------------------------------ */

export function VideoScene() {
  const [vi, setVi] = useState(1);
  const [sec, setSec] = useState(5);
  const size = VIDEO_SIZES[vi];
  const v = videoTokens(size.w, size.h, sec);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    // frames stacked back to front; one coloured box is the piece of space and time that a single token covers
    const shown = Math.min(16, 4 + sec), dx = Math.min(13, (w - 2 * PAD - 150) / shown), dy = 5.5, fw = 132, fh = 74;
    const sx = (w - fw - dx * (shown - 1)) / 2, sy = 30 + dy * (shown - 1);
    for (let i = shown - 1; i >= 0; i--) {
      const x = sx + i * dx, y = sy - i * dy;
      ctx.fillStyle = i < 4 ? "#ffffff" : "#f4f5f8"; ctx.fillRect(x, y, fw, fh);
      frame(ctx, x, y, fw, fh, i < 4 ? palette.normal : palette.frame, i < 4 ? 1.5 : 1);
    }
    const bx = sx + 22, byy = sy + 20, bs = 18;
    ctx.save(); ctx.fillStyle = `rgba(${palette.accentRgb},0.85)`; ctx.strokeStyle = palette.accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx, byy); ctx.lineTo(bx + 3 * dx, byy - 3 * dy); ctx.lineTo(bx + 3 * dx + bs, byy - 3 * dy); ctx.lineTo(bx + 3 * dx + bs, byy - 3 * dy + bs); ctx.lineTo(bx + bs, byy + bs); ctx.lineTo(bx, byy + bs); ctx.closePath();
    ctx.fill(); ctx.stroke(); ctx.strokeRect(bx, byy, bs, bs); ctx.restore();
    label(ctx, `${U.video.time} →`, sx + fw + dx * (shown - 1) - 4, sy + fh - dy * (shown - 1) + 14, palette.muted, 11, "right");
    label(ctx, U.video.patch, sx, sy + fh + 16, palette.accent, 11);

    const rows: [string, string, string][] = [
      [U.video.frames, v.frames.toLocaleString("en-US"), palette.ink],
      [U.video.numbers, ko(v.numbers), palette.ink],
      [U.video.grid, v.grid.join(" × "), palette.ink],
      [U.video.tokens, v.tokens.toLocaleString("en-US"), palette.accent],
      [U.video.vsImage, `${(v.tokens / 4096).toFixed(v.tokens / 4096 < 10 ? 1 : 0)}${U.video.times}`, palette.anomaly],
    ];
    const ty = sy + fh + 48, rh = Math.min(30, (h - ty - 8) / rows.length);
    rows.forEach(([name, value, color], i) => {
      label(ctx, name, PAD, ty + i * rh, palette.muted, 12);
      label(ctx, value, w - PAD, ty + i * rh, color, 15, "right");
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.video.size}>
          <span>{U.video.size}</span>
          {VIDEO_SIZES.map((s, i) => <button key={s.name} type="button" className={vi === i ? "on" : ""} onClick={() => setVi(i)}>{s.name}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{U.video.seconds} <b>{sec}{U.video.sec}</b></span>
          <input type="range" min={1} max={20} step={1} value={sec} onChange={(e) => setSec(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · Frames drawn apart, or drawn together                           */
/* ------------------------------------------------------------------ */

const LOOKS = [palette.normal, palette.anomaly, palette.accent, palette.mint, palette.accent2];
const FRAMES = 8;
const meanSteady = (joint: boolean) => { let s = 0; for (let seed = 1; seed <= 300; seed++) s += sampleClip(joint, FRAMES, seed).steady; return s / 300; };

export function ClipScene() {
  const [joint, setJoint] = useState(false);
  const [seed, setSeed] = useState(1);
  const clip = useMemo(() => sampleClip(joint, FRAMES, seed), [joint, seed]);
  const average = useMemo(() => meanSteady(joint), [joint]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const S = Math.min(w - 2 * PAD, h - 196), cx = w / 2, cy = 26 + S / 2, sc = S / 2 / 2.2;
    const X = (p: P2) => cx + p[0] * sc, Y = (p: P2) => cy - p[1] * sc;
    label(ctx, U.clip.plane, PAD, 14, palette.muted, 11);
    BLOBS.mu.forEach((m, k) => {
      ctx.save(); ctx.globalAlpha = 0.18; ctx.fillStyle = LOOKS[k]; ctx.beginPath(); ctx.arc(X(m), Y(m), 0.42 * sc, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = LOOKS[k]; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
    });
    // frames that land on the same look pile up, so fan them out around the centre
    clip.pts.forEach((p, i) => {
      const m = BLOBS.mu[clip.look[i]], ang = (2 * Math.PI * i) / FRAMES, px = X(m) + 0.25 * sc * Math.cos(ang) + (p[0] - m[0]) * sc * 0.3, py = Y(m) + 0.25 * sc * Math.sin(ang) - (p[1] - m[1]) * sc * 0.3;
      ctx.fillStyle = LOOKS[clip.look[i]]; ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
      label(ctx, String(i + 1), px, py + 0.5, "#ffffff", 11, "center");
    });

    const fy = 26 + S + 30, gap = 5, tw = (w - 2 * PAD - (FRAMES - 1) * gap) / FRAMES, th = Math.min(46, tw * 0.9);
    label(ctx, U.clip.film, PAD, fy - 12, palette.muted, 11);
    clip.look.forEach((k, i) => {
      const x = PAD + i * (tw + gap);
      rbox(ctx, x, fy, tw, th, 5, "#ffffff", palette.frame, 1);
      ctx.fillStyle = LOOKS[k]; ctx.beginPath(); ctx.arc(x + tw / 2, fy + th / 2, Math.min(tw, th) * 0.3, 0, Math.PI * 2); ctx.fill();
      label(ctx, String(i + 1), x + 4, fy + 9, palette.muted, 10);
    });
    const ty = fy + th + 28;
    label(ctx, U.clip.steady, PAD, ty, palette.muted, 12);
    label(ctx, pct(clip.steady), PAD, ty + 28, clip.steady > 0.9 ? palette.mint : palette.anomaly, 20);
    label(ctx, `${U.clip.average} ${pct(average)}`, w - PAD, ty + 28, palette.muted, 12, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.clip.mode}>
          <span>{U.clip.mode}</span>
          <button type="button" className={!joint ? "on" : ""} onClick={() => setJoint(false)}>{U.clip.apart}</button>
          <button type="button" className={joint ? "on" : ""} onClick={() => setJoint(true)}>{U.clip.together}</button>
        </div>
        <button type="button" className="ad-btn" onClick={() => setSeed((s) => s + 1)}>{U.clip.again}</button>
      </div>
    </div>
  );
}
