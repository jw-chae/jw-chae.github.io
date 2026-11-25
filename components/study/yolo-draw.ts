/** Canvas helpers for the YOLO study scenes: the one picture (a cat and a cup), its grid, boxes, and the scene layout. */

import { label, palette } from "@/components/anomaly/lib";
import { frame, rbox, type Ctx } from "./kit";
import { GRID, IMG, RC, type Box, type CellId } from "./yolo-math";

export const PAD = 18;
export const isPortrait = (w: number, h: number) => h > w * 1.15;
export const OUT = palette.accent;     // what the model outputs: amber
export const GT = palette.mint;        // the answer sheet: green
export const BAD = palette.anomaly;    // removed or contradicting: red
export const READ = palette.normal;    // computed comparisons (IoU, dot products): blue
export const TINT = `rgba(${palette.accentRgb},0.18)`;

/** Up to d decimals, trailing zeros dropped, real minus sign. */
export const num = (v: number, d = 3) => {
  const raw = v.toFixed(d), s = raw.includes(".") ? raw.replace(/\.?0+$/, "") : raw;
  return s === "-0" || s === "" ? "0" : s.replace("-", "−");
};
/** Exactly d decimals, real minus sign. */
export const fix = (v: number, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? (0).toFixed(d) : v.toFixed(d)).replace("-", "−");
export const vec = (a: number[], d = 3) => `[${a.map((v) => num(v, d)).join(", ")}]`;

/** Width of a label as `label` would draw it. */
export function tw(ctx: Ctx, text: string, size: number) {
  ctx.save();
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}
/** A label that shrinks (down to 11 px) to fit `maxW`. */
export function fitLabel(ctx: Ctx, text: string, x: number, y: number, maxW: number, color: string, size = 12, align: CanvasTextAlign = "left") {
  let s = size;
  while (s > 11 && tw(ctx, text, s) > maxW) s -= 0.5;
  label(ctx, text, x, y, color, s, align);
}

/** Where the picture goes and where the side panel goes. */
export type Lay = { port: boolean; px: number; py: number; s: number; x: number; y: number; pw: number; ph: number };
export function layout(w: number, h: number, picShare = 0.47, top = 40): Lay {
  const port = isPortrait(w, h);
  if (port) {
    const s = Math.min(w - 2 * PAD, h * 0.42);
    const py = top - 4;
    return { port, px: (w - s) / 2, py, s, x: PAD, y: py + s + 24, pw: w - 2 * PAD, ph: h - (py + s + 24) - 10 };
  }
  const s = Math.min(h - top - 64, (w - 3 * PAD) * picShare);
  const x = PAD + s + PAD + 4, py = Math.max(top, Math.round((h - s) / 2) - 4);
  return { port, px: PAD, py, s, x, y: py, pw: w - x - PAD, ph: h - py - 10 };
}

export type Map = { X: (u: number) => number; Y: (v: number) => number; k: number };
export const mapOf = (L: { px: number; py: number; s: number }): Map => ({ X: (u) => L.px + (u * L.s) / IMG, Y: (v) => L.py + (v * L.s) / IMG, k: L.s / IMG });

