"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, frame, gray, rbox, type Ctx } from "./kit";
import { CAT_SRC } from "./cat-grids";
import { vitWalkUi as U } from "./vit-walk-copy";
import { BG_RGB, NO_EYE, PART_CELL, STANDARD, look, pixels, type Part, type Third } from "./vit-math";

const PAD = 18;
export const MARK = ["1번", "2번", "3번", "4번"];
export const num = (v: number) => { const s = v.toFixed(2).replace(/\.?0+$/, ""); return s === "-0" ? "0" : s.replace("-", "−"); };
export const vec = (a: number[]) => `[${a.map(num).join(", ")}]`;
export const pc = (v: number) => `${Math.round(v * 100)}%`;
export const isPortrait = (w: number, h: number) => h > w * 1.15;

/** What each of the four cells holds, for the two photos of sections 02–03. */
export const CELLS: Record<Third, Part[]> = { eye: STANDARD, bg: NO_EYE };

/** The owner's cat (head only, 512 × 512). The ref stays empty until the drawing has loaded; the canvas repaints every frame. */
export function useHead() {
  const ref = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => { ref.current = img; };
    img.src = CAT_SRC.head;
  }, []);
  return ref;
}

/** One cell: a quarter of the head drawing, or plain background colour. */
function part(ctx: Ctx, img: HTMLImageElement | null, x: number, y: number, c: number, p: Part) {
  if (p === "bg" || !img) {
    ctx.fillStyle = p === "bg" ? BG_RGB : palette.track;
    ctx.fillRect(x, y, c, c);
    return;
  }
  const [r, col] = PART_CELL[p], s = img.naturalWidth / 2;
  ctx.drawImage(img, col * s, r * s, s, s, x, y, c, c);
}

/** The 2 × 2 photo without its grid: `cells` says what sits in ①, ②, ③, ④. */
export function cat(ctx: Ctx, img: HTMLImageElement | null, x: number, y: number, S: number, cells: Part[]) {
  const c = S / 2;
  cells.forEach((p, i) => part(ctx, img, x + (i % 2) * c, y + Math.floor(i / 2) * c, c, p));
}

/** The photo with its grid, cell numbers and one highlighted cell (`hot` < 0 for none). */
export function photo(ctx: Ctx, img: HTMLImageElement | null, x: number, y: number, S: number, cells: Part[], hot: number) {
  const c = S / 2;
  cat(ctx, img, x, y, S, cells);
  ctx.save(); ctx.strokeStyle = "rgba(20,24,33,0.55)"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(x + c, y); ctx.lineTo(x + c, y + S); ctx.moveTo(x, y + c); ctx.lineTo(x + S, y + c); ctx.stroke(); ctx.restore();
  frame(ctx, x, y, S, S, palette.frame, 1);
  MARK.forEach((_, i) => {
    const cx = x + (i % 2) * c + 13, cy = y + Math.floor(i / 2) * c + 13;
    ctx.fillStyle = i === hot ? palette.accent : "rgba(255,255,255,0.9)"; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    label(ctx, String(i + 1), cx, cy + 0.5, i === hot ? "#ffffff" : palette.ink, 12, "center");
  });
  if (hot >= 0) frame(ctx, x + (hot % 2) * c, y + Math.floor(hot / 2) * c, c, c, palette.accent, 3);
}

/* ------------------------------------------------------------------ */
/* 02 · One patch reads all four: scores, shares, values, the new vector */
/* ------------------------------------------------------------------ */

const OWNERS = [0, 2];

