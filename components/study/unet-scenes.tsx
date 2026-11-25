"use client";

import { useMemo, useRef, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, cellText, cells, frame, gray, line, rbox, type Ctx } from "./kit";
import { unetCopy } from "./unet-copy";
import {
  CELLS_PHOTO, CELLS_TRUTH, PATCH_PICKS, PHOTO, SMALL_MAP, STAMP_COPY, STAMP_LEARNED, TRUTH, UN, U_NODES,
  bilinearUp, downThenUp, iou, makeWarp, patchMean, patchPredict, skipFusion, threshold, transposedUp, warp, type Grid,
} from "./unet-math";

const U = unetCopy.ui;
const PAD = 18;
const isPortrait = (w: number, h: number) => h > w * 1.15;
const MINT_RGB = "15,157,106";

/** Draw a binary mask; when `truth` is given, wrong cells are colored (red = painted by mistake, blue = missed). */
function drawMask(ctx: Ctx, m: Grid, x: number, y: number, cell: number, rgb: string, truth?: Grid, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  cells(ctx, x, y, cell, m.n, m.n, (r, c) => {
    const v = m.d[r * m.n + c], t = truth ? truth.d[r * m.n + c] : v;
    if (v && !t) return palette.anomaly;
    if (!v && t) return palette.normal;
    return v ? `rgba(${rgb},0.85)` : palette.track;
  }, cell > 5 ? 1 : 0.5);
  ctx.restore();
}

const drawPhoto = (ctx: Ctx, g: Grid, x: number, y: number, cell: number) =>
  cells(ctx, x, y, cell, g.n, g.n, (r, c) => gray(g.d[r * g.n + c]), cell > 5 ? 1 : 0.5);

/** Outline of a binary mask, drawn along cell borders. */
function outline(ctx: Ctx, m: Grid, x: number, y: number, cell: number, color: string, lw = 2) {
  const n = m.n, on = (r: number, c: number) => r >= 0 && c >= 0 && r < n && c < n && m.d[r * n + c] > 0;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.beginPath();
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!on(r, c)) continue;
    const x0 = x + c * cell, y0 = y + r * cell;
    if (!on(r - 1, c)) { ctx.moveTo(x0, y0); ctx.lineTo(x0 + cell, y0); }
    if (!on(r + 1, c)) { ctx.moveTo(x0, y0 + cell); ctx.lineTo(x0 + cell, y0 + cell); }
    if (!on(r, c - 1)) { ctx.moveTo(x0, y0); ctx.lineTo(x0, y0 + cell); }
    if (!on(r, c + 1)) { ctx.moveTo(x0 + cell, y0); ctx.lineTo(x0 + cell, y0 + cell); }
  }
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* 01 · Per-pixel patches: context against precision                    */
/* ------------------------------------------------------------------ */

const PATCHES = [1, 3, 5, 7, 9, 11];
type Pick = keyof typeof PATCH_PICKS;
const PICKS: Pick[] = ["arm", "speck"];

