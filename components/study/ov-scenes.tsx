"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { bar, frame, rbox, signed, type Ctx } from "./kit";
import { ovCopy } from "./ov-copy";
import {
  BATCHES, CROPS, EMB, FEAT, GRID, IDX, IMG_VEC, K_CLS, NAME_KEYS, NAME_LISTS, RC, ROW_GUESS, SCALE, TEXT,
  clipLoss, closedScore, cosTable, dot, scoreName, zeroShot, type Box, type Moment, type NameKey,
} from "./ov-math";
import { BAD, GT, OUT, PAD, READ, cellNum, cellTag, drawPicture, drawGridOver, fillCell, fitLabel, fix, layout, mapOf, num, outlineCell, vec } from "./yolo-draw";

const U = ovCopy.ui;
const NM = U.names;
const par = (v: number) => (v < 0 ? `(${num(v)})` : num(v));
export const terms = (a: number[], b: number[]) => a.map((v, j) => `${par(v)}×${par(b[j])}`).join(" + ");
/** Blue fill for a cell score, stronger as the score approaches `max`. */
export const heat = (v: number, max: number) => (v <= 0.02 ? "rgba(255,255,255,0)" : `rgba(${palette.normalRgb},${0.08 + 0.55 * Math.min(1, v / max)})`);

/** A crop of the picture (a box in picture pixels) drawn at its own aspect ratio, centred in a size × size slot. */
export function drawCrop(ctx: Ctx, b: Box, x: number, y: number, size: number, color: string = palette.frame) {
  const bw = b[2] - b[0], bh = b[3] - b[1], k = size / Math.max(bw, bh);
  const cw = bw * k, chh = bh * k, cx = x + (size - cw) / 2, cy = y + (size - chh) / 2;
  ctx.save();
  ctx.beginPath(); ctx.rect(cx, cy, cw, chh); ctx.clip();
  drawPicture(ctx, { px: cx - b[0] * k, py: cy - b[1] * k, s: 160 * k });
  ctx.restore();
  frame(ctx, cx, cy, cw, chh, color, 1.2);
}

/* ------------------------------------------------------------------ */
/* 01 · A closed head: one learned row per name                        */
/* ------------------------------------------------------------------ */

