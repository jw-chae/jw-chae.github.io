"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, bar, frame, type Ctx } from "./kit";
import { yoloCopy } from "./yolo-copy";
import {
  ACT_W, ANCHORS_REAL, DELTAS, EMB, FEAT, GRID, IDX, K_CLS, K_EMB, NAME_KEYS, OBJ_ANY, PROMPT_CELLS, RC, TEXT, TEXT_REFINED, V10_ROAD_M, V10_ROAD_S, VOCAB,
  dot, fold, kept, macsFolded, macsTwoStep, matVec, scoreName, twoWays, visualPrompt, type Mat, type NameKey,
} from "./yolo-math";
import { BAD, GT, OUT, PAD, READ, TINT, cellTag, drawBox, drawGridOver, drawPicture, fillCell, fitLabel, fix, layout, num, outlineCell, vec } from "./yolo-draw";

const U = yoloCopy.ui;
const par = (v: number) => (v < 0 ? `(${num(v)})` : num(v));
const terms = (a: number[], b: number[]) => a.map((v, j) => `${par(v)}×${par(b[j])}`).join(" + ");

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

/* ------------------------------------------------------------------ */
/* 05 · YOLOv10's roadmap: params, FLOPs, latency, AP                   */
/* ------------------------------------------------------------------ */