export function PatchLookScene() {
  const [owner, setOwner] = useState(0);
  const [step, setStep] = useState(0);
  const L = useMemo(() => look(owner), [owner]);
  const head = useHead();

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const img = head.current;
    const portrait = isPortrait(w, h), S = portrait ? 150 : Math.min(210, w * 0.4);
    const px = portrait ? (w - S) / 2 : PAD, py = 34;
    photo(ctx, img, px, py, S, CELLS.eye, owner);
    const x0 = portrait ? PAD : px + S + 22, x1 = w - PAD, y0 = portrait ? py + S + 34 : py + 8;
    const me = MARK[owner], top = L.weights.indexOf(Math.max(...L.weights));

    if (step === 0) {
      // the cell's pixels, the same cell shrunk to 2 × 2 brightness values, and the vector E makes from those four numbers
      const Z = Math.min(96, (x1 - x0 - 18) / 2), gx = x0 + Z + 18, b = Z / 2, px4 = pixels(STANDARD[owner]);
      label(ctx, `${me} ${U.look.inside}`, x0, y0, palette.muted, 12);
      label(ctx, U.look.shrunk, gx, y0, palette.muted, 12);
      part(ctx, img, x0, y0 + 14, Z, STANDARD[owner]);
      frame(ctx, x0, y0 + 14, Z, Z, palette.accent, 2);
      px4.forEach((v, i) => {
        const bx = gx + (i % 2) * b, by = y0 + 14 + Math.floor(i / 2) * b;
        ctx.fillStyle = gray(v); ctx.fillRect(bx + 0.5, by + 0.5, b - 1, b - 1);
        label(ctx, num(v), bx + b / 2, by + b / 2, v > 0.6 ? palette.ink : "#ffffff", 12, "center");
      });
      const ya = y0 + 14 + Z;
      arrow(ctx, gx + b, ya + 6, gx + b, ya + 30, palette.accent, 2);
      label(ctx, U.look.times, gx + b - 10, ya + 18, palette.muted, 11, "right");
      label(ctx, `${me} ${U.look.vector}`, x0, ya + 50, palette.muted, 12);
      label(ctx, vec(L.x[owner]), x0, ya + 74, palette.ink, 18);
      label(ctx, U.look.noLabel, x0, ya + 100, palette.muted, 11);
    } else if (step === 1) {
      label(ctx, `${me}의 ${U.look.q} ${vec(L.q)}`, x0, y0, palette.accent, 13);
      label(ctx, U.look.sum, x0, y0 + 20, palette.normal, 11);
      L.keys.forEach((k, j) => {
        const y = y0 + 50 + j * (portrait ? 46 : 52), bw = x1 - x0 - 46;
        label(ctx, `${MARK[j]} ${U.look.k} ${vec(k)}`, x0, y, palette.ink, 12);
        label(ctx, `${U.look.score} ${num(L.scores[j])}`, x1, y, palette.muted, 11, "right");
        ctx.fillStyle = palette.track; ctx.fillRect(x0, y + 12, bw, 11);
        ctx.fillStyle = palette.normal; ctx.fillRect(x0, y + 12, Math.max(2, bw * L.weights[j]), 11);
        label(ctx, pc(L.weights[j]), x1, y + 18, palette.normal, 13, "right");
      });
    } else if (step === 2) {
      // narrow panels put each product's result on its own line
      const wide = x1 - x0 >= 300, rh = wide ? 34 : 40;
      label(ctx, U.look.mixing, x0, y0, palette.muted, 12);
      L.vals.forEach((v, j) => {
        const y = y0 + 34 + j * rh, color = j === top ? palette.normal : palette.ink;
        label(ctx, `${MARK[j]}  ${num(L.weights[j])} × ${vec(v)}`, x0, y, palette.ink, 12);
        label(ctx, `= ${vec(L.parts[j])}`, x1, wide ? y : y + 17, color, 12, "right");
      });
      const ys = y0 + 34 + 4 * rh + (wide ? 6 : 14);
      ctx.fillStyle = palette.frame; ctx.fillRect(x0, ys - 14, x1 - x0, 1);
      label(ctx, U.look.read, x0, ys + 6, palette.muted, 12);
      label(ctx, vec(L.read), x1, ys + 6, palette.normal, 16, "right");
    } else {
      const rows: [string, string, string][] = [
        [`${U.look.before} ${me}`, vec(L.x[owner]), palette.ink],
        [`+ ${U.look.read}`, vec(L.read), palette.normal],
        [`= ${U.look.after} ${me}`, vec(L.out), palette.accent],
      ];
      rows.forEach(([name, value, color], i) => {
        const y = y0 + 8 + i * 58;
        label(ctx, name, x0, y, palette.muted, 12);
        label(ctx, value, x0, y + 20, color, i === 2 ? 18 : 15);
      });
      label(ctx, U.look.same, x0, y0 + 8 + 3 * 58 + 6, palette.muted, 11);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.look.step}>
          <span>{U.look.step}</span>
          {U.look.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.look.owner}>
          <span>{U.look.owner}</span>
          {OWNERS.map((i) => <button key={i} type="button" className={owner === i ? "on" : ""} onClick={() => setOwner(i)}>{MARK[i]}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Change cell ③ only, and watch cell ① before and after the layer */
/* ------------------------------------------------------------------ */

const EYE = look(0, "eye"), BARE = look(0, "bg");
const TABLE: [string, string, boolean][] = [
  [vec(EYE.x[0]), vec(BARE.x[0]), true],
  [vec(EYE.keys[2]), vec(BARE.keys[2]), false],
  [vec(EYE.vals[2]), vec(BARE.vals[2]), false],
  [pc(EYE.weights[2]), pc(BARE.weights[2]), false],
  [vec(EYE.read), vec(BARE.read), false],
  [vec(EYE.out), vec(BARE.out), false],
];

export function PatchSwapScene() {
  const [third, setThird] = useState<Third>("eye");
  const head = useHead();

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), S = portrait ? 124 : Math.min(170, w * 0.32);
    const px = portrait ? (w - S) / 2 : PAD, py = 26;
    photo(ctx, head.current, px, py, S, CELLS[third], 0);
    if (third === "bg") {
      // mark the one cell that changed
      const c = S / 2;
      rbox(ctx, px + 6, py + c + c - 24, c - 12, 18, 5, "rgba(255,255,255,0.92)", palette.anomaly, 1);
      label(ctx, U.swap.painted, px + c / 2, py + 2 * c - 15, palette.anomaly, 11, "center");
    }
    const x0 = portrait ? PAD : px + S + 20, x1 = w - PAD, y0 = portrait ? py + S + 30 : py + 6;
    const tagW = 46, colW = (x1 - x0 - tagW) / 2, rh = Math.min(58, (h - y0 - 30) / TABLE.length);
    const on = third === "eye" ? 0 : 1;
    [U.swap.colEye, U.swap.colBg].forEach((name, cidx) => label(ctx, name, x0 + cidx * colW + 4, y0, cidx === on ? palette.accent : palette.muted, 11));
    TABLE.forEach(([a, b, same], i) => {
      const y = y0 + 18 + i * rh;
      label(ctx, U.swap.rows[i], x0 + 4, y + 6, palette.muted, 11);
      [a, b].forEach((value, cidx) => {
        const cx = x0 + cidx * colW;
        if (cidx === on) rbox(ctx, cx, y + 16, colW - 8, 24, 6, `rgba(${palette.accentRgb},0.1)`, palette.accent, 1.5);
        label(ctx, value, cx + 8, y + 28, cidx === on ? palette.ink : palette.muted, 13);
      });
      label(ctx, same ? U.swap.same : U.swap.differs, x1, y + 28, same ? palette.mint : palette.anomaly, 11, "right");
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.swap.third}>
          <span>{U.swap.third}</span>
          <button type="button" className={third === "eye" ? "on" : ""} onClick={() => setThird("eye")}>{U.swap.eye}</button>
          <button type="button" className={third === "bg" ? "on" : ""} onClick={() => setThird("bg")}>{U.swap.bg}</button>
        </div>
      </div>
    </div>
  );
}