export function ClosedScene() {
  const [ni, setNi] = useState(0);
  const [guess, setGuess] = useState(false);
  const T = U.closed;
  const name = NAME_KEYS[ni];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    label(ctx, `${T.name}: ${NM[name]}`, L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { fade: 0.75, loading: U.pic.loading });
    const useGuess = name === "siam" && guess;
    const row = name === "cat" ? K_CLS[0] : name === "cup" ? K_CLS[1] : useGuess ? ROW_GUESS : null;
    if (row) {
      for (let i = 0; i < GRID * GRID; i++) {
        const r = Math.floor(i / GRID), c = i % GRID, v = closedScore(i, row);
        fillCell(ctx, L, r, c, heat(v, 3));
        cellNum(ctx, L, r, c, fix(v, 1), v > 1.5 ? palette.ink : palette.muted);
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
    const rows: { n: string; r: number[]; on: boolean }[] = [
      { n: NM.cat, r: K_CLS[0], on: name === "cat" },
      { n: NM.cup, r: K_CLS[1], on: name === "cup" },
    ];
    if (useGuess) rows.push({ n: NM.siam, r: ROW_GUESS, on: true });
    line(`${T.rowsOf} ${rows.length}`, palette.muted, 11, 20);
    rows.forEach((x) => line(`${x.n}  ${vec(x.r)}`, x.on ? OUT : palette.ink, fs, 20));
    if (useGuess) line(`  ${T.copied}`, palette.muted, 11, 20);
    y += 8;
    if (row) {
      line(`${NM[name]} · I =`, palette.muted, 11, 18);
      line(terms(row, I), palette.ink, 11.5, 18);
      line(`= ${num(dot(row, I))}`, OUT, 13, 26);
      if (useGuess) line(T.same, BAD, 12, 20);
    } else {
      line(`${NM[name]}: ${T.noRow}`, BAD, 13, 24);
      line(T.retrain, palette.muted, 11, 20);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.name}>
          <span>{T.name}</span>
          {NAME_KEYS.map((k, i) => <button key={k} type="button" className={ni === i ? "on" : ""} onClick={() => setNi(i)}>{NM[k]}</button>)}
        </div>
        {name === "siam" ? (
          <div className="ad-ctl ad-seg" role="group" aria-label={T.row}>
            <span>{T.row}</span>
            {T.rows.map((n, i) => <button key={n} type="button" className={guess === (i === 1) ? "on" : ""} onClick={() => setGuess(i === 1)}>{n}</button>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · CLIP's contrastive loss on a batch of three pairs               */
/* ------------------------------------------------------------------ */

const MOMENTS: Moment[] = ["start", "trained", "collapsed"];
const BATCH_CROPS: Box[] = [CROPS.cat, CROPS.cup, CROPS.wall];
const amber = (p: number) => `rgba(${palette.accentRgb},${0.06 + 0.6 * Math.max(0, Math.min(1, p))})`;

export function ContrastScene() {
  const [view, setView] = useState(0);
  const [mo, setMo] = useState(0);
  const T = U.contrast;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = h > w * 1.15, fs = w < 420 ? 11.5 : 12;
    const b = BATCHES[MOMENTS[mo]], cos = cosTable(b), L = clipLoss(b);
    label(ctx, `${T.moments[mo]} · ${T.scale}`, PAD, 16, palette.muted, 11);

    const rhW = port ? 82 : 104, logW = view === 1 ? (port ? 46 : 64) : 0;
    const cw = Math.min(port ? 84 : 120, (w - 2 * PAD - rhW - logW) / 3), ch = port ? 50 : 56;
    const x0 = PAD + rhW, y0 = 52;
    T.caps.forEach((_, j) => label(ctx, `${T.cap} ${j + 1}`, x0 + j * cw + cw / 2, y0 - 12, READ, 12, "center"));
    if (view === 1) label(ctx, "−log", x0 + 3 * cw + logW / 2, y0 - 12, OUT, 11, "center");
    for (let i = 0; i < 3; i++) {
      const ty = y0 + i * ch;
      const th = Math.min(ch - 6, rhW * 0.5);
      drawCrop(ctx, BATCH_CROPS[i], PAD, ty + (ch - th) / 2, th);
      fitLabel(ctx, T.imgs[i], PAD + th + 4, ty + ch / 2, rhW - th - 8, palette.ink, 11.5);
      for (let j = 0; j < 3; j++) {
        const x = x0 + j * cw, v = view === 0 ? cos[i][j] : view === 1 ? L.rows[i][j] : L.cols[j][i];
        ctx.fillStyle = view === 0 ? signed(v, 1) : amber(v);
        ctx.fillRect(x + 2, ty + 2, cw - 4, ch - 4);
        if (i === j) frame(ctx, x + 2, ty + 2, cw - 4, ch - 4, GT, 2.4);
        label(ctx, fix(v, 3), x + cw / 2, ty + ch / 2, palette.ink, port ? 12 : 13, "center");
      }
      if (view === 1) label(ctx, fix(-Math.log(L.rows[i][i]), 3), x0 + 3 * cw + logW / 2, ty + ch / 2, OUT, fs, "center");
    }
    let y = y0 + 3 * ch + 14;
    if (view === 2) {
      label(ctx, "−log", PAD + 4, y, OUT, 11);
      for (let j = 0; j < 3; j++) label(ctx, fix(-Math.log(L.cols[j][j]), 3), x0 + j * cw + cw / 2, y, OUT, fs, "center");
      y += 22;
    } else if (view === 1) {
      fitLabel(ctx, T.sumRow, x0, y, 3 * cw, palette.muted, 11); y += 22;
    }
    if (view === 2) { fitLabel(ctx, T.sumCol, x0, y, 3 * cw, palette.muted, 11); y += 22; }
    y += 2;
    T.caps.forEach((c, j) => { fitLabel(ctx, `${T.cap} ${j + 1}  ${c}`, PAD, y, w - 2 * PAD, palette.muted, 11.5); y += port ? 18 : 17; });
    y += 10;
    fitLabel(ctx, `${T.diag} ${fix(L.diag, 3)}`, PAD, y, w - 2 * PAD, palette.ink, fs); y += 22;
    if (view > 0) {
      fitLabel(ctx, `${T.lossImg} ${fix(L.lossImg, 3)} · ${T.lossTxt} ${fix(L.lossTxt, 3)}`, PAD, y, w - 2 * PAD, palette.ink, fs); y += 22;
      fitLabel(ctx, `${T.loss} = ${fix(L.loss, 3)}   (${T.ln3})`, PAD, y, w - 2 * PAD, MOMENTS[mo] === "trained" ? GT : BAD, 13);
    } else {
      fitLabel(ctx, T.pair, PAD, y, w - 2 * PAD, GT, 11.5);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.view}>
          <span>{T.view}</span>
          {T.views.map((n, i) => <button key={n} type="button" className={view === i ? "on" : ""} onClick={() => setView(i)}>{i + 1}. {n}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.moment}>
          <span>{T.moment}</span>
          {T.moments.map((n, i) => <button key={n} type="button" className={mo === i ? "on" : ""} onClick={() => setMo(i)}>{n}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Zero-shot classification: one picture vector, a list of names  */
/* ------------------------------------------------------------------ */

const ZS_PICS: ("all" | "cat" | "cup")[] = ["all", "cat", "cup"];

export function ZeroShotScene() {
  const [pi, setPi] = useState(0);
  const [li, setLi] = useState(0);
  const T = U.zeroshot;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    label(ctx, `${T.pic}: ${T.pics[pi]}`, L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { loading: U.pic.loading });
    const key = ZS_PICS[pi], box = CROPS[key], m = mapOf(L);
    if (key !== "all") {
      ctx.fillStyle = "rgba(255,255,255,0.72)";
      const X1 = m.X(box[0]), Y1 = m.Y(box[1]), X2 = m.X(box[2]), Y2 = m.Y(box[3]), X0 = m.X(0), Y0 = m.Y(0), XE = m.X(160), YE = m.Y(160);
      ctx.fillRect(X0, Y0, XE - X0, Y1 - Y0);
      ctx.fillRect(X0, Y2, XE - X0, YE - Y2);
      ctx.fillRect(X0, Y1, X1 - X0, Y2 - Y1);
      ctx.fillRect(X2, Y1, XE - X2, Y2 - Y1);
      frame(ctx, X1, Y1, X2 - X1, Y2 - Y1, OUT, 2);
    } else frame(ctx, m.X(0) + 1, m.Y(0) + 1, L.s - 2, L.s - 2, OUT, 2);

    const names = NAME_LISTS[li], img = IMG_VEC[key], z = zeroShot(img, names);
    const fs = L.pw < 260 ? 11.5 : 12;
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };
    line(`${T.vec} = [${img.map((v) => fix(v, 3)).join(", ")}]`, READ, fs, 22);
    line(T.prompt, palette.muted, 11, 26);
    const bw = L.pw * 0.5;
    names.forEach((n, i) => {
      label(ctx, NM[n], L.x, y, palette.ink, fs);
      fitLabel(ctx, `${T.cos} ${fix(z.cos[i], 3)} · ×${SCALE} = ${fix(z.cos[i] * SCALE, 2)}`, L.x + 70, y, L.pw - 70, palette.muted, 11);
      y += 17;
      bar(ctx, L.x, y - 5, bw, 10, z.share[i], OUT);
      label(ctx, `${fix(z.share[i] * 100, 1)}%`, L.x + bw + 8, y, palette.ink, fs);
      y += L.port ? 22 : 25;
    });
    y += 4;
    line(T.sum, palette.muted, 11, 20);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.pic}>
          <span>{T.pic}</span>
          {T.pics.map((n, i) => <button key={n} type="button" className={pi === i ? "on" : ""} onClick={() => setPi(i)}>{n}</button>)}
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
/* 04 · A closed head versus one vector per cell compared with names    */
/* ------------------------------------------------------------------ */

export function RegionScene() {
  const [head, setHead] = useState(1);
  const [ni, setNi] = useState(0);
  const T = U.region;
  const name = NAME_KEYS[ni];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    label(ctx, `${T.name}: ${NM[name]}`, L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { fade: 0.75, loading: U.pic.loading });
    const closedRow = name === "cat" ? 0 : name === "cup" ? 1 : -1;
    const has = head === 1 || closedRow >= 0;
    const score = (i: number) => (head === 0 ? closedScore(i, K_CLS[closedRow]) : scoreName(i, name));
    if (has) {
      for (let i = 0; i < GRID * GRID; i++) {
        const r = Math.floor(i / GRID), c = i % GRID, v = score(i);
        fillCell(ctx, L, r, c, heat(v, 3.2));
        cellNum(ctx, L, r, c, fix(v, 1), v > 1.6 ? palette.ink : palette.muted);
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
      K_CLS.forEach((row, r) => line(`${r === 0 ? NM.cat : NM.cup}  ${vec(row)}`, r === closedRow ? OUT : palette.ink, fs, 20));
      y += 8;
      if (closedRow >= 0) {
        const row = K_CLS[closedRow];
        line(`${NM[name]} · I =`, palette.muted, 11, 18);
        line(`${terms(row, I)}`, palette.ink, 11.5, 18);
        line(`= ${num(dot(row, I))}`, OUT, 13, 24);
      } else {
        line(`${NM[name]}: ${T.noRow}`, BAD, 13, 24);
        line(T.retrain, palette.muted, 11, 20);
      }
    } else {
      const O = EMB[IDX.A], P = TEXT[name];
      line(`K (3 × 4) · I`, palette.muted, 11, 18);
      line(`${T.objVec} = ${vec(O)}`, READ, fs, 24);
      line(`${T.nameVec} ${NM[name]} = ${vec(P, 2)}`, palette.ink, fs, 22);
      line(`${T.dotAB} ${terms(O, P)}`, palette.muted, 11, 18);
      line(`= ${num(dot(O, P), 2)}`, OUT, 13, 26);
      line(T.allNames, palette.muted, 11, 20);
      const shown: NameKey[] = ni >= 2 ? ["cat", "cup", name] : ["cat", "cup"];
      shown.forEach((n) => {
        const v = scoreName(IDX.A, n);
        label(ctx, NM[n], L.x, y, n === name ? OUT : palette.ink, fs);
        bar(ctx, L.x + 66, y - 5, L.pw * 0.45, 10, v / 3.2, n === name ? OUT : `rgba(${palette.normalRgb},0.55)`);
        label(ctx, fix(v, 2), L.x + 74 + L.pw * 0.45, y, palette.ink, fs);
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
          {NAME_KEYS.map((k, i) => <button key={k} type="button" className={ni === i ? "on" : ""} onClick={() => setNi(i)}>{NM[k]}</button>)}
        </div>
      </div>
    </div>
  );
}

/** A small rounded tag with white text (rank numbers in the fusion scene of 05). */
export const tag = (ctx: Ctx, x: number, y: number, text: string, color: string) => {
  rbox(ctx, x, y, 22, 15, 4, color, null);
  label(ctx, text, x + 11, y + 8, "#ffffff", 11, "center");
};
