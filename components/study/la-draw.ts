/** Drawing helpers and cached derived data for the linear-algebra scenes: the cat head grids as pictures, colour swatches,
 *  number formats, and the decompositions that several scenes share. */

import { useEffect, useRef } from "react";
import { clamp, label, palette } from "@/components/anomaly/lib";
import { CAT_SRC } from "./cat-grids";
import type { Ctx } from "./kit";
import { LA_GRAY64, LA_RGB32 } from "./la-cat";
import { allCells, isBg, keepK, matVec, pca, rowOrder, svd, truncate, YCC, type Mat, type Pca, type Svd, type Vec } from "./la-math";

export const PAD = 18;
export const isPortrait = (w: number, h: number) => h > w * 1.15;

export const num = (v: number, d = 2) => { const s = v.toFixed(d).replace(/\.?0+$/, ""); return s === "-0" ? "0" : s.replace("-", "−"); };
/** Fixed decimals, minus sign as in the prose. */
export const fix = (v: number, d = 4) => { const s = v.toFixed(d); return /^-0\.0*$/.test(s) ? s.slice(1) : s.replace("-", "−"); };
export const vec = (a: Vec, d = 2) => `[${a.map((v) => num(v, d)).join(", ")}]`;
export const vecFix = (a: Vec, d = 4) => `[${a.map((v) => fix(v, d)).join(", ")}]`;
export const pc = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
export const thousands = (v: number) => Math.round(v).toLocaleString("en-US");

export const rgbCss = (v: Vec) => `rgb(${v.map((x) => Math.round(clamp(x, 0, 1) * 255)).join(",")})`;
export const grayCss = (y: number) => { const g = Math.round(clamp(y, 0, 1) * 255); return `rgb(${g},${g},${g})`; };

/** kit.signed and kit.act return rgba() strings over white; turn one into an opaque colour vector for the offscreen pictures. */
export function rgbFromCss(css: string): Vec {
  const m = css.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
  if (m.length < 4) return [m[0] / 255, m[1] / 255, m[2] / 255];
  const a = m[3];
  return [0, 1, 2].map((i) => (a * m[i] + (1 - a) * 255) / 255);
}

/** Loads the head drawing once per scene; the ref stays null until it has arrived (canvases repaint every frame). */
export function useHeadImage() {
  const ref = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.onload = () => { ref.current = img; };
    img.src = CAT_SRC.head;
  }, []);
  return ref;
}

/* ---- pictures from grids, rendered once into small offscreen canvases and scaled up without smoothing ---- */

const pictures = new Map<string, HTMLCanvasElement>();

/** An n × m picture whose pixel (r, c) has colour fill(r, c) = [R, G, B] in 0..1, cached under `key`. */
export function picture(key: string, n: number, m: number, fill: (r: number, c: number) => Vec): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const hit = pictures.get(key);
  if (hit) return hit;
  const cv = document.createElement("canvas");
  cv.width = m; cv.height = n;
  const c2 = cv.getContext("2d");
  if (!c2) return null;
  const img = c2.createImageData(m, n);
  for (let r = 0; r < n; r++) for (let c = 0; c < m; c++) {
    const v = fill(r, c), o = 4 * (r * m + c);
    img.data[o] = Math.round(clamp(v[0], 0, 1) * 255);
    img.data[o + 1] = Math.round(clamp(v[1], 0, 1) * 255);
    img.data[o + 2] = Math.round(clamp(v[2], 0, 1) * 255);
    img.data[o + 3] = 255;
  }
  c2.putImageData(img, 0, 0);
  pictures.set(key, cv);
  return cv;
}

/** Draw a cached picture into the box (x, y, S, S) with crisp cells and a thin frame. */
export function blit(ctx: Ctx, pic: HTMLCanvasElement | null, x: number, y: number, S: number, H = S) {
  ctx.save();
  ctx.fillStyle = "#f4f4f6"; ctx.fillRect(x, y, S, H);
  if (pic) { ctx.imageSmoothingEnabled = false; ctx.drawImage(pic, x, y, S, H); }
  ctx.strokeStyle = palette.frame; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, S - 1, H - 1);
  ctx.restore();
}

