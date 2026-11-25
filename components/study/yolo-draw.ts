/** Canvas helpers for the YOLO study scenes: the one picture (the Siamese cat and a cup), its grid, boxes, and the scene layout. */

import { label, palette } from "@/components/anomaly/lib";
import { frame, rbox, type Ctx } from "./kit";
import { CAT2_AT, CAT_AT, CAT_SRC, GRID, GT_CUP, IMG, RC, type Box, type CellId } from "./yolo-math";

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

/* ---- the picture: the pixel-art Siamese cat (transparent background) composed with a drawn wall, floor and cup ---- */

const RES = 4;                                   // pixels of the composed picture per picture pixel (160 → 640)
const WALL = "#fdece2", FLOOR = "#f0dacc", FLOOR_Y = 122;
let catImg: HTMLImageElement | null = null;
const composed: { one?: HTMLCanvasElement; two?: HTMLCanvasElement } = {};

/** The cat image once it has loaded (starts loading on first call), else null. */
function catImage(): HTMLImageElement | null {
  if (typeof window === "undefined") return null;
  if (!catImg) {
    catImg = new window.Image();
    catImg.src = CAT_SRC.url;
  }
  return catImg.complete && catImg.naturalWidth > 0 ? catImg : null;
}

/** The cup, in picture pixels, filling GT_CUP: rim ellipse on top, a tapered white body, a handle on the right. */
function drawCup(c: Ctx) {
  const [x1, y1, x2, y2] = GT_CUP, rimY = y1 + 3, bodyR = x2 - 8;
  c.beginPath();
  c.moveTo(x1, rimY); c.lineTo(bodyR, rimY); c.lineTo(bodyR - 3, y2); c.lineTo(x1 + 3, y2); c.closePath();
  c.fillStyle = "#ffffff"; c.fill();
  c.strokeStyle = "#7d8796"; c.lineWidth = 0.9; c.stroke();
  c.fillStyle = "rgba(42,111,214,0.35)"; c.fillRect(x1 + 1, rimY + 13, bodyR - x1 - 1.5, 5);
  c.beginPath(); c.arc(bodyR, (rimY + y2) / 2 - 3.5, x2 - bodyR - 0.8, -Math.PI / 2, Math.PI / 2); c.strokeStyle = "#7d8796"; c.lineWidth = 1.6; c.stroke();
  c.beginPath(); c.ellipse((x1 + bodyR) / 2, rimY, (bodyR - x1) / 2, 3, 0, 0, Math.PI * 2); c.fillStyle = "#6b4a32"; c.fill();
}

/** Compose the picture once at RES × 160 pixels: wall, floor, (cat 2 behind, a little darker), cat 1, cup. */
function compose(img: HTMLImageElement, two: boolean): HTMLCanvasElement {
  const cv = document.createElement("canvas");
  cv.width = cv.height = IMG * RES;
  const c = cv.getContext("2d");
  if (!c) return cv;
  c.scale(RES, RES);
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = "high";
  c.fillStyle = WALL; c.fillRect(0, 0, IMG, IMG);
  c.fillStyle = FLOOR; c.fillRect(0, FLOOR_Y, IMG, IMG - FLOOR_Y);
  if (two) {
    const w = Math.round(CAT_SRC.w * CAT2_AT.k * RES), h = Math.round(CAT_SRC.h * CAT2_AT.k * RES);
    const t = document.createElement("canvas");
    t.width = w; t.height = h;
    const tc = t.getContext("2d");
    if (tc) {
      tc.imageSmoothingEnabled = true;
      tc.imageSmoothingQuality = "high";
      tc.drawImage(img, 0, 0, w, h);
      tc.globalCompositeOperation = "source-atop";
      tc.fillStyle = "rgba(40,22,10,0.2)";
      tc.fillRect(0, 0, w, h);
      c.drawImage(t, CAT2_AT.x, CAT2_AT.y, CAT_SRC.w * CAT2_AT.k, CAT_SRC.h * CAT2_AT.k);
    }
  }
  c.drawImage(img, CAT_AT.x, CAT_AT.y, CAT_SRC.w * CAT_AT.k, CAT_SRC.h * CAT_AT.k);
  drawCup(c);
  return cv;
}

function picture(two: boolean): HTMLCanvasElement | null {
  const img = catImage();
  if (!img) return null;
  const key = two ? "two" : "one";
  if (!composed[key]) composed[key] = compose(img, two);
  return composed[key] ?? null;
}

