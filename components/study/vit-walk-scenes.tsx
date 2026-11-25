"use client";

import { useMemo, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, frame, rbox, type Ctx } from "./kit";
import { vitWalkUi as U } from "./vit-walk-copy";
import type { Kind } from "./vit-math";
import { look, type Patch2 } from "./walk-math";

const PAD = 18;
export const MARK = ["1번", "2번", "3번", "4번"];
export const num = (v: number) => { const s = v.toFixed(2).replace(/\.?0+$/, ""); return s === "-0" ? "0" : s.replace("-", "−"); };
export const vec = (a: number[]) => `[${a.map(num).join(", ")}]`;
export const pc = (v: number) => `${Math.round(v * 100)}%`;
export const isPortrait = (w: number, h: number) => h > w * 1.15;

const WALL = "#efece4", FUR = "#d9903f", STRIPE = "#8a5220";

/** What each of the four cells holds, for the two photos of sections 02–03. */
export const CELLS: Record<Patch2, Kind[]> = { eye: ["ear", "eye", "wall", "wall"], wall: ["ear", "wall", "wall", "wall"] };

/** One cell of the photo: a striped cat's ear, its eye, or bare wall. Drawn, not a real photograph. */
function cell(ctx: Ctx, x: number, y: number, c: number, kind: Kind) {
  if (kind === "wall") return;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, c, c); ctx.clip();
  const stripes = (y0: number, y1: number) => {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y0, c, y1 - y0); ctx.clip();
    ctx.strokeStyle = STRIPE; ctx.lineWidth = Math.max(2, c * 0.044);
    for (let k = -4; k < 12; k++) { ctx.beginPath(); ctx.moveTo(x + k * c * 0.2, y1); ctx.lineTo(x + k * c * 0.2 + c * 0.22, y0); ctx.stroke(); }
    ctx.restore();
  };
  if (kind === "ear") {
    // the top of the head with one ear
    ctx.fillStyle = FUR; ctx.fillRect(x, y + c * 0.62, c, c * 0.38);
    ctx.beginPath(); ctx.moveTo(x + c * 0.2, y + c * 0.64); ctx.lineTo(x + c * 0.5, y + c * 0.1); ctx.lineTo(x + c * 0.86, y + c * 0.64); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#f2c6b0"; ctx.beginPath(); ctx.moveTo(x + c * 0.38, y + c * 0.62); ctx.lineTo(x + c * 0.52, y + c * 0.3); ctx.lineTo(x + c * 0.7, y + c * 0.62); ctx.closePath(); ctx.fill();
    stripes(y + c * 0.66, y + c);
  } else {
    ctx.fillStyle = FUR; ctx.fillRect(x, y + c * 0.3, c, c * 0.7);
    stripes(y + c * 0.3, y + c * 0.52);
    ctx.fillStyle = "#e9e3b4"; ctx.beginPath(); ctx.ellipse(x + c * 0.5, y + c * 0.72, c * 0.24, c * 0.15, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1b1b1b"; ctx.beginPath(); ctx.ellipse(x + c * 0.5, y + c * 0.72, c * 0.05, c * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/** The 2 × 2 photo without its grid: `cells` says what sits in ①, ②, ③, ④. */
export function cat(ctx: Ctx, x: number, y: number, S: number, cells: Kind[]) {
  const c = S / 2;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, S, S); ctx.clip();
  ctx.fillStyle = WALL; ctx.fillRect(x, y, S, S);
  cells.forEach((kind, i) => cell(ctx, x + (i % 2) * c, y + Math.floor(i / 2) * c, c, kind));
  ctx.restore();
}

/** The photo with its grid, cell numbers and one highlighted cell (`hot` < 0 for none). */
export function photo(ctx: Ctx, x: number, y: number, S: number, cells: Kind[], hot: number) {
  const c = S / 2;
  cat(ctx, x, y, S, cells);
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

export function PatchLookScene() {
  const [owner, setOwner] = useState(0);
  const [step, setStep] = useState(0);
  const L = useMemo(() => look(owner), [owner]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), S = portrait ? 150 : Math.min(210, w * 0.4);
    const px = portrait ? (w - S) / 2 : PAD, py = 34;
    photo(ctx, px, py, S, CELLS.eye, owner);
    const x0 = portrait ? PAD : px + S + 22, x1 = w - PAD, y0 = portrait ? py + S + 34 : py + 8, rh = portrait ? 34 : 44;
    const me = MARK[owner];

    if (step === 0) {
      const Z = Math.min(112, x1 - x0 - 20);
      label(ctx, `${me} ${U.look.inside}`, x0, y0, palette.muted, 12);
      ctx.save(); ctx.beginPath(); ctx.rect(x0, y0 + 14, Z, Z); ctx.clip();
      cat(ctx, x0 - (owner % 2) * Z, y0 + 14 - Math.floor(owner / 2) * Z, 2 * Z, CELLS.eye);
      ctx.restore(); frame(ctx, x0, y0 + 14, Z, Z, palette.accent, 2);
      arrow(ctx, x0 + Z / 2, y0 + Z + 20, x0 + Z / 2, y0 + Z + 44, palette.accent, 2);
      label(ctx, `${me} ${U.look.vector}`, x0, y0 + Z + 60, palette.muted, 12);
      label(ctx, vec(L.x[owner]), x0, y0 + Z + 84, palette.ink, 18);
      label(ctx, U.look.noLabel, x0, y0 + Z + 110, palette.muted, 11);
    } else if (step === 1) {
      label(ctx, `${me}의 ${U.look.q} ${vec(L.q)}`, x0, y0, palette.accent, 13);
      label(ctx, U.look.sum, x1, y0, palette.normal, 11, "right");
      L.keys.forEach((k, j) => {
        const y = y0 + 40 + j * (rh + 12), bx = x0 + 132, bw = Math.max(30, x1 - bx - 44);
        label(ctx, `${MARK[j]} ${U.look.k} ${vec(k)}`, x0, y - 7, palette.ink, 12);
        label(ctx, `${U.look.score} ${num(L.scores[j])}`, x0, y + 10, palette.muted, 11);
        ctx.fillStyle = palette.track; ctx.fillRect(bx, y - 6, bw, 12);
        ctx.fillStyle = palette.normal; ctx.fillRect(bx, y - 6, Math.max(2, bw * L.weights[j]), 12);
        label(ctx, pc(L.weights[j]), x1, y, palette.normal, 13, "right");
      });
    } else if (step === 2) {
      label(ctx, U.look.mixing, x0, y0, palette.muted, 12);
      L.vals.forEach((v, j) => {
        const y = y0 + 34 + j * rh;
        label(ctx, `${MARK[j]}  ${num(L.weights[j])} × ${vec(v)}`, x0, y, palette.ink, 12);
        label(ctx, `= ${vec(L.parts[j])}`, x1, y, j === 1 - owner ? palette.normal : palette.ink, 12, "right");
      });
      const ys = y0 + 34 + 4 * rh + 6;
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
          {[0, 1].map((i) => <button key={i} type="button" className={owner === i ? "on" : ""} onClick={() => setOwner(i)}>{MARK[i]}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Change patch ② only, and watch patch ① before and after the layer */
/* ------------------------------------------------------------------ */

const EYE = look(0, "eye"), BARE = look(0, "wall");
const TABLE: [string, string, boolean][] = [
  [vec(EYE.x[0]), vec(BARE.x[0]), true],
  [vec(EYE.keys[1]), vec(BARE.keys[1]), false],
  [vec(EYE.vals[1]), vec(BARE.vals[1]), false],
  [pc(EYE.weights[1]), pc(BARE.weights[1]), false],
  [vec(EYE.read), vec(BARE.read), false],
  [vec(EYE.out), vec(BARE.out), false],
];

export function PatchSwapScene() {
  const [second, setSecond] = useState<Patch2>("eye");

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), S = portrait ? 124 : Math.min(170, w * 0.32);
    const px = portrait ? (w - S) / 2 : PAD, py = 26;
    photo(ctx, px, py, S, CELLS[second], 0);
    const x0 = portrait ? PAD : px + S + 20, x1 = w - PAD, y0 = portrait ? py + S + 30 : py + 6;
    const tagW = 46, colW = (x1 - x0 - tagW) / 2, rh = Math.min(58, (h - y0 - 30) / TABLE.length);
    const on = second === "eye" ? 0 : 1;
    [U.swap.colEye, U.swap.colWall].forEach((name, cidx) => label(ctx, name, x0 + cidx * colW + 4, y0, cidx === on ? palette.accent : palette.muted, 11));
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
        <div className="ad-ctl ad-seg" role="group" aria-label={U.swap.second}>
          <span>{U.swap.second}</span>
          <button type="button" className={second === "eye" ? "on" : ""} onClick={() => setSecond("eye")}>{U.swap.eye}</button>
          <button type="button" className={second === "wall" ? "on" : ""} onClick={() => setSecond("wall")}>{U.swap.wall}</button>
        </div>
      </div>
    </div>
  );
}
