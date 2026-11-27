/** Drawing helpers for the attention-cost scenes: number and byte formats, the cat image, a 2-D vector plane. */

import { useEffect, useRef } from "react";
import { label, palette } from "@/components/anomaly/lib";
import { CAT_SRC } from "./cat-grids";
import type { Ctx } from "./kit";
import { CROP, GB, KB, MB, type Kind } from "./attn-math";

export const PAD = 18;
export const isPortrait = (w: number, h: number) => h > w * 1.15;

/** At most d decimals, trailing zeros after the point dropped, a proper minus sign. */
export const num = (v: number, d = 2) => { const f = v.toFixed(d), s = f.includes(".") ? f.replace(/\.?0+$/, "") : f; return s === "-0" ? "0" : s.replace("-", "−"); };
/** A fixed number of decimals, with a proper minus sign. */
export const fix = (v: number, d = 2) => { const s = v.toFixed(d); return (/^-0\.?0*$/.test(s) ? s.slice(1) : s).replace("-", "−"); };
export const vec = (a: number[], d = 2) => `[${a.map((v) => fix(v, d)).join(", ")}]`;
export const pc = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
export const comma = (v: number) => Math.round(v).toLocaleString("en-US");
/** Bytes in binary units, at most two decimals, trailing zeros dropped. */
export function bytes(v: number): string {
  const sig = (x: number) => num(x, x >= 100 ? 0 : x >= 10 ? 1 : 2);
  if (v >= GB) return `${sig(v / GB)}GB`;
  if (v >= MB) return `${sig(v / MB)}MB`;
  if (v >= KB) return `${sig(v / KB)}KB`;
  return `${Math.round(v)}B`;
}
/** Seconds as milliseconds with two decimals. */
export const ms = (s: number) => `${(s * 1e3).toFixed(2)}ms`;

/** Dot colours for the kinds of patch, from the cat's own colours (darkened to show on white). */
export const KIND_DOT: Record<Kind, string> = { bg: "#c4ab9b", brown: "#6e4632", cream: "#d29a62", eye: "#3b8bd0" };
/** Group tints for pooled keys: not green or red, which mean "same" and "differs". */
export const TINTS = ["194,115,0", "124,58,237", "14,127,199", "120,130,40", "190,60,160", "90,100,120", "160,90,40", "40,140,150"];
export const tint = (i: number, a = 0.32) => `rgba(${TINTS[i % TINTS.length]},${a})`;

/** Loads cat-square.png once per scene. The ref stays null until the image has arrived; the canvases repaint every frame. */
export function useCatImage() {
  const ref = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => { ref.current = img; };
    img.src = CAT_SRC.square;
  }, []);
  return ref;
}

/** The whole cat square (512 px source) drawn into an S × S box, with a pale fill until the image loads. */
export function drawCat(ctx: Ctx, img: HTMLImageElement | null, x: number, y: number, S: number, alpha = 1) {
  ctx.save();
  ctx.fillStyle = "#fdece2"; ctx.fillRect(x, y, S, S);
  if (img) { ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true; ctx.drawImage(img, 0, 0, 512, 512, x, y, S, S); }
  ctx.restore();
}

/** One 40 px cell of the tokens chapter's 4 × 4 crop, enlarged into an S × S box. */
export function drawCell(ctx: Ctx, img: HTMLImageElement | null, cell: number, x: number, y: number, S: number) {
  const c = CROP.size / 4, sx = CROP.x + (cell % 4) * c, sy = CROP.y + Math.floor(cell / 4) * c;
  ctx.save();
  ctx.fillStyle = "#fdece2"; ctx.fillRect(x, y, S, S);
  if (img) ctx.drawImage(img, sx, sy, c, c, x, y, S, S);
  ctx.strokeStyle = palette.frame; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);
  ctx.restore();
}

/** The whole 4 × 4 crop into an S × S box. */
export function drawCrop(ctx: Ctx, img: HTMLImageElement | null, x: number, y: number, S: number) {
  ctx.save();
  ctx.fillStyle = "#fdece2"; ctx.fillRect(x, y, S, S);
  if (img) ctx.drawImage(img, CROP.x, CROP.y, CROP.size, CROP.size, x, y, S, S);
  ctx.restore();
}

/** Grid lines over an S × S box cut into g × g cells. */
export function gridLines(ctx: Ctx, x: number, y: number, S: number, g: number, color = "rgba(20,24,33,0.35)") {
  const c = S / g;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let k = 1; k < g; k++) { ctx.moveTo(x + k * c, y); ctx.lineTo(x + k * c, y + S); ctx.moveTo(x, y + k * c); ctx.lineTo(x + S, y + k * c); }
  ctx.stroke();
  ctx.strokeStyle = palette.frame; ctx.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);
  ctx.restore();
}

/** Small white tag with text centred at (cx, cy). */
export function tag(ctx: Ctx, text: string, cx: number, cy: number, color: string = palette.ink, size = 11) {
  ctx.save();
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const tw = ctx.measureText(text).width + 6;
  ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(cx - tw / 2, cy - size / 2 - 2, tw, size + 4);
  ctx.restore();
  label(ctx, text, cx, cy + 0.5, color, size, "center");
}

/** A 2-D vector plane in the box (x, y, w, h); returns a mapping from vector to canvas point. */
export function plane(ctx: Ctx, x: number, y: number, w: number, h: number, xr: [number, number], yr: [number, number]) {
  const px = (v: number) => x + ((v - xr[0]) / (xr[1] - xr[0])) * w;
  const py = (v: number) => y + h - ((v - yr[0]) / (yr[1] - yr[0])) * h;
  ctx.save();
  ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = palette.frame; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.strokeStyle = palette.grid; ctx.beginPath(); ctx.moveTo(px(0), y); ctx.lineTo(px(0), y + h); ctx.moveTo(x, py(0)); ctx.lineTo(x + w, py(0)); ctx.stroke();
  ctx.restore();
  return (v: number[]) => [px(v[0]), py(v[1])] as const;
}

/** Horizontal bar with a track, filled to `value` of `w`. */
export function hbar(ctx: Ctx, x: number, y: number, w: number, h: number, value: number, color: string) {
  ctx.fillStyle = palette.track; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color; ctx.fillRect(x, y, Math.max(1, Math.min(1, value) * w), h);
}

/** Text width at a monospace size, for layout. */
export function textW(ctx: Ctx, text: string, size = 11) {
  ctx.save(); ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const w = ctx.measureText(text).width; ctx.restore();
  return w;
}
