"use client";

import { useMemo, useState } from "react";
import { clamp, drawGrid, label, palette, rng, useCanvas } from "@/components/anomaly/lib";
import { cnnCopy } from "./cnn-copy";
import { CAT_IMG, CORNER_RULES, KERNELS, PLUS, SHAPES, conv, grid, maxOf, pool, receptiveField, runTinyNet, type Grid } from "./cnn-math";
import { act, arrow, bar, cellText, cells, frame, gray, line, type Ctx } from "./kit";

const U = cnnCopy.ui;
const PAD = 18;
const isPortrait = (w: number, h: number) => h > w * 1.15;

/* ------------------------------------------------------------------ */
/* 04 · One fully connected neuron vs one shared 3×3 kernel            */
/* ------------------------------------------------------------------ */

const HOME: [number, number] = [3, 3];
const TOUR: [number, number][] = [[3, 3], [3, 4], [3, 6], [5, 6], [6, 2], [1, 1]];
const stamp = (p: [number, number]) =>
  grid(10, (r, c) => {
    const u = r - p[0], v = c - p[1];
    return u >= 0 && v >= 0 && u < 3 && v < 3 ? PLUS[u * 3 + v] : 0;
  });
const TEMPLATE = stamp(HOME);

export function WhyConvScene() {
  const [pos, setPos] = useState<[number, number]>(HOME);
  const [auto, setAuto] = useState(true);
  const move = (dr: number, dc: number) => {
    setAuto(false);
    setPos(([r, c]) => [clamp(r + dr, 0, 7), clamp(c + dc, 0, 7)]);
  };

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const p = auto ? TOUR[Math.floor(tt / 1.5) % TOUR.length] : pos;
    const img = stamp(p);
    const fcOut = img.d.reduce((s, v, i) => s + v * TEMPLATE.d[i], 0);
    const resp = conv(img, PLUS);
    const best = maxOf(resp);
    const bi = resp.d.indexOf(best);
    const portrait = isPortrait(w, h);

    let cL: number, ix: number, iy: number;
    let panels: { x: number; y: number; pw: number; ph: number }[];
    if (portrait) {
      cL = Math.min(18, (w - 2 * PAD) / 10, (h * 0.34) / 10);
      ix = (w - 10 * cL) / 2; iy = 34;
      const py = iy + 10 * cL + 38, pw = (w - 2 * PAD - 16) / 2, ph = h - py - 16;
      panels = [{ x: PAD, y: py, pw, ph }, { x: PAD + pw + 16, y: py, pw, ph }];
    } else {
      cL = Math.min(22, (w * 0.42 - PAD) / 10, (h - 90) / 10);
      ix = PAD + 4; iy = (h - 10 * cL) / 2;
      const px = ix + 10 * cL + 30, pw = w - px - PAD, ph = (h - 56) / 2;
      panels = [{ x: px, y: 28, pw, ph }, { x: px, y: 28 + ph + 8, pw, ph }];
    }

    // input
    label(ctx, U.why.input, ix + 5 * cL, iy - 14, palette.muted, 11, "center");
    cells(ctx, ix, iy, cL, 10, 10, (r, c) => gray(0.08 + 0.86 * img.d[r * 10 + c]));
    frame(ctx, ix + p[1] * cL, iy + p[0] * cL, 3 * cL, 3 * cL, palette.accent, 2);

    // panel A: one fully connected neuron, weights fixed at the home position
    {
      const { x, y, pw, ph } = panels[0];
      const ct = Math.min(15, pw / 10, (ph - 66) / 10);
      label(ctx, U.why.fc, x, y + 6, palette.ink, 11);
      const gy = y + 20;
      cells(ctx, x, gy, ct, 10, 10, (r, c) => {
        const wv = TEMPLATE.d[r * 10 + c], xv = img.d[r * 10 + c];
        if (wv && xv) return palette.accent;
        if (wv) return `rgba(${palette.normalRgb},0.75)`;
        return palette.track;
      });
      for (let i = 0; i < 100; i++) if (img.d[i] && !TEMPLATE.d[i]) frame(ctx, x + (i % 10) * ct + 1, gy + Math.floor(i / 10) * ct + 1, ct - 2, ct - 2, palette.ink, 1);
      const by = gy + 10 * ct + 12;
      bar(ctx, x, by, Math.min(pw, 10 * ct), 8, fcOut / 5, fcOut >= 5 ? palette.mint : palette.anomaly);
      label(ctx, `${U.why.fcOut} ${fcOut} / 5`, x, by + 20, fcOut >= 5 ? palette.mint : palette.anomaly, 12);
    }
    // panel B: one 3×3 kernel reused at every position
    {
      const { x, y, pw, ph } = panels[1];
      const ct = Math.min(15, (pw - 14) / (8 + 3 * 1.3), (ph - 66) / 10);
      const ck = ct * 1.3;
      label(ctx, U.why.conv, x, y + 6, palette.ink, 11);
      const gy = y + 20;
      cells(ctx, x, gy, ck, 3, 3, (r, c) => (PLUS[r * 3 + c] ? `rgba(${palette.normalRgb},0.75)` : palette.track));
      const mx = x + 3 * ck + 14;
      cells(ctx, mx, gy, ct, 8, 8, (r, c) => act(resp.d[r * 8 + c], 5));
      frame(ctx, mx + (bi % 8) * ct, gy + Math.floor(bi / 8) * ct, ct, ct, palette.accent, 2);
      label(ctx, U.why.map, mx, gy + 8 * ct + 10, palette.muted, 11);
      const by = gy + 10 * ct + 12;
      bar(ctx, x, by, Math.min(pw, 3 * ck + 14 + 8 * ct), 8, best / 5, palette.mint);
      label(ctx, `${U.why.convOut} ${best} / 5`, x, by + 20, palette.mint, 12);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.why.move}>
          <span>{U.why.move}</span>
          <button type="button" onClick={() => move(0, -1)} aria-label="left">←</button>
          <button type="button" onClick={() => move(-1, 0)} aria-label="up">↑</button>
          <button type="button" onClick={() => move(1, 0)} aria-label="down">↓</button>
          <button type="button" onClick={() => move(0, 1)} aria-label="right">→</button>
          <button type="button" className={auto ? "on" : ""} onClick={() => setAuto((a) => !a)}>{U.why.auto}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · Stride and padding set the output size                         */
/* ------------------------------------------------------------------ */

const SIMG = CAT_IMG;   // the 9×9 cat of section 01
const SN = SIMG.n, SM = SN + 2, SO = SN;   // picture side, side with padding, largest output side
const BLUR = [...KERNELS.blur];

export function StridePadScene() {
  const [s, setS] = useState(1);
  const [p, setP] = useState(0);
  const out = useMemo(() => conv(SIMG, BLUR, s, p), [s, p]);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const N = SN, M = N + 2 * p, O = out.n;
    const step = Math.floor(tt * 2.4) % (O * O + 3);
    const idx = Math.min(step, O * O - 1);
    const r0 = Math.floor(idx / O), c0 = idx % O;
    const c = Math.min(28, (w - 2 * PAD - 40) / (SM + SO), (h - 150) / SM);
    const ax = (w - ((SM + SO) * c + 40)) / 2, ay = 44;
    const ix = ax + ((SM - M) / 2) * c, iy = ay + ((SM - M) / 2) * c;

    label(ctx, `${U.stride.input} ${N}×${N}${p ? "  +  padding 1" : ""}`, ax + (SM / 2) * c, ay - 16, palette.muted, 11, "center");
    for (let r = 0; r < M; r++) for (let cc = 0; cc < M; cc++) {
      const y = r - p, x = cc - p;
      const inside = y >= 0 && x >= 0 && y < N && x < N;
      if (inside) {
        ctx.fillStyle = gray(SIMG.d[y * N + x]);
        ctx.fillRect(ix + cc * c + 0.5, iy + r * c + 0.5, c - 1, c - 1);
      } else {
        frame(ctx, ix + cc * c + 1.5, iy + r * c + 1.5, c - 3, c - 3, palette.dotOff, 1, [3, 3]);
        cellText(ctx, U.stride.zero, ix + cc * c, iy + r * c, c, palette.muted);
      }
    }
    frame(ctx, ix + c0 * s * c, iy + r0 * s * c, 3 * c, 3 * c, palette.accent, 2.5);

    const ox = ax + SM * c + 40 + ((SO - O) / 2) * c, oy = ay + ((SM - O) / 2) * c;
    label(ctx, `${U.stride.output} ${O}×${O}`, ax + SM * c + 40 + (SO / 2) * c, ay - 16, palette.muted, 11, "center");
    cells(ctx, ox, oy, c, O, O, (r, cc) => (r * O + cc <= step ? gray(out.d[r * O + cc]) : palette.track));
    frame(ctx, ox + c0 * c, oy + r0 * c, c, c, palette.accent, 2.5);
    arrow(ctx, ax + SM * c + 8, ay + (SM / 2) * c, ax + SM * c + 32, ay + (SM / 2) * c, palette.muted);

    const ty = ay + SM * c + 30;
    label(ctx, `O = ⌊(${N} + 2·${p} − 3) / ${s}⌋ + 1 = ${O}`, w / 2, ty, palette.ink, 13, "center");
    label(ctx, `${N}×${N}  →  ${O}×${O}`, w / 2, ty + 24, palette.accent, 13, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.stride.pad}>
          <span>{U.stride.pad}</span>
          {[0, 1].map((v) => <button key={v} type="button" className={p === v ? "on" : ""} onClick={() => setP(v)}>{v}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.stride.stride}>
          <span>{U.stride.stride}</span>
          {[1, 2].map((v) => <button key={v} type="button" className={s === v ? "on" : ""} onClick={() => setS(v)}>{v}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · Receptive field grows with depth, faster after a stride        */
/* ------------------------------------------------------------------ */

export function ReceptiveFieldScene() {
  const [L, setL] = useState(3);
  const [s2, setS2] = useState(false);
  const info = useMemo(() => {
    const strides = Array.from({ length: L }, (_, l) => (s2 && l === 1 ? 2 : 1));
    const rf = receptiveField(strides);
    const jump = [1, ...rf.map((v) => v.jump)];          // spacing of layer-l units, in input cells
    const hw = new Array<number>(L + 1).fill(0);         // half-width of the cone at layer l, in input cells
    for (let l = L; l >= 1; l--) hw[l - 1] = hw[l] + jump[l - 1];
    return { jump, hw, r: 2 * hw[0] + 1 };
  }, [L, s2]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const W = 21, mid = 10;
    const portrait = isPortrait(w, h);
    const coneW = portrait ? w - 2 * PAD - 30 : w * 0.58 - PAD - 30;
    const cw = coneW / W;
    const rowH = portrait ? 27 : Math.min(58, (h - 130) / 5);
    const cx0 = PAD + 30;
    const baseY = portrait ? 46 + 5 * rowH : (h + 5 * rowH) / 2;
    const u = Math.min(cw - 2, 14);
    const xOf = (x: number) => cx0 + (x + 0.5) * cw;
    const yOf = (l: number) => baseY - l * rowH;
    const { jump, hw, r } = info;

    for (let l = L; l >= 1; l--) {
      for (let x = mid - hw[l]; x <= mid + hw[l]; x += jump[l]) {
        for (const d of [-1, 0, 1]) line(ctx, xOf(x), yOf(l) + u / 2, xOf(x + d * jump[l - 1]), yOf(l - 1) - u / 2, `rgba(${palette.accentRgb},0.35)`, 1);
      }
    }
    for (let l = 0; l <= L; l++) {
      label(ctx, l === 0 ? U.rf.input : `${l}${U.rf.layer}`, PAD, yOf(l), palette.muted, 11);
      for (let m = -mid; m <= mid; m++) {
        const x = mid + m * jump[l];
        if (x < 0 || x >= W) continue;
        const on = Math.abs(x - mid) <= hw[l];
        ctx.fillStyle = l === L && x === mid ? palette.ink : on ? `rgba(${palette.accentRgb},0.9)` : palette.track2;
        ctx.fillRect(xOf(x) - u / 2, yOf(l) - u / 2, u, u);
      }
    }

    const fc = portrait ? Math.min(cw, (h - baseY - 76) / W) : Math.min((w * 0.42 - PAD - 10) / W, (h - 120) / W);
    const fx = portrait ? (w - W * fc) / 2 : w * 0.58 + 10, fy = portrait ? baseY + 34 : (h - W * fc) / 2;
    cells(ctx, fx, fy, fc, W, W, (rr, cc) => {
      if (rr === mid && cc === mid) return palette.ink;
      return Math.abs(rr - mid) <= hw[0] && Math.abs(cc - mid) <= hw[0] ? `rgba(${palette.accentRgb},0.8)` : palette.track2;
    });
    label(ctx, `${U.rf.sees}: ${r} × ${r} ${U.rf.cells}`, fx + (W * fc) / 2, fy + W * fc + 16, palette.accent, 12, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.rf.layers} <b>{L}</b></span>
          <input type="range" min={1} max={5} step={1} value={L} onChange={(e) => setL(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.rf.stride2}>
          <span>{U.rf.stride2}</span>
          <button type="button" className={!s2 ? "on" : ""} onClick={() => setS2(false)}>{U.rf.off}</button>
          <button type="button" className={s2 ? "on" : ""} onClick={() => setS2(true)}>{U.rf.on}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · Pooling keeps "was it here" and drops "exactly where"          */
/* ------------------------------------------------------------------ */

const PBG: Grid = (() => {
  const r = rng(11);
  return grid(8, () => r() * 0.22);
})();
const PTOUR: [number, number][] = [[2, 2], [2, 3], [3, 3], [3, 2], [3, 4], [2, 4], [5, 5], [4, 4]];

export function PoolScene() {
  const [pos, setPos] = useState<[number, number]>([2, 2]);
  const [auto, setAuto] = useState(true);
  const [mode, setMode] = useState<"max" | "avg">("max");
  const move = (dr: number, dc: number) => {
    setAuto(false);
    setPos(([r, c]) => [clamp(r + dr, 0, 7), clamp(c + dc, 0, 7)]);
  };

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const p = auto ? PTOUR[Math.floor(tt / 1.3) % PTOUR.length] : pos;
    const img = grid(8, (r, c) => (r === p[0] && c === p[1] ? 1 : PBG.d[r * 8 + c]));
    const out = pool(img, mode);
    const R = Math.floor(p[0] / 2), C = Math.floor(p[1] / 2);
    const c = Math.min(28, (w - 2 * PAD - 44) / 16, (h - 150) / 8);
    const x0 = (w - (16 * c + 44)) / 2, y0 = 46;
    const ox = x0 + 8 * c + 44;

    label(ctx, U.pool.input, x0 + 4 * c, y0 - 16, palette.muted, 11, "center");
    cells(ctx, x0, y0, c, 8, 8, (r, cc) => act(img.d[r * 8 + cc], 1));
    for (let i = 0; i <= 4; i++) {
      line(ctx, x0 + i * 2 * c, y0, x0 + i * 2 * c, y0 + 8 * c, palette.frame, 1);
      line(ctx, x0, y0 + i * 2 * c, x0 + 8 * c, y0 + i * 2 * c, palette.frame, 1);
    }
    for (const [dr, dc] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
      const r = 2 * R + dr, cc = 2 * C + dc;
      if (r !== p[0] || cc !== p[1]) frame(ctx, x0 + cc * c + 3, y0 + r * c + 3, c - 6, c - 6, palette.mint, 1, [3, 3]);
    }
    frame(ctx, x0 + 2 * C * c, y0 + 2 * R * c, 2 * c, 2 * c, palette.accent, 2.5);

    label(ctx, U.pool.output, ox + 4 * c, y0 - 16, palette.muted, 11, "center");
    cells(ctx, ox, y0, 2 * c, 4, 4, (r, cc) => act(out.d[r * 4 + cc], 1), 2);
    for (let i = 0; i < 16; i++) cellText(ctx, out.d[i].toFixed(2), ox + (i % 4) * 2 * c, y0 + Math.floor(i / 4) * 2 * c, 2 * c * 0.8, palette.ink);
    frame(ctx, ox + C * 2 * c, y0 + R * 2 * c, 2 * c, 2 * c, palette.accent, 2.5);
    arrow(ctx, x0 + 8 * c + 8, y0 + 4 * c, ox - 8, y0 + 4 * c, palette.muted);

    const ty = y0 + 8 * c + 30;
    label(ctx, `${U.pool.at} ${p[0] + 1}${U.board.row} ${p[1] + 1}${U.board.col}  →  ${U.pool.out} ${R + 1}${U.board.row} ${C + 1}${U.board.col} = ${out.d[R * 4 + C].toFixed(2)}`, w / 2, ty, palette.ink, 12, "center");
    label(ctx, U.pool.same, w / 2, ty + 22, palette.mint, 12, "center");
    label(ctx, "8×8 = 64  →  4×4 = 16", w / 2, ty + 44, palette.muted, 12, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.pool.move}>
          <span>{U.pool.move}</span>
          <button type="button" onClick={() => move(0, -1)} aria-label="left">←</button>
          <button type="button" onClick={() => move(-1, 0)} aria-label="up">↑</button>
          <button type="button" onClick={() => move(1, 0)} aria-label="down">↓</button>
          <button type="button" onClick={() => move(0, 1)} aria-label="right">→</button>
          <button type="button" className={auto ? "on" : ""} onClick={() => setAuto((a) => !a)}>{U.pool.auto}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.pool.mode}>
          <span>{U.pool.mode}</span>
          <button type="button" className={mode === "max" ? "on" : ""} onClick={() => setMode("max")}>{U.pool.max}</button>
          <button type="button" className={mode === "avg" ? "on" : ""} onClick={() => setMode("avg")}>{U.pool.avg}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 · Edges combine into corners (a hand-built two-layer network)    */
/* ------------------------------------------------------------------ */

function drawMap(ctx: Ctx, g: Grid, x: number, y: number, cell: number, max: number, name: string, on: boolean) {
  cells(ctx, x, y, cell, g.n, g.n, (r, c) => act(g.d[r * g.n + c], max), cell > 5 ? 1 : 0.5);
  frame(ctx, x - 1, y - 1, g.n * cell + 2, g.n * cell + 2, on ? palette.accent : palette.frame, on ? 2.5 : 1);
  label(ctx, name, x + (g.n * cell) / 2, y + g.n * cell + 10, on ? palette.accent : palette.muted, 11, "center");
}

const SHAPE_KEYS = ["box", "vstripes", "hstripes"] as const;

export function HierarchyScene() {
  const [shape, setShape] = useState<(typeof SHAPE_KEYS)[number]>("box");
  const [corner, setCorner] = useState(0);
  const [auto, setAuto] = useState(true);
  const net = useMemo(() => runTinyNet(SHAPES[shape]), [shape]);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const k = auto ? Math.floor(tt / 1.8) % 4 : corner;
    const [ea, , , eb] = CORNER_RULES[k];
    const gap = 8;
    const c = Math.min(14, (w - 2 * PAD) / 12, (h * 0.26) / 12);
    const ix = (w - 12 * c) / 2, iy = 34;
    const c1 = Math.min(10, (w - 2 * PAD - 3 * gap) / 40, (h - (iy + 12 * c) - 150) / 20);
    const rowW = 40 * c1 + 3 * gap, rx = (w - rowW) / 2;
    const y1 = iy + 12 * c + 44, y2 = y1 + 10 * c1 + 50;
    const pos1 = (i: number): [number, number] => [rx + i * (10 * c1 + gap), y1];
    const pos2 = (i: number): [number, number] => [rx + i * (10 * c1 + gap), y2];
    const head1: [number, number] = [w / 2, y1 - 16], head2: [number, number] = [w / 2, y2 - 16];

    label(ctx, U.net.input, ix + 6 * c, iy - 14, palette.muted, 11, "center");
    cells(ctx, ix, iy, c, 12, 12, (r, cc) => gray(0.08 + 0.86 * net.input.d[r * 12 + cc]));
    label(ctx, U.net.layer1, head1[0], head1[1], palette.ink, 11, "center");
    label(ctx, U.net.layer2, head2[0], head2[1], palette.ink, 11, "center");

    // the two edge maps that feed the selected corner unit
    const [tx, ty] = pos2(k);
    for (const e of [ea, eb]) {
      const [sx, sy] = pos1(e);
      line(ctx, sx + 5 * c1, sy + 5 * c1, tx + 5 * c1, ty + 5 * c1, `rgba(${palette.accentRgb},0.45)`, 1.5);
    }
    net.edges.forEach((g, i) => { const [x, y] = pos1(i); drawMap(ctx, g, x, y, c1, 1, U.net.edges[i], i === ea || i === eb); });
    net.corners.forEach((g, i) => { const [x, y] = pos2(i); drawMap(ctx, g, x, y, c1, 0.8, U.net.corners[i], i === k); });

    label(ctx, `${U.net.corners[k]} = ${U.net.edges[ea]} + ${U.net.edges[eb]} − 1.2`, w / 2, h - 18, palette.accent, 12, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.net.shape}>
          <span>{U.net.shape}</span>
          {SHAPE_KEYS.map((s, i) => <button key={s} type="button" className={shape === s ? "on" : ""} onClick={() => setShape(s)}>{U.net.shapes[i]}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.net.corner}>
          <span>{U.net.corner}</span>
          {U.net.cornersShort.map((s, i) => <button key={s} type="button" className={!auto && corner === i ? "on" : ""} onClick={() => { setAuto(false); setCorner(i); }}>{s}</button>)}
          <button type="button" className={auto ? "on" : ""} onClick={() => setAuto(true)}>{U.net.auto}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10 · From maps to one answer: average, linear layer, softmax        */
/* ------------------------------------------------------------------ */

const PIPE_KEYS = ["vstripes", "hstripes", "box", "boxMoved"] as const;

export function PipelineScene() {
  const [si, setSi] = useState(2);
  const net = useMemo(() => runTinyNet(SHAPES[PIPE_KEYS[si]]), [si]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const gap = 6;
    const c = Math.min(10, (w * 0.32) / 12);
    const c1 = Math.min(6.5, (w - 2 * PAD - 12 * c - 22 - 3 * gap) / 40);
    const rowW = 12 * c + 22 + 40 * c1 + 3 * gap;
    const ix = (w - rowW) / 2, iy = 34;
    const mx = ix + 12 * c + 22;
    const maps = [...net.edges, ...net.corners];
    const names = [...U.net.edges, ...U.net.corners];

    label(ctx, U.net.input, ix + 6 * c, iy - 14, palette.muted, 11, "center");
    cells(ctx, ix, iy, c, 12, 12, (r, cc) => gray(0.08 + 0.86 * net.input.d[r * 12 + cc]));
    maps.forEach((g, i) => {
      const x = mx + (i % 4) * (10 * c1 + gap), y = iy + Math.floor(i / 4) * (10 * c1 + gap + 2);
      cells(ctx, x, y, c1, 10, 10, (r, cc) => act(g.d[r * 10 + cc], i < 4 ? 1 : 0.8), 0.5);
      frame(ctx, x - 1, y - 1, 10 * c1 + 2, 10 * c1 + 2, i < 4 ? palette.frame : `rgba(124,58,237,0.5)`, 1);
    });
    const row1Bottom = iy + Math.max(12 * c, 20 * c1 + gap + 2);

    // global averages
    const gx = portrait ? PAD : PAD, gw = portrait ? w - 2 * PAD : w / 2 - PAD - 12;
    const gy = row1Bottom + 36;
    label(ctx, U.net.gap, gx, gy - 16, palette.ink, 11);
    const nameW = 78, rh = 17;
    net.features.forEach((f, i) => {
      const y = gy + i * rh;
      label(ctx, names[i], gx, y + 5, palette.muted, 11);
      bar(ctx, gx + nameW, y + 1, gw - nameW - 38, 8, f / 6, i < 4 ? palette.accent : palette.accent2);
      label(ctx, f.toFixed(2), gx + gw, y + 5, palette.ink, 11, "right");
    });

    // class scores and probabilities
    const sx = portrait ? PAD : w / 2 + 12, sw = portrait ? w - 2 * PAD : w / 2 - PAD - 12;
    const sy = portrait ? gy + 8 * rh + 34 : gy;
    label(ctx, U.net.scores, sx, sy - 16, palette.ink, 11);
    const win = net.probs.indexOf(Math.max(...net.probs));
    net.probs.forEach((pr, i) => {
      const y = sy + i * 30;
      label(ctx, U.net.classes[i], sx, y + 6, i === win ? palette.ink : palette.muted, 12);
      bar(ctx, sx + 56, y, sw - 56 - 104, 12, pr, i === win ? palette.mint : palette.dotOff);
      label(ctx, `${net.scores[i].toFixed(1)} → ${(pr * 100).toFixed(0)}%`, sx + sw, y + 6, i === win ? palette.mint : palette.muted, 11, "right");
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.net.shape}>
          <span>{U.net.shape}</span>
          {PIPE_KEYS.map((s, i) => <button key={s} type="button" className={si === i ? "on" : ""} onClick={() => setSi(i)}>{U.net.shapes4[i]}</button>)}
        </div>
      </div>
    </div>
  );
}
