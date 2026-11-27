/** Drawing helpers shared by the pruning chapter's scenes. */

import { clamp, label, palette } from "@/components/anomaly/lib";
import { frame, line, rbox, type Ctx } from "./kit";
import { CAT_SRC } from "./cat-grids";

export const PAD = 16;
export const isPortrait = (w: number, h: number) => h > w * 1.15;
export const GREEN = palette.mint, AMBER = palette.accent, BLUE = palette.normal, RED = palette.anomaly;
export const tint = (rgb: string, a: number) => `rgba(${rgb},${a})`;

/* ---- numbers ---- */

/** Fixed decimals with a real minus sign; values that round to zero print as zero. */
export const fix = (v: number, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? (0).toFixed(d) : v.toFixed(d)).replace("-", "−");
export const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
/** Probability as a percentage with two decimals, capped so 0.99996 prints as 99.99% rather than 100.00%. */
export const pct2 = (v: number) => (v >= 0.99995 && v < 1 ? "99.99%" : `${(v * 100).toFixed(2)}%`);

/* ---- the owner's cat head, 512 x 512, cut into 16 x 16 cells ---- */

let headImg: HTMLImageElement | null = null;
export function headImage(): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  if (!headImg) {
    headImg = new window.Image();
    headImg.src = CAT_SRC.head;
  }
  return headImg.complete && headImg.naturalWidth > 0 ? headImg : null;
}
/** The head picture in an s × s box; the given cell (index r * 16 + c) outlined. Grey box until the image has loaded. */
export function drawHead(ctx: Ctx, x: number, y: number, s: number, cell: number | null, stroke: string = AMBER) {
  const img = headImage();
  if (!img) rbox(ctx, x, y, s, s, 6, palette.track, null);
  else ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight, x, y, s, s);
  frame(ctx, x + 0.5, y + 0.5, s - 1, s - 1, palette.frame, 1);
  if (cell !== null) {
    const k = s / 16, r = Math.floor(cell / 16), c = cell % 16;
    frame(ctx, x + c * k - 1, y + r * k - 1, k + 2, k + 2, "#ffffff", 3.5);
    frame(ctx, x + c * k - 1, y + r * k - 1, k + 2, k + 2, stroke, 2);
  }
}
/** A colour swatch for an RGB triple in 0..1. */
export function swatch(ctx: Ctx, rgb: number[], x: number, y: number, w: number, h: number) {
  ctx.fillStyle = `rgb(${rgb.map((v) => Math.round(v * 255)).join(",")})`;
  ctx.fillRect(x, y, w, h);
  frame(ctx, x + 0.5, y + 0.5, w - 1, h - 1, palette.frame, 1);
}

/* ---- tables of weights ---- */

/** Signed fill for a weight: blue for positive, red for negative, stronger with |w| / max. */
export const wFill = (v: number, max: number) => {
  const a = clamp(Math.abs(v) / max, 0, 1);
  return `rgba(${v >= 0 ? palette.normalRgb : palette.anomalyRgb},${0.07 + 0.38 * a})`;
};

export type TableOpts = {
  max?: number;                                     // colour scale
  mask?: number[][];                                // 0 = cut (drawn empty)
  digits?: number;
  mark?: (r: number, c: number) => string | null;   // outline colour for a cell
  text?: (v: number, r: number, c: number) => string;
  size?: number;                                    // font size
};
/** A table of numbers: one cell per weight, cut cells drawn as empty grey with a slash. */
export function weightTable(ctx: Ctx, W: number[][], x: number, y: number, cw: number, ch: number, o: TableOpts = {}) {
  const max = o.max ?? Math.max(...W.flat().map(Math.abs), 1e-9), d = o.digits ?? 2;
  W.forEach((row, r) => row.forEach((v, c) => {
    const cx = x + c * cw, cy = y + r * ch, cut = o.mask ? o.mask[r][c] === 0 : false;
    ctx.fillStyle = cut ? "rgba(15,23,42,0.035)" : wFill(v, max);
    ctx.fillRect(cx, cy, cw, ch);
    ctx.strokeStyle = palette.frame; ctx.lineWidth = 1;
    ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);
    if (cut) line(ctx, cx + 4, cy + ch - 4, cx + cw - 4, cy + 4, "rgba(15,23,42,0.25)", 1);
    else {
      const s = o.text ? o.text(v, r, c) : fix(v, d);
      const size = o.size ?? (s.length * 6.9 <= cw - 4 ? 11 : 10);
      label(ctx, s, cx + cw / 2, cy + ch / 2 + 0.5, palette.ink, size, "center");
    }
    const m = o.mark?.(r, c);
    if (m) frame(ctx, cx + 1, cy + 1, cw - 2, ch - 2, m, 2);
  }));
}

/* ---- simple plots ---- */

export type Axes = { x: number; y: number; w: number; h: number; x0: number; x1: number; y0: number; y1: number };
export const ax = (a: Axes, v: number) => a.x + ((v - a.x0) / (a.x1 - a.x0)) * a.w;
export const ay = (a: Axes, v: number) => a.y + a.h - ((v - a.y0) / (a.y1 - a.y0)) * a.h;
/** Frame, horizontal grid lines at the given y values with their labels on the left. */
export function axesFrame(ctx: Ctx, a: Axes, yTicks: number[], yFmt: (v: number) => string) {
  yTicks.forEach((v) => {
    const yy = ay(a, v);
    line(ctx, a.x, yy, a.x + a.w, yy, "rgba(15,23,42,0.08)", 1);
    label(ctx, yFmt(v), a.x - 5, yy, palette.muted, 10, "right");
  });
  line(ctx, a.x, a.y + a.h, a.x + a.w, a.y + a.h, palette.frame, 1);
  line(ctx, a.x, a.y, a.x, a.y + a.h, palette.frame, 1);
}
export function polyline(ctx: Ctx, pts: [number, number][], color: string, lw = 2, dash?: number[]) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  if (dash) ctx.setLineDash(dash);
  ctx.beginPath();
  pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.stroke();
  ctx.restore();
}
export function dot(ctx: Ctx, x: number, y: number, r: number, fill: string, stroke: string | null = "#ffffff") {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1.2; ctx.stroke(); }
}
/** Text broken at spaces to fit maxW; returns the y below the last line. */
export function wrapText(ctx: Ctx, text: string, x: number, y: number, maxW: number, lineH: number, color: string = palette.ink, size = 11): number {
  ctx.save();
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const words = text.split(" ");
  let cur = "", yy = y;
  words.forEach((wd) => {
    const next = cur ? `${cur} ${wd}` : wd;
    if (ctx.measureText(next).width > maxW && cur) { label(ctx, cur, x, yy, color, size); cur = wd; yy += lineH; }
    else cur = next;
  });
  if (cur) label(ctx, cur, x, yy, color, size);
  ctx.restore();
  return yy + lineH;
}

/** A labelled horizontal bar: track, filled share, value text at the right end of the track. */
export function hbar(ctx: Ctx, x: number, y: number, w: number, h: number, v: number, color: string, text?: string, textColor: string = palette.ink) {
  ctx.fillStyle = palette.track; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(0, w * clamp(v, 0, 1)), h);
  if (text) label(ctx, text, x + w + 6, y + h / 2 + 0.5, textColor, 11);
}
