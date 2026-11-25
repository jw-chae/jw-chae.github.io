"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, line, rbox, type Ctx } from "./kit";
import { cmpCopy } from "./cmp-copy";
import { PAD, classColor, fix, isPortrait, num, sgn, shareBar, tag, tint, valueGrid, vec } from "./cmp-kit";
import {
  CAIT_K, CAIT_Q, CAIT_SCORE, CAIT_TABLE, PROBS_A, P_SET, QAT_SCALE, QAT_STEPS, W_LAST, X_A,
  caitPrune, matVec, maxAbs, quantize, quantizeTable, setLoss, softmax, trainQat,
} from "./cmp-math";

const U = cmpCopy.ui;
const NAMES = U.classes;
const GREEN = palette.mint, AMBER = palette.accent, BLUE = palette.normal, RED = palette.anomaly;

/* ------------------------------------------------------------------ */
/* 05 · DINO-PCB: what runs in each stage                               */
/* ------------------------------------------------------------------ */

function board(ctx: Ctx, x: number, y: number, w: number, h: number) {
  rbox(ctx, x, y, w, h, 6, "rgba(15,157,106,0.14)", GREEN, 1.3);
  for (let i = 1; i <= 3; i++) line(ctx, x + 8, y + (h * i) / 4, x + w - 8, y + (h * i) / 4, "rgba(194,115,0,0.55)", 1.2);
  line(ctx, x + w * 0.35, y + 4, x + w * 0.35, y + h - 4, "rgba(194,115,0,0.55)", 1.2);
  ctx.fillStyle = RED; ctx.beginPath(); ctx.arc(x + w * 0.68, y + h * 0.5, 2.6, 0, Math.PI * 2); ctx.fill();
}

