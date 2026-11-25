"use client";

import { useMemo, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { line, rbox } from "./kit";
import { vitWalkUi as U } from "./vit-walk-copy";
import { CLASSES, CLS0, NO_EYE, POS, STANDARD, SWAPPED, pass, type Pass, type Third } from "./vit-math";
import { MARK, isPortrait, num, pc, photo, useHead, vec } from "./vit-walk-scenes";

const PAD = 18;
const pcs = (v: number) => (v < 0.01 && v > 0 ? `${(v * 100).toFixed(1)}%` : pc(v));
/** Tokens in the order the model reads them here: the four patches, then [CLS] itself. */
const NAMES = [...MARK, U.cls.self];

/* ------------------------------------------------------------------ */
/* 04 · A token with no pixels reads the four patches, and the answer comes from it */
/* ------------------------------------------------------------------ */

export function ClsReadScene() {
  const [step, setStep] = useState(0);
  const [third, setThird] = useState<Third>("eye");
  const cells = third === "eye" ? STANDARD : NO_EYE;
  const P = useMemo(() => pass(third === "eye" ? STANDARD : NO_EYE), [third]);
  const head = useHead();

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), S = portrait ? 132 : Math.min(190, w * 0.36), c = S / 2;
    const px = portrait ? (w - S) / 2 : PAD, ty = 30, py = ty + 44;
    const R = P.cls;

    // [CLS] sits outside the photo: it has no pixels
    rbox(ctx, px, ty, 62, 26, 6, palette.accent, null);
    label(ctx, U.cls.token, px + 31, ty + 13.5, "#ffffff", 12, "center");
    if (step === 0) label(ctx, U.cls.outside, px + 70, ty + 13, palette.muted, 11);
    else label(ctx, `${U.cls.selfShare} ${pc(R.weights[4])}`, px + 70, ty + 13, palette.normal, 12);
    photo(ctx, head.current, px, py, S, cells, -1);
    if (step >= 1) {
      for (let i = 0; i < 4; i++) {
        // bottom right of each cell, clear of the cell number
        const cx = px + (i % 2) * c + c - 4, cy = py + Math.floor(i / 2) * c + c - 13;
        rbox(ctx, cx - 38, cy - 9, 38, 18, 5, "rgba(255,255,255,0.92)", null);
        label(ctx, pc(R.weights[i]), cx - 5, cy + 0.5, palette.normal, 12, "right");
      }
    }

    const x0 = portrait ? PAD : px + S + 22, x1 = w - PAD, y0 = portrait ? py + S + 30 : ty + 6;
    const wide = x1 - x0 >= 300, small = wide ? 12 : 11;

    if (step === 0) {
      label(ctx, U.cls.row, x0, y0, palette.muted, 12);
      label(ctx, U.cls.token, x0, y0 + 32, palette.accent, 13);
      label(ctx, vec(CLS0), x0 + 60, y0 + 32, palette.ink, 15);
      label(ctx, U.cls.fixed, x0 + 60, y0 + 52, palette.muted, 11);
      P.x.forEach((v, i) => {
        const y = y0 + 88 + i * (portrait ? 30 : 38), hot = i === 2 && third === "bg";
        label(ctx, MARK[i], x0, y, hot ? palette.anomaly : palette.ink, 13);
        label(ctx, vec(v), x0 + 60, y, hot ? palette.anomaly : palette.ink, 15);
        if (hot) label(ctx, U.cls.changed, x1, y, palette.anomaly, 11, "right");
      });
    } else if (step === 1) {
      const sp = portrait ? 40 : 46, bw = x1 - x0 - 46;
      label(ctx, `${U.cls.q} ${vec(R.q)}`, x0, y0, palette.accent, 13);
      label(ctx, U.cls.sum, x0, y0 + 20, palette.normal, 11);
      R.keys.forEach((k, j) => {
        const y = y0 + 50 + j * sp;
        label(ctx, `${NAMES[j]} ${U.cls.k} ${vec(k)}`, x0, y, palette.ink, 12);
        label(ctx, `${U.cls.score} ${num(R.scores[j])}`, x1, y, palette.muted, 11, "right");
        ctx.fillStyle = palette.track; ctx.fillRect(x0, y + 12, bw, 10);
        ctx.fillStyle = palette.normal; ctx.fillRect(x0, y + 12, Math.max(2, bw * R.weights[j]), 10);
        if (j < 4) line(ctx, x0 + bw * 0.25, y + 8, x0 + bw * 0.25, y + 26, palette.ink, 1.5);
        label(ctx, pc(R.weights[j]), x1, y + 17, palette.normal, 13, "right");
      });
      label(ctx, U.cls.mean, x0, y0 + 50 + 5 * sp - 4, palette.muted, 11);
    } else if (step === 2) {
      const rh = wide ? (portrait ? 26 : 30) : 36;
      label(ctx, U.cls.mixing, x0, y0, palette.muted, 12);
      R.vals.forEach((v, j) => {
        const y = y0 + 28 + j * rh;
        label(ctx, `${NAMES[j]}  ${num(R.weights[j])} × ${vec(v)}`, x0, y, palette.ink, small);
        label(ctx, `= ${vec(R.parts[j])}`, x1, wide ? y : y + 15, palette.ink, small, "right");
      });
      const ys = y0 + 28 + 5 * rh + (wide ? 4 : 10);
      ctx.fillStyle = palette.frame; ctx.fillRect(x0, ys - 16, x1 - x0, 1);
      label(ctx, U.cls.read, x0, ys + 4, palette.muted, 12);
      label(ctx, vec(R.read), x1, ys + 4, palette.normal, 15, "right");
      label(ctx, `+ ${U.cls.before}`, x0, ys + 34, palette.muted, 12);
      label(ctx, vec(CLS0), x1, ys + 34, palette.ink, 14, "right");
      label(ctx, `= ${U.cls.after}`, x0, ys + 62, palette.muted, 12);
      label(ctx, vec(R.out), x1, ys + 62, palette.accent, 16, "right");
    } else {
      label(ctx, U.cls.after, x0, y0, palette.muted, 12);
      label(ctx, vec(R.out), x0, y0 + 24, palette.accent, 17);
      label(ctx, U.cls.from, x0, y0 + 48, palette.muted, 11);
      label(ctx, U.cls.prob, x0, y0 + 92, palette.accent, 11);
      CLASSES.forEach((name, k) => {
        const y = y0 + 122 + k * 30, bx = x0 + 62, bw = Math.max(30, x1 - bx - 50);
        label(ctx, name, x0, y, palette.ink, 12);
        ctx.fillStyle = palette.track; ctx.fillRect(bx, y - 6, bw, 12);
        ctx.fillStyle = palette.accent; ctx.fillRect(bx, y - 6, Math.max(2, bw * P.probs[k]), 12);
        label(ctx, pcs(P.probs[k]), x1, y, palette.ink, 13, "right");
      });
      label(ctx, U.cls.unused, x0, y0 + 122 + 3 * 30 + 12, palette.muted, 11);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.cls.step}>
          <span>{U.cls.step}</span>
          {U.cls.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.swap.third}>
          <span>{U.swap.third}</span>
          <button type="button" className={third === "eye" ? "on" : ""} onClick={() => setThird("eye")}>{U.swap.eye}</button>
          <button type="button" className={third === "bg" ? "on" : ""} onClick={() => setThird("bg")}>{U.swap.bg}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · Exchange the ear and the eye patch: nothing changes until places are written into the input */
/* ------------------------------------------------------------------ */

const ROWS: ((p: Pass) => string)[] = [
  (p) => vec(p.earRead.q),
  (p) => pc(p.earRead.weights[p.eye]),
  (p) => vec(p.earRead.read),
  (p) => vec(p.earRead.out),
  (p) => pc(p.probs[0]),
];
const tight = (a: number[]) => `[${a.map(num).join(",")}]`;

export function PlaceScene() {
  const [swapped, setSwapped] = useState(false);
  const [pos, setPos] = useState(false);
  const head = useHead();
  const table = useMemo(() => {
    const A = pass(STANDARD, pos), B = pass(SWAPPED, pos);
    return ROWS.map((f) => [f(A), f(B)]);
  }, [pos]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), S = portrait ? 140 : Math.min(170, w * 0.32), c = S / 2;
    const px = portrait ? (w - S) / 2 : PAD, py = 26, cells = swapped ? SWAPPED : STANDARD;
    photo(ctx, head.current, px, py, S, cells, cells.indexOf("ear"));
    if (pos) {
      // the position vector belongs to the slot, not to what is drawn in it
      POS.forEach((v, i) => {
        const text = tight(v), tw = text.length * 6.7 + 8, cx = px + (i % 2) * c + 4, cy = py + Math.floor(i / 2) * c + c - 22;
        rbox(ctx, cx, cy, tw, 18, 5, "rgba(255,255,255,0.94)", palette.accent2, 1);
        label(ctx, text, cx + 4, cy + 9.5, palette.accent2, 11);
      });
      label(ctx, U.place.tag, portrait ? w / 2 : px, py + S + 16, palette.accent2, 11, portrait ? "center" : "left");
    }
    const x0 = portrait ? PAD : px + S + 20, x1 = w - PAD, y0 = portrait ? py + S + 42 : py + 6;
    const tagW = 46, colW = (x1 - x0 - tagW) / 2, rh = Math.min(58, (h - y0 - 30) / table.length);
    const on = swapped ? 1 : 0;
    [U.place.colStd, U.place.colSwap].forEach((name, cidx) => label(ctx, name, x0 + cidx * colW + 4, y0, cidx === on ? palette.accent : palette.muted, 11));
    table.forEach(([a, b], i) => {
      const y = y0 + 18 + i * rh, same = a === b;
      label(ctx, U.place.rows[i], x0 + 4, y + 6, palette.muted, 11);
      [a, b].forEach((value, cidx) => {
        const cx = x0 + cidx * colW;
        if (cidx === on) rbox(ctx, cx, y + 16, colW - 8, 24, 6, `rgba(${palette.accentRgb},0.1)`, palette.accent, 1.5);
        label(ctx, value, cx + 8, y + 28, cidx === on ? palette.ink : palette.muted, 13);
      });
      label(ctx, same ? U.place.same : U.place.differs, x1, y + 28, same ? palette.mint : palette.anomaly, 11, "right");
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.place.arr}>
          <span>{U.place.arr}</span>
          <button type="button" className={!swapped ? "on" : ""} onClick={() => setSwapped(false)}>{U.place.std}</button>
          <button type="button" className={swapped ? "on" : ""} onClick={() => setSwapped(true)}>{U.place.swapped}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.place.pos}>
          <span>{U.place.pos}</span>
          <button type="button" className={!pos ? "on" : ""} onClick={() => setPos(false)}>{U.place.off}</button>
          <button type="button" className={pos ? "on" : ""} onClick={() => setPos(true)}>{U.place.on}</button>
        </div>
      </div>
    </div>
  );
}
