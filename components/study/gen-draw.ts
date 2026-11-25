/** Canvas helpers shared by the "modern image and video generators" scenes. */

import { label, palette } from "@/components/anomaly/lib";
import { frame, gray, type Ctx } from "./kit";
import { genCopy } from "./gen-copy";
import type { Img } from "./gen-math";

export const PAD = 18;
export const isPortrait = (w: number, h: number) => h > w * 1.15;
export const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.01 ? 1 : 0)}%`;
/** A share with one decimal below 10%, so small losses such as 1.3% and 4.6% stay apart. */
export const pctFine = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
/** A fixed number of decimals with a real minus sign; a rounded zero never keeps its sign. */
export const num = (v: number, d = 2) => { const s = v.toFixed(d); return (Number(s) === 0 ? s.replace("-", "") : s).replace("-", "−"); };
export const point = (p: [number, number]) => `[${num(p[0])}, ${num(p[1])}]`;

/** Large counts in Korean units: 만 (1e4), 억 (1e8), 조 (1e12). */
export function ko(n: number): string {
  const unit = genCopy.ui.dit.unit;
  if (n >= 1e12) return `${(n / 1e12).toFixed(1)}${unit.jo}`;
  if (n >= 1e8) return `${(n / 1e8).toFixed(1)}${unit.eok}`;
  if (n >= 1e5) return `${Math.floor(n / 1e4).toLocaleString("en-US")}${unit.man}`;
  return Math.round(n).toLocaleString("en-US");
}

const bitmaps = new WeakMap<Img, HTMLCanvasElement>();
/** A grayscale image drawn once into a small off-screen canvas, then scaled up with hard pixel edges. */
export function picture(ctx: Ctx, img: Img, x: number, y: number, S: number) {
  let c = bitmaps.get(img);
  if (!c) {
    c = document.createElement("canvas");
    c.width = img[0].length; c.height = img.length;
    const g = c.getContext("2d");
    if (g) {
      const d = g.createImageData(c.width, c.height), cw = c.width;
      img.forEach((row, yy) => row.forEach((v, xx) => {
        const q = Math.round(28 + Math.min(1, Math.max(0, v)) * 210), i = 4 * (yy * cw + xx);
        d.data[i] = q; d.data[i + 1] = q; d.data[i + 2] = q + 4; d.data[i + 3] = 255;
      }));
      g.putImageData(d, 0, 0);
    }
    bitmaps.set(img, c);
  }
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(c, x, y, S, S); ctx.restore();
  frame(ctx, x, y, S, S, palette.frame, 1);
}

/** One 4×4 patch as gray cells, optionally with each value written inside and a red box on the cells `bad` picks out. */
export function patchGrid(ctx: Ctx, p: number[], x: number, y: number, cell: number, numbers = false, bad?: (i: number) => boolean) {
  p.forEach((v, i) => {
    const cx = x + (i % 4) * cell, cy = y + Math.floor(i / 4) * cell;
    ctx.fillStyle = gray(v); ctx.fillRect(cx, cy, cell + 0.5, cell + 0.5);
    if (numbers) label(ctx, num(v), cx + cell / 2, cy + cell / 2 + 0.5, v > 0.45 ? palette.ink : "#ffffff", 11, "center");
  });
  frame(ctx, x, y, 4 * cell, 4 * cell, palette.frame, 1);
  if (bad) p.forEach((_, i) => { if (bad(i)) frame(ctx, x + (i % 4) * cell + 1.5, y + Math.floor(i / 4) * cell + 1.5, cell - 3, cell - 3, palette.anomaly, 2); });
}

/** A filled dot. */
export function dot(ctx: Ctx, x: number, y: number, r: number, fill: string, stroke?: string, lw = 1.5) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}
