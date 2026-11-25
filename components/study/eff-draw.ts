/** Small drawing and formatting helpers shared by the efficiency scenes. */

import { label, palette } from "@/components/anomaly/lib";
import { line, rbox, type Ctx } from "./kit";

export const PAD = 18;
export const COMP = palette.normal;        // computing: blue
export const MOVE = palette.accent;        // moving bytes: amber
export const SAME = palette.mint;          // equal
export const DIFF = palette.anomaly;       // differs
export const isPortrait = (w: number, h: number) => h > w * 1.15;
export const tint = (rgb: string, a: number) => `rgba(${rgb},${a})`;

export const int = (v: number) => Math.round(v).toLocaleString("en-US");
export const us = (v: number, d = 1) => `${v.toFixed(d)}µs`;
export const mb = (bytes: number, d = 2) => `${(bytes / 1e6).toFixed(d)}MB`;
/** Ratio written plainly: 2.85, 0.13, 64. */
export const ratio = (v: number) => (v >= 9.95 ? v.toFixed(0) : v >= 0.995 ? v.toFixed(2).replace(/\.?0+$/, "") : v.toFixed(2));

/** A stack of feature maps: a front square of `side` px receding by `depth` px up and to the right. */
export function stack(ctx: Ctx, x: number, y: number, side: number, depth: number, tone: string, rgb: string) {
  const dx = depth * 0.62, dy = depth * 0.46;
  ctx.save();
  // top and right faces
  ctx.fillStyle = tint(rgb, 0.1);
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y - dy); ctx.lineTo(x + side + dx, y - dy); ctx.lineTo(x + side, y); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + side, y); ctx.lineTo(x + side + dx, y - dy); ctx.lineTo(x + side + dx, y + side - dy); ctx.lineTo(x + side, y + side); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = tone; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + dx, y - dy); ctx.lineTo(x + side + dx, y - dy); ctx.lineTo(x + side + dx, y + side - dy); ctx.lineTo(x + side, y + side);
  ctx.moveTo(x + side, y); ctx.lineTo(x + side + dx, y - dy);
  ctx.stroke();
  // front face
  ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, side, side);
  ctx.fillStyle = tint(rgb, 0.12); ctx.fillRect(x, y, side, side);
  ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, side - 1, side - 1);
  ctx.restore();
  return { dx, dy };
}

/** Horizontal bar with a light track; `frac` in 0..1 of `w`. */
export function hbar(ctx: Ctx, x: number, y: number, w: number, h: number, frac: number, color: string, strong = false) {
  ctx.fillStyle = palette.track;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.max(2, w * Math.min(1, Math.max(0, frac))), h);
  if (strong) { ctx.save(); ctx.strokeStyle = palette.ink; ctx.lineWidth = 2; ctx.strokeRect(x - 1, y - 1, Math.max(2, w * Math.min(1, frac)) + 2, h + 2); ctx.restore(); }
}

/** A small rounded tag with text, right-aligned at x when `right`. */
export function tag(ctx: Ctx, text: string, x: number, y: number, color: string, right = false, size = 11) {
  ctx.save();
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const tw = ctx.measureText(text).width + 14;
  ctx.restore();
  const x0 = right ? x - tw : x;
  rbox(ctx, x0, y - 10, tw, 20, 9, tint(color === SAME ? "15,157,106" : color === DIFF ? palette.anomalyRgb : palette.accentRgb, 0.1), color, 1.2);
  label(ctx, text, x0 + tw / 2, y + 0.5, color, size, "center");
}

/** Log axis helper: maps v in [lo, hi] onto [a, b] in log space. */
export const logMap = (v: number, lo: number, hi: number, a: number, b: number) => a + ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * (b - a);

/** Dashed guide line. */
export const guide = (ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string = palette.frame) => line(ctx, x1, y1, x2, y2, color, 1, [4, 4]);
