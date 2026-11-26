/** Canvas helpers for the DETR study scenes: the token grid over the YOLO chapter's picture, shares as heat, the
 *  three-way probability bar (cat, cup, no object), fog, and small tables. The picture itself comes from yolo-draw.ts. */

import { label, palette } from "@/components/anomaly/lib";
import { arrow, frame, rbox, type Ctx } from "./kit";
import { IMG } from "./detr-math";
import { OUT, READ, fitLabel, tw } from "./yolo-draw";

export type Pic = { px: number; py: number; s: number };
export const NONE_C = "rgba(120,120,140,0.55)";              // "no object": grey
export const clsColor = (k: number) => (k === 0 ? OUT : k === 1 ? READ : palette.muted);
export const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

/** Grid lines of an n × n token map over the picture. */
export function tokGrid(ctx: Ctx, L: Pic, n: number, alpha = 0.3, color = "20,24,33") {
  const c = L.s / n;
  ctx.save();
  ctx.strokeStyle = `rgba(${color},${alpha})`; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < n; i++) {
    ctx.moveTo(L.px + i * c, L.py); ctx.lineTo(L.px + i * c, L.py + L.s);
    ctx.moveTo(L.px, L.py + i * c); ctx.lineTo(L.px + L.s, L.py + i * c);
  }
  ctx.stroke();
  ctx.restore();
}

export function tokFill(ctx: Ctx, L: Pic, n: number, r: number, c: number, color: string) {
  const s = L.s / n;
  ctx.fillStyle = color;
  ctx.fillRect(L.px + c * s + 0.5, L.py + r * s + 0.5, s - 1, s - 1);
}
export function tokOutline(ctx: Ctx, L: Pic, n: number, r: number, c: number, color: string, lw = 2) {
  const s = L.s / n;
  frame(ctx, L.px + c * s + lw / 2 + 0.5, L.py + r * s + lw / 2 + 0.5, s - lw - 1, s - lw - 1, color, lw);
}
/** A short text in the middle of a token cell on a white pill (only when the cell is wide enough). */
export function tokText(ctx: Ctx, L: Pic, n: number, r: number, c: number, text: string, color: string = palette.ink, dy = 0) {
  const s = L.s / n, size = s < 34 ? 11 : 11.5, w = tw(ctx, text, size) + 6;
  if (w > s - 2) return;
  const x = L.px + c * s + s / 2, y = L.py + r * s + s / 2 + dy;
  rbox(ctx, x - w / 2, y - 7.5, w, 15, 4, "rgba(255,255,255,0.86)", null);
  label(ctx, text, x, y, color, size, "center");
}
/** The token number in the top-left corner of its cell. */
export function tokNo(ctx: Ctx, L: Pic, n: number, r: number, c: number, color: string = palette.muted) {
  const s = L.s / n, t = String(r * n + c + 1), w = tw(ctx, t, 11) + 5;
  rbox(ctx, L.px + c * s + 2, L.py + r * s + 2, w, 14, 3, "rgba(255,255,255,0.8)", null);
  label(ctx, t, L.px + c * s + 2 + w / 2, L.py + r * s + 9, color, 11, "center");
}

/** Reading share as a blue wash, strongest at `max`. */
export const heat = (v: number, max: number) => `rgba(${palette.normalRgb},${(0.06 + 0.6 * Math.min(1, v / max)).toFixed(3)})`;

/** A picture point (picture pixels) on the canvas. */
export const at = (L: Pic, x: number, y: number): [number, number] => [L.px + (x * L.s) / IMG, L.py + (y * L.s) / IMG];
/** A small × at a picture point. */
export function cross(ctx: Ctx, L: Pic, x: number, y: number, color: string = palette.ink, r = 5) {
  const [cx, cy] = at(L, x, y);
  ctx.save();
  ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r); ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r); ctx.stroke();
  ctx.restore();
}
export function dotAt(ctx: Ctx, L: Pic, x: number, y: number, color: string, r = 4.5) {
  const [cx, cy] = at(L, x, y);
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r + 1.5, 0, Math.PI * 2); ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
  ctx.restore();
}
export function arrowPic(ctx: Ctx, L: Pic, x1: number, y1: number, x2: number, y2: number, color: string) {
  const [ax, ay] = at(L, x1, y1), [bx, by] = at(L, x2, y2), d = Math.hypot(bx - ax, by - ay), k = d > 12 ? (d - 7) / d : 1;
  arrow(ctx, ax, ay, ax + (bx - ax) * k, ay + (by - ay) * k, color, 1.6);
}

/** Fog over the picture: a pale veil. */
export function fogOver(ctx: Ctx, L: Pic, a = 0.5) {
  ctx.fillStyle = `rgba(244,246,248,${a})`;
  ctx.fillRect(L.px, L.py, L.s, L.s);
}

/** The three probabilities of one slot as one bar: cat (amber), cup (blue), no object (grey). The bar is always full. */
export function probBar(ctx: Ctx, x: number, y: number, w: number, h: number, p: number[]) {
  let cx = x;
  const cols = [`rgba(${palette.accentRgb},0.78)`, `rgba(${palette.normalRgb},0.6)`, NONE_C];
  p.forEach((v, k) => { ctx.fillStyle = cols[k]; ctx.fillRect(cx, y, w * v, h); cx += w * v; });
  frame(ctx, x, y, w, h, palette.frame, 1);
}

/** Three labelled bars (one per class) with their values. */
export function classBars(ctx: Ctx, x: number, y: number, w: number, p: number[], names: string[], fs = 12, dy = 21) {
  const nameW = 50, bw = Math.max(40, w - nameW - 50);
  p.forEach((v, k) => {
    label(ctx, names[k], x, y + k * dy, k === 2 ? palette.muted : palette.ink, fs);
    ctx.fillStyle = palette.track; ctx.fillRect(x + nameW, y + k * dy - 5, bw, 10);
    ctx.fillStyle = k === 0 ? `rgba(${palette.accentRgb},0.85)` : k === 1 ? `rgba(${palette.normalRgb},0.7)` : NONE_C;
    ctx.fillRect(x + nameW, y + k * dy - 5, bw * v, 10);
    label(ctx, v.toFixed(3), x + nameW + bw + 6, y + k * dy, palette.ink, fs);
  });
  return y + p.length * dy;
}

/** A label that wraps onto a second line at a space when it does not fit. Returns the y after it. */
export function wrapLabel(ctx: Ctx, text: string, x: number, y: number, maxW: number, color: string, size = 12, dy = 18) {
  if (tw(ctx, text, size) <= maxW) { label(ctx, text, x, y, color, size); return y + dy; }
  const words = text.split(" ");
  let a = "";
  for (let i = 0; i < words.length; i++) {
    const t = a ? `${a} ${words[i]}` : words[i];
    if (tw(ctx, t, size) > maxW && a) {
      label(ctx, a, x, y, color, size);
      fitLabel(ctx, words.slice(i).join(" "), x, y + dy, maxW, color, size);
      return y + 2 * dy;
    }
    a = t;
  }
  fitLabel(ctx, a, x, y, maxW, color, size);
  return y + dy;
}
