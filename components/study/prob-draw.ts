/** Drawing helpers for the probability scenes: number formats, part colours, the cat picture and its 16 × 16 grid. */

import { useEffect, useRef } from "react";
import { label, palette } from "@/components/anomaly/lib";
import { CAT_SRC } from "./cat-grids";
import { gray, type Ctx } from "./kit";
import { CELLS, N, PARTS, TRACK, type Part } from "./prob-math";

export const PAD = 18;
export const isPortrait = (w: number, h: number) => h > w * 1.15;

export const num = (v: number, d = 2) => { const s = v.toFixed(d).replace(/\.?0+$/, ""); return s === "-0" ? "0" : s.replace("-", "−"); };
export const fix = (v: number, d = 2) => { const s = v.toFixed(d); return s.startsWith("-") && Number(s) !== 0 ? "−" + s.slice(1) : s.replace("-", ""); };
export const pc = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
/** Counts that may be fractional (expected counts in the factory): thousands separator, at most one decimal. */
export const cnt = (v: number) => (Math.abs(v - Math.round(v)) < 1e-9 ? Math.round(v).toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 }));

/** One colour per part, taken from the cat's own colours: pale peach background, tan body fur, dark brown legs and tail,
 *  mid brown face, pink inner ear, blue eye. */
export const PART_COLOR: Record<Part, string> = { bg: "#dccbbf", body: "#dfac74", leg: "#4f3022", face: "#9a6648", ear: "#d17f8b", eye: "#3b8bd0" };
export const partColor = (i: number) => PART_COLOR[PARTS[i]];

/** Loads cat-square.png once per scene. The ref stays null until the image has arrived; the canvases repaint every frame, so it then appears. */
export function useCatImage() {
  const ref = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => { ref.current = img; };
    img.src = CAT_SRC.square;
  }, []);
  return ref;
}

export type GridOpts = {
  /** "parts": the picture with each cell tinted in its part colour. "gray": each cell painted in its measured brightness. */
  mode: "parts" | "gray";
  veil?: (r: number, c: number) => boolean;       // cells to fade out
  fill?: (r: number, c: number) => string | null; // extra fill on top
  edge?: (r: number, c: number) => string | null; // inner frame colour
  track?: boolean;
};

/** The 16 × 16 grid of the cat at (x, y), side S. */
export function catGrid(ctx: Ctx, img: HTMLImageElement | null, x: number, y: number, S: number, o: GridOpts) {
  const c = S / N;
  ctx.save();
  if (o.mode === "parts") {
    ctx.fillStyle = "#fdece2"; ctx.fillRect(x, y, S, S);
    if (img) ctx.drawImage(img, 0, 0, 512, 512, x, y, S, S);
    CELLS.forEach((k) => {
      ctx.fillStyle = PART_COLOR[k.part];
      ctx.globalAlpha = k.part === "bg" ? 0.35 : 0.62;
      ctx.fillRect(x + k.c * c, y + k.r * c, c, c);
    });
    ctx.globalAlpha = 1;
  } else {
    CELLS.forEach((k) => { ctx.fillStyle = gray(k.x); ctx.fillRect(x + k.c * c, y + k.r * c, c, c); });
  }
  // thin cell lines
  ctx.strokeStyle = "rgba(20,24,33,0.14)"; ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < N; i++) { ctx.moveTo(x + i * c + 0.5, y); ctx.lineTo(x + i * c + 0.5, y + S); ctx.moveTo(x, y + i * c + 0.5); ctx.lineTo(x + S, y + i * c + 0.5); }
  ctx.stroke();
  CELLS.forEach((k) => {
    const cx = x + k.c * c, cy = y + k.r * c, veiled = o.veil?.(k.r, k.c) ?? false;
    if (veiled) { ctx.fillStyle = "rgba(250,250,252,0.78)"; ctx.fillRect(cx, cy, c, c); }
    // marks on a faded cell are faded with it
    ctx.globalAlpha = veiled ? 0.22 : 1;
    const f = o.fill?.(k.r, k.c);
    if (f) { ctx.fillStyle = f; ctx.fillRect(cx, cy, c, c); }
    const e = o.edge?.(k.r, k.c);
    if (e) { ctx.strokeStyle = e; ctx.lineWidth = 2; ctx.strokeRect(cx + 1.5, cy + 1.5, c - 3, c - 3); }
    ctx.globalAlpha = 1;
  });
  ctx.strokeStyle = palette.frame; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);
  ctx.restore();
  if (o.track) trackRing(ctx, x + (TRACK.c + 0.5) * c, y + (TRACK.r + 0.5) * c, c);
}

/** The followed cell: an amber ring with its name beside it. */
export function trackRing(ctx: Ctx, cx: number, cy: number, c: number, text = "우리 칸") {
  ctx.save();
  ctx.strokeStyle = palette.accent; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(cx, cy, c * 0.78, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  tag(ctx, text, cx - c * 0.78 - 4, cy - c * 0.9, palette.accent, 11, "right");
}

/** Small white tag with text. */
export function tag(ctx: Ctx, text: string, x: number, y: number, color: string = palette.ink, size = 11, align: CanvasTextAlign = "center") {
  ctx.save();
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const tw = ctx.measureText(text).width + 6;
  const left = align === "center" ? x - tw / 2 : align === "right" ? x - tw : x;
  ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(left, y - size / 2 - 2, tw, size + 4);
  ctx.restore();
  label(ctx, text, align === "center" ? x : align === "right" ? x - 3 : x + 3, y + 0.5, color, size, align);
}

/** A small colour swatch. */
export function swatch(ctx: Ctx, x: number, y: number, s: number, color: string) {
  ctx.fillStyle = color; ctx.fillRect(x, y - s / 2, s, s);
  ctx.strokeStyle = "rgba(20,24,33,0.25)"; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y - s / 2 + 0.5, s - 1, s - 1);
}

/** A number axis from lo to hi at height y, with ticks every `step`. Returns the mapping value → x. */
export function axis(ctx: Ctx, x0: number, x1: number, y: number, lo: number, hi: number, step: number, digits = 1, color: string = palette.muted) {
  const X = (v: number) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  ctx.save();
  ctx.strokeStyle = palette.frame; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x0, y + 0.5); ctx.lineTo(x1, y + 0.5); ctx.stroke();
  for (let v = lo; v <= hi + 1e-9; v += step) {
    const px = X(v);
    ctx.beginPath(); ctx.moveTo(px + 0.5, y); ctx.lineTo(px + 0.5, y + 4); ctx.stroke();
    label(ctx, v.toFixed(digits), px, y + 13, color, 11, "center");
  }
  ctx.restore();
  return X;
}
