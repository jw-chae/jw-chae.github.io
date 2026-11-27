"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, bar, frame, type Ctx } from "./kit";
import { ovCopy } from "./ov-copy";
import {
  ACT_W, ANCHORS_REAL, DELTAS, EMB, FEAT, FUSION_LISTS, GRID, IDX, K_EMB, NQ_PAPER, NQ_TOY, OBJ_ANY, PROMPT_BOX, PROMPT_CELLS, TEXT_REFINED, VOCAB,
  dot, fold, gate, idOf, kept, macsFolded, macsTwoStep, maxSim, scoreName, topQueries, twoWays, visualPrompt, type Mat, type NameKey,
} from "./ov-math";
import { GT, OUT, PAD, READ, TINT, cellNum, cellTag, drawBox, drawGridOver, drawPicture, fillCell, fitLabel, fix, layout, num, outlineCell, vec } from "./yolo-draw";
import { heat, tag, terms } from "./ov-scenes";

const U = ovCopy.ui;
const NM = U.names;
const par = (v: number) => (v < 0 ? `(${num(v)})` : num(v));

/** A small matrix as cells with numbers; returns its width. */
function mgrid(ctx: Ctx, m: Mat, x: number, y: number, cw: number, ch: number, tone: string, cap?: string, hiRow = -1) {
  m.forEach((row, r) => row.forEach((v, c) => {
    ctx.fillStyle = r === hiRow ? TINT : "#ffffff";
    ctx.fillRect(x + c * cw, y + r * ch, cw, ch);
    ctx.strokeStyle = palette.frame; ctx.lineWidth = 1;
    ctx.strokeRect(x + c * cw + 0.5, y + r * ch + 0.5, cw - 1, ch - 1);
    fitLabel(ctx, num(v), x + c * cw + cw / 2, y + r * ch + ch / 2 + 0.5, cw - 4, palette.ink, 12, "center");
  }));
  frame(ctx, x, y, m[0].length * cw, m.length * ch, tone, 1.5);
  if (cap) label(ctx, cap, x, y - 11, tone, 11);
  return m[0].length * cw;
}

/** How the prose names a cell: its letter, or the part of the picture it holds. */
const cellName = (i: number) => {
  const r = Math.floor(i / GRID), c = i % GRID, id = idOf(r, c);
  if (id) return id;
  return ({ 12: "꼬리 cell", 13: "발 cell", 15: "컵 아래 cell" } as Record<number, string>)[i] ?? `${r + 1}행 ${c + 1}열`;
};

/* ------------------------------------------------------------------ */
/* 07 · Fusion: YOLO-World's max-sigmoid gate, Grounding DINO's query   */
/*      selection, both computed on the toy cell vectors                */
/* ------------------------------------------------------------------ */