/** The picture: wall, floor, the cat (in the "two cats" picture a second cat right behind it), and a cup. */
export function drawPicture(ctx: Ctx, L: { px: number; py: number; s: number }, o: { two?: boolean; fade?: number; loading?: string } = {}) {
  const m = mapOf(L);
  const pic = picture(!!o.two);
  ctx.save();
  ctx.globalAlpha = o.fade ?? 1;
  if (pic) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(pic, m.X(0), m.Y(0), L.s, L.s);
  } else {
    ctx.fillStyle = WALL; ctx.fillRect(m.X(0), m.Y(0), L.s, L.s);
    ctx.fillStyle = FLOOR; ctx.fillRect(m.X(0), m.Y(FLOOR_Y), L.s, L.s - FLOOR_Y * m.k);
    if (o.loading) label(ctx, o.loading, m.X(IMG / 2), m.Y(IMG / 2), palette.muted, 11, "center");
  }
  ctx.restore();
  frame(ctx, m.X(0), m.Y(0), L.s, L.s, palette.frame, 1);
}

/** A number in the middle of a cell, on a small white pill so it reads over the cat. */
export function cellNum(ctx: Ctx, L: { px: number; py: number; s: number }, r: number, c: number, text: string, color: string, dy = 7) {
  const cs = L.s / GRID, x = L.px + c * cs + cs / 2, y = L.py + r * cs + cs / 2 + dy, w = tw(ctx, text, 11.5) + 8;
  rbox(ctx, x - w / 2, y - 8, w, 16, 4, "rgba(255,255,255,0.86)", null);
  label(ctx, text, x, y, color, 11.5, "center");
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

/** A tag's rectangle on the canvas: x, y, width, height. */
export type Rect = [number, number, number, number];
const hit = (a: Rect, b: Rect) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
type Corner = "tl" | "tr" | "bl" | "br";

/** A tag on one corner of a box. With `avoid`, the tag takes the first corner (preferred one first) that does not
 *  cover a tag already placed, and is added to the list. */
function drawTag(ctx: Ctx, L: { px: number; py: number; s: number }, b: Box, color: string, tag: string, at: Corner = "tl", avoid?: Rect[]) {
  const m = mapOf(L);
  const x1 = m.X(b[0]), y1 = m.Y(b[1]), x2 = m.X(b[2]), y2 = m.Y(b[3]);
  const tWidth = tw(ctx, tag, 11) + 8;
  const rectAt = (c: Corner): Rect => {
    const tx = c === "tl" || c === "bl" ? x1 : x2 - tWidth, ty = c === "tl" || c === "tr" ? y1 - 15 : y2 + 1;
    return [Math.max(L.px, Math.min(tx, L.px + L.s - tWidth)), ty, tWidth, 14];
  };
  let r = rectAt(at);
  if (avoid) {
    const free = ([at, "tl", "tr", "bl", "br"] as Corner[]).map(rectAt).find((q) => !avoid.some((p) => hit(p, q)));
    if (free) r = free;
    avoid.push(r);
  }
  rbox(ctx, r[0], r[1], tWidth, 14, 3, color, null);
  label(ctx, tag, r[0] + tWidth / 2, r[1] + 7.5, "#ffffff", 11, "center");
}

/** A box in picture pixels, drawn on the canvas, with an optional tag on one corner. */
export function drawBox(ctx: Ctx, L: { px: number; py: number; s: number }, b: Box, color: string, o: { lw?: number; dash?: number[]; tag?: string; tagAt?: Corner } = {}) {
  const m = mapOf(L);
  frame(ctx, m.X(b[0]), m.Y(b[1]), m.X(b[2]) - m.X(b[0]), m.Y(b[3]) - m.Y(b[1]), color, o.lw ?? 2, o.dash);
  if (o.tag) drawTag(ctx, L, b, color, o.tag, o.tagAt);
}

export type BoxItem = { box: Box; color: string; lw?: number; dash?: number[]; tag?: string; tagAt?: Corner };
/** Several boxes: every frame first, then the tags, each on the first corner that is still free,
 *  so no frame crosses a tag and no two tags cover each other. */
export function drawBoxes(ctx: Ctx, L: { px: number; py: number; s: number }, items: BoxItem[], avoid: Rect[] = []) {
  items.forEach((b) => drawBox(ctx, L, b.box, b.color, { lw: b.lw, dash: b.dash }));
  items.forEach((b) => { if (b.tag) drawTag(ctx, L, b.box, b.color, b.tag, b.tagAt, avoid); });
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