export function PcbScene() {
  const [stage, setStage] = useState(0);
  const S = U.pcb;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const small = w < 420, g = Math.max(0, (h - 440) / 2);
    const colW = small ? (w - 2 * PAD - 24) / 2 : Math.min(210, (w - 2 * PAD - 70) / 2);
    const lx = small ? PAD : w / 2 - 35 - colW, rx = small ? w - PAD - colW : w / 2 + 35;
    const sc = 1 + g / 300, yT = 92 + g / 4, Y = (k: number) => yT + k * sc, bh = 26;

    // the board photo enters both columns
    const iw = small ? 120 : 150, ix = (w - iw) / 2, iy = 10, ih = 30;
    board(ctx, ix, iy, iw, ih);
    label(ctx, S.image, ix + iw / 2, iy + ih + 11, palette.muted, 11, "center");
    const teacherA = stage === 2 ? 0.22 : 1, studentA = stage === 0 ? 0.25 : 1;
    ctx.save(); ctx.globalAlpha = teacherA; arrow(ctx, ix + 10, iy + ih + 18, lx + colW / 2, Y(0) - 26, palette.muted, 1.4); ctx.restore();
    ctx.save(); ctx.globalAlpha = studentA; arrow(ctx, ix + iw - 10, iy + ih + 18, rx + colW / 2, Y(0) - 26, palette.muted, 1.4); ctx.restore();

    // teacher column
    ctx.save(); ctx.globalAlpha = teacherA;
    label(ctx, S.teacher + (stage >= 1 ? `  · ${S.frozen}` : ""), lx + colW / 2, Y(0) - 12, BLUE, 12, "center");
    const trainT = stage === 0;
    tag(ctx, S.blocks, lx, Y(0), colW, bh, BLUE, tint(palette.normalRgb, 0.08));
    tag(ctx, S.last, lx, Y(0) + bh + 2, colW, 22, trainT ? AMBER : BLUE, trainT ? tint(palette.accentRgb, 0.18) : tint(palette.normalRgb, 0.08));
    tag(ctx, S.tokens, lx, Y(66), colW, bh, BLUE, tint(palette.normalRgb, 0.08));
    tag(ctx, S.roi, lx, Y(108), colW, bh, BLUE, "#ffffff");
    tag(ctx, S.head, lx, Y(150), colW, bh, trainT ? AMBER : BLUE, trainT ? tint(palette.accentRgb, 0.18) : tint(palette.normalRgb, 0.08));
    tag(ctx, S.emb, lx, Y(192), colW, bh, BLUE, tint(palette.normalRgb, 0.08));
    [[52, 66], [92, 108], [134, 150], [176, 192]].forEach(([a, b]) => arrow(ctx, lx + colW / 2, Y(a) + 4, lx + colW / 2, Y(b) - 2, palette.muted, 1.2));
    if (stage === 0) {
      arrow(ctx, lx + colW / 2, Y(218) + 2, lx + colW / 2, Y(234) - 2, RED, 1.2);
      tag(ctx, S.arc, lx, Y(234), colW, bh, RED, tint(palette.anomalyRgb, 0.08));
    }
    ctx.restore();
    if (stage === 2) label(ctx, S.unused, lx + colW / 2, Y(260), palette.muted, 12, "center");

    // student column
    ctx.save(); ctx.globalAlpha = studentA;
    label(ctx, S.student, rx + colW / 2, Y(0) - 12, AMBER, 12, "center");
    const trainS = stage === 1, fillS = trainS ? tint(palette.accentRgb, 0.16) : "#ffffff";
    tag(ctx, S.backbone, rx, Y(0), colW, bh, AMBER, fillS);
    tag(ctx, S.encoder, rx, Y(66), colW, bh, AMBER, fillS);
    tag(ctx, S.decoder, rx, Y(150), colW, bh, AMBER, fillS);
    tag(ctx, S.queries, rx, Y(192), colW, bh, AMBER, fillS);
    tag(ctx, S.boxes, rx, Y(234), colW, bh, AMBER, "#ffffff");
    [[26, 66], [92, 150], [176, 192], [218, 234]].forEach(([a, b]) => arrow(ctx, rx + colW / 2, Y(a) + 2, rx + colW / 2, Y(b) - 2, palette.muted, 1.2));
    ctx.restore();
    if (stage === 0) label(ctx, S.unused, rx + colW / 2, Y(272), palette.muted, 12, "center");

    // the two distillation links of stage 2
    if (stage === 1) {
      const PURPLE = palette.accent2;
      line(ctx, lx + colW, Y(66) + bh / 2, rx, Y(0) + bh / 2, BLUE, 1.6, [5, 4]);
      line(ctx, lx + colW, Y(66) + bh / 2, rx, Y(66) + bh / 2, BLUE, 1.6, [5, 4]);
      line(ctx, lx + colW, Y(192) + bh / 2, rx, Y(192) + bh / 2, PURPLE, 1.6, [2, 3]);
      const yl = Y(282);
      line(ctx, PAD, yl, PAD + 24, yl, BLUE, 1.6, [5, 4]); label(ctx, `${S.hild}: ${S.tokens} · ${S.backbone}, ${S.encoder}`, PAD + 32, yl, palette.ink, 11);
      line(ctx, PAD, yl + 20, PAD + 24, yl + 20, PURPLE, 1.6, [2, 3]); label(ctx, `${S.cild}: ${S.emb} · ${S.queries}`, PAD + 32, yl + 20, palette.ink, 11);
      label(ctx, S.trainOnly, PAD, yl + 44, palette.muted, 11);
    }
    if (stage === 2) label(ctx, S.latency, w / 2, Y(300), AMBER, 13, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={S.stage}>
          <span>{S.stage}</span>
          {S.stages.map((name, i) => <button key={name} type="button" className={stage === i ? "on" : ""} onClick={() => setStage(i)}>{name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · CAIT: channel scores, consistent pruning, the published table    */
/* ------------------------------------------------------------------ */

const PRUNED = caitPrune();

export function CaitScene() {
  const [step, setStep] = useState(0);
  const [model, setModel] = useState(1);
  const S = U.cait;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const stack = isPortrait(w, h) || w < 420, g = Math.max(0, (h - 440) / 4);
    if (step < 2) {
      const pw = stack ? w - 2 * PAD : (w - 2 * PAD - 24) / 2, posH = stack ? 52 + g / 6 : 64, ph = 3 * posH + 30;
      [0, 1].forEach((hd) => {
        const x = stack ? PAD : PAD + hd * (pw + 24), y = stack ? 12 + hd * (ph + 12) : 26;
        rbox(ctx, x, y, pw, ph, 8, "#ffffff", palette.frame, 1);
        label(ctx, `${S.head} ${hd + 1}`, x + 10, y + 14, palette.ink, 12);
        const kept = 3 - (step === 1 ? 1 : 0);
        label(ctx, `${S.width} ${step === 1 ? `3 → ${kept}` : 3}`, x + pw - 10, y + 14, step === 1 ? AMBER : palette.muted, 11, "right");
        const bx = x + 62, bw = pw - 62 - 46;
        for (let c = 0; c < 3; c++) {
          const yy = y + 30 + c * posH;
          const cut = step === 1 ? PRUNED.findIndex((p) => p.head === hd && p.ch === c) : -1;
          if (cut >= 0) {
            ctx.fillStyle = cut === 0 ? tint(palette.anomalyRgb, 0.1) : tint(palette.accentRgb, 0.12);
            ctx.fillRect(x + 4, yy - 4, pw - 8, posH - 6);
          }
          label(ctx, `${c + 1}`, x + 14, yy + 18, palette.muted, 12);
          ctx.save(); ctx.globalAlpha = cut >= 0 ? 0.45 : 1;
          const rows: [string, number, string][] = [[S.q, CAIT_Q[hd][c], palette.muted], [S.k, CAIT_K[hd][c], palette.muted], [S.mean, CAIT_SCORE[hd][c], AMBER]];
          rows.forEach(([name, v, tone], k) => {
            const by = yy + k * 13;
            label(ctx, name, x + 30, by + 5, tone, 11);
            ctx.fillStyle = palette.track; ctx.fillRect(bx, by, bw, 10);
            ctx.fillStyle = k === 2 ? tint(palette.accentRgb, 0.75) : "rgba(91,100,116,0.45)"; ctx.fillRect(bx, by, bw * v, 10);
            label(ctx, num(v, 2), bx + bw + 6, by + 5, k === 2 ? AMBER : palette.muted, 11);
          });
          ctx.restore();
          if (cut >= 0) label(ctx, cut === 0 ? S.global : S.consistent, bx, yy + 3 * 13 + 6, cut === 0 ? RED : AMBER, 11);
        }
      });
      const yN = stack ? 12 + 2 * (ph + 12) + 10 : 26 + ph + 30 + g;
      if (step === 0) label(ctx, `${S.mean} = (${S.q} + ${S.k}) ÷ 2`, PAD, yN, AMBER, 12);
      else {
        label(ctx, S.lower, PAD, yN, palette.ink, 12);
        label(ctx, S.merge, PAD, yN + 22, palette.muted, 11);
      }
      return;
    }

    // the published table for one model
    const m = CAIT_TABLE[model];
    label(ctx, `${m.name} · ImageNet-1K`, PAD, 20, palette.ink, 13);
    const rows: [string, number, number, string, string][] = [
      [S.params, m.params[0], m.params[1], fix(m.params[0], 1), fix(m.params[1], 1)],
      [S.flops, m.flops[0], m.flops[1], fix(m.flops[0], 1), fix(m.flops[1], 1)],
      [S.speed, 1, m.speed, "1.0×", `${fix(m.speed, 1)}×`],
      [S.top1, m.top1[0], m.top1[1], fix(m.top1[0], 1), fix(m.top1[1], 1)],
    ];
    const y0 = 48 + g / 2, rh = 82 + g / 2, bx = PAD + 50, bw = w - PAD - 54 - bx;
    rows.forEach(([name, a, b, sa, sb], i) => {
      const y = y0 + i * rh, mx = i === 3 ? 100 : Math.max(a, b);
      label(ctx, name, PAD, y + 6, palette.ink, 12);
      ([[S.orig, a, sa, "rgba(91,100,116,0.45)"], [S.cait, b, sb, tint(palette.accentRgb, 0.75)]] as [string, number, string, string][]).forEach(([nm, v, s, fill], k) => {
        const by = y + 18 + k * 22;
        label(ctx, nm, bx - 8, by + 8, palette.muted, 11, "right");
        ctx.fillStyle = palette.track; ctx.fillRect(bx, by, bw, 16);
        ctx.fillStyle = fill; ctx.fillRect(bx, by, (bw * v) / mx, 16);
        label(ctx, s, w - PAD, by + 8, k === 1 ? AMBER : palette.muted, 12, "right");
      });
    });
    label(ctx, `${S.note} · ${S.paper}`, PAD, h - 14, palette.muted, 11);
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
          <div className="ad-ctl ad-seg" role="group" aria-label={S.model}>
            <span>{S.model}</span>
            {CAIT_TABLE.map((t, i) => <button key={t.name} type="button" className={model === i ? "on" : ""} onClick={() => setModel(i)}>{t.name.replace("DeiT-", "")}</button>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · One row written in 8 and 4 bits, centred or fitted to the range  */
/* ------------------------------------------------------------------ */

const ROW = W_LAST[0];

export function QuantScene() {
  const [bi, setBi] = useState(0);
  const [scheme, setScheme] = useState(0);
  const S = U.quant;
  const bits = bi === 0 ? 8 : 4;
  const Q = quantize(ROW, bits, scheme === 0 ? "sym" : "zp");

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const small = w < 420, g = Math.max(0, (h - 440) / 4);
    label(ctx, `${S.row} ${vec(ROW)}`, PAD, 18, BLUE, small ? 11 : 12);
    const qmax = 2 ** (bits - 1) - 1, n = 2 ** bits - 1;
    if (scheme === 0) label(ctx, `${S.scale} s = ${num(maxAbs(ROW))} ÷ ${qmax} = ${fix(Q.scale, 5)}`, PAD, 40, palette.ink, small ? 11 : 12);
    else label(ctx, `S = (${num(Q.hi)} − (${num(Q.lo)})) ÷ ${n} = ${fix(Q.scale, 5)}    ${S.zero} = ${Q.zero}`, PAD, 40, palette.ink, small ? 11 : 12);

    // the number line with every level the codes can stand for
    const yA = 104 + g / 2, x0 = PAD + 8, x1 = w - PAD - 8, X = (v: number) => x0 + ((v + 0.95) / 1.9) * (x1 - x0);
    line(ctx, x0, yA, x1, yA, palette.frame, 1);
    const levels = scheme === 0 ? Array.from({ length: 2 * qmax + 1 }, (_, i) => ({ code: i - qmax, v: (i - qmax) * Q.scale }))
      : Array.from({ length: n + 1 }, (_, i) => ({ code: i, v: Q.scale * (i - Q.zero) }));
    const used = new Set(Q.q);
    levels.forEach(({ code, v }) => {
      const x = X(v);
      if (bits === 8) line(ctx, x, yA - 4, x, yA + 4, used.has(code) ? AMBER : "rgba(15,23,42,0.22)", used.has(code) ? 2 : 1);
      else line(ctx, x, yA - 7, x, yA + 7, used.has(code) ? AMBER : "rgba(15,23,42,0.35)", used.has(code) ? 2.5 : 1.2);
      if (bits === 4) label(ctx, String(code), x, yA + 17, used.has(code) ? AMBER : palette.muted, 11, "center");
    });
    if (bits === 4 && scheme === 0) {
      const a = X(-qmax * Q.scale) - 5, b = X(-4 * Q.scale) + 5;
      ctx.fillStyle = tint(palette.anomalyRgb, 0.1); ctx.fillRect(a, yA - 10, b - a, 20);
      label(ctx, S.empty, (a + b) / 2, yA + 34, RED, 11, "center");
    }
    if (scheme === 1) label(ctx, `0 = ${S.zero} ${Q.zero}`, X(0), yA + (bits === 4 ? 34 : 18), AMBER, 11, "center");
    else if (bits === 8) label(ctx, "0", X(0), yA + 18, palette.muted, 11, "center");
    // the six floats above the line, each joined to the level it lands on
    ROW.forEach((v, i) => {
      const x = X(v), xd = X(Q.deq[i]), r = i === 0 ? 5.5 : 4;
      line(ctx, x, yA - 26, xd, yA - 3, AMBER, 1.2);
      ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(x, yA - 30, r, 0, Math.PI * 2); ctx.fill();
      if (i === 0) { ctx.strokeStyle = palette.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, yA - 30, r + 3, 0, Math.PI * 2); ctx.stroke(); }
    });

    // the table: float, stored integer, restored value, error
    const yT = yA + 62 + g / 2, rh = 24 + g / 6, cw = (w - 2 * PAD) / 4;
    [S.w, S.q, S.deq, S.err].forEach((t, k) => label(ctx, t, PAD + k * cw, yT, [BLUE, AMBER, palette.ink, RED][k], 11));
    ROW.forEach((v, i) => {
      const y = yT + 20 + i * rh;
      if (i === 0) { ctx.fillStyle = tint(palette.accentRgb, 0.12); ctx.fillRect(PAD - 4, y - rh / 2 + 1, w - 2 * PAD + 8, rh - 2); }
      label(ctx, fix(v, 2), PAD, y, palette.ink, 12);
      label(ctx, String(Q.q[i]), PAD + cw, y, AMBER, 12);
      label(ctx, fix(Q.deq[i], 4), PAD + 2 * cw, y, palette.ink, 12);
      label(ctx, sgn(Q.err[i], 4), PAD + 3 * cw, y, RED, 12);
    });
    const yF = yT + 20 + 6 * rh + 8;
    label(ctx, `${S.maxErr} ${fix(maxAbs(Q.err), 4)} ≤ ${S.half} ${fix(Q.scale / 2, 4)}`, PAD, yF, palette.ink, 12);
    label(ctx, scheme === 0 ? S.storeSym : S.storeZp, PAD, yF + 20, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={S.bits}>
          <span>{S.bits}</span>
          {S.bitNames.map((name, i) => <button key={name} type="button" className={bi === i ? "on" : ""} onClick={() => setBi(i)}>{name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={S.scheme}>
          <span>{S.scheme}</span>
          {S.schemes.map((name, i) => <button key={name} type="button" className={scheme === i ? "on" : ""} onClick={() => setScheme(i)}>{name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · One scale for the table, or one per row                          */
/* ------------------------------------------------------------------ */

const ERR_REF = 0.17;

function shareRows(ctx: Ctx, rows: [string, number[]][], y: number, w: number, rh: number, small: boolean) {
  const bx = PAD + (small ? 84 : 100), bw = w - PAD - bx;
  rows.forEach(([name, p], i) => {
    label(ctx, name, PAD, y + i * rh + 10, palette.ink, 11);
    shareBar(ctx, bx, y + i * rh, bw, 20, p);
  });
  const colors = classColor();
  NAMES.forEach((nm, i) => label(ctx, nm, bx + i * (small ? 64 : 80), y + rows.length * rh + 6, colors[i], 11));
}

export function ChannelScene() {
  const [unit, setUnit] = useState(0);
  const [bi, setBi] = useState(1);
  const S = U.channel;
  const bits = bi === 0 ? 8 : 4;
  const tq = quantizeTable(W_LAST, bits, unit === 1);
  const probsQ = softmax(matVec(tq.deq, X_A));

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const small = w < 420, g = Math.max(0, (h - 440) / 4);
    const cw = small ? 36 : 50, ch = small ? 25 : 27, labW = small ? 46 : 58, gx = PAD + labW, sx = gx + 6 * cw + 12;
    label(ctx, S.floatT, PAD, 16, BLUE, 11);
    label(ctx, `${S.outlier} 2.40`, gx + 6 * cw, 16, RED, 11, "right");
    const y1 = 48;
    X_A.forEach((v, j) => label(ctx, `x=${num(v)}`, gx + j * cw + cw / 2, y1 - 10, j === 2 ? RED : palette.muted, 10, "center"));
    valueGrid(ctx, W_LAST, gx, y1, cw, ch, { tone: BLUE, fill: (r, c) => (r === 2 && c === 2 ? tint(palette.anomalyRgb, 0.16) : null) });
    label(ctx, S.scaleCol, sx + 4, y1 - 10, AMBER, 11);
    tq.rows.forEach((r, i) => {
      label(ctx, NAMES[i], PAD, y1 + i * ch + ch / 2, palette.ink, 12);
      label(ctx, fix(r.scale, 4), sx, y1 + i * ch + ch / 2, AMBER, small ? 11 : 12);
    });

    const y2 = y1 + 3 * ch + 38 + g / 2;
    label(ctx, S.codes, PAD, y2 - 14, AMBER, 11);
    const codes = tq.rows.map((r) => r.q);
    valueGrid(ctx, codes, gx, y2, cw, ch, {
      tone: AMBER, text: (v) => String(v),
      fill: (r, c) => tint(palette.anomalyRgb, Math.min(0.6, (Math.abs(tq.rows[r].err[c]) / ERR_REF) * 0.55)),
    });
    tq.rows.forEach((r, i) => {
      label(ctx, NAMES[i], PAD, y2 + i * ch + ch / 2, palette.ink, 12);
      label(ctx, `≤ ${fix(maxAbs(r.err), 3)}`, sx, y2 + i * ch + ch / 2, RED, 11);
    });

    const y3 = y2 + 3 * ch + 38 + g / 2;
    label(ctx, S.probs, PAD, y3 - 14, palette.ink, 11);
    shareRows(ctx, [[S.fromFloat, PROBS_A], [S.fromQuant, probsQ]], y3, w, 28, small);
    label(ctx, S.zeroFeat, PAD, Math.min(h - 12, y3 + 2 * 28 + 34 + g / 2), RED, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={S.unit}>
          <span>{S.unit}</span>
          {S.units.map((name, i) => <button key={name} type="button" className={unit === i ? "on" : ""} onClick={() => setUnit(i)}>{name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={S.bits}>
          <span>{S.bits}</span>
          {S.bitNames.map((name, i) => <button key={name} type="button" className={bi === i ? "on" : ""} onClick={() => setBi(i)}>{name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 · PTQ at step 0, then QAT picks other codes                        */
/* ------------------------------------------------------------------ */

const QRUN = trainQat();
const PTQ_CODES = QRUN[0].codes;
const LOSS_MAX = Math.max(...QRUN.map((s) => s.loss)) * 1.12;
const PERCH_LOSS = setLoss(quantizeTable(W_LAST, 4, true).deq);

export function QatScene() {
  const [step, setStep] = useState(0);
  const S = U.qat;
  const snap = QRUN[step];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const small = w < 420, g = Math.max(0, (h - 440) / 4);
    const cw = small ? 36 : 44, ch = small ? 25 : 27, labW = small ? 46 : 58, gx = PAD + labW;
    label(ctx, `${S.codes}`, PAD, 16, AMBER, 11);
    label(ctx, `s = ${fix(QAT_SCALE, 3)}`, w - PAD, 16, palette.muted, 11, "right");
    const y1 = 32;
    let changed = 0;
    valueGrid(ctx, snap.codes, gx, y1, cw, ch, {
      tone: AMBER, text: (v) => String(v),
      fill: (r, c) => { const d = snap.codes[r][c] !== PTQ_CODES[r][c]; if (d) changed++; return d ? tint(palette.accentRgb, 0.32) : null; },
    });
    NAMES.forEach((nm, i) => label(ctx, nm, PAD, y1 + i * ch + ch / 2, palette.ink, 12));
    const tx = gx + 6 * cw + 14;
    if (tx + 80 < w) {
      label(ctx, `${S.changed}`, tx, y1 + ch / 2, palette.muted, 11);
      label(ctx, `${changed} / 18`, tx, y1 + ch / 2 + 18, AMBER, 13);
      if (step === 0) label(ctx, S.ptqStep, tx, y1 + ch / 2 + 40, palette.muted, 11);
    }

    // the mismatch over eight photos, step by step
    const top = y1 + 3 * ch + 40 + g / 2, bot = top + 100 + g, lx = PAD + 44, rx = w - PAD - 6;
    const X = (s: number) => lx + (s / QAT_STEPS) * (rx - lx), Y = (v: number) => bot - (v / LOSS_MAX) * (bot - top);
    label(ctx, S.loss, PAD, top - 14, palette.muted, 11);
    line(ctx, lx, bot, rx, bot, palette.frame, 1);
    line(ctx, lx, Y(PERCH_LOSS), rx, Y(PERCH_LOSS), GREEN, 1.4, [5, 4]);
    if (small) label(ctx, `${S.perCh} ${fix(PERCH_LOSS, 4)}`, PAD, bot + 30, GREEN, 11);
    else label(ctx, `${S.perCh} ${fix(PERCH_LOSS, 4)}`, rx, top - 14, GREEN, 11, "right");
    [0, 0.01, 0.02].forEach((v) => label(ctx, fix(v, 2), lx - 6, Y(v), palette.muted, 10, "right"));
    [0, 20, 40, 60].forEach((s) => label(ctx, String(s), X(s), bot + 12, palette.muted, 11, "center"));
    ctx.save(); ctx.strokeStyle = BLUE; ctx.lineWidth = 1.8; ctx.beginPath();
    QRUN.forEach((r, s) => { if (s === 0) ctx.moveTo(X(s), Y(r.loss)); else ctx.lineTo(X(s), Y(r.loss)); });
    ctx.stroke(); ctx.restore();
    ctx.fillStyle = BLUE; ctx.beginPath(); ctx.arc(X(step), Y(snap.loss), 4.5, 0, Math.PI * 2); ctx.fill();
    label(ctx, fix(snap.loss, 4), Math.min(X(step) + 8, rx - 50), Y(snap.loss) - 12, BLUE, 11);

    // one cell, three values: the float QAT keeps, the stored integer, the restored value
    const yc = bot + (small ? 54 : 34);
    const m = snap.master[0][4], code = snap.codes[0][4];
    label(ctx, `${S.cell}: ${S.floatV} ${fix(m, 3)} · ${S.codeV} ${code} · ${S.deqV} ${fix(code * QAT_SCALE, 3)}`, PAD, yc, palette.ink, small ? 11 : 12);

    const yb = yc + 24 + g / 3;
    label(ctx, S.probs, PAD, yb, palette.ink, 11);
    shareRows(ctx, [[S.float, P_SET[0]], [S.ptq, QRUN[0].probsA], [S.now, snap.probsA]], yb + 12, w, 26, small);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{S.step} <b>{step}</b></span>
          <input type="range" min={0} max={QAT_STEPS} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