export function DesignScene() {
  const [step, setStep] = useState(1);
  const [model, setModel] = useState(0);
  const T = U.design;
  const road = model === 0 ? V10_ROAD_S : V10_ROAD_M;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = h > w * 1.15;
    const cur = road[step], prev = road[Math.max(0, step - 1)], base = road[0];
    const sName = (i: number) => (model === 1 && i === road.length - 1 ? T.lastM : T.steps[i]);
    label(ctx, `YOLOv8-${T.models[model]}${T.from} YOLOv10-${T.models[model]}${T.to}`, PAD, 18, palette.muted, 11);
    fitLabel(ctx, `${step + 1}. ${sName(step)}`, PAD, 42, w - 2 * PAD, OUT, 15);

    const keys: ("params" | "flops" | "lat" | "ap")[] = ["params", "flops", "lat", "ap"];
    const nameW = port ? 66 : 80, valW = port ? 118 : 150, bw = w - 2 * PAD - nameW - valW;
    let y = 82;
    keys.forEach((k, i) => {
      const v = cur[k], pv = prev[k], b0 = base[k];
      label(ctx, T.rows[i], PAD, y, palette.ink, 12);
      if (k !== "ap") {
        const share = v / b0, pshare = pv / b0, x0 = PAD + nameW;
        bar(ctx, x0, y - 7, bw, 14, share, `rgba(${palette.normalRgb},0.55)`);
        if (step > 0 && Math.abs(pv - v) > 1e-9) {
          const lo = Math.min(share, pshare), hi = Math.max(share, pshare);
          ctx.fillStyle = v < pv ? `rgba(15,157,106,0.55)` : `rgba(${palette.anomalyRgb},0.55)`;
          ctx.fillRect(x0 + bw * lo, y - 7, bw * (hi - lo), 14);
        }
        label(ctx, `${Math.round(share * 100)}%`, x0 + bw * share + 4, y + 16, palette.muted, 11);
      }
      const unit = T.units[i];
      label(ctx, `${num(v, 2)}${unit}`, w - PAD, y - 5, palette.ink, 13, "right");
      if (step > 0) {
        const d = v - pv, good = k === "ap" ? d > 0 : d < 0;
        const s = Math.abs(d) < 1e-9 ? "±0" : `${d > 0 ? "+" : "−"}${num(Math.abs(d), 2)}${unit}`;
        label(ctx, `${T.vsPrev} ${s}`, w - PAD, y + 12, Math.abs(d) < 1e-9 ? palette.muted : good ? GT : BAD, 11, "right");
      }
      y += port ? 50 : 54;
    });

    y += 4;
    road.forEach((_, i) => {
      const color = i === step ? OUT : i < step ? palette.ink : palette.muted;
      fitLabel(ctx, `${i + 1}. ${sName(i)}`, PAD, y, w - 2 * PAD, color, i === step ? 12.5 : 11.5);
      y += port ? 21 : 19;
    });
    fitLabel(ctx, T.source, PAD, h - 14, w - 2 * PAD, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{T.step} <b>{step + 1}</b> · {model === 1 && step === road.length - 1 ? T.lastM : T.steps[step]}</span>
          <input type="range" min={0} max={road.length - 1} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.model}>
          <span>{T.model}</span>
          {T.models.map((n, i) => <button key={n} type="button" className={model === i ? "on" : ""} onClick={() => setModel(i)}>{n}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · A closed head versus names as vectors                           */
/* ------------------------------------------------------------------ */

const heat = (v: number, max: number) => (v <= 0.02 ? "rgba(255,255,255,0)" : `rgba(${palette.normalRgb},${0.08 + 0.55 * Math.min(1, v / max)})`);

export function VocabScene() {
  const [head, setHead] = useState(1);
  const [ni, setNi] = useState(0);
  const T = U.vocab;
  const name = NAME_KEYS[ni];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    label(ctx, `${T.name}: ${T.names[name]}`, L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { fade: 0.75 });
    const closedRow = name === "cat" ? 0 : name === "cup" ? 1 : -1;
    const has = head === 1 || closedRow >= 0;
    const cs = L.s / GRID;
    const score = (i: number) => (head === 0 ? matVec(K_CLS, FEAT[i])[closedRow] : scoreName(i, name));
    if (has) {
      for (let i = 0; i < GRID * GRID; i++) {
        const r = Math.floor(i / GRID), c = i % GRID, v = score(i);
        fillCell(ctx, L, r, c, heat(v, 3.2));
        label(ctx, fix(v, 1), L.px + c * cs + cs / 2, L.py + r * cs + cs / 2 + 7, v > 1.6 ? palette.ink : palette.muted, 11.5, "center");
      }
    }
    drawGridOver(ctx, L, { letters: false, alpha: 0.2 });
    cellTag(ctx, L, "A", OUT);
    outlineCell(ctx, L, RC.A[0], RC.A[1], OUT, 2);

    const fs = L.pw < 260 ? 11.5 : 12;
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };
    const I = FEAT[IDX.A];
    line(`${T.feat} = ${vec(I)}`, palette.ink, fs, 26);
    if (head === 0) {
      line(`${T.rowsOf} (${K_CLS.length})`, palette.muted, 11, 20);
      K_CLS.forEach((row, r) => line(`${r === 0 ? T.names.cat : T.names.cup}  ${vec(row)}`, r === closedRow ? OUT : palette.ink, fs, 20));
      y += 8;
      if (closedRow >= 0) {
        const row = K_CLS[closedRow];
        line(`${T.names[name]} · I =`, palette.muted, 11, 18);
        line(`${terms(row, I)}`, palette.ink, 11.5, 18);
        line(`= ${num(dot(row, I))}`, OUT, 13, 24);
      } else {
        line(`${T.names[name]}: ${T.noRow}`, BAD, 13, 24);
        line(T.retrain, palette.muted, 11, 20);
      }
    } else {
      const O = EMB[IDX.A], P = TEXT[name];
      line(`K (3 × 4) · I`, palette.muted, 11, 18);
      line(`${T.objVec} = ${vec(O)}`, READ, fs, 24);
      line(`${T.nameVec} ${T.names[name]} = ${vec(P, 2)}`, palette.ink, fs, 22);
      line(`${T.dotAB} ${terms(O, P)}`, palette.muted, 11, 18);
      line(`= ${num(dot(O, P), 2)}`, OUT, 13, 26);
      line(T.allNames, palette.muted, 11, 20);
      const shown: NameKey[] = ni >= 2 ? ["cat", "cup", name] : ["cat", "cup"];
      shown.forEach((n) => {
        const v = scoreName(IDX.A, n);
        label(ctx, T.names[n], L.x, y, n === name ? OUT : palette.ink, fs);
        bar(ctx, L.x + 56, y - 5, L.pw * 0.45, 10, v / 3.2, n === name ? OUT : `rgba(${palette.normalRgb},0.55)`);
        label(ctx, fix(v, 2), L.x + 64 + L.pw * 0.45, y, palette.ink, fs);
        y += 22;
      });
      if (ni >= 2) { y += 4; line(T.same, GT, 11, 18); }
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.head}>
          <span>{T.head}</span>
          {T.heads.map((n, i) => <button key={n} type="button" className={head === i ? "on" : ""} onClick={() => setHead(i)}>{n}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.name}>
          <span>{T.name}</span>
          {NAME_KEYS.map((k, i) => <button key={k} type="button" className={ni === i ? "on" : ""} onClick={() => setNi(i)}>{T.names[k]}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · RepRTA: two products in training, one folded 1×1 conv in use    */
/* ------------------------------------------------------------------ */

export function FoldScene() {
  const [step, setStep] = useState(0);
  const [li, setLi] = useState(0);
  const T = U.fold;
  const names: NameKey[] = li === 0 ? ["cat", "cup"] : ["cat", "cup", "dog", "hat"];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = h > w * 1.15, fs = w < 420 ? 11.5 : 12;
    const nm = U.vocab.names;
    const I = FEAT[IDX.A], tw2 = twoWays(IDX.A, names), Kp = fold(names), Pt = names.map((n) => TEXT_REFINED[n]);
    const cw = port ? 38 : w < 560 ? 38 : 40, ch = port ? 24 : 27;
    const y = 30;
    label(ctx, `${T.feat} = ${vec(I)}`, PAD, 16, palette.ink, 12);

    if (step === 0) {
      // I → K → O, then O · P̃ for each name
      const kx = PAD, ky = y + 16;
      const kw = mgrid(ctx, K_EMB, kx, ky, cw, ch, READ, T.k);
      const ox = kx + kw + 56;
      arrow(ctx, kx + kw + 6, ky + 1.5 * ch, ox - 6, ky + 1.5 * ch, palette.muted);
      mgrid(ctx, tw2.O.map((v) => [v]), ox, ky, cw, ch, READ, T.o);
      label(ctx, `K · I`, kx + kw + 28, ky + 1.5 * ch - 12, palette.muted, 11, "center");
      let yy = ky + 3 * ch + 36;
      label(ctx, T.pt, PAD, yy - 14, OUT, 11);
      const px = PAD + 56;
      mgrid(ctx, Pt, px, yy, cw, ch, OUT);
      names.forEach((n, r) => {
        label(ctx, nm[n], PAD, yy + r * ch + ch / 2, palette.ink, fs);
        label(ctx, `O·P̃ = ${fix(tw2.twoStep[r], 3)}`, px + 3 * cw + 12, yy + r * ch + ch / 2, palette.ink, fs);
      });
      yy += names.length * ch + 26;
      fitLabel(ctx, `${nm.cat}: ${terms(tw2.O, TEXT_REFINED.cat)} = ${fix(tw2.twoStep[0], 2)}`, PAD, yy, w - 2 * PAD, palette.muted, 11.5);
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
      label(ctx, `K′${T.rowOf} ${nm.cat} ${T.row} =`, PAD, yy, palette.muted, 11); yy += 20;
      K_EMB.forEach((row, d) => { fitLabel(ctx, `${d ? "+ " : "  "}${par(p[d])} × ${vec(row)}`, PAD, yy, w - 2 * PAD, palette.ink, fs); yy += 19; });
      fitLabel(ctx, `= ${vec(Kp[0])}`, PAD, yy, w - 2 * PAD, OUT, 12.5); yy += 26;
      fitLabel(ctx, `${T.once}: f_θ(P), K′`, PAD, yy, w - 2 * PAD, palette.muted, 11);
    } else {
      const ky = y + 16;
      mgrid(ctx, Kp, PAD, ky, cw + 8, ch, OUT, "K′");
      const sx = PAD + 4 * (cw + 8) + 44;
      arrow(ctx, PAD + 4 * (cw + 8) + 6, ky + (names.length * ch) / 2, sx - 6, ky + (names.length * ch) / 2, palette.muted);
      label(ctx, "· I", PAD + 4 * (cw + 8) + 22, ky + (names.length * ch) / 2 - 12, palette.muted, 11, "center");
      names.forEach((n, r) => label(ctx, `${nm[n]} ${fix(tw2.oneStep[r], 3)}`, sx, ky + r * ch + ch / 2, OUT, fs));
      let yy = ky + names.length * ch + 30;
      fitLabel(ctx, `${nm.cat}: ${terms(Kp[0], I)} = ${fix(tw2.oneStep[0], 2)}`, PAD, yy, w - 2 * PAD, palette.muted, 11.5);
      yy += 28;
      const cols = [PAD, PAD + (port ? 80 : 110), PAD + (port ? 170 : 230), PAD + (port ? 262 : 350)];
      [["", T.twoStep, T.oneStep, T.diff], ...names.map((n, r) => [nm[n], fix(tw2.twoStep[r], 3), fix(tw2.oneStep[r], 3), fix(Math.abs(tw2.twoStep[r] - tw2.oneStep[r]), 3)])].forEach((row, r) => {
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
/* 08 · Visual prompt (SAVPE, toy) and prompt-free retrieval (LRPC)     */
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
    drawPicture(ctx, L, { fade: 0.75 });
    const cs = L.s / GRID, fs = L.pw < 260 ? 11.5 : 12;
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };

    if (mode === 0) {
      const P = visualPrompt(ACT_W);
      for (let i = 0; i < GRID * GRID; i++) {
        const r = Math.floor(i / GRID), c = i % GRID, v = dot(EMB[i], P);
        fillCell(ctx, L, r, c, heat(v, 3.2));
        label(ctx, fix(v, 1), L.px + c * cs + cs / 2, L.py + r * cs + cs / 2 + 7, v > 1.6 ? palette.ink : palette.muted, 11.5, "center");
      }
      drawGridOver(ctx, L, { letters: false, alpha: 0.2 });
      drawBox(ctx, L, [2, 42, 78, 118], OUT, { lw: 2.2, dash: [6, 4] });
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
        label(ctx, fmtSmall(OBJ_ANY[i]), L.px + c * cs + cs / 2, L.py + r * cs + cs / 2 + 7, on ? palette.ink : palette.muted, 11, "center");
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
