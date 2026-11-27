"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { frame, line } from "./kit";
import { pruneCopy } from "./prune-copy";
import { AMBER, BLUE, GREEN, PAD, RED, fix, hbar, isPortrait, pct, pct2, tint, weightTable, wrapText } from "./prune-kit";
import {
  CSGD, CSGD_MERGED, DENSE, clusterSpread, DISTILL, EYE_CELL, HEAD_RGB, L1_ORDER, L1_UNITS, LLM_K, NET_Q4, NET_Q8, RESCALE_UNIT, RESREP, RESREP_MERGED, RETRAIN,
  STRUCTURED, TOY_BITS, W2SPARSE, accuracy, correct, dropFirst, eyeCorrect, llmPrune, paramCount, pass, prob, type LlmMethod,
} from "./prune-math";

const U = pruneCopy.ui;
const PARTS = U.parts;
const EYE_X = HEAD_RGB[EYE_CELL];
const EYE_H = pass(DENSE, EYE_X).h;

/* ------------------------------------------------------------------ */
/* 06 · whole units by the L1 norm of their incoming weights            */
/* ------------------------------------------------------------------ */

const STRUCT_NETS = STRUCTURED.map((r) => dropFirst(r.k));

export function StructScene() {
  const [k, setK] = useState(0);
  const S = U.struct;
  const row = STRUCTURED[k];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const tall = isPortrait(w, h);
    const gone = new Set(L1_ORDER.slice(0, k));
    const kept = [0, 1, 2, 3, 4, 5, 6, 7].filter((i) => !gone.has(i));
    const ch = tall ? 26 : 24, lx = PAD + 18, gap = tall ? 5 : 10, l1w = tall ? 36 : 66, ew = tall ? 34 : 42;
    const cw = Math.min(44, (w - 2 * PAD - 18 - 3 * gap - l1w - ew) / 8);
    const l1x = lx + 3 * cw + gap, ex = l1x + l1w + gap, w2x = ex + ew + gap;
    const ty = 44, digits = cw < 34 ? 1 : 2, small = cw < 34 ? 9 : undefined;

    label(ctx, S.w1, lx, ty - 30, palette.muted, 11);
    U.rgb.forEach((c, j) => label(ctx, c, lx + j * cw + cw / 2, ty - 12, palette.muted, 10, "center"));
    label(ctx, S.l1, l1x, ty - 12, palette.muted, 10);
    label(ctx, S.eyeVal, ex + ew / 2, ty - 12, BLUE, 10, "center");
    label(ctx, `${S.w2}ᵀ`, w2x, ty - 30, palette.muted, 11);
    PARTS.forEach((p, j) => label(ctx, p.slice(0, tall ? 1 : 2), w2x + j * cw + cw / 2, ty - 12, j === 4 ? BLUE : palette.muted, 10, "center"));

    kept.forEach((u, r) => {
      const y = ty + r * ch;
      label(ctx, `${u + 1}`, PAD + 6, y + ch / 2, palette.muted, 11, "center");
      weightTable(ctx, [DENSE.W1[u]], lx, y, cw, ch, { max: 7.1, digits, size: small });
      const bw = tall ? l1w : l1w - 34;
      ctx.fillStyle = palette.track; ctx.fillRect(l1x, y + 6, bw, ch - 12);
      ctx.fillStyle = tint(palette.accentRgb, 0.7); ctx.fillRect(l1x, y + 6, (bw * L1_UNITS[u]) / 14.2, ch - 12);
      if (!tall) label(ctx, fix(L1_UNITS[u]), l1x + bw + 4, y + ch / 2, palette.ink, 10);
      else label(ctx, fix(L1_UNITS[u], 1), l1x + 2, y + ch / 2, palette.ink, 9);
      ctx.fillStyle = tint(palette.normalRgb, 0.1); ctx.fillRect(ex, y + 2, ew, ch - 4);
      label(ctx, fix(EYE_H[u], digits), ex + ew / 2, y + ch / 2, EYE_H[u] > 0 ? BLUE : palette.muted, tall ? 9 : 11, "center");
      weightTable(ctx, [DENSE.W2.map((rr) => rr[u])], w2x, y, cw, ch, { max: 7.2, digits, size: small });
    });

    const sy = ty + kept.length * ch + 24;
    if (k > 0) label(ctx, `${S.k}: ${L1_ORDER.slice(0, k).map((u) => `${u + 1}`).join(", ")}`, PAD, sy, RED, 11);
    const n = STRUCT_NETS[k], yy = sy + 22;
    label(ctx, `${S.params} ${paramCount(n)} / 64 · W1 ${n.W1.length}×3, W2 5×${n.W1.length}`, PAD, yy, palette.ink, 11);
    label(ctx, `${S.oneshot} ${pct(row.oneshot)} · ${U.eyeP} ${pct2(prob(n, EYE_CELL, 4))}`, PAD, yy + 19, palette.muted, 11);
    label(ctx, `${S.retrained} ${pct(row.retrain)} · ${U.eyeP} ${pct2(row.eyeProb)}`, PAD, yy + 38, AMBER, 11);
    label(ctx, U.measured, w - PAD, h - 12, palette.muted, 10, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{S.k} <b>{k}</b></span>
          <input type="range" min={0} max={STRUCTURED.length - 1} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · C-SGD and ResRep                                                */
/* ------------------------------------------------------------------ */

const CLUSTER_RGB = [palette.accentRgb, palette.normalRgb, "124,58,237", "15,157,106"];
const CS_ORDER = CSGD.clusters.flat();
const clusterOf = (u: number) => CSGD.clusters.findIndex((c) => c.includes(u));

export function DingScene() {
  const [method, setMethod] = useState(0);
  const [step, setStep] = useState(0);
  const S = U.ding;
  const snaps = method === 0 ? CSGD.snaps : RESREP.snaps;
  const last = snaps.length;                       // one more position: after merging
  const idx = Math.min(step, last);
  const merged = idx === last;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const tall = isPortrait(w, h);
    const cw = tall ? 40 : 48, ch = tall ? 26 : 24, lx = PAD + 26, ty = 50;
    let acc = 0, eyeP = 0;

    if (method === 0) {
      if (!merged) {
        const sn = CSGD.snaps[idx];
        acc = sn.acc; eyeP = sn.eyeProb;
        label(ctx, `W1 + b  · ${S.step} ${sn.step}`, PAD, 14, palette.muted, 11);
        [...U.rgb, "b"].forEach((c, j) => label(ctx, c, lx + j * cw + cw / 2, ty - 10, palette.muted, 10, "center"));
        CS_ORDER.forEach((u, r) => {
          const y = ty + r * ch, cl = clusterOf(u);
          ctx.fillStyle = tint(CLUSTER_RGB[cl], 0.85); ctx.fillRect(PAD, y + 2, 6, ch - 4);
          label(ctx, `${u + 1}`, PAD + 16, y + ch / 2, palette.muted, 11, "center");
          weightTable(ctx, [[...sn.W1[u], sn.b1[u]]], lx, y, cw, ch, { max: 7.1 });
          frame(ctx, lx + 0.5, y + 0.5, 4 * cw - 1, ch - 1, tint(CLUSTER_RGB[cl], 0.9), 1.6);
        });
        const sx = lx + 4 * cw + 14;
        CSGD.clusters.forEach((c, j) => {
          const y0 = ty + CS_ORDER.indexOf(c[0]) * ch;
          const spread = clusterSpread(sn.W1, [c]);
          if (c.length > 1) label(ctx, `${fix(spread, 3)}`, sx, y0 + (c.length * ch) / 2, tint(CLUSTER_RGB[j], 1), 11);
        });
        label(ctx, S.spread, sx, ty - 26, palette.muted, 10);
      } else {
        acc = CSGD.after; eyeP = CSGD.eyeAfter;
        label(ctx, `${S.merged}: W1 4 × 3 + b, W2 5 × 4`, PAD, 14, palette.muted, 11);
        const mx = PAD + 50, mc = Math.min(44, (w - 2 * PAD - 50 - 14) / 9), w2x = mx + 4 * mc + 14;
        [...U.rgb, "b"].forEach((c, j) => label(ctx, c, mx + j * mc + mc / 2, ty - 10, palette.muted, 10, "center"));
        PARTS.forEach((p, j) => label(ctx, p.slice(0, tall ? 1 : 2), w2x + j * mc + mc / 2, ty - 10, palette.muted, 10, "center"));
        label(ctx, `W2ᵀ (${S.sum})`, w2x, ty - 26, palette.muted, 10);
        CSGD.clusters.forEach((c, r) => {
          const y = ty + r * (ch + 8);
          ctx.fillStyle = tint(CLUSTER_RGB[r], 0.85); ctx.fillRect(PAD, y + 2, 6, ch - 4);
          label(ctx, c.map((u) => u + 1).join("+"), PAD + 10, y + ch / 2, palette.ink, 10);
          weightTable(ctx, [[...CSGD_MERGED.W1[r], CSGD_MERGED.b1[r]]], mx, y, mc, ch, { max: 7.1, size: tall ? 9 : 10 });
          weightTable(ctx, [CSGD_MERGED.W2.map((rr) => rr[r])], w2x, y, mc, ch, { max: 11.2, size: tall ? 9 : 10 });
        });
      }
    } else {
      const sn = RESREP.snaps[Math.min(idx, last - 1)];
      if (!merged) {
        acc = sn.acc; eyeP = sn.eyeProb;
        label(ctx, `${S.qnorm} · ${S.step} ${sn.step}`, PAD, 14, palette.muted, 11);
        const bx = PAD + 26, bw = w - 2 * PAD - 26 - 56, bh = tall ? 22 : 20;
        for (let u = 0; u < 8; u++) {
          const y = ty + u * (bh + 8), f = sn.mask[u] === 0;
          label(ctx, `${u + 1}`, PAD + 8, y + bh / 2, palette.muted, 11, "center");
          ctx.fillStyle = palette.track; ctx.fillRect(bx, y, bw, bh);
          ctx.fillStyle = f ? tint(palette.anomalyRgb, 0.75) : tint(palette.normalRgb, 0.7);
          ctx.fillRect(bx, y, Math.max(1, (bw * Math.min(sn.norms[u], 1.5)) / 1.5), bh);
          line(ctx, bx + bw / 1.5, y - 2, bx + bw / 1.5, y + bh + 2, "rgba(15,23,42,0.3)", 1, [2, 2]);
          label(ctx, fix(sn.norms[u], 4), bx + bw + 6, y + bh / 2, f ? RED : palette.ink, 11);
        }
        label(ctx, "1", PAD + 26 + (w - 2 * PAD - 26 - 56) / 1.5, ty - 8, palette.muted, 10, "center");
        const ly = ty + 8 * (bh + 8) + 6;
        ctx.fillStyle = tint(palette.anomalyRgb, 0.75); ctx.fillRect(PAD, ly - 5, 12, 10);
        label(ctx, S.forget, PAD + 18, ly, RED, 11);
        ctx.fillStyle = tint(palette.normalRgb, 0.7); ctx.fillRect(PAD + 130, ly - 5, 12, 10);
        label(ctx, S.keep, PAD + 148, ly, BLUE, 11);
      } else {
        acc = RESREP.mergedAcc; eyeP = prob(RESREP_MERGED, EYE_CELL, 4);
        label(ctx, `${S.merged}: ${S.folded}, W1′ 4 × 3, b′`, PAD, 14, palette.muted, 11);
        [...U.rgb, "b′"].forEach((c, j) => label(ctx, c, lx + j * cw + cw / 2, ty - 10, palette.muted, 10, "center"));
        RESREP.kept.forEach((u, r) => {
          const y = ty + r * (ch + 8);
          label(ctx, `${u + 1}`, PAD + 10, y + ch / 2, palette.muted, 11, "center");
          weightTable(ctx, [[...RESREP_MERGED.W1[r], RESREP_MERGED.b1[r]]], lx, y, cw, ch, { max: 7.1 });
        });
      }
    }

    const ry = h - 60;
    label(ctx, `${U.acc} ${pct(acc)}`, PAD, ry, palette.ink, 12);
    label(ctx, `${U.eyeP} ${pct2(eyeP)}`, PAD, ry + 20, BLUE, 12);
    label(ctx, U.measured, w - PAD, h - 12, palette.muted, 10, "right");
  });

  const stepLabel = merged ? S.merged : `${snaps[idx].step}`;
  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={S.method}>
          <span>{S.method}</span>
          {S.methods.map((name, j) => <button key={name} type="button" className={method === j ? "on" : ""} onClick={() => setMethod(j)}>{name}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{S.step} <b>{stepLabel}</b></span>
          <input type="range" min={0} max={last} step={1} value={idx} onChange={(e) => setStep(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · magnitude, Wanda, and Wanda with the kept weights re-solved     */
/* ------------------------------------------------------------------ */

const LLM_METHODS: LlmMethod[] = ["mag", "wanda", "update"];
const LLM_RES = [false, true].map((resc) => LLM_METHODS.map((m) => {
  const r = llmPrune(m, resc);
  return { ...r, correct: correct(r.net), eye: eyeCorrect(r.net), eyeP: prob(r.net, EYE_CELL, 4) };
}));

export function LlmScene() {
  const [mi, setMi] = useState(0);
  const [resc, setResc] = useState(0);
  const S = U.llm;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const tall = isPortrait(w, h);
    const R = LLM_RES[resc][mi];
    const lw = 46, cw = Math.min(56, (w - 2 * PAD - lw) / 8), tx = PAD + lw;

    // input lengths, log scale
    const nTop = 30, nH = tall ? 100 : 86, lo = 0.5, hi = 3.1;
    label(ctx, `${S.norms} · ${S.log}`, PAD, 12, palette.muted, 11);
    [1, 10, 100, 1000].forEach((v) => {
      const yy = nTop + nH - ((Math.log10(v) - lo) / (hi - lo)) * nH;
      line(ctx, tx, yy, tx + 8 * cw, yy, "rgba(15,23,42,0.07)", 1);
      label(ctx, `${v}`, tx - 6, yy, palette.muted, 9, "right");
    });
    R.norms.forEach((v, j) => {
      const top = nTop + nH - ((Math.log10(v) - lo) / (hi - lo)) * nH;
      ctx.fillStyle = j === RESCALE_UNIT ? tint(palette.accentRgb, 0.8) : tint(palette.normalRgb, 0.6);
      ctx.fillRect(tx + j * cw + cw * 0.2, top, cw * 0.6, nTop + nH - top);
      label(ctx, fix(v, 1), tx + j * cw + cw / 2, top - 7, palette.ink, cw < 40 ? 9 : 10, "center");
    });

    // W2 with each row's four cut weights
    const ty = nTop + nH + 46, ch = tall ? 28 : 24;
    label(ctx, S.table, PAD, ty - 30, palette.muted, 11);
    for (let j = 0; j < 8; j++) label(ctx, `${j + 1}`, tx + j * cw + cw / 2, ty - 7, j === RESCALE_UNIT ? AMBER : palette.muted, 10, "center");
    PARTS.forEach((p, i) => label(ctx, p, PAD, ty + i * ch + ch / 2, i === 4 ? BLUE : palette.muted, 10));
    weightTable(ctx, R.net.W2, tx, ty, cw, ch, { mask: R.mask, max: 7.2, size: cw < 40 ? 9 : undefined, text: (v) => fix(v, Math.abs(v) < 1 && v !== 0 ? 3 : 2) });
    if (resc) frame(ctx, tx + 1, ty - 1, cw - 2, 5 * ch + 2, AMBER, 2);
    const cut1 = 5 - R.mask.reduce((s, row) => s + row[RESCALE_UNIT], 0);

    const ry = ty + 5 * ch + 26;
    label(ctx, `${S.cutCol} ${cut1} / 5 · ${S.perRow} ${LLM_K} / 8`, PAD, ry, palette.muted, 11);
    label(ctx, `${U.acc} ${R.correct} / 256 (${pct(R.correct / 256)})`, PAD, ry + 20, palette.ink, 12);
    label(ctx, `${U.eye11} ${R.eye} · ${U.eyeP} ${pct2(R.eyeP)}`, PAD, ry + 40, BLUE, 12);
    label(ctx, U.measured, w - PAD, h - 12, palette.muted, 10, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={S.method}>
          <span>{S.method}</span>
          {S.methods.map((name, j) => <button key={name} type="button" className={mi === j ? "on" : ""} onClick={() => setMi(j)}>{name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={S.unit1}>
          <span>{S.unit1}</span>
          {S.unit1s.map((name, j) => <button key={name} type="button" className={resc === j ? "on" : ""} onClick={() => setResc(j)}>{name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 · the three ways side by side on the same toy                     */
/* ------------------------------------------------------------------ */

const ROW_S50 = RETRAIN.find((r) => r.s === 0.5)!;
const CMP = {
  bits: [TOY_BITS.dense, TOY_BITS.csr50, TOY_BITS.w24, TOY_BITS.units4, TOY_BITS.q8, TOY_BITS.q4, TOY_BITS.student4, TOY_BITS.units4],
  acc: [accuracy(DENSE), ROW_S50.retrain, W2SPARSE.r24, STRUCTURED[4].retrain, accuracy(NET_Q8), accuracy(NET_Q4), DISTILL.kd, DISTILL.pruneKd],
  eye: [eyeCorrect(DENSE), ROW_S50.eye, W2SPARSE.r24eye, STRUCTURED[4].eye, eyeCorrect(NET_Q8), eyeCorrect(NET_Q4), DISTILL.kdEye, DISTILL.pruneKdEye],
};

export function CompareScene() {
  const [sel, setSel] = useState(1);
  const S = U.compare;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const tall = isPortrait(w, h);
    const nameW = tall ? 92 : 108, bx = PAD + nameW, bw = w - PAD - bx - 96, rh = tall ? 17 : 15;
    const chart = (y0: number, title: string, vals: number[], max: number, fmt: (v: number, i: number) => string, ref100: number | null) => {
      label(ctx, title, PAD, y0 - 10, palette.muted, 11);
      S.names.forEach((name, i) => {
        const y = y0 + i * rh, on = i === sel;
        label(ctx, name, PAD, y + rh / 2 - 1, on ? palette.ink : palette.muted, on ? 11 : 10);
        hbar(ctx, bx, y + 2, bw, rh - 5, vals[i] / max, on ? tint(palette.accentRgb, 0.9) : "rgba(91,100,116,0.32)", fmt(vals[i], i), on ? palette.ink : palette.muted);
      });
      if (ref100 !== null) line(ctx, bx + bw * ref100, y0 - 2, bx + bw * ref100, y0 + 8 * rh, GREEN, 1.2, [3, 3]);
    };
    const y1 = 24, y2 = y1 + 8 * rh + 34;
    chart(y1, S.size, CMP.bits.map((b) => b / TOY_BITS.dense), 1.3, (v) => `${Math.round(v * 100)}%`, 1 / 1.3);
    chart(y2, S.acc, CMP.acc, 1, (v, i) => `${pct(v)} · ${S.eye} ${CMP.eye[i]}`, null);

    const py = y2 + 8 * rh + 22, row = S.rows[sel];
    let yy = py;
    [[S.reduces, row[0]], [S.needs, row[1]], [S.faster, row[2]]].forEach(([k, v]) => {
      label(ctx, k, PAD, yy, AMBER, 11);
      yy = wrapText(ctx, v, PAD + (tall ? 0 : 132), tall ? yy + 16 : yy, w - 2 * PAD - (tall ? 0 : 132), 15, palette.ink, 11) + 3;
    });
    label(ctx, U.measured, w - PAD, h - 12, palette.muted, 10, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={S.method}>
          <span>{S.method}</span>
          {S.names.map((name, j) => <button key={name} type="button" className={sel === j ? "on" : ""} onClick={() => setSel(j)}>{name}</button>)}
        </div>
      </div>
    </div>
  );
}
