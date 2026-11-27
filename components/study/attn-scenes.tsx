"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { line, rbox } from "./kit";
import { attnCopy } from "./attn-copy";
import {
  BLOCKS, DEVICE, DH, EYE16, EYE_PX, FOUR, FOUR_KIND, FOUR_OUT, FOUR_S, FOUR_W, G, GLOBAL, SIDES, TAIL16, VITB, attnFlops, cellAt,
  eyeKeys, flashBytes, headTable, keptFlash, keptStandard, keysOf, layerTables, layersToTail, online, onlineOut, pairsPerLayer, quadShare,
  reach, standardBytes, timeOf, tokenTensor, tokensAt, trainTables, type Pattern,
} from "./attn-math";
import { PAD, bytes, comma, drawCat, drawCell, fix as fixNum, gridLines, hbar, isPortrait, ms, num, pc, tag, textW, useCatImage, vec } from "./attn-draw";

const U = attnCopy.ui;
const GRAY = "rgba(20,24,33,0.45)";

/* ------------------------------------------------------------------ */
/* 01 · The cat at growing resolution: tokens, the eye's row, bytes    */
/* ------------------------------------------------------------------ */

export function WallScene() {
  const [si, setSi] = useState(4);
  const [mode, setMode] = useState<"infer" | "train">("infer");
  const T = U.wall;
  const img = useCatImage();

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), fs = w < 420 ? 11 : 12;
    const side = SIDES[si], N = tokensAt(side), g = side / 16;
    label(ctx, `${side}px · ${T.tokens} ${comma(N)} · d = ${VITB.d}`, PAD, 18, palette.ink, 13);

    // the cat with its 16 px grid and the eye cell
    const S = portrait ? 140 : Math.min(176, w * 0.32), cx = PAD, cy = 34;
    drawCat(ctx, img.current, cx, cy, S);
    if (S / g >= 3) gridLines(ctx, cx, cy, S, g, `rgba(20,24,33,${g >= 32 ? 0.18 : 0.35})`);
    else { ctx.save(); ctx.strokeStyle = palette.frame; ctx.strokeRect(cx + 0.5, cy + 0.5, S - 1, S - 1); ctx.restore(); }
    const [er, ec] = cellAt(EYE_PX, g), c = S / g;
    ctx.save();
    ctx.fillStyle = `rgba(${palette.normalRgb},0.55)`; ctx.fillRect(cx + ec * c, cy + er * c, Math.max(c, 2), Math.max(c, 2));
    ctx.strokeStyle = palette.normal; ctx.lineWidth = 2;
    if (c < 8) { ctx.beginPath(); ctx.arc(cx + (ec + 0.5) * c, cy + (er + 0.5) * c, 8, 0, Math.PI * 2); ctx.stroke(); }
    else ctx.strokeRect(cx + ec * c, cy + er * c, c, c);
    ctx.restore();
    label(ctx, T.eye, cx + (ec + 0.5) * c + (c < 8 ? 12 : c / 2 + 4), cy + (er + 0.5) * c, palette.normal, 11);

    // counts beside the cat
    const ix = cx + S + 16, iy = cy + 10;
    const rows: [string, string, string][] = [
      [T.tokens, `${comma(N)}`, palette.ink],
      [T.row, `${comma(N)} ${T.cells}`, palette.normal],
      [T.table, `${comma(N)} × ${comma(N)}`, palette.ink],
      ["", `= ${comma(N * N)} ${T.cells}`, palette.muted],
    ];
    rows.forEach(([a, b, col], i) => {
      if (a) label(ctx, a, ix, iy + i * 22, palette.muted, 11);
      label(ctx, b, w - PAD, iy + i * 22, col, fs, "right");
    });
    if (si > 0) label(ctx, `${T.times} ${T.tokens} ×4 · ${T.table} ×16`, ix, iy + 4 * 22 + 4, palette.accent, 11);

    // share of the layer's multiply-adds that is token-to-token work
    const y1 = cy + S + (portrait ? 34 : 30);
    const share = quadShare(N);
    label(ctx, `${T.share} ${pc(share)}`, PAD, y1, palette.normal, fs);
    hbar(ctx, PAD, y1 + 10, w - 2 * PAD, 12, share, palette.normal);

    // bytes: token vectors, one table, one layer's tables, and in training every layer's P
    const items: [string, number, string][] = [
      [T.vec, tokenTensor(N), GRAY],
      [T.head, headTable(N), `rgba(${palette.normalRgb},0.55)`],
      [T.layer, layerTables(N), palette.normal],
    ];
    if (mode === "train") items.push([T.all, trainTables(N), palette.anomaly]);
    const max = Math.max(...items.map((it) => it[1]));
    const y2 = y1 + (portrait ? 48 : 44), rowH = portrait ? 46 : Math.min(40, (h - y2 - 8) / items.length);
    items.forEach(([name, v, col], i) => {
      const y = y2 + i * rowH;
      label(ctx, name, PAD, y, palette.muted, 11);
      label(ctx, bytes(v), w - PAD, y, col === GRAY ? palette.ink : col, fs, "right");
      hbar(ctx, PAD, y + 9, w - 2 * PAD, 10, v / max, col);
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{T.side} <b>{SIDES[si]}px</b></span>
          <input type="range" min={0} max={SIDES.length - 1} step={1} value={si} onChange={(e) => setSi(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.mode}>
          <button type="button" className={mode === "infer" ? "on" : ""} onClick={() => setMode("infer")}>{T.infer}</button>
          <button type="button" className={mode === "train" ? "on" : ""} onClick={() => setMode("train")}>{T.train}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · Softmax one block at a time                                     */
/* ------------------------------------------------------------------ */

export function OnlineScene() {
  const [step, setStep] = useState(0);
  const [order, setOrder] = useState<"late" | "early">("late");
  const T = U.online;
  const img = useCatImage();
  const seq = order === "late" ? [0, 1, 2, 3] : [3, 2, 1, 0];
  const steps = online(seq, 2);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), narrow = w < 420, fs = narrow ? 11 : 12;
    // four tokens in the order they stream past, grouped into two blocks
    const gap = narrow ? 10 : 16, cw = Math.min(92, (w - 2 * PAD - 3 * gap - 16) / 4), y0 = 42;
    const blockGap = 16, totalW = 4 * cw + 2 * gap + blockGap;
    const x0 = (w - totalW) / 2;
    const xAt = (k: number) => x0 + k * cw + (k >= 2 ? gap + blockGap : 0) + (k % 2 === 1 ? gap : 0);
    seq.forEach((j, k) => {
      const x = xAt(k), on = step === 0 || step >= 2 || k < 2;
      ctx.save(); ctx.globalAlpha = on ? 1 : 0.3;
      const S = cw - 10;
      drawCell(ctx, img.current, FOUR[j], x + 5, y0, S);
      label(ctx, T.names[FOUR_KIND[j]], x + cw / 2, y0 + S + 14, palette.ink, 11, "center");
      label(ctx, `${T.score} ${num(FOUR_S[j])}`, x + cw / 2, y0 + S + 30, palette.normal, 11, "center");
      if (step === 0 || step === 3) {
        hbar(ctx, x + 5, y0 + S + 40, S, 8, FOUR_W[j], palette.normal);
        label(ctx, pc(FOUR_W[j]), x + cw / 2, y0 + S + 58, palette.normal, 11, "center");
      }
      ctx.restore();
    });
    const S0 = cw - 10, boxB = y0 + S0 + (step === 0 || step === 3 ? 66 : 40);
    if (step === 0) {
      rbox(ctx, xAt(0) - 4, y0 - 8, xAt(3) + cw - xAt(0) + 8, boxB - y0 + 8, 8, null, palette.normal, 1.5);
      label(ctx, T.steps[0], xAt(0), y0 - 18, palette.normal, 11);
    } else [0, 1].forEach((b) => {
      const on = step >= 2 || b === 0;
      rbox(ctx, xAt(2 * b) - 4, y0 - 8, xAt(2 * b + 1) + cw - xAt(2 * b) + 8, boxB - y0 + 8, 8, null, on ? palette.accent : palette.frame, on ? 1.8 : 1);
      label(ctx, `${T.block} ${b + 1}`, xAt(2 * b), y0 - 18, on ? palette.accent : palette.muted, 11);
    });

    // running statistics, one row per block that has arrived
    const yT = boxB + (portrait ? 30 : 24);
    if (step === 0) {
      const exps = FOUR_S.map((s) => Math.exp(s)), tot = exps.reduce((a, b) => a + b, 0);
      label(ctx, `e^s: ${seq.map((j) => exps[j].toFixed(3)).join(" + ")}`, PAD, yT, palette.ink, fs);
      label(ctx, `= ${tot.toFixed(3)}`, PAD, yT + 22, palette.ink, fs);
      label(ctx, `${T.shares} = e^s ÷ ${tot.toFixed(3)}`, PAD, yT + 46, palette.muted, 11);
    } else {
      const cols = narrow ? [PAD, PAD + 52, PAD + 104, PAD + 160, w - PAD] : [PAD, PAD + 70, PAD + 150, PAD + 240, w - PAD];
      const heads = [T.block, "m", "ℓ", "acc", T.mult];
      heads.forEach((t, i) => label(ctx, t, cols[i], yT, palette.muted, 11, i === 4 ? "right" : "left"));
      line(ctx, PAD, yT + 10, w - PAD, yT + 10, palette.frame, 1);
      steps.slice(0, Math.min(step, 2)).forEach((st, r) => {
        const y = yT + 28 + r * 24;
        label(ctx, `${r + 1}`, cols[0] + 6, y, palette.ink, fs);
        label(ctx, fixNum(st.m), cols[1], y, palette.ink, fs);
        label(ctx, st.l.toFixed(3), cols[2], y, palette.ink, fs);
        label(ctx, vec(st.acc), cols[3], y, palette.ink, fs);
        const changed = r > 0 && st.rescale < 0.999;
        label(ctx, r === 0 ? "·" : num(st.rescale, 4), cols[4], y, changed ? palette.accent : palette.muted, fs, "right");
      });
    }

    // the answer: one pass against block by block
    const yA = h - (portrait ? 56 : 46);
    line(ctx, PAD, yA - 18, w - PAD, yA - 18, palette.frame, 1);
    label(ctx, `${T.full} ${vec(FOUR_OUT)}`, PAD, yA, palette.muted, fs);
    if (step === 3) {
      const out = onlineOut(steps), same = Math.abs(out[0] - FOUR_OUT[0]) < 1e-9 && Math.abs(out[1] - FOUR_OUT[1]) < 1e-9;
      label(ctx, `${T.now} ${vec(out)} · ${same ? T.same : ""}`, PAD, yA + 22, palette.mint, fs);
    } else if (step > 0) label(ctx, `${T.now}: ${T.wait}`, PAD, yA + 22, palette.muted, fs);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.step} style={{ flexWrap: "wrap" }}>
          {T.steps.map((s, i) => <button key={s} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{s}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.order}>
          <button type="button" className={order === "late" ? "on" : ""} onClick={() => setOrder("late")}>{T.late}</button>
          <button type="button" className={order === "early" ? "on" : ""} onClick={() => setOrder("early")}>{T.early}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · FlashAttention: bytes moved, time, what backward keeps          */
/* ------------------------------------------------------------------ */

const FLASH_SIDES = [512, 1024, 2048];

export function FlashScene() {
  const [method, setMethod] = useState<"std" | "flash">("std");
  const [Br, setBr] = useState(128);
  const [side, setSide] = useState(1024);
  const T = U.flash;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), narrow = w < 420, fs = narrow ? 11 : 12;
    const N = tokensAt(side), sb = standardBytes(N), fb = flashBytes(N, Br), fl = attnFlops(N);
    const isStd = method === "std", tot = isStd ? sb.total : fb.total;
    label(ctx, `${side}px · N = ${comma(N)}, d = ${DH}`, PAD, 18, palette.ink, 13);
    if (!isStd) label(ctx, `${T.block} ${Br}`, w - PAD, 18, palette.accent, 12, "right");

    // bytes moved, split by what moves; scaled to the standard total at this N
    const bx = PAD, bw = w - 2 * PAD, y1 = 52;
    label(ctx, `${T.moved} ${bytes(tot)}`, bx, y1 - 14, palette.ink, fs);
    const quarter = sb.tables / 4;
    const segs: [string, number, string][] = isStd
      ? [[T.qkvo, sb.qkvo, GRAY], [T.sw, quarter, `rgba(${palette.anomalyRgb},0.85)`], [T.sr, quarter, `rgba(${palette.anomalyRgb},0.6)`], [T.pw, quarter, `rgba(${palette.anomalyRgb},0.45)`], [T.pr, quarter, `rgba(${palette.anomalyRgb},0.3)`]]
      : [[T.qo, fb.qo, GRAY], [`${T.kv} × ${fb.passes}${T.passes}`, fb.kv, palette.normal], [T.stats, fb.stats, palette.mint]];
    ctx.fillStyle = palette.track; ctx.fillRect(bx, y1, bw, 18);
    let x = bx;
    segs.forEach(([, v, col]) => { const sw = (v / sb.total) * bw; ctx.fillStyle = col; ctx.fillRect(x, y1, sw, 18); x += sw; });
    // legend under the bar, wrapping
    let lx = bx, ly = y1 + 32;
    segs.forEach(([name, v, col]) => {
      const t = `${name} ${bytes(v)}`, tw = textW(ctx, t) + 26;
      if (lx + tw > w - PAD) { lx = bx; ly += 17; }
      ctx.fillStyle = col; ctx.fillRect(lx, ly - 5, 10, 10);
      label(ctx, t, lx + 14, ly, palette.muted, 11);
      lx += tw;
    });

    // compute time against move time, on one scale for both methods at this N
    const tS = timeOf(fl, sb.total), tF = timeOf(fl, fb.total), now = isStd ? tS : tF;
    const scaleT = Math.max(tS.compute, tS.move, tF.move);
    const y2 = ly + (portrait ? 40 : 34), tw0 = narrow ? 64 : 80;
    ([[T.compute, now.compute, palette.accent], [T.move, now.move, palette.normal]] as [string, number, string][]).forEach(([name, v, col], i) => {
      const y = y2 + i * 30;
      label(ctx, name, bx, y + 7, palette.muted, 11);
      const bw2 = bw - tw0 - 70;
      ctx.fillStyle = palette.track; ctx.fillRect(bx + tw0, y, bw2, 14);
      ctx.fillStyle = col; ctx.fillRect(bx + tw0, y, (v / scaleT) * bw2, 14);
      if (v >= now.t - 1e-15) { ctx.save(); ctx.strokeStyle = palette.ink; ctx.lineWidth = 2; ctx.strokeRect(bx + tw0 - 1, y - 1, (v / scaleT) * bw2 + 2, 16); ctx.restore(); }
      label(ctx, ms(v), w - PAD, y + 7, v >= now.t - 1e-15 ? palette.ink : palette.muted, fs, "right");
    });
    const bound = now.move > now.compute;
    label(ctx, `= ${ms(now.t)} · ${bound ? T.memBound : T.compBound}`, bx + tw0, y2 + 62, bound ? palette.anomaly : palette.mint, fs);

    // what the backward pass needs kept, per head
    const y3 = y2 + (portrait ? 104 : 94);
    line(ctx, PAD, y3 - 16, w - PAD, y3 - 16, palette.frame, 1);
    label(ctx, T.kept, bx, y3, palette.muted, 11);
    label(ctx, isStd ? `${T.keptStd} ${bytes(keptStandard(N))}` : `${T.keptFlash} ${bytes(keptFlash(N))}`, w - PAD, y3, isStd ? palette.anomaly : palette.mint, fs, "right");

    // arithmetic intensity against the device's P/B on a log scale from 1 to 1000
    const y4 = y3 + (portrait ? 46 : 40), I = fl / tot, PB = DEVICE.flops / DEVICE.bw;
    const yl = y4 + 34;
    const ax0 = bx + (narrow ? 0 : 0), ax1 = w - PAD, at = (v: number) => ax0 + (Math.log10(v) / 3) * (ax1 - ax0);
    label(ctx, `${T.intensity} ${num(I, 1)} · ${T.pb} ${PB}`, bx, y4, palette.ink, fs);
    line(ctx, ax0, yl, ax1, yl, palette.frame, 1.5);
    [1, 10, 100, 1000].forEach((v) => { line(ctx, at(v), yl - 4, at(v), yl + 4, palette.muted, 1); label(ctx, `${v}`, at(v), yl + 14, palette.muted, 11, v === 1 ? "left" : v === 1000 ? "right" : "center"); });
    ctx.fillStyle = palette.muted; ctx.fillRect(at(PB) - 1.5, yl - 12, 3, 14);
    label(ctx, "P/B", at(PB), yl - 20, palette.muted, 11, "center");
    ctx.fillStyle = bound ? palette.anomaly : palette.mint; ctx.beginPath(); ctx.arc(at(I), yl, 6, 0, Math.PI * 2); ctx.fill();
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.method}>
          <button type="button" className={method === "std" ? "on" : ""} onClick={() => setMethod("std")}>{T.std}</button>
          <button type="button" className={method === "flash" ? "on" : ""} onClick={() => setMethod("flash")}>{T.flash}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.block}>
          <span>{T.block}</span>
          {BLOCKS.map((b) => <button key={b} type="button" className={Br === b ? "on" : ""} onClick={() => setBr(b)}>{b}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.side}>
          <span>{T.side}</span>
          {FLASH_SIDES.map((s) => <button key={s} type="button" className={side === s ? "on" : ""} onClick={() => setSide(s)}>{s}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · Window attention: how far the eye's information has spread     */
/*      after each layer                                               */
/* ------------------------------------------------------------------ */

const isSwin = (p: Pattern) => p === "swin" || p === "swinShift";

export function ReachScene({ patterns, maxLayer }: { patterns: Pattern[]; maxLayer: number }) {
  const [p, setP] = useState<Pattern>(patterns[0]);
  const [layer, setLayer] = useState(1);
  const T = U.reach;
  const img = useCatImage();
  const got = reach(p, layer), tailAt = layersToTail(p), eyeIdx = EYE16[0] * G + EYE16[1], tailIdx = TAIL16[0] * G + TAIL16[1];
  const hasG = p === "global" || p === "bigbird";

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), fs = w < 420 ? 11 : 12;
    const S = portrait ? Math.min(w - 2 * PAD, 300) : Math.min(h - 64, w - 2 * PAD - 150), gx = portrait ? (w - S) / 2 : PAD, gy = portrait ? 44 : 36, c = S / G;
    label(ctx, `${T.names[p]} · ${T.layer} ${layer}`, PAD, 16, palette.ink, 13);
    drawCat(ctx, img.current, gx, gy, S, 0.85);
    for (let q = 0; q < G * G; q++) {
      if (!got[q]) continue;
      ctx.fillStyle = `rgba(${palette.normalRgb},0.42)`;
      ctx.fillRect(gx + (q % G) * c, gy + Math.floor(q / G) * c, c, c);
    }
    gridLines(ctx, gx, gy, S, G, "rgba(20,24,33,0.16)");

    // this layer's windows (Swin) or the eye's own window
    ctx.save(); ctx.strokeStyle = palette.accent; ctx.lineWidth = 2;
    if (isSwin(p)) {
      const shift = p === "swinShift" && layer % 2 === 0, off = shift ? -2 : 0;
      for (let a = off; a < G; a += 4) for (let b = off; b < G; b += 4) {
        const r0 = Math.max(0, a), c0 = Math.max(0, b), r1 = Math.min(G, a + 4), c1 = Math.min(G, b + 4);
        ctx.strokeRect(gx + c0 * c + 1, gy + r0 * c + 1, (c1 - c0) * c - 2, (r1 - r0) * c - 2);
      }
    } else if (p === "slide2" || p === "slide1" || p === "random" || p === "global" || p === "bigbird") {
      const rad = p === "slide2" ? 2 : 1;
      const r0 = Math.max(0, EYE16[0] - rad), c0 = Math.max(0, EYE16[1] - rad), r1 = Math.min(G, EYE16[0] + rad + 1), c1 = Math.min(G, EYE16[1] + rad + 1);
      ctx.strokeRect(gx + c0 * c, gy + r0 * c, (c1 - c0) * c, (r1 - r0) * c);
    }
    ctx.restore();

    // the keys the eye reads directly in the first layer, for the sparse patterns
    const eyeX = gx + (EYE16[1] + 0.5) * c, eyeY = gy + (EYE16[0] + 0.5) * c;
    const gBox = { x: portrait ? gx + S - 52 : gx + S + 16, y: portrait ? gy - 34 : gy, w: 52, h: 24 };
    if (!isSwin(p) && p !== "slide2") {
      const keys = keysOf(p, eyeIdx, 1);
      keys.forEach((k) => {
        if (k === GLOBAL) { line(ctx, eyeX, eyeY, gBox.x, gBox.y + gBox.h / 2, palette.accent, 1.2, [3, 3]); return; }
        const kx = gx + ((k % G) + 0.5) * c, ky = gy + (Math.floor(k / G) + 0.5) * c;
        const far = Math.max(Math.abs(Math.floor(k / G) - EYE16[0]), Math.abs((k % G) - EYE16[1])) > 1;
        if (far && p !== "strided") line(ctx, eyeX, eyeY, kx, ky, palette.accent, 1.4);
        ctx.fillStyle = palette.accent; ctx.beginPath(); ctx.arc(kx, ky, 2.6, 0, Math.PI * 2); ctx.fill();
      });
    }
    if (hasG) {
      rbox(ctx, gBox.x, gBox.y, gBox.w, gBox.h, 6, got[GLOBAL] ? `rgba(${palette.normalRgb},0.45)` : "#ffffff", palette.accent, 1.5);
      label(ctx, T.global, gBox.x + gBox.w / 2, gBox.y + gBox.h / 2 + 0.5, palette.ink, 11, "center");
    }

    // the eye and the tail tip
    const tailOk = got[tailIdx];
    ctx.save(); ctx.lineWidth = 2.5;
    ctx.strokeStyle = palette.mint; ctx.strokeRect(gx + EYE16[1] * c + 1, gy + EYE16[0] * c + 1, c - 2, c - 2);
    ctx.strokeStyle = tailOk ? palette.mint : palette.anomaly; ctx.strokeRect(gx + TAIL16[1] * c + 1, gy + TAIL16[0] * c + 1, c - 2, c - 2);
    ctx.restore();
    tag(ctx, T.eye, gx + (EYE16[1] + 0.5) * c, gy + EYE16[0] * c - 8, palette.mint, 11);
    tag(ctx, T.tailName, gx + (TAIL16[1] + 0.5) * c, gy + (TAIL16[0] + 1) * c + 9, tailOk ? palette.mint : palette.anomaly, 11);

    // numbers
    const nx = portrait ? PAD : gx + S + 16, ny = portrait ? gy + S + 30 : gy + (hasG ? 52 : 14), lh = portrait ? 22 : 26;
    const reached = got.slice(0, G * G).filter(Boolean).length;
    const tailText = tailAt === null ? T.never : layer >= tailAt ? `${tailAt}${T.at}` : T.notYet;
    const lines: [string, string, string][] = [
      [T.eyeReads, `${eyeKeys(p, layer)}`, palette.accent],
      [T.pairs, `${comma(pairsPerLayer(p))} / ${comma(G * G * G * G)}`, palette.ink],
      [T.reached, `${reached} / ${G * G}`, palette.normal],
      [T.tail, tailText, tailAt === null ? palette.anomaly : layer >= tailAt ? palette.mint : palette.muted],
    ];
    lines.forEach(([a, b, col], i) => {
      if (portrait) { label(ctx, a, nx, ny + i * lh, palette.muted, 11); label(ctx, b, w - PAD, ny + i * lh, col, fs, "right"); }
      else { label(ctx, a, nx, ny + i * 2 * lh * 0.8, palette.muted, 11); label(ctx, b, nx, ny + i * 2 * lh * 0.8 + 17, col, fs); }
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.pattern} style={{ flexWrap: "wrap" }}>
          {patterns.map((q) => <button key={q} type="button" className={p === q ? "on" : ""} onClick={() => setP(q)}>{T.names[q]}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{T.layer} <b>{layer}</b></span>
          <input type="range" min={1} max={maxLayer} step={1} value={layer} onChange={(e) => setLayer(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

export const WindowScene = () => <ReachScene patterns={["swin", "swinShift", "slide2"]} maxLayer={8} />;
