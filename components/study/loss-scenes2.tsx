"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, frame, line, rbox } from "./kit";
import { lossCopy } from "./loss-copy";
import {
  BAD, CROP_CUP, CROP_HEAD, CROP_LEGS, GT, OUT, PAD, READ, big, cropPic, curve, dot, drawBox, drawPicture, fitLabel,
  isPortrait, mapOf, num, pct, plot, ticks,
} from "./loss-draw";
import {
  CAT_BEST, CAT_HARD, LAMBDA_IOU, LAMBDA_L1, LOSS_ROWS, MARGIN, POS, SHIFTS, SMOOTH_EPS, SMOOTH_STEPS,
  WALL, anchorLoss, boxStats, gapStar, isPos, pT, shares, smoothRun, smoothTarget, triplet,
  type Anchor, type Box, type Moment, type TripletState, type V2,
} from "./loss-math";
import { Seg } from "./loss-scenes";

const U = lossCopy.ui;

/* ------------------------------------------------------------------ */
/* 05 · RetinaNet's anchors on the picture: who owns the summed loss     */
/* ------------------------------------------------------------------ */

const MOMENTS: Moment[] = ["init", "mid"];
const GROUP_COL = [OUT, BAD, READ];

export function FocalScene() {
  const [mi, setMi] = useState(0);
  const [ri, setRi] = useState(0);
  const T = U.focal;
  const m = MOMENTS[mi], row = LOSS_ROWS[ri], S = shares(row, m);
  const tracked: [Anchor, string, string][] = [[CAT_BEST, T.best, OUT], [CAT_HARD, T.hard, BAD], [WALL, T.wall, READ]];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const ps = port ? 150 : 230, L = port ? { px: (w - ps) / 2, py: 32, s: ps } : { px: PAD, py: 40, s: ps };
    fitLabel(ctx, T.anchors, L.px, L.py - 14, port ? w - L.px - PAD : L.s + 20, palette.muted, 11);
    drawPicture(ctx, L, { loading: U.loading });
    ctx.save();
    ctx.beginPath(); ctx.rect(L.px, L.py, L.s, L.s); ctx.clip();
    POS.forEach((a) => drawBox(ctx, L, a.b, `rgba(${palette.accentRgb},0.3)`, { lw: 1 }));
    drawBox(ctx, L, CAT_HARD.b, BAD, { lw: 1.8, dash: [5, 3] });
    drawBox(ctx, L, WALL.b, READ, { lw: 1.8, dash: [5, 3] });
    drawBox(ctx, L, CAT_BEST.b, OUT, { lw: 2.6 });
    ctx.restore();

    // three groups: count, sum, share
    const x0 = port ? PAD : L.px + L.s + 24, pw = w - x0 - PAD, y0 = port ? L.py + L.s + 30 : 52, rh = port ? 40 : 52, fs = port ? 12 : 12.5;
    T.groups.forEach((g, k) => {
      const y = y0 + k * rh, n = S.n[k];
      label(ctx, `${g} ${big(n)}${T.count}`, x0, y, n === 0 ? palette.muted : GROUP_COL[k], fs);
      label(ctx, n === 0 ? T.none : `${T.sum} ${S.sum[k] < 1 ? num(S.sum[k], 4) : big(S.sum[k], 1)}`, x0 + pw, y, palette.ink, fs, "right");
      const by = y + 13, bw = pw - 76;
      ctx.fillStyle = palette.track; ctx.fillRect(x0, by, bw, 9);
      ctx.fillStyle = GROUP_COL[k]; ctx.fillRect(x0, by, Math.max(n ? 1 : 0, bw * S.share[k]), 9);
      label(ctx, `${T.share} ${pct(S.share[k], S.share[k] < 0.01 && S.share[k] > 0 ? 2 : 1)}`, x0 + pw, by + 5, palette.ink, 11.5, "right");
    });
    fitLabel(ctx, `${T.total} ${big(S.total, 1)} · ${T.perPos} ${num(S.total / POS.length, 3)}`, x0, y0 + 3 * rh + (port ? 0 : 2), pw, palette.muted, 11.5);

    // the three tracked anchors, then the paper's AP for this loss
    const ay = port ? y0 + 3 * rh + 28 : L.py + L.s + 26, aw = w - 2 * PAD;
    const step = port ? 36 : 21;
    tracked.forEach(([a, nm, col], k) => {
      const pt = pT(a, m), l = anchorLoss(pt, isPos(a), row), nums = `IoU ${num(a.iou, 3)} · p_t ${num(pt, 3)} · ${T.lossOf} ${num(l, l < 0.001 ? 6 : 3)}`;
      if (port) { label(ctx, nm, PAD, ay + k * step, col, 11.5); fitLabel(ctx, nums, PAD + 10, ay + k * step + 16, aw - 10, col, 11.5); }
      else fitLabel(ctx, `${nm} · ${nums}`, PAD, ay + k * step, aw, col, 12);
    });
    const apy = ay + 3 * step + (port ? 0 : 10);
    if (port) {
      label(ctx, `${T.ap} ${row.ap.toFixed(1)}`, PAD, apy, palette.ink, 12);
      fitLabel(ctx, T.apNote, PAD, apy + 19, aw, palette.muted, 11);
    } else {
      fitLabel(ctx, `${T.ap} ${row.ap.toFixed(1)} · ${T.apNote}`, PAD, apy, aw, palette.ink, 12);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <Seg name={T.moment} items={T.moments} value={mi} onPick={setMi} />
        <Seg name={T.loss} items={T.rows} value={ri} onPick={setRi} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · Label smoothing: the score gap with and without a stopping point */
/* ------------------------------------------------------------------ */

const RUNS = SMOOTH_EPS.map((e) => smoothRun(e));

export function SmoothScene() {
  const [ei, setEi] = useState(0);
  const [t, setT] = useState(100);
  const T = U.smooth;
  const eps = SMOOTH_EPS[ei], run = RUNS[ei], s = run[t], q = smoothTarget(eps), star = gapStar(eps);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const px = port ? 40 : 48, py = 40, pw = w - px - PAD - 4, ph = port ? 170 : 170;
    const P = plot(ctx, px, py, pw, ph, [0, SMOOTH_STEPS], [0, 7]);
    label(ctx, T.gap, px, py - 14, palette.ink, 11.5);
    ticks(ctx, P, [0, 100, 200, 300], [0, 2, 4, 6]);
    label(ctx, T.t, px + pw, py + ph + 28, palette.muted, 11, "right");
    const path = (r: typeof run, color: string, lw: number) => curve(ctx, P, (u) => r[Math.round(u)].gap, color, lw, SMOOTH_STEPS);
    path(RUNS[0], ei === 0 ? OUT : "rgba(91,100,116,0.55)", ei === 0 ? 2.2 : 1.6);
    if (ei > 0) path(run, OUT, 2.2);
    if (Number.isFinite(star)) {
      line(ctx, P.x, P.Y(star), P.x + P.w, P.Y(star), GT, 1.2, [5, 4]);
      label(ctx, `${T.stop} ${num(star, 2)}`, P.x + P.w - 4, P.Y(star) - 10, GT, 11.5, "right");
    } else {
      label(ctx, T.noStop, P.x + P.w - 4, P.y + 12, palette.muted, 11.5, "right");
    }
    line(ctx, P.X(t), P.y, P.X(t), P.y + P.h, palette.muted, 1, [4, 4]);
    dot(ctx, P.X(t), P.Y(s.gap), 5.5, OUT);
    label(ctx, num(s.gap, 2), P.X(t) + (t > 220 ? -9 : 9), P.Y(s.gap) + 14, OUT, 12, t > 220 ? "right" : "left");

    // model probabilities against the target
    const by = py + ph + (port ? 70 : 56), rh = port ? 30 : 28, nameW = 58, bw = w - 2 * PAD - nameW - 120;
    label(ctx, `${T.model} · ${T.target}`, PAD, by - 18, palette.muted, 11);
    T.names.forEach((nm, i) => {
      const y = by + i * rh, x = PAD + nameW;
      label(ctx, nm, PAD, y, palette.ink, 12.5);
      ctx.fillStyle = palette.track; ctx.fillRect(x, y - 6, bw, 12);
      ctx.fillStyle = `rgba(${palette.accentRgb},0.8)`; ctx.fillRect(x, y - 6, bw * s.p[i], 12);
      line(ctx, x + bw * q[i], y - 10, x + bw * q[i], y + 10, GT, 2.5);
      label(ctx, `${pct(s.p[i], 2)} · ${pct(q[i], 1)}`, x + bw + 8, y, palette.ink, 12);
    });
    const gy = by + 3 * rh + 12;
    label(ctx, `${T.grad} p − q = ${num(s.g0, 4)}`, PAD, gy, Math.abs(s.g0) < 5e-5 ? GT : palette.ink, port ? 12 : 12.5);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <Seg name={T.eps} items={SMOOTH_EPS.map((e) => String(e))} value={ei} onPick={setEi} />
        <label className="ad-ctl">
          <span>{T.t} <b>{t}</b></span>
          <input type="range" min={0} max={SMOOTH_STEPS} step={1} value={t} onChange={(e) => setT(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · One triplet: what a comparison loss fixes and what it leaves     */
/* ------------------------------------------------------------------ */

const STATES: TripletState[] = ["base", "shift", "double", "far", "point"];

export function PairScene() {
  const [si, setSi] = useState(0);
  const T = U.pair;
  const r = triplet(STATES[si]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const side = port ? Math.min(w - 2 * PAD, 300) : Math.min(h - 60, 296), ox = port ? (w - side) / 2 : PAD, oy = port ? 20 : 34;
    const U0 = -0.8, U1 = 0.8, V0 = -0.45, V1 = 1.15, k = side / (U1 - U0);
    const ky = side / (V1 - V0);                 // the two ranges are equal, so k = ky and circles stay round
    const X = (u: number) => ox + (u - U0) * k, Y = (v: number) => oy + side - (v - V0) * ky;
    rbox(ctx, ox, oy, side, side, 8, "rgba(255,255,255,0.75)", palette.frame, 1);
    line(ctx, X(0), oy + 4, X(0), oy + side - 4, palette.track, 1);
    line(ctx, ox + 4, Y(0), ox + side - 4, Y(0), palette.track, 1);
    const at = (v: V2): [number, number] => [X(v[0]), Y(v[1])];

    // the margin circle around the anchor: distance² = d(a,p)² + α
    const [ax, ay] = at(r.a), rad = Math.sqrt(r.dap + MARGIN);
    ctx.save();
    ctx.beginPath(); ctx.rect(ox, oy, side, side); ctx.clip();
    ctx.strokeStyle = `rgba(${palette.inkRgb},0.35)`; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(ax, ay, rad * k, rad * ky, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    const [pxx, pyy] = at(r.p), [nx, ny] = at(r.n);
    line(ctx, ax, ay, pxx, pyy, GT, 2);
    line(ctx, ax, ay, nx, ny, BAD, 2);

    // thumbnails of the three crops; in "모두 한 점" they share one spot, so fan them out slightly
    const th = port ? 34 : 38, same = STATES[si] === "point";
    const items: [V2, [number, number, number, number], string, number][] = [[r.a, CROP_HEAD, palette.ink, 0], [r.p, CROP_LEGS, GT, 1], [r.n, CROP_CUP, BAD, 2]];
    items.forEach(([v, crop, col, i]) => {
      const [cx, cy] = at(v), dx = same ? (i - 1) * (th + 6) : 0, dy = same ? -th - 10 : 0;
      if (same) line(ctx, cx, cy, cx + dx, cy + dy + th / 2, col, 1);
      cropPic(ctx, crop, cx + dx - th / 2, cy + dy - th / 2, th, th, col, "");
      dot(ctx, cx, cy, 3.5, col);
    });
    // where one step moves each vector: opposite to its gradient
    const ak = port ? 52 : 60;
    if (r.loss > 0) {
      ([[r.a, r.ga], [r.p, r.gp], [r.n, r.gn]] as [V2, V2][]).forEach(([v, g]) => {
        const [cx, cy] = at(v), len = Math.hypot(g[0], g[1]);
        if (len < 1e-9) return;
        arrow(ctx, cx, cy, cx - (g[0] / len) * Math.min(ak, len * ak), cy + (g[1] / len) * Math.min(ak, len * ak), OUT, 2);
      });
    }

    // numbers
    const rx = port ? PAD : ox + side + 24, maxW = port ? w - 2 * PAD : w - rx - PAD, fs = port ? 12 : 12.5;
    let y = port ? oy + side + 22 : 44;
    if (port) {
      fitLabel(ctx, `${T.anchor} · ${T.pos} · ${T.neg}`, rx, y, maxW, palette.muted, 11);
      y += 28;
    } else {
      ([[T.anchor, palette.ink], [T.pos, GT], [T.neg, BAD]] as [string, string][]).forEach(([t, c], i) => label(ctx, t, rx, y + i * 20, c, 11.5));
      y += 3 * 20 + 14;
    }
    label(ctx, `‖a − p‖² = ${num(r.dap, 3)}`, rx, y, GT, fs);
    label(ctx, `‖a − n‖² = ${num(r.dan, 3)}`, rx, y + 22, BAD, fs);
    y += 52;
    const tri = `[${num(r.dap, 3)} − ${num(r.dan, 3)} + ${num(MARGIN)}]₊ = ${num(r.loss, 3)}`;
    if (port) { fitLabel(ctx, `${T.tri} ${tri}`, rx, y, maxW, OUT, fs); y += 24; }
    else { label(ctx, T.tri, rx, y, OUT, 11.5); fitLabel(ctx, tri, rx, y + 20, maxW, OUT, fs); y += 46; }
    fitLabel(ctx, `${T.pull} ${num(r.pull, 3)}`, rx, y, maxW, palette.muted, fs);
    y += 28;
    const gp = `∂L/∂p = [${r.gp.map((v) => num(v, 2)).join(", ")}]`, gn = `∂L/∂n = [${r.gn.map((v) => num(v, 2)).join(", ")}]`;
    if (r.loss <= 0) { label(ctx, T.zero, rx, y, palette.muted, fs); y += 24; }
    else if (port) { fitLabel(ctx, `${gp} · ${gn}`, rx, y, maxW, palette.ink, 11.5); y += 24; }
    else { label(ctx, gp, rx, y, palette.ink, 12); label(ctx, gn, rx, y + 20, palette.ink, 12); y += 44; }
    label(ctx, T.margin, rx, y + 4, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <Seg name={T.state} items={T.states} value={si} onPick={setSi} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · Several losses in one sum                                       */
/* ------------------------------------------------------------------ */

export function SumScene() {
  const [oi, setOi] = useState(0);
  const [ki, setKi] = useState(0);
  const [fi, setFi] = useState(0);
  const T = U.sum;
  const obj = oi === 0 ? "cat" : "cup", k = ki + 1, f = fi === 0 ? SHIFTS.near : SHIFTS.apart, b = boxStats(obj, f, k);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const ps = port ? 170 : 210, L = port ? { px: (w - ps) / 2, py: 30, s: ps } : { px: PAD, py: 48, s: ps };
    label(ctx, `${T.scale} ${160 * k} × ${160 * k}`, L.px, L.py - 14, palette.muted, 11);
    drawPicture(ctx, L, { loading: U.loading });
    const gt = b.gt.map((v) => v / k) as Box, pred = b.pred.map((v) => v / k) as Box;
    ctx.save();
    ctx.beginPath(); ctx.rect(L.px, L.py, L.s, L.s); ctx.clip();
    if (b.iou === 0) {
      // C, the smallest box around both (drawn a little outside so its edges show), and the part of C neither box covers
      const C: Box = [Math.min(gt[0], pred[0]), Math.min(gt[1], pred[1]), Math.max(gt[2], pred[2]), Math.max(gt[3], pred[3])];
      const mm = mapOf(L), g0 = Math.min(gt[2], pred[2]), g1 = Math.max(gt[0], pred[0]);
      ctx.fillStyle = `rgba(${palette.anomalyRgb},0.2)`;
      ctx.fillRect(mm.X(g0), mm.Y(C[1]), mm.X(g1) - mm.X(g0), mm.Y(C[3]) - mm.Y(C[1]));
      frame(ctx, mm.X(C[0]) - 4, mm.Y(C[1]) - 4, mm.X(C[2]) - mm.X(C[0]) + 8, mm.Y(C[3]) - mm.Y(C[1]) + 8, palette.muted, 1.2, [4, 4]);
    }
    drawBox(ctx, L, gt, GT, { lw: 2 });
    drawBox(ctx, L, pred, OUT, { lw: 2.4 });
    ctx.restore();
    const m = mapOf(L);
    if (pred[2] > 160) label(ctx, "→", m.X(160) - 6, m.Y((pred[1] + pred[3]) / 2), OUT, 14, "right");

    // the table
    const x0 = port ? PAD : L.px + L.s + 24, pw = w - x0 - PAD, y0 = port ? L.py + L.s + 28 : 50, rh = port ? 21 : 23, fs = port ? 12 : 12.5;
    const rows: [string, string, string][] = [
      ["L1 픽셀", num(b.l1px, 2), palette.muted],
      ["L1 ÷ 그림 크기", num(b.l1n, 4), palette.ink],
      ["IoU", num(b.iou, 3), READ],
      ["GIoU", num(b.giou, 3), READ],
      [`${T.name} −ln p`, num(b.name, 3), palette.ink],
      [`${T.l1} = ${LAMBDA_L1} × ${num(b.l1n, 4)}`, num(LAMBDA_L1 * b.l1n, 3), palette.ink],
      [`${T.giou}`, num(LAMBDA_IOU * (1 - b.giou), 3), palette.ink],
      [T.total, num(b.total, 3), OUT],
    ];
    rows.forEach(([a, v, c], i) => {
      const y = y0 + i * rh + (i >= 4 ? 8 : 0) + (i === 7 ? 4 : 0);
      if (i === 7) line(ctx, x0, y - rh / 2 - 1, x0 + pw, y - rh / 2 - 1, palette.frame, 1);
      fitLabel(ctx, a, x0, y, pw - 70, c, fs);
      label(ctx, v, x0 + pw, y, c, fs, "right");
    });
    // shares of the sum
    const sy = y0 + 8 * rh + 22, parts = [b.name, LAMBDA_L1 * b.l1n, LAMBDA_IOU * (1 - b.giou)], cols = [OUT, READ, GT];
    let cx = x0;
    parts.forEach((v, i) => { const ww = (v / b.total) * pw; ctx.fillStyle = cols[i]; ctx.fillRect(cx, sy, ww, 12); cx += ww; });
    const names = [T.name, "L1", "GIoU"];
    fitLabel(ctx, parts.map((v, i) => `${names[i]} ${pct(v / b.total, 0)}`).join(" · "), x0, sy + 26, pw, palette.muted, 11);
    fitLabel(ctx, `${T.px} ${num(b.totalPx, 2)}`, x0, sy + 46, pw, BAD, 11.5);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <Seg name={T.obj} items={T.objs} value={oi} onPick={setOi} />
        <Seg name={T.scale} items={T.scales} value={ki} onPick={setKi} />
        <Seg name={T.shift} items={T.shifts} value={fi} onPick={setFi} />
      </div>
    </div>
  );
}

