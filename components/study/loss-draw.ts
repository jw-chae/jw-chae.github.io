/** Canvas helpers for the loss study scenes: crops of the YOLO chapter's picture, small plots, number formats.
 *  The picture itself (the pixel-art Siamese cat, a drawn cup, wall and floor) comes from yolo-draw.ts. */

import { label, palette } from "@/components/anomaly/lib";
import { frame, line, type Ctx } from "./kit";
import { IMG, type Box } from "./loss-math";
import { drawPicture } from "./yolo-draw";

export { BAD, GT, OUT, PAD, READ, drawBox, drawPicture, fitLabel, isPortrait, mapOf, tw } from "./yolo-draw";

/** Up to d decimals, trailing zeros dropped, real minus sign; very large values in exponent form. */
export const num = (v: number, d = 3) => {
  if (!Number.isFinite(v)) return "∞";
  if (Math.abs(v) >= 1e6) return v.toExponential(2).replace("-", "−").replace("e+", "e");
  const raw = v.toFixed(d), s = raw.includes(".") ? raw.replace(/\.?0+$/, "") : raw;
  return s === "-0" || s === "" ? "0" : s.replace("-", "−");
};
/** Exactly d decimals, real minus sign. */
export const fix = (v: number, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? (0).toFixed(d) : v.toFixed(d)).replace("-", "−");
export const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
/** Thousands separators. */
export const big = (v: number, d = 0) => v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Crops of the picture the chapter uses (picture pixels). Drawing constants, not quoted numbers. */
export const CROP_HEAD: Box = [33, 32, 76, 74];
export const CROP_LEGS: Box = [15, 112, 73, 139];
export const CROP_CUP: Box = [112, 92, 150, 140];

/** Draw one region of the picture into the rectangle (x, y, w, h), keeping its aspect (centred), with a frame. */
export function cropPic(ctx: Ctx, region: Box, x: number, y: number, w: number, h: number, color: string = palette.frame, loading?: string) {
  const rw = region[2] - region[0], rh = region[3] - region[1], k = Math.min(w / rw, h / rh);
  const dw = rw * k, dh = rh * k, ox = x + (w - dw) / 2, oy = y + (h - dh) / 2;
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, dw, dh); ctx.clip();
  drawPicture(ctx, { px: ox - region[0] * k, py: oy - region[1] * k, s: IMG * k }, { loading });
  ctx.restore();
  frame(ctx, ox, oy, dw, dh, color, 1.5);
  return { ox, oy, dw, dh };
}

/** The picture placement that shows `region` inside the rectangle (x, y, w, h), and that rectangle as a clip.
 *  Draw the picture and boxes with the returned L between `ctx.save(); clip(...)` and `ctx.restore()`. */
export function zoomL(region: Box, x: number, y: number, w: number, h: number) {
  const rw = region[2] - region[0], rh = region[3] - region[1], k = Math.min(w / rw, h / rh);
  const dw = rw * k, dh = rh * k, ox = x + (w - dw) / 2, oy = y + (h - dh) / 2;
  return { L: { px: ox - region[0] * k, py: oy - region[1] * k, s: IMG * k }, clip: [ox, oy, dw, dh] as [number, number, number, number] };
}

/** A plot frame: maps data (u, v) in [u0, u1] × [v0, v1] into the rectangle, draws light axes. */
export type Plot = { x: number; y: number; w: number; h: number; X: (u: number) => number; Y: (v: number) => number; u0: number; u1: number; v0: number; v1: number };
export function plot(ctx: Ctx, x: number, y: number, w: number, h: number, u: [number, number], v: [number, number]): Plot {
  const P: Plot = {
    x, y, w, h, u0: u[0], u1: u[1], v0: v[0], v1: v[1],
    X: (q) => x + ((q - u[0]) / (u[1] - u[0])) * w,
    Y: (q) => y + h - ((q - v[0]) / (v[1] - v[0])) * h,
  };
  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  line(ctx, x, y + h, x + w, y + h, palette.frame, 1);
  line(ctx, x, y, x, y + h, palette.frame, 1);
  return P;
}
/** A curve of f over the plot's u range, clipped to the plot. */
export function curve(ctx: Ctx, P: Plot, f: (u: number) => number, color: string, lw = 2, n = 240, dash?: number[]) {
  ctx.save();
  ctx.beginPath(); ctx.rect(P.x, P.y - 1, P.w, P.h + 2); ctx.clip();
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const u = P.u0 + ((P.u1 - P.u0) * i) / n, v = f(u), yy = P.Y(Math.max(P.v0 - (P.v1 - P.v0), Math.min(P.v1 + (P.v1 - P.v0), v)));
    if (i === 0) ctx.moveTo(P.X(u), yy); else ctx.lineTo(P.X(u), yy);
  }
  ctx.stroke();
  ctx.restore();
}
/** Tick labels along the bottom (u values) and the left (v values). */
export function ticks(ctx: Ctx, P: Plot, us: number[], vs: number[], fmtU: (u: number) => string = (u) => num(u), fmtV: (v: number) => string = (v) => num(v)) {
  us.forEach((u) => { line(ctx, P.X(u), P.y + P.h, P.X(u), P.y + P.h + 4, palette.frame, 1); label(ctx, fmtU(u), P.X(u), P.y + P.h + 13, palette.muted, 11, "center"); });
  vs.forEach((v) => { line(ctx, P.x - 4, P.Y(v), P.x, P.Y(v), palette.frame, 1); label(ctx, fmtV(v), P.x - 6, P.Y(v), palette.muted, 11, "right"); });
}
export function dot(ctx: Ctx, x: number, y: number, r: number, fill: string, stroke: string | null = "#ffffff") {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.restore();
}