function ellipse(ctx: Ctx, m: Map, cx: number, cy: number, rx: number, ry: number, fill: string) {
  ctx.beginPath();
  ctx.ellipse(m.X(cx), m.Y(cy), rx * m.k, ry * m.k, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}
function tri(ctx: Ctx, m: Map, p: [number, number][], fill: string) {
  ctx.beginPath();
  p.forEach(([u, v], i) => (i ? ctx.lineTo(m.X(u), m.Y(v)) : ctx.moveTo(m.X(u), m.Y(v))));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function cat(ctx: Ctx, m: Map, dx: number, dy: number, body: string, scale = 1) {
  const S = (u: number) => u * scale;
  ctx.save();
  ctx.strokeStyle = body; ctx.lineWidth = 7 * m.k * scale; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(m.X(dx + S(90)), m.Y(dy + S(126))); ctx.quadraticCurveTo(m.X(dx + S(104)), m.Y(dy + S(112)), m.X(dx + S(96)), m.Y(dy + S(94))); ctx.stroke();
  ctx.restore();
  ellipse(ctx, m, dx + S(58), dy + S(108), S(38), S(27), body);
  ellipse(ctx, m, dx + S(38), dy + S(62), S(20), S(19), body);
  tri(ctx, m, [[dx + S(20), dy + S(54)], [dx + S(23), dy + S(37)], [dx + S(35), dy + S(46)]], body);
  tri(ctx, m, [[dx + S(41), dy + S(46)], [dx + S(53), dy + S(37)], [dx + S(56), dy + S(54)]], body);
  ellipse(ctx, m, dx + S(31), dy + S(60), S(2.4), S(2.8), "#1d1a17");
  ellipse(ctx, m, dx + S(45), dy + S(60), S(2.4), S(2.8), "#1d1a17");
  ellipse(ctx, m, dx + S(38), dy + S(68), S(2), S(1.4), "#5a3d33");
}

/** The picture: a wall, a table, the cat (and in the "two cats" picture a second cat behind it), and a cup. */
export function drawPicture(ctx: Ctx, L: { px: number; py: number; s: number }, o: { two?: boolean; fade?: number } = {}) {
  const m = mapOf(L);
  ctx.save();
  ctx.globalAlpha = o.fade ?? 1;
  ctx.fillStyle = "#f2eee6"; ctx.fillRect(m.X(0), m.Y(0), L.s, L.s);
  ctx.fillStyle = "#e4dac8"; ctx.fillRect(m.X(0), m.Y(128), L.s, L.s - 128 * m.k);
  if (o.two) cat(ctx, m, 30, 6, "#6f6359", 0.92);
  cat(ctx, m, 0, 0, "#a3917d");
  // the cup
  ctx.beginPath();
  ctx.moveTo(m.X(114), m.Y(97)); ctx.lineTo(m.X(140), m.Y(97)); ctx.lineTo(m.X(137.5), m.Y(136)); ctx.lineTo(m.X(116.5), m.Y(136)); ctx.closePath();
  ctx.fillStyle = "#ffffff"; ctx.fill();
  ctx.strokeStyle = "#7d8796"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "rgba(42,111,214,0.35)"; ctx.fillRect(m.X(115), m.Y(110), 24.5 * m.k, 6 * m.k);
  ctx.beginPath(); ctx.arc(m.X(141), m.Y(114), 7 * m.k, -Math.PI / 2, Math.PI / 2); ctx.strokeStyle = "#7d8796"; ctx.lineWidth = 2; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(m.X(127), m.Y(97), 13 * m.k, 2.6 * m.k, 0, 0, Math.PI * 2); ctx.fillStyle = "#6b4a32"; ctx.fill();
  ctx.restore();
  frame(ctx, m.X(0), m.Y(0), L.s, L.s, palette.frame, 1);
}

/** Grid lines over the picture, and the letters of the cells the chapter follows. */
export function drawGridOver(ctx: Ctx, L: { px: number; py: number; s: number }, o: { letters?: boolean; alpha?: number } = {}) {
  const m = mapOf(L), c = L.s / GRID;
  ctx.save();
  ctx.strokeStyle = `rgba(20,24,33,${o.alpha ?? 0.28})`; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < GRID; i++) {
    ctx.moveTo(m.X(0) + i * c, m.Y(0)); ctx.lineTo(m.X(0) + i * c, m.Y(IMG));
    ctx.moveTo(m.X(0), m.Y(0) + i * c); ctx.lineTo(m.X(IMG), m.Y(0) + i * c);
  }
  ctx.stroke();
  ctx.restore();
  if (o.letters !== false) (Object.keys(RC) as CellId[]).forEach((id) => cellTag(ctx, L, id));
}

/** A small white tag with the cell's letter in its top-left corner. */
export function cellTag(ctx: Ctx, L: { px: number; py: number; s: number }, id: CellId, color: string = palette.ink) {
  const c = L.s / GRID, [r, cc] = RC[id];
  const x = L.px + cc * c + 3, y = L.py + r * c + 3;
  rbox(ctx, x, y, 16, 15, 4, "rgba(255,255,255,0.88)", null);
  label(ctx, id, x + 8, y + 8, color, 11, "center");
}

/** Fill one cell (row, col) of the picture. */
export function fillCell(ctx: Ctx, L: { px: number; py: number; s: number }, r: number, c: number, color: string) {
  const s = L.s / GRID;
  ctx.fillStyle = color;
  ctx.fillRect(L.px + c * s + 1, L.py + r * s + 1, s - 2, s - 2);
}
export function outlineCell(ctx: Ctx, L: { px: number; py: number; s: number }, r: number, c: number, color: string, lw = 2) {
  const s = L.s / GRID;
  frame(ctx, L.px + c * s + 1.5, L.py + r * s + 1.5, s - 3, s - 3, color, lw);
}

/** A box in picture pixels, drawn on the canvas, with an optional tag on its top edge. */
export function drawBox(ctx: Ctx, L: { px: number; py: number; s: number }, b: Box, color: string, o: { lw?: number; dash?: number[]; tag?: string; tagAt?: "tl" | "tr" | "bl" | "br" } = {}) {
  const m = mapOf(L);
  const x1 = m.X(b[0]), y1 = m.Y(b[1]), x2 = m.X(b[2]), y2 = m.Y(b[3]);
  frame(ctx, x1, y1, x2 - x1, y2 - y1, color, o.lw ?? 2, o.dash);
  if (!o.tag) return;
  const tWidth = tw(ctx, o.tag, 11) + 8, at = o.tagAt ?? "tl";
  const tx = at === "tl" || at === "bl" ? x1 : x2 - tWidth, ty = at === "tl" || at === "tr" ? y1 - 15 : y2 + 1;
  const cx = Math.max(L.px, Math.min(tx, L.px + L.s - tWidth));
  rbox(ctx, cx, ty, tWidth, 14, 3, color, null);
  label(ctx, o.tag, cx + tWidth / 2, ty + 7.5, "#ffffff", 11, "center");
}

/** A small table: rows of cells, first row as header. */
export function table(ctx: Ctx, x: number, y: number, colW: number[], rows: string[][], o: { rowH?: number; size?: number; color?: (r: number, c: number) => string; fill?: (r: number) => string | null } = {}) {
  const rh = o.rowH ?? 20, size = o.size ?? 12;
  rows.forEach((row, r) => {
    const f = o.fill?.(r);
    if (f) { ctx.fillStyle = f; ctx.fillRect(x - 4, y + r * rh - rh / 2 + 1, colW.reduce((a, b) => a + b, 0) + 4, rh - 2); }
    let cx = x;
    row.forEach((cell, c) => {
      const color = o.color?.(r, c) ?? (r === 0 ? palette.muted : palette.ink);
      label(ctx, cell, c === 0 ? cx : cx + colW[c] - 4, y + r * rh, color, r === 0 ? 11 : size, c === 0 ? "left" : "right");
      cx += colW[c];
    });
  });
}
