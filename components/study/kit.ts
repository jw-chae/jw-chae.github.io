/** Small canvas helpers shared by the study scenes. */

import { clamp, label, palette } from "@/components/anomaly/lib";

/** Pixel value 0..1 as a gray swatch (0 = dark, 1 = bright), like a real image. */
export const gray = (v: number) => {
  const g = Math.round(28 + clamp(v, 0, 1) * 210);
  return `rgb(${g},${g},${g + 4})`;
};

/** Signed value as color: positive blue, negative red, strength by |v| / max. */
export const signed = (v: number, max = 1) => {
  const a = clamp(Math.abs(v) / max, 0, 1);
  return a < 0.02 ? palette.track : `rgba(${v >= 0 ? palette.normalRgb : palette.anomalyRgb},${0.12 + 0.88 * a})`;
};

/** Non-negative activation as an amber swatch. */
export const act = (v: number, max = 1) => {
  const a = clamp(v / max, 0, 1);
  return a < 0.02 ? palette.track : `rgba(${palette.accentRgb},${0.12 + 0.88 * a})`;
};

export type Ctx = CanvasRenderingContext2D;

/** Draw a rows × cols block of square cells; `fill` returns a CSS color per cell. */
export function cells(ctx: Ctx, x: number, y: number, cell: number, rows: number, cols: number, fill: (r: number, c: number) => string, gap = 1) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    ctx.fillStyle = fill(r, c);
    ctx.fillRect(x + c * cell + gap / 2, y + r * cell + gap / 2, cell - gap, cell - gap);
  }
}

export function frame(ctx: Ctx, x: number, y: number, w: number, h: number, color: string = palette.accent, lw = 2.5, dash?: number[]) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  if (dash) ctx.setLineDash(dash);
  ctx.strokeRect(x, y, w, h);
  ctx.restore();
}

export function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, lw = 1, dash?: number[]) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

/** Arrow from (x1,y1) to (x2,y2) with a small head. */
export function arrow(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string = palette.muted, lw = 1.5) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  line(ctx, x1, y1, x2, y2, color, lw);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 7 * Math.cos(a - 0.45), y2 - 7 * Math.sin(a - 0.45));
  ctx.lineTo(x2 - 7 * Math.cos(a + 0.45), y2 - 7 * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Horizontal bar with a track; value in 0..1. */
export function bar(ctx: Ctx, x: number, y: number, w: number, h: number, value: number, color: string) {
  ctx.fillStyle = palette.track;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(0, w * clamp(value, 0, 1)), h);
}

/** Text centered in a cell; picks a size that fits. */
export function cellText(ctx: Ctx, text: string, x: number, y: number, cell: number, color: string = palette.ink) {
  const size = clamp(Math.floor(cell * 0.34), 7, 12);
  label(ctx, text, x + cell / 2, y + cell / 2, color, size, "center");
}

/** Rounded rectangle path filled and/or stroked. */
export function rbox(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | null, stroke: string | null, lw = 1.5) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}

export const fmt = (v: number, digits = 2) => (Math.abs(v) < 0.005 ? "0" : v.toFixed(digits));