/** Outline cells [r0, r1) × [c0, c1) of an n-cell grid drawn at (x, y) with side S. */
export function cellFrame(ctx: Ctx, x: number, y: number, S: number, n: number, r0: number, c0: number, r1 = r0 + 1, c1 = c0 + 1, color: string = palette.accent, lw = 2.2) {
  const k = S / n;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw;
  ctx.strokeRect(x + c0 * k - lw / 2, y + r0 * k - lw / 2, (c1 - c0) * k + lw, (r1 - r0) * k + lw);
  ctx.restore();
}

/** A colour swatch with a frame. */
export function swatch(ctx: Ctx, v: Vec, x: number, y: number, w: number, h: number, stroke: string = palette.frame, lw = 1) {
  ctx.save();
  ctx.fillStyle = rgbCss(v); ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(x + lw / 2, y + lw / 2, w - lw, h - lw);
  ctx.restore();
}

/** Text on a white tag so it stays readable over pictures. */
export function tag(ctx: Ctx, text: string, cx: number, cy: number, color: string = palette.ink, size = 11, align: CanvasTextAlign = "center") {
  ctx.save();
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const tw = ctx.measureText(text).width + 6, x0 = align === "center" ? cx - tw / 2 : align === "right" ? cx - tw : cx - 3;
  ctx.fillStyle = "rgba(255,255,255,0.9)"; ctx.fillRect(x0, cy - size / 2 - 2, tw, size + 4);
  ctx.restore();
  label(ctx, text, cx, cy + 0.5, color, size, align);
}

/** Largest monospace size (down to `min`) at which `text` fits in `width`. */
export function fitSize(ctx: Ctx, text: string, width: number, max = 13, min = 10) {
  ctx.save();
  let s = max;
  for (; s > min; s--) { ctx.font = `${s}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`; if (ctx.measureText(text).width <= width) break; }
  ctx.restore();
  return s;
}

/* ---- shared derived data, computed on first use ---- */

export const CELLS32 = allCells(LA_RGB32);
export const rgbAt = (r: number, c: number) => LA_RGB32[r][c];

let svdMain: Svd | null = null, svdShuffled: Svd | null = null;
export const ORDER = rowOrder(64);
export const GRAY_SHUFFLED: Mat = ORDER.map((i) => LA_GRAY64[i]);
export function svdOf(shuffled: boolean): Svd {
  if (shuffled) return (svdShuffled ??= svd(GRAY_SHUFFLED));
  return (svdMain ??= svd(LA_GRAY64));
}
const approxCache = new Map<string, Mat>();
export function approx(shuffled: boolean, k: number): Mat {
  const key = `${shuffled ? 1 : 0}:${k}`;
  let m = approxCache.get(key);
  if (!m) { m = truncate(svdOf(shuffled), k); approxCache.set(key, m); }
  return m;
}

let pcaAll: Pca | null = null, pcaNoBg: Pca | null = null;
export const NO_BG = CELLS32.filter((v) => !isBg(v));
export function pcaOf(noBg: boolean): Pca {
  if (noBg) return (pcaNoBg ??= pca(NO_BG));
  return (pcaAll ??= pca(CELLS32));
}
const reconCache = new Map<string, Vec[]>();
/** Every cell of the 32 × 32 grid rebuilt from the first k directions of the chosen set's PCA. */
export function recon(noBg: boolean, k: number): Vec[] {
  const key = `${noBg ? 1 : 0}:${k}`;
  let m = reconCache.get(key);
  if (!m) { const p = pcaOf(noBg); m = CELLS32.map((v) => keepK(p, v, k)); reconCache.set(key, m); }
  return m;
}

/** Y, Cb, Cr of every cell (JPEG rows, no offsets). */
export const YCC32: Vec[] = CELLS32.map((v) => matVec(YCC, v));
