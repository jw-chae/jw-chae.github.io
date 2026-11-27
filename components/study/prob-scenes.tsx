"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { bar, line, rbox, type Ctx } from "./kit";
import { probCopy } from "./prob-copy";
import { PAD, catGrid, cnt, fix, isPortrait, num, partColor, pc, swatch, tag, useCatImage } from "./prob-draw";
import {
  CAT_CELLS, CELLS, DARK, DRAWS_ALL, DRAWS_CAT, FACTORY_DEFAULT, FA_STEPS, N, PART16, PARTS, PART_COUNT, Q_HAND, RATE_STEPS, RECALL_STEPS,
  SHARE_ALL, SHARE_CAT, TH_STEPS, Z_DARK, catTree, cond, expOf, factory, isDark, joint, softmax, tally, tweak, type Tweak,
} from "./prob-math";

const U = probCopy.ui;
const NAMES = PARTS.map((p) => U.parts[p]);
const BLUE = palette.normal, AMBER = palette.accent;
const BLUE_SOFT = `rgba(${palette.normalRgb},0.16)`, AMBER_SOFT = `rgba(${palette.accentRgb},0.5)`;

/* ------------------------------------------------------------------ */
/* 01 · a distribution: shares of the 256 cells                         */
/* ------------------------------------------------------------------ */

const DRAW_STEPS = [0, 10, 100, 1000];