export function FusionScene() {
  const [mode, setMode] = useState(0);
  const [li, setLi] = useState(0);
  const T = U.fusion;
  const names: NameKey[] = FUSION_LISTS[li];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    label(ctx, mode === 0 ? T.gateTitle : T.maxTitle, L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { fade: 0.75, loading: U.pic.loading });
    const fs = L.pw < 260 ? 11.5 : 12;
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };
    const cs = L.s / GRID;

    if (mode === 0) {
      for (let i = 0; i < GRID * GRID; i++) {
        const r = Math.floor(i / GRID), c = i % GRID, g = gate(i, names);
        fillCell(ctx, L, r, c, `rgba(${palette.normalRgb},${0.04 + 1.1 * Math.max(0, g - 0.5)})`);
        cellNum(ctx, L, r, c, fix(g, 3), g > 0.75 ? palette.ink : palette.muted);
      }
      drawGridOver(ctx, L, { letters: false, alpha: 0.2 });
      cellTag(ctx, L, "A", OUT);
      outlineCell(ctx, L, 2, 1, OUT, 2);
      const O = EMB[IDX.A], m = maxSim(IDX.A, names), g = gate(IDX.A, names);
      line(T.dots, palette.muted, 11, 22);
      names.forEach((n) => line(`${NM[n]}  ${fix(scoreName(IDX.A, n), 2)}`, palette.ink, fs, 21));
      y += 4;
      line(`${T.max} = ${fix(m, 2)}`, palette.ink, fs, 22);
      line(`${T.gateA} = σ(${fix(m, 2)}) = ${fix(g, 3)}`, READ, 13, 28);
      line(T.featA, palette.muted, 11, 18);
      line(`${fix(g, 3)} × ${vec(O)}`, palette.ink, fs, 20);
      line(`= ${vec(O.map((v) => v * g), 2)}`, OUT, fs, 28);
      line(T.redo, palette.muted, 11, 20);
    } else {
      const picks = topQueries(names);
      for (let i = 0; i < GRID * GRID; i++) {
        const r = Math.floor(i / GRID), c = i % GRID, v = maxSim(i, names), k = picks.indexOf(i);
        fillCell(ctx, L, r, c, heat(v, 3.2));
        if (k >= 0) outlineCell(ctx, L, r, c, OUT, 2.4);
        cellNum(ctx, L, r, c, fix(v, 2), v > 1.6 ? palette.ink : palette.muted);
      }
      drawGridOver(ctx, L, { letters: false, alpha: 0.2 });
      picks.forEach((i, k) => tag(ctx, L.px + (i % GRID) * cs + cs - 25, L.py + Math.floor(i / GRID) * cs + 3, String(k + 1), OUT));
      line(`${T.pick} ${NQ_TOY}`, palette.muted, 11, 24);
      picks.forEach((i, k) => line(`${k + 1}${T.rank}  ${cellName(i)}  ${fix(maxSim(i, names), 2)}`, OUT, fs, 22));
      y += 6;
      line(T.nq, palette.muted, 11, 22);
      line(`N_q: ${NQ_TOY} / ${NQ_PAPER}`, palette.muted, 11, 26);
      line(T.redoGd, palette.muted, 11, 20);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.mode}>
          <span>{T.mode}</span>
          {T.modes.map((n, i) => <button key={n} type="button" className={mode === i ? "on" : ""} onClick={() => setMode(i)}>{n}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.list}>
          <span>{T.list}</span>
          {T.lists.map((n, i) => <button key={n} type="button" className={li === i ? "on" : ""} onClick={() => setLi(i)}>{n}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · RepRTA: two products in training, one folded 1×1 conv in use    */
/* ------------------------------------------------------------------ */

export function FoldScene() {
  const [step, setStep] = useState(0);
  const [li, setLi] = useState(0);
  const T = U.fold;
  const names: NameKey[] = li === 0 ? ["cat", "cup"] : ["cat", "cup", "siam", "hat"];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = h > w * 1.15, fs = w < 420 ? 11.5 : 12;
    const I = FEAT[IDX.A], tw2 = twoWays(IDX.A, names), Kp = fold(names), Pt = names.map((n) => TEXT_REFINED[n]);
    const cw = port ? 38 : w < 560 ? 38 : 40, ch = port ? 24 : 27;
    const y = 30;
    label(ctx, `${T.feat} = ${vec(I)}`, PAD, 16, palette.ink, 12);

    if (step === 0) {
      const kx = PAD, ky = y + 16;
      const kw = mgrid(ctx, K_EMB, kx, ky, cw, ch, READ, T.k);
      const ox = kx + kw + 56;
      arrow(ctx, kx + kw + 6, ky + 1.5 * ch, ox - 6, ky + 1.5 * ch, palette.muted);
      mgrid(ctx, tw2.O.map((v) => [v]), ox, ky, cw, ch, READ, T.o);
      label(ctx, `K · I`, kx + kw + 28, ky + 1.5 * ch - 12, palette.muted, 11, "center");
      let yy = ky + 3 * ch + 36;
      label(ctx, T.pt, PAD, yy - 14, OUT, 11);
      const px = PAD + 62;
      mgrid(ctx, Pt, px, yy, cw, ch, OUT);
      names.forEach((n, r) => {
        label(ctx, NM[n], PAD, yy + r * ch + ch / 2, palette.ink, fs);
        label(ctx, `O·P̃ = ${fix(tw2.twoStep[r], 3)}`, px + 3 * cw + 12, yy + r * ch + ch / 2, palette.ink, fs);
      });
      yy += names.length * ch + 26;
      fitLabel(ctx, `${NM.cat}: ${terms(tw2.O, TEXT_REFINED.cat)} = ${fix(tw2.twoStep[0], 2)}`, PAD, yy, w - 2 * PAD, palette.muted, 11.5);
      yy += 24;
      fitLabel(ctx, `${T.macs}: ${T.twoStep} ${macsTwoStep(names.length)}${T.times}`, PAD, yy, w - 2 * PAD, palette.muted, 11);
    } else if (step === 1) {
      const ky = y + 16;
      label(ctx, T.kp, PAD, ky - 11, OUT, 11);
      mgrid(ctx, Pt, PAD, ky, cw, ch, OUT, undefined, 0);
      label(ctx, "×", PAD + 3 * cw + 12, ky + 1.5 * ch, palette.muted, 15, "center");
      const kx = PAD + 3 * cw + 24, kw = mgrid(ctx, K_EMB, kx, ky, cw, ch, READ);
      const side = kx + kw + 34 + 4 * (cw + 8) <= w - PAD;
      const rx = side ? kx + kw + 34 : PAD, ry = side ? ky : ky + Math.max(names.length, 3) * ch + 30;
      if (side) label(ctx, "=", kx + kw + 17, ky + 1.5 * ch, palette.muted, 15, "center");
      mgrid(ctx, Kp, rx, ry, cw + 8, ch, OUT, side ? undefined : "K′", 0);
      let yy = Math.max(ky + Math.max(names.length, 3) * ch, ry + names.length * ch) + 30;
      const p = TEXT_REFINED.cat;
      label(ctx, `K′${T.rowOf} ${NM.cat} ${T.row} =`, PAD, yy, palette.muted, 11); yy += 20;
      K_EMB.forEach((row, d) => { fitLabel(ctx, `${d ? "+ " : "  "}${par(p[d])} × ${vec(row)}`, PAD, yy, w - 2 * PAD, palette.ink, fs); yy += 19; });
      fitLabel(ctx, `= ${vec(Kp[0])}`, PAD, yy, w - 2 * PAD, OUT, 12.5); yy += 26;
      fitLabel(ctx, `${T.once}: f_θ(P), K′`, PAD, yy, w - 2 * PAD, palette.muted, 11);
    } else {
      const ky = y + 16;
      mgrid(ctx, Kp, PAD, ky, cw + 8, ch, OUT, "K′");
      const sx = PAD + 4 * (cw + 8) + 44;
      arrow(ctx, PAD + 4 * (cw + 8) + 6, ky + (names.length * ch) / 2, sx - 6, ky + (names.length * ch) / 2, palette.muted);
      label(ctx, "· I", PAD + 4 * (cw + 8) + 22, ky + (names.length * ch) / 2 - 12, palette.muted, 11, "center");
      names.forEach((n, r) => label(ctx, `${NM[n]} ${fix(tw2.oneStep[r], 3)}`, sx, ky + r * ch + ch / 2, OUT, fs));
      let yy = ky + names.length * ch + 30;
      fitLabel(ctx, `${NM.cat}: ${terms(Kp[0], I)} = ${fix(tw2.oneStep[0], 2)}`, PAD, yy, w - 2 * PAD, palette.muted, 11.5);
      yy += 28;
      const cols = [PAD, PAD + (port ? 80 : 110), PAD + (port ? 170 : 230), PAD + (port ? 262 : 350)];
      [["", T.twoStep, T.oneStep, T.diff], ...names.map((n, r) => [NM[n], fix(tw2.twoStep[r], 3), fix(tw2.oneStep[r], 3), fix(Math.abs(tw2.twoStep[r] - tw2.oneStep[r]), 3)])].forEach((row, r) => {
        row.forEach((cell, c) => label(ctx, cell, cols[c], yy, r === 0 ? palette.muted : c === 3 ? GT : palette.ink, r === 0 ? 11 : fs));
        yy += 21;
      });
      yy += 8;
      fitLabel(ctx, `${T.macs}: ${T.twoStep} ${macsTwoStep(names.length)}${T.times}, ${T.oneStep} ${macsFolded(names.length)}${T.times}`, PAD, yy, w - 2 * PAD, palette.ink, 11.5);
      yy += 20;
      fitLabel(ctx, `${T.perImage}: K′ · I`, PAD, yy, w - 2 * PAD, palette.muted, 11);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.step}>
          <span>{T.step}</span>
          {T.steps.map((n, i) => <button key={n} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {n}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.list}>
          <span>{T.list}</span>
          {T.lists.map((n, i) => <button key={n} type="button" className={li === i ? "on" : ""} onClick={() => setLi(i)}>{n}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · Visual prompt (SAVPE, toy) and prompt-free retrieval (LRPC)     */
/* ------------------------------------------------------------------ */

const fmtSmall = (v: number) => (v >= 0.01 ? fix(v, 2) : v.toFixed(4));

export function PromptScene() {
  const [mode, setMode] = useState(0);
  const [di, setDi] = useState(1);
  const T = U.prompts;
  const delta = DELTAS[di];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    label(ctx, T.modes[mode], L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { fade: 0.75, loading: U.pic.loading });
    const fs = L.pw < 260 ? 11.5 : 12;
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };

    if (mode === 0) {
      const P = visualPrompt(ACT_W);
      for (let i = 0; i < GRID * GRID; i++) {
        const r = Math.floor(i / GRID), c = i % GRID, v = dot(EMB[i], P);
        fillCell(ctx, L, r, c, heat(v, 3.2));
        cellNum(ctx, L, r, c, fix(v, 1), v > 1.6 ? palette.ink : palette.muted);
      }
      drawGridOver(ctx, L, { letters: false, alpha: 0.2 });
      drawBox(ctx, L, PROMPT_BOX, OUT, { lw: 2.2, dash: [6, 4] });
      (["A", "B", "C", "D"] as const).forEach((k) => cellTag(ctx, L, k, OUT));
      line(T.weights, palette.muted, 11, 24);
      PROMPT_CELLS.forEach((_, i) => {
        const k = (["A", "B", "C", "D"] as const)[i];
        label(ctx, k, L.x, y, palette.ink, 13);
        bar(ctx, L.x + 22, y - 5, L.pw * 0.5, 10, ACT_W[i], OUT);
        label(ctx, fix(ACT_W[i], 3), L.x + 30 + L.pw * 0.5, y, palette.ink, fs);
        y += 23;
      });
      y += 6;
      line(`${T.prompt}`, palette.muted, 11, 18);
      line(vec(P), READ, fs, 26);
      line(`${T.scoreA} = ${fix(dot(EMB[IDX.A], P), 2)}`, OUT, 13, 22);
    } else {
      const keep = new Set(kept(delta));
      for (let i = 0; i < GRID * GRID; i++) {
        const r = Math.floor(i / GRID), c = i % GRID, on = keep.has(i);
        fillCell(ctx, L, r, c, on ? TINT : "rgba(255,255,255,0.55)");
        if (on) outlineCell(ctx, L, r, c, OUT, 2);
        cellNum(ctx, L, r, c, fmtSmall(OBJ_ANY[i]), on ? palette.ink : palette.muted);
      }
      drawGridOver(ctx, L, { letters: false, alpha: 0.2 });
      line(`${T.any} · δ = ${delta}`, palette.muted, 11, 26);
      line(`${T.kept} ${keep.size} / ${GRID * GRID}`, OUT, 13, 26);
      line(`${T.compare}`, palette.muted, 11, 19);
      line(`${keep.size} × ${VOCAB} = ${(keep.size * VOCAB).toLocaleString("en-US")}`, OUT, fs, 22);
      line(`${T.all} ${GRID * GRID} × ${VOCAB} = ${(GRID * GRID * VOCAB).toLocaleString("en-US")}`, palette.ink, fs, 30);
      line(T.real, palette.muted, 11, 19);
      line(`= ${(ANCHORS_REAL * VOCAB).toLocaleString("en-US")}`, palette.ink, fs, 20);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.mode}>
          <span>{T.mode}</span>
          {T.modes.map((n, i) => <button key={n} type="button" className={mode === i ? "on" : ""} onClick={() => setMode(i)}>{n}</button>)}
        </div>
        {mode === 1 ? (
          <div className="ad-ctl ad-seg" role="group" aria-label={T.delta}>
            <span>{T.delta}</span>
            {DELTAS.map((d, i) => <button key={d} type="button" className={di === i ? "on" : ""} onClick={() => setDi(i)}>{String(d)}</button>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