export function WindowScene() {
  const [ki, setKi] = useState(1);
  const [pick, setPick] = useState<Pick>("arm");
  const k = PATCHES[ki];
  const calc = useMemo(() => {
    const pred = patchPredict(PHOTO, k);
    let fp = 0, fn = 0;
    pred.d.forEach((v, i) => { if (v && !TRUTH.d[i]) fp++; if (!v && TRUTH.d[i]) fn++; });
    return { pred, fp, fn, iou: iou(pred, TRUTH) };
  }, [k]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const c = Math.min(10, (w - 2 * PAD - 22) / (2 * UN), (h - 170) / UN);
    const x0 = (w - (2 * UN * c + 22)) / 2, y0 = Math.max(44, (h - UN * c - 140) / 2 + 10), x1 = x0 + UN * c + 22;
    const [pr, pc] = PATCH_PICKS[pick], half = (k - 1) / 2;

    // left: the photo, with the patch that is cut out around the followed pixel
    label(ctx, U.photo, x0 + (UN * c) / 2, y0 - 16, palette.muted, 11, "center");
    drawPhoto(ctx, PHOTO, x0, y0, c);
    const fx = Math.max(0, pc - half), fy = Math.max(0, pr - half), fx2 = Math.min(UN, pc + half + 1), fy2 = Math.min(UN, pr + half + 1);
    frame(ctx, x0 + fx * c, y0 + fy * c, (fx2 - fx) * c, (fy2 - fy) * c, palette.accent, 2.5);

    // right: the answer at every pixel for this patch size
    label(ctx, `${U.pred}  ${k}×${k}`, x1 + (UN * c) / 2, y0 - 16, palette.muted, 11, "center");
    drawMask(ctx, calc.pred, x1, y0, c, MINT_RGB, TRUTH);
    frame(ctx, x1 + pc * c - 1, y0 + pr * c - 1, c + 2, c + 2, palette.accent, 2);

    const mean = patchMean(PHOTO, k, pr, pc), said = mean > 0.5 ? 1 : 0, truth = TRUTH.d[pr * UN + pc], ok = said === truth;
    const word = (v: number) => (v ? U.window.cell : U.window.bg);
    const ty = y0 + UN * c + 24;
    label(ctx, `${U.window.mean} ${mean.toFixed(2)} → ${word(said)}`, w / 2, ty, palette.accent, 13, "center");
    label(ctx, `${U.window.answer} ${word(truth)} · ${ok ? U.window.right : U.window.wrong}`, w / 2, ty + 21, ok ? palette.mint : palette.anomaly, 12, "center");
    label(ctx, `${U.iou} ${calc.iou.toFixed(2)}`, w / 2, ty + 48, palette.ink, 14, "center");
    label(ctx, `${U.window.fp} ${calc.fp}`, w / 2 - 12, ty + 70, palette.anomaly, 12, "right");
    label(ctx, `${U.window.fn} ${calc.fn}`, w / 2 + 12, ty + 70, palette.normal, 12);
    label(ctx, `${U.window.runs}: ${UN} × ${UN} = ${UN * UN}`, w / 2, ty + 91, palette.muted, 11, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.window.size} <b>{k}×{k}</b></span>
          <input type="range" min={0} max={PATCHES.length - 1} step={1} value={ki} onChange={(e) => setKi(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.window.follow}>
          <span>{U.window.follow}</span>
          {PICKS.map((p) => <button key={p} type="button" className={pick === p ? "on" : ""} onClick={() => setPick(p)}>{U.window.picks[p]}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · Shrinking keeps "what" and loses "where"                        */
/* ------------------------------------------------------------------ */

export function DownUpScene() {
  const [d, setD] = useState(2);
  const calc = useMemo(() => {
    const r = downThenUp(TRUTH, d);
    return { ...r, iou: iou(r.back, TRUTH) };
  }, [d]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const gap = 18;
    const c = portrait ? Math.min(9, (w - 2 * PAD - gap) / (2 * UN), (h - 160) / (2 * UN)) : Math.min(9, (w - 2 * PAD - 2 * gap) / (3 * UN), (h - 130) / UN);
    const S = UN * c;
    const pos: [number, number][] = portrait
      ? [[(w - 2 * S - gap) / 2, 40], [(w - 2 * S - gap) / 2 + S + gap, 40], [(w - 2 * S - gap) / 2, 40 + S + 44]]
      : [0, 1, 2].map((i) => [(w - 3 * S - 2 * gap) / 2 + i * (S + gap), Math.max(44, (h - S - 70) / 2)] as [number, number]);

    label(ctx, U.down.original, pos[0][0] + S / 2, pos[0][1] - 16, palette.muted, 11, "center");
    drawMask(ctx, TRUTH, pos[0][0], pos[0][1], c, MINT_RGB);

    const n = calc.small.n, big = S / n;
    label(ctx, `${U.down.small}  ${n}×${n}`, pos[1][0] + S / 2, pos[1][1] - 16, palette.muted, 11, "center");
    cells(ctx, pos[1][0], pos[1][1], big, n, n, (r, cc) => {
      const v = calc.small.d[r * n + cc];
      return v < 0.02 ? palette.track : `rgba(${palette.accentRgb},${0.12 + 0.88 * v})`;
    });

    label(ctx, U.down.back, pos[2][0] + S / 2, pos[2][1] - 16, palette.muted, 11, "center");
    drawMask(ctx, calc.back, pos[2][0], pos[2][1], c, MINT_RGB, TRUTH);

    if (portrait) {
      const tx = pos[1][0] + S / 2, ty = pos[2][1] + S / 2;
      label(ctx, U.iou, tx, ty - 16, palette.muted, 12, "center");
      label(ctx, calc.iou.toFixed(2), tx, ty + 10, palette.ink, 22, "center");
    } else {
      label(ctx, `${U.iou} ${calc.iou.toFixed(2)}`, w / 2, pos[0][1] + S + 30, palette.ink, 15, "center");
      arrow(ctx, pos[0][0] + S + 3, pos[0][1] + S / 2, pos[1][0] - 3, pos[1][1] + S / 2, palette.muted);
      arrow(ctx, pos[1][0] + S + 3, pos[1][1] + S / 2, pos[2][0] - 3, pos[2][1] + S / 2, palette.muted);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.down.depth} <b>{d}</b></span>
          <input type="range" min={0} max={3} step={1} value={d} onChange={(e) => setD(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Three ways to grow a map; one of them is learnable              */
/* ------------------------------------------------------------------ */

type UpMethod = "copy" | "smooth" | "stamp";

export function UpsampleScene() {
  const [method, setMethod] = useState<UpMethod>("stamp");
  const big = useMemo(() => (method === "smooth" ? bilinearUp(SMALL_MAP) : transposedUp(SMALL_MAP, method === "copy" ? STAMP_COPY : STAMP_LEARNED)), [method]);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const cs = Math.min(46, (w - 2 * PAD - 44) / 8, (h - 190) / 4);
    const x0 = (w - (8 * cs + 44)) / 2, y0 = 48, x1 = x0 + 4 * cs + 44, cb = cs / 2;
    const stepping = method !== "smooth";
    const idx = stepping ? Math.min(15, Math.floor(tt / 0.7) % 19) : 15;
    const ir = Math.floor(idx / 4), ic = idx % 4;
    const amber = (v: number) => (v < 0.02 ? palette.track : `rgba(${palette.accentRgb},${0.12 + 0.88 * Math.min(1, v)})`);

    label(ctx, U.up.small, x0 + 2 * cs, y0 - 16, palette.muted, 11, "center");
    cells(ctx, x0, y0, cs, 4, 4, (r, c) => amber(SMALL_MAP.d[r * 4 + c]), 2);
    for (let i = 0; i < 16; i++) cellText(ctx, SMALL_MAP.d[i].toFixed(1), x0 + (i % 4) * cs, y0 + Math.floor(i / 4) * cs, cs, palette.ink);
    arrow(ctx, x0 + 4 * cs + 8, y0 + 2 * cs, x1 - 8, y0 + 2 * cs, palette.muted);

    label(ctx, U.up.big, x1 + 2 * cs, y0 - 16, palette.muted, 11, "center");
    cells(ctx, x1, y0, cb, 8, 8, (r, c) => {
      const done = !stepping || Math.floor(r / 2) * 4 + Math.floor(c / 2) <= idx;
      return done ? amber(big.d[r * 8 + c]) : palette.track;
    }, 1.5);
    if (cb >= 17) {
      for (let i = 0; i < 64; i++) {
        const r = Math.floor(i / 8), c = i % 8;
        if (!stepping || Math.floor(r / 2) * 4 + Math.floor(c / 2) <= idx) cellText(ctx, big.d[i].toFixed(1), x1 + c * cb, y0 + r * cb, cb * 1.25, palette.ink);
      }
    }
    if (stepping) {
      frame(ctx, x0 + ic * cs, y0 + ir * cs, cs, cs, palette.accent, 2.5);
      frame(ctx, x1 + ic * cs, y0 + ir * cs, cs, cs, palette.accent, 2.5);
    }

    // the 2×2 stamp
    const ky = y0 + 4 * cs + 44, kc = Math.min(34, cs);
    if (stepping) {
      const kern = method === "copy" ? STAMP_COPY : STAMP_LEARNED;
      const kx = w / 2 - kc - 70;
      label(ctx, U.up.kernel, kx + kc, ky - 14, palette.muted, 11, "center");
      cells(ctx, kx, ky, kc, 2, 2, (r, c) => `rgba(${palette.normalRgb},${0.15 + 0.6 * kern[r * 2 + c]})`, 2);
      kern.forEach((v, i) => cellText(ctx, v.toFixed(1), kx + (i % 2) * kc, ky + Math.floor(i / 2) * kc, kc, palette.ink));
      const v = SMALL_MAP.d[idx];
      label(ctx, `${v.toFixed(1)} × ${U.up.kernel}`, kx + 2 * kc + 22, ky + kc * 0.6, palette.ink, 12);
      label(ctx, `→ ${kern.map((kv) => (v * kv).toFixed(2)).join("  ")}`, kx + 2 * kc + 22, ky + kc * 1.4, palette.accent, 12);
    } else {
      label(ctx, "y = (1−a)(1−b)·x₀₀ + a(1−b)·x₀₁ + (1−a)b·x₁₀ + ab·x₁₁", w / 2, ky + 16, palette.muted, 11, "center");
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.up.method}>
          <span>{U.up.method}</span>
          <button type="button" className={method === "copy" ? "on" : ""} onClick={() => setMethod("copy")}>{U.up.copy}</button>
          <button type="button" className={method === "smooth" ? "on" : ""} onClick={() => setMethod("smooth")}>{U.up.smooth}</button>
          <button type="button" className={method === "stamp" ? "on" : ""} onClick={() => setMethod("stamp")}>{U.up.stamp}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · The bridge: "what" from below meets "where" from across         */
/* ------------------------------------------------------------------ */

const FUSION = skipFusion(PHOTO);
const FUSION_IOU = { coarse: iou(FUSION.coarse, TRUTH), fine: iou(FUSION.fine, TRUTH), fused: iou(FUSION.fused, TRUTH) };

export function SkipFuseScene() {
  const [on, setOn] = useState(true);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const gapX = 26, gapY = 60;
    const c = Math.min(8, (w - 2 * PAD - gapX) / (2 * UN), (h - 70 - gapY) / (2 * UN));
    const S = UN * c, x0 = (w - 2 * S - gapX) / 2, y0 = 34, x1 = x0 + S + gapX, y1 = y0 + S + gapY;

    label(ctx, U.photo, x0, y0 - 14, palette.muted, 11);
    drawPhoto(ctx, PHOTO, x0, y0, c);

    label(ctx, U.skip.coarse, x1, y0 - 14, palette.accent, 11);
    drawMask(ctx, FUSION.coarse, x1, y0, c, palette.accentRgb);
    label(ctx, `${U.skip.alone} ${FUSION_IOU.coarse.toFixed(2)}`, x1, y0 + S + 13, palette.muted, 11);

    label(ctx, U.skip.fine, x0, y1 - 14, on ? palette.memory : palette.dotOff, 11);
    drawMask(ctx, FUSION.fine, x0, y1, c, palette.memoryRgb, undefined, on ? 1 : 0.22);
    label(ctx, `${U.skip.alone} ${FUSION_IOU.fine.toFixed(2)}`, x0, y1 + S + 13, on ? palette.muted : palette.dotOff, 11);

    const out = on ? FUSION.fused : FUSION.coarse, score = on ? FUSION_IOU.fused : FUSION_IOU.coarse;
    label(ctx, U.skip.out, x1, y1 - 14, palette.ink, 11);
    drawMask(ctx, out, x1, y1, c, MINT_RGB, TRUTH);
    frame(ctx, x1 - 2, y1 - 2, S + 4, S + 4, palette.ink, 1.5);
    label(ctx, `${U.iou} ${score.toFixed(2)}`, x1, y1 + S + 14, palette.ink, 13);

    // from below (always) and across the bridge (only when it is on)
    arrow(ctx, x1 + S - 14, y0 + S + 6, x1 + S - 14, y1 - 6, palette.accent, 2);
    if (on) arrow(ctx, x0 + S + 3, y1 + S / 2, x1 - 5, y1 + S / 2, palette.memory, 2.5);
    else line(ctx, x0 + S + 3, y1 + S / 2, x1 - 5, y1 + S / 2, palette.dotOff, 1.5, [4, 4]);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.skip.bridge}>
          <span>{U.skip.bridge}</span>
          <button type="button" className={!on ? "on" : ""} onClick={() => setOn(false)}>{U.skip.off}</button>
          <button type="button" className={on ? "on" : ""} onClick={() => setOn(true)}>{U.skip.on}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · The whole U, one stage at a time                                */
/* ------------------------------------------------------------------ */

export function UShapeScene() {
  const [step, setStep] = useState<number | null>(null);
  const stepRef = useRef(0);
  const last = U_NODES.length - 1;

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const s = step ?? Math.min(last, Math.floor(tt / 1.5) % (last + 3));
    stepRef.current = s;
    const hb = (res: number) => 14 + 10.5 * Math.log2(res / 16);
    const wb = (ch: number) => (ch < 64 ? 10 : 16 + 11 * Math.log2(ch / 64));
    const top = 46 + hb(256) / 2, rowGap = (h - 118 - top) / 4;
    const inset = Math.min(46, w * 0.075);
    const X = (i: number) => {
      const n = U_NODES[i];
      if (n.side === "down") return w * 0.17 + n.level * inset;
      if (n.side === "bottom") return w * 0.5;
      if (n.side === "up") return w * 0.83 - n.level * inset - 16;
      return w * 0.83 + 18;
    };
    const Y = (i: number) => top + U_NODES[i].level * rowGap;
    const tone = (i: number) => (i === s ? palette.accent : i < s ? `rgba(${palette.inkRgb},0.6)` : palette.track2);

    // bridges between the two sides at the same height
    for (let lv = 0; lv <= 3; lv++) {
      const a = lv, b = 8 - lv;
      const active = s === b, done = s > b;
      const color = active ? palette.mint : done ? `rgba(${MINT_RGB},0.6)` : palette.dotOff;
      const xa = X(a) + wb(U_NODES[a].ch) / 2 + 4, xb = X(b) - wb(U_NODES[b].ch) / 2 - 5;
      if (active || done) arrow(ctx, xa, Y(a), xb, Y(b), color, active ? 2.5 : 1.5);
      else line(ctx, xa, Y(a), xb, Y(b), color, 1.2, [4, 4]);
    }
    // the main path
    for (let i = 0; i < last; i++) {
      const ha = hb(U_NODES[i].res) / 2, hbn = hb(U_NODES[i + 1].res) / 2;
      const color = i < s ? `rgba(${palette.inkRgb},0.6)` : palette.dotOff;
      if (i < 4) arrow(ctx, X(i), Y(i) + ha + 2, X(i + 1), Y(i + 1) - hbn - 3, color, 1.5);
      else if (i < 8) arrow(ctx, X(i), Y(i) - ha - 2, X(i + 1), Y(i + 1) + hbn + 3, color, 1.5);
      else arrow(ctx, X(i) + wb(U_NODES[i].ch) / 2 + 2, Y(i), X(i + 1) - 7, Y(i + 1), color, 1.5);
    }
    U_NODES.forEach((n, i) => {
      const bw = wb(n.ch), bh = hb(n.res);
      rbox(ctx, X(i) - bw / 2, Y(i) - bh / 2, bw, bh, 3, tone(i), i === s ? palette.accent : null, 1);
      const tc = i <= s ? palette.ink : palette.muted;
      if (n.side === "down") {
        label(ctx, `${n.res}²`, X(i) - bw / 2 - 6, Y(i) - 6, tc, 10, "right");
        label(ctx, `${n.ch}`, X(i) - bw / 2 - 6, Y(i) + 7, palette.accent2, 10, "right");
      } else if (n.side === "bottom") {
        label(ctx, `${n.res}² · ${n.ch}`, X(i), Y(i) + bh / 2 + 11, tc, 10, "center");
      } else if (n.side === "up" && n.level > 0) {
        label(ctx, `${n.res}²`, X(i) + bw / 2 + 6, Y(i) - 6, tc, 10);
        label(ctx, `${n.ch}`, X(i) + bw / 2 + 6, Y(i) + 7, palette.accent2, 10);
      } else {
        label(ctx, `${n.ch}`, X(i), Y(i) + bh / 2 + 11, palette.accent2, 10, "center");
      }
    });
    label(ctx, U.ushape.input, X(0), Y(0) - hb(256) / 2 - 12, palette.muted, 11, "center");
    label(ctx, U.ushape.output, (X(8) + X(last)) / 2, Y(last) - hb(256) / 2 - 12, palette.muted, 11, "center");

    const lines = U.ushape.lines[s];
    label(ctx, `${s + 1} / ${last + 1}`, w / 2, h - 86, palette.muted, 10, "center");
    label(ctx, lines[0], w / 2, h - 62, palette.ink, 13, "center");
    label(ctx, lines[1], w / 2, h - 38, palette.accent, 12, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.ushape.step}>
          <span>{U.ushape.step}</span>
          <button type="button" onClick={() => setStep(Math.max(0, stepRef.current - 1))} aria-label="previous">{U.ushape.prev}</button>
          <button type="button" onClick={() => setStep(Math.min(last, stepRef.current + 1))} aria-label="next">{U.ushape.next}</button>
          <button type="button" className={step === null ? "on" : ""} onClick={() => setStep(null)}>{U.ushape.auto}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · Elastic deformation moves the photo and its mask together       */
/* ------------------------------------------------------------------ */

export function DeformScene() {
  const [seed, setSeed] = useState(1);
  const [strength, setStrength] = useState(2.2);
  const calc = useMemo(() => {
    const wp = makeWarp(seed, strength);
    return { wp, photo: warp(CELLS_PHOTO, wp), mask: threshold(warp(CELLS_TRUTH, wp)) };
  }, [seed, strength]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const n = CELLS_PHOTO.n, gap = 24;
    const c = Math.min(9, (w - 2 * PAD - gap) / (2 * n), (h - 100) / n);
    const S = n * c, x0 = (w - 2 * S - gap) / 2, y0 = Math.max(44, (h - S - 40) / 2), x1 = x0 + S + gap;

    label(ctx, U.augment.original, x0 + S / 2, y0 - 16, palette.muted, 11, "center");
    drawPhoto(ctx, CELLS_PHOTO, x0, y0, c);
    outline(ctx, CELLS_TRUTH, x0, y0, c, palette.mint, 2.5);
    // the pushes applied at the coarse control points
    const k = calc.wp.k;
    for (let a = 0; a < k; a++) for (let b = 0; b < k; b++) {
      const [dy, dx] = calc.wp.pushes[a * k + b];
      const px = x0 + (b / (k - 1)) * (S - c) + c / 2, py = y0 + (a / (k - 1)) * (S - c) + c / 2;
      ctx.fillStyle = palette.accent;
      ctx.beginPath(); ctx.arc(px, py, 2.2, 0, Math.PI * 2); ctx.fill();
      if (Math.hypot(dx, dy) > 0.15) arrow(ctx, px, py, px + dx * c, py + dy * c, palette.accent, 1.5);
    }

    label(ctx, U.augment.warped, x1 + S / 2, y0 - 16, palette.muted, 11, "center");
    drawPhoto(ctx, calc.photo, x1, y0, c);
    outline(ctx, calc.mask, x1, y0, c, palette.mint, 2.5);
    arrow(ctx, x0 + S + 4, y0 + S / 2, x1 - 4, y0 + S / 2, palette.muted);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <button type="button" className="ad-btn" onClick={() => setSeed((v) => v + 1)}>{U.augment.again}</button>
        <label className="ad-ctl">
          <span>{U.augment.strength} <b>{strength.toFixed(1)}</b></span>
          <input type="range" min={0} max={4} step={0.2} value={strength} onChange={(e) => setStrength(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}