export function DistScene() {
  const [catOnly, setCatOnly] = useState(false);
  const [k, setK] = useState(0);
  const T = U.dist;
  const img = useCatImage();

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const S = port ? Math.min(w - 2 * PAD, h - 270) : Math.min(h - 84, w - 2 * PAD - 250);
    const gx = port ? (w - S) / 2 : PAD, gy = 40, c = S / N;
    label(ctx, catOnly ? `${T.cat}: ${CAT_CELLS.length}${T.cells}` : `${T.all}: ${CELLS.length}${T.cells}`, PAD, 20, palette.ink, 13);
    if (k > 0) label(ctx, `${k}${T.drawn}`, w - PAD, 20, AMBER, 12, "right");

    catGrid(ctx, img.current, gx, gy, S, { mode: "parts", veil: catOnly ? (r, cc) => PART16[r][cc] === "bg" : undefined });
    // the drawn cells, while there are few enough to see one by one
    if (k > 0 && k <= 10) {
      const seq = catOnly ? DRAWS_CAT : DRAWS_ALL, list = catOnly ? CAT_CELLS : CELLS, hits = new Map<number, number>();
      for (let i = 0; i < k; i++) { const cell = list[seq[i]], key = cell.r * N + cell.c; hits.set(key, (hits.get(key) ?? 0) + 1); }
      hits.forEach((n, key) => {
        const cx = gx + ((key % N) + 0.5) * c, cy = gy + (Math.floor(key / N) + 0.5) * c;
        ctx.fillStyle = AMBER; ctx.beginPath(); ctx.arc(cx, cy, Math.max(4, c * 0.3), 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.stroke();
        if (n > 1) label(ctx, `${n}`, cx, cy + 0.5, "#ffffff", 11, "center");
      });
    }

    // one bar per part: the counted share, and the share found by drawing
    const shares = catOnly ? SHARE_CAT : SHARE_ALL, got = k > 0 ? tally(k, catOnly) : null;
    const bx = port ? PAD : gx + S + 22, by = port ? gy + S + 30 : gy + 10, bw = w - PAD - bx;
    const rowH = port ? 25 : 36, nameW = port ? 74 : 76, pctW = 52, barW = bw - nameW - pctW;
    label(ctx, T.share, bx + nameW, by - 12, palette.muted, 11);
    PARTS.forEach((p, i) => {
      const y = by + i * rowH + rowH / 2;
      swatch(ctx, bx, y, 11, partColor(i));
      label(ctx, NAMES[i], bx + 16, y, catOnly && p === "bg" ? palette.muted : palette.ink, 12);
      bar(ctx, bx + nameW, y - 7, barW, 14, shares[i], partColor(i));
      if (got) {
        const tx = bx + nameW + barW * (got[i] / k);
        ctx.fillStyle = palette.ink; ctx.fillRect(tx - 1, y - 11, 2.5, 22);
      }
      label(ctx, pc(shares[i]), w - PAD, y, palette.ink, 12, "right");
    });

    // what stays: the ratio between two cat parts
    const fy = port ? by + 6 * rowH + 18 : gy + S + 28;
    const fx = port ? PAD : PAD;
    label(ctx, `${T.ratio} = ${PART_COUNT.body} ÷ ${PART_COUNT.leg} = ${fix(shares[1] / shares[2])}`, fx, fy, palette.mint, 12);
    label(ctx, `${T.sum} ${pc(shares.reduce((a, b) => a + b, 0), 0)}`, w - PAD, fy, palette.muted, 11, "right");
    if (got) {
      ctx.fillStyle = palette.ink; ctx.fillRect(fx, fy + 20, 2.5, 14);
      label(ctx, `${T.counted}: ${PARTS.map((_, i) => pc(got[i] / k, 1)).join(" ")}`, fx + 8, fy + 27, palette.muted, 11);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.scope}>
          <span>{T.scope}</span>
          <button type="button" className={!catOnly ? "on" : ""} onClick={() => setCatOnly(false)}>{T.all}</button>
          <button type="button" className={catOnly ? "on" : ""} onClick={() => setCatOnly(true)}>{T.cat}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.draws}>
          <span>{T.draws}</span>
          {DRAW_STEPS.map((n) => <button key={n} type="button" className={k === n ? "on" : ""} onClick={() => setK(n)}>{n}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · softmax: six scores become six shares                            */
/* ------------------------------------------------------------------ */

const TWEAKS: Tweak[] = ["none", "plus", "double", "half", "ear"];
const Z_LO = -2, Z_HI = 4;

export function SoftmaxScene() {
  const [tw, setTw] = useState<Tweak>("none");
  const T = U.soft;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), avail = w - 2 * PAD;
    const z = tweak(Z_DARK, tw), e = expOf(z), q = softmax(z), sum = e.reduce((a, b) => a + b, 0);
    const nameW = port ? 70 : 80, zW = avail * (port ? 0.29 : 0.28), eW = port ? 50 : 66, pctW = 48, qW = avail - nameW - zW - eW - pctW;
    const zx = PAD + nameW, ex = zx + zW, qx = ex + eW + 6, sc = (zW - 40) / (Z_HI - Z_LO), z0 = zx + -Z_LO * sc;
    const top = 58, rowH = port ? 44 : 40;
    label(ctx, `${T.head} = [${Z_DARK.map((v) => num(v)).join(", ")}]`, PAD, 20, palette.ink, 12);
    label(ctx, T.score, zx, top - 16, palette.muted, 11);
    label(ctx, T.exp, ex + eW / 2, top - 16, palette.muted, 11, "center");
    label(ctx, T.share, qx, top - 16, palette.muted, 11);
    // zero line of the scores
    line(ctx, z0, top - 6, z0, top + 6 * rowH - 6, palette.frame, 1);

    PARTS.forEach((p, i) => {
      const y = top + i * rowH + rowH / 2 - 4;
      const changed = tw === "ear" && p === "ear";
      swatch(ctx, PAD, y, 11, partColor(i));
      label(ctx, NAMES[i], PAD + 16, y, changed ? AMBER : palette.ink, 12);
      // the score as a bar from zero
      const zv = z[i], x1 = z0 + zv * sc;
      ctx.fillStyle = changed ? AMBER : "rgba(91,100,116,0.55)";
      ctx.fillRect(Math.min(z0, x1), y - 6, Math.abs(x1 - z0), 12);
      label(ctx, num(zv), zx + zW - 6, y, changed ? AMBER : palette.ink, 12, "right");
      // e to the score
      label(ctx, e[i] >= 10 ? e[i].toFixed(1) : e[i].toFixed(2), ex + eW - 4, y, palette.ink, 12, "right");
      // the share, with a ghost tick where it was before the change
      bar(ctx, qx, y - 7, qW, 14, q[i], AMBER);
      if (tw !== "none") { const gx = qx + qW * Q_HAND[i]; ctx.fillStyle = "rgba(20,24,33,0.45)"; ctx.fillRect(gx - 1, y - 11, 2, 22); }
      label(ctx, pc(q[i]), w - PAD, y, palette.ink, 12, "right");
    });

    const fy = top + 6 * rowH + 20;
    label(ctx, `${T.sum} = ${sum.toFixed(2)}`, PAD, fy, palette.ink, 12);
    label(ctx, `${T.ratio} = ${pc(q[2])} ÷ ${pc(q[3])} = ${fix(q[2] / q[3])}`, PAD, fy + 26, tw === "double" || tw === "half" ? palette.anomaly : palette.mint, 12);
    label(ctx, T.say[tw], PAD, fy + 52, palette.muted, port ? 11 : 12);
    if (tw !== "none") label(ctx, T.ghost, PAD, fy + 76, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.tweak}>
          <span>{T.tweak}</span>
          {TWEAKS.map((t) => <button key={t} type="button" className={tw === t ? "on" : ""} onClick={() => setTw(t)}>{T.tweaks[t]}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · joint and conditional: one numerator, three denominators        */
/* ------------------------------------------------------------------ */

type CondMode = "joint" | "darkGivenEar" | "earGivenDark";
const COND_MODES: CondMode[] = ["joint", "darkGivenEar", "earGivenDark"];
const EAR_EDGE = "#c2566a";

export function CondScene() {
  const [mode, setMode] = useState<CondMode>("joint");
  const [ti, setTi] = useState(TH_STEPS.indexOf(DARK));
  const T = U.cond;
  const th = TH_STEPS[ti];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const c = cond("ear", th), j = joint(th);
    const S = port ? Math.min(w - 2 * PAD, h - 250) : Math.min(h - 96, (w - 2 * PAD) * 0.5);
    const gx = port ? (w - S) / 2 : PAD, gy = 40;
    label(ctx, `${T.th} ${th.toFixed(2)}: ${T.darkCount} ${c.nDark} · ${T.earCount} ${c.nPart} · ${T.both} ${c.both}`, PAD, 20, palette.ink, port ? 11 : 12);

    const isEar = (r: number, cc: number) => PART16[r][cc] === "ear";
    const dark = (r: number, cc: number) => isDark(CELLS[r * N + cc].x, th);
    catGrid(ctx, null, gx, gy, S, {
      mode: "gray",
      veil: (r, cc) => (mode === "darkGivenEar" ? !isEar(r, cc) : mode === "earGivenDark" ? !dark(r, cc) : false),
      fill: (r, cc) => (isEar(r, cc) && dark(r, cc) ? AMBER_SOFT : null),
      edge: (r, cc) => (isEar(r, cc) && dark(r, cc) ? AMBER : isEar(r, cc) ? EAR_EDGE : dark(r, cc) ? BLUE : null),
      track: true,
    });
    // legend under the grid
    const ly = gy + S + 18;
    const items: [string, string, boolean][] = [[T.dark, BLUE, false], [U.parts.ear, EAR_EDGE, false], [T.numer, AMBER, true]];
    let lx = gx;
    items.forEach(([name, col, filled]) => {
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.strokeRect(lx + 1, ly - 6, 12, 12);
      if (filled) { ctx.fillStyle = AMBER_SOFT; ctx.fillRect(lx + 1, ly - 6, 12, 12); }
      ctx.restore();
      label(ctx, name, lx + 18, ly, palette.muted, 11);
      lx += 18 + name.length * 11 + 26;
    });

    // the three shares: same numerator, different denominators
    const rows: [CondMode, string, number, number, number][] = [
      ["joint", T.modes.joint, c.both, 256, c.pJoint],
      ["darkGivenEar", T.modes.darkGivenEar, c.both, c.nPart, c.pDarkGivenPart],
      ["earGivenDark", T.modes.earGivenDark, c.both, c.nDark, c.pPartGivenDark],
    ];
    const fx = port ? PAD : gx + S + 22, fy0 = port ? ly + 30 : gy + 190;
    rows.forEach(([m, name, a, b, v], i) => {
      const on = m === mode, y = fy0 + i * (port ? 26 : 28);
      label(ctx, `${name} = ${a} / ${b} = ${pc(v)}`, fx, y, on ? palette.ink : palette.muted, on ? 13 : 12);
      if (on) { ctx.fillStyle = AMBER; ctx.fillRect(fx - 8, y - 7, 3, 14); }
    });
    const denomName = mode === "joint" ? `256${U.dist.cells}` : mode === "darkGivenEar" ? `${U.parts.ear} ${c.nPart}${U.dist.cells}` : `${T.dark} ${c.nDark}${U.dist.cells}`;
    label(ctx, `${T.numer}: ${c.both}${U.dist.cells} · ${T.denom}: ${denomName}`, fx, fy0 + 3 * (port ? 26 : 28) + 6, AMBER, port ? 11 : 12);

    // the joint table, where there is room for it
    if (!port) {
      const tx = gx + S + 22, ty = gy + 6, cw = (w - PAD - tx - 70) / 2;
      label(ctx, T.part, tx, ty, palette.muted, 11);
      label(ctx, T.dark, tx + 70 + cw / 2, ty, BLUE, 11, "center");
      label(ctx, T.bright, tx + 70 + cw * 1.5, ty, palette.muted, 11, "center");
      PARTS.forEach((p, i) => {
        const y = ty + 22 + i * 21, ear = p === "ear";
        if (ear) { ctx.fillStyle = "rgba(209,127,139,0.16)"; ctx.fillRect(tx - 4, y - 10, w - PAD - tx + 4, 20); }
        label(ctx, NAMES[i], tx, y, ear ? EAR_EDGE : palette.ink, 12);
        label(ctx, `${j.dark[i]}`, tx + 70 + cw / 2, y, ear ? AMBER : BLUE, 12, "center");
        label(ctx, `${j.bright[i]}`, tx + 70 + cw * 1.5, y, palette.ink, 12, "center");
      });
      const y = ty + 22 + 6 * 21;
      line(ctx, tx, y - 9, w - PAD, y - 9, palette.frame, 1);
      label(ctx, `${j.nDark}`, tx + 70 + cw / 2, y + 2, BLUE, 12, "center");
      label(ctx, `${256 - j.nDark}`, tx + 70 + cw * 1.5, y + 2, palette.ink, 12, "center");
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.mode}>
          {COND_MODES.map((m) => <button key={m} type="button" className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{T.modes[m]}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{T.th} <b>{th.toFixed(2)}</b></span>
          <input type="range" min={0} max={TH_STEPS.length - 1} step={1} value={ti} onChange={(e) => setTi(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · Bayes: the tree of counts, and the two bars it gives            */
/* ------------------------------------------------------------------ */

type BayesMode = "ear" | "eye" | "factory";
const BAYES_MODES: BayesMode[] = ["ear", "eye", "factory"];

function box(ctx: Ctx, x: number, y: number, w: number, h: number, l1: string, l2: string, fill: string | null, stroke: string, port: boolean) {
  rbox(ctx, x, y, w, h, 7, fill ?? "#ffffff", stroke, 1.5);
  label(ctx, l1, x + w / 2, y + h / 2 - 8, palette.ink, port ? 11 : 12, "center");
  label(ctx, l2, x + w / 2, y + h / 2 + 9, palette.ink, port ? 12 : 13, "center");
}

export function BayesScene() {
  const [mode, setMode] = useState<BayesMode>("ear");
  const [ri, setRi] = useState(RATE_STEPS.indexOf(FACTORY_DEFAULT.rate));
  const [ci, setCi] = useState(RECALL_STEPS.indexOf(FACTORY_DEFAULT.recall));
  const [fi, setFi] = useState(FA_STEPS.indexOf(FACTORY_DEFAULT.fa));
  const T = U.bayes;
  const fac = mode === "factory";

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h);
    const t = fac ? factory(RATE_STEPS[ri], RECALL_STEPS[ci], FA_STEPS[fi]) : catTree(mode === "eye" ? "eye" : "ear");
    const nm = fac ? T.fac : { ...T.cat, a: mode === "eye" ? T.cat.eyeA : T.cat.a, na: mode === "eye" ? T.cat.eyeNa : T.cat.na };
    const avail = w - 2 * PAD, gap = port ? 6 : 10, lw = (avail - 3 * gap) / 4, bh = port ? 40 : 38;
    const y0 = 22, y1 = port ? 92 : 92, y2 = port ? 168 : 168, y3 = port ? 246 : 238;
    const leafX = [0, 1, 2, 3].map((i) => PAD + i * (lw + gap));
    const midA = leafX[0] + lw + gap / 2, midB = leafX[2] + lw + gap / 2;
    const l1w = Math.min(2 * lw + gap, port ? 150 : 200), rootW = port ? 150 : 200;

    // root
    const rx = w / 2 - rootW / 2;
    rbox(ctx, rx, y0, rootW, bh - 6, 7, "#ffffff", palette.frame, 1.5);
    label(ctx, nm.all, w / 2, y0 + (bh - 6) / 2 + 0.5, palette.ink, port ? 12 : 13, "center");
    // level 1: A and not A
    const ax = midA - l1w / 2, bx = midB - l1w / 2;
    line(ctx, w / 2, y0 + bh - 6, midA, y1, palette.frame, 1.5);
    line(ctx, w / 2, y0 + bh - 6, midB, y1, palette.frame, 1.5);
    label(ctx, pc(t.nA / t.total, t.nA / t.total < 0.01 ? 2 : 1), (w / 2 + midA) / 2 - 6, (y0 + bh + y1) / 2 - 4, AMBER, 11, "right");
    label(ctx, pc(t.nB / t.total), (w / 2 + midB) / 2 + 6, (y0 + bh + y1) / 2 - 4, palette.muted, 11, "left");
    box(ctx, ax, y1, l1w, bh, nm.a, cnt(t.nA), "rgba(194,115,0,0.08)", AMBER, port);
    box(ctx, bx, y1, l1w, bh, nm.na, cnt(t.nB), null, palette.frame, port);
    // level 2: signal or not, under each
    const leaves: [number, string, number, boolean, number][] = [
      [midA, nm.s, t.aSig, true, t.hitA], [midA, nm.ns, t.nA - t.aSig, false, 1 - t.hitA],
      [midB, nm.s, t.bSig, true, t.hitB], [midB, nm.ns, t.nB - t.bSig, false, 1 - t.hitB],
    ];
    leaves.forEach(([px, name, n, sig, rate], i) => {
      const lx = leafX[i];
      line(ctx, px, y1 + bh, lx + lw / 2, y2, palette.frame, 1.5);
      const rx2 = (px + lx + lw / 2) / 2 + (i % 2 === 0 ? -4 : 4);
      label(ctx, pc(rate, rate > 0 && rate < 0.01 ? 2 : 1), rx2, (y1 + bh + y2) / 2, sig ? BLUE : palette.muted, 11, i % 2 === 0 ? "right" : "left");
      box(ctx, lx, y2, lw, bh, name, cnt(n), sig ? BLUE_SOFT : null, sig ? BLUE : palette.frame, port);
    });
    // the two signal leaves, put together
    const sx = leafX[0] + lw / 2, sx2 = leafX[2] + lw / 2, my = y3 + 14;
    line(ctx, sx, y2 + bh, sx, my, BLUE, 1.2, [4, 3]);
    line(ctx, sx2, y2 + bh, sx2, my, BLUE, 1.2, [4, 3]);
    line(ctx, sx, my, sx2, my, BLUE, 1.2, [4, 3]);
    tag(ctx, `${nm.sig} ${cnt(t.sig)} = ${cnt(t.aSig)} + ${cnt(t.bSig)}`, (sx + sx2) / 2, my, BLUE, port ? 11 : 12);

    // two bars: the condition one way, then the other
    const bY = y3 + (port ? 56 : 54), bw = avail;
    const r1 = `P(${nm.s} | ${nm.a}) = ${cnt(t.aSig)} ÷ ${cnt(t.nA)}`, r2 = `P(${nm.a} | ${nm.s}) = ${cnt(t.aSig)} ÷ ${cnt(t.sig)}`;
    label(ctx, fac && !port ? `${r1}  ${T.recallName}` : r1, PAD, bY, palette.ink, port ? 11 : 12);
    label(ctx, pc(t.pSigGivenA), w - PAD, bY, BLUE, 13, "right");
    bar(ctx, PAD, bY + 12, bw, 14, t.pSigGivenA, BLUE);
    const bY2 = bY + (port ? 56 : 52);
    label(ctx, fac && !port ? `${r2}  ${T.precisionName}` : r2, PAD, bY2, palette.ink, port ? 11 : 12);
    label(ctx, pc(t.pAGivenSig), w - PAD, bY2, AMBER, 13, "right");
    bar(ctx, PAD, bY2 + 12, bw, 14, t.pAGivenSig, AMBER);
    if (fac && port) label(ctx, `${T.recallName} ${pc(t.pSigGivenA)} · ${T.precisionName} ${pc(t.pAGivenSig)}`, PAD, bY2 + 46, palette.muted, 11);
  });

  const pct = (v: number) => (v < 0.01 ? `${(v * 100).toFixed(1)}%` : `${Math.round(v * 100)}%`);
  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.mode}>
          <span>{T.mode}</span>
          {BAYES_MODES.map((m) => <button key={m} type="button" className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{T.modes[m]}</button>)}
        </div>
        {fac ? (
          <>
            <label className="ad-ctl">
              <span>{T.rate} <b>{pct(RATE_STEPS[ri])}</b></span>
              <input type="range" min={0} max={RATE_STEPS.length - 1} step={1} value={ri} onChange={(e) => setRi(Number(e.target.value))} />
            </label>
            <label className="ad-ctl">
              <span>{T.recall} <b>{pct(RECALL_STEPS[ci])}</b></span>
              <input type="range" min={0} max={RECALL_STEPS.length - 1} step={1} value={ci} onChange={(e) => setCi(Number(e.target.value))} />
            </label>
            <label className="ad-ctl">
              <span>{T.fa} <b>{pct(FA_STEPS[fi])}</b></span>
              <input type="range" min={0} max={FA_STEPS.length - 1} step={1} value={fi} onChange={(e) => setFi(Number(e.target.value))} />
            </label>
          </>
        ) : null}
      </div>
    </div>
  );
}
