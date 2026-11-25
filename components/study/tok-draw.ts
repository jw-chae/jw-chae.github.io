/** Drawing helpers for the token-reduction scenes: the cat crop, number formats, hatching and group tints. */

import { useEffect, useRef } from "react";
import { label, palette } from "@/components/anomaly/lib";
import { CAT_SRC } from "./cat-grids";
import type { Ctx } from "./kit";
import { CROP, EYE_SHAPE, type Kind } from "./tok-math";

export const PAD = 18;
export const isPortrait = (w: number, h: number) => h > w * 1.15;

export const num = (v: number, d = 2) => { const s = v.toFixed(d).replace(/\.?0+$/, ""); return s === "-0" ? "0" : s.replace("-", "−"); };
export const vec = (a: number[], d = 2) => `[${a.map((v) => num(v, d)).join(", ")}]`;
export const pc = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
/** Large counts in Korean units: 조 (10¹²), 억 (10⁸), 만 (10⁴). */
export function big(v: number): string {
  if (v >= 1e12) return `${(v / 1e12).toFixed(2)}조`;
  if (v >= 1e8) return `${(v / 1e8).toFixed(1)}억`;
  if (v >= 1e4) return `${(v / 1e4).toFixed(1)}만`;
  return Math.round(v).toLocaleString("en-US");
}

/** Dot colours for the kinds of patch in the vector planes, taken from the cat's own colours (darkened where needed to show on white). */
export const KIND_DOT: Record<Kind, string> = { bg: "#c4ab9b", brown: "#6e4632", cream: "#d29a62", eye: "#3b8bd0", closed: "#3a2419" };

/** Tints for tokens that stand for two or more patches. Deliberately not green or red, which mean "same" and "differs". */
export const TINTS = ["194,115,0", "124,58,237", "14,127,199", "120,130,40", "190,60,160", "90,100,120", "160,90,40", "40,140,150"];
export const tint = (i: number, a = 0.32) => `rgba(${TINTS[i % TINTS.length]},${a})`;

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

/** The 4 × 4 crop of the cat drawn into an S × S box, or only patch `cell` of it enlarged to S. With `closed`, the eye is painted over
 *  exactly where the measurement painted it: an ellipse in the fur colour and a lid line. */
export function catCrop(ctx: Ctx, img: HTMLImageElement | null, x: number, y: number, S: number, closed = false, cell?: number) {
  const c = CROP.size / 4;
  const sx = cell === undefined ? CROP.x : CROP.x + (cell % 4) * c, sy = cell === undefined ? CROP.y : CROP.y + Math.floor(cell / 4) * c;
  const sw = cell === undefined ? CROP.size : c, k = S / sw;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, S, S); ctx.clip();
  ctx.fillStyle = "#fdece2"; ctx.fillRect(x, y, S, S);
  if (img) {
    ctx.drawImage(img, sx, sy, sw, sw, x, y, S, S);
    if (closed) {
      const ex = x + (EYE_SHAPE.cx - sx) * k, ey = y + (EYE_SHAPE.cy - sy) * k;
      ctx.fillStyle = EYE_SHAPE.fill;
      ctx.beginPath(); ctx.ellipse(ex, ey, EYE_SHAPE.rx * k, EYE_SHAPE.ry * k, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = EYE_SHAPE.line; ctx.lineWidth = Math.max(1, 2 * k); ctx.lineCap = "round";
      ctx.beginPath(); ctx.ellipse(ex, ey - 1.5 * k, (EYE_SHAPE.rx - 3) * k, 5.5 * k, 0, (15 * Math.PI) / 180, (165 * Math.PI) / 180); ctx.stroke();
    }
  }
  ctx.restore();
}

/** Thin grid lines over the picture. */
export function gridLines(ctx: Ctx, x: number, y: number, S: number, color = "rgba(20,24,33,0.4)") {
  const c = S / 4;
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(x + k * c, y); ctx.lineTo(x + k * c, y + S); ctx.moveTo(x, y + k * c); ctx.lineTo(x + S, y + k * c); ctx.stroke(); }
  ctx.strokeStyle = palette.frame; ctx.strokeRect(x + 0.5, y + 0.5, S - 1, S - 1);
  ctx.restore();
}

/** Grey veil with diagonal hatching: a dropped patch. */
export function hatch(ctx: Ctx, x: number, y: number, w: number, h: number) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = "rgba(245,245,247,0.72)"; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = "rgba(20,24,33,0.35)"; ctx.lineWidth = 1;
  for (let k = -h; k < w; k += 6) { ctx.beginPath(); ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); ctx.stroke(); }
  ctx.restore();
}

/** Small white tag with text, centred at (cx, cy). */
export function tag(ctx: Ctx, text: string, cx: number, cy: number, color: string = palette.ink, size = 11) {
  ctx.save();
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  const tw = ctx.measureText(text).width + 6;
  ctx.fillStyle = "rgba(255,255,255,0.88)"; ctx.fillRect(cx - tw / 2, cy - size / 2 - 2, tw, size + 4);
  ctx.restore();
  label(ctx, text, cx, cy + 0.5, color, size, "center");
}

/** A picture cell that belongs to a merged token: a faint tint (light enough to keep the cat's colours readable) and an inner border
 *  in the token's colour. */
export function tintCell(ctx: Ctx, x: number, y: number, c: number, idx: number) {
  ctx.fillStyle = tint(idx, 0.12); ctx.fillRect(x, y, c, c);
  ctx.save(); ctx.strokeStyle = tint(idx, 0.95); ctx.lineWidth = 2; ctx.strokeRect(x + 2.5, y + 2.5, c - 5, c - 5); ctx.restore();
}

/** A token in the vector plane: radius grows with the number of patches s; s is written inside when it is 2 or more. */
export function tokenDot(ctx: Ctx, x: number, y: number, s: number, fill: string, off: boolean, showS = true) {
  const r = 6 + 2 * Math.sqrt(s);
  ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = off ? palette.anomaly : palette.ink; ctx.lineWidth = off ? 2.4 : 1.3; ctx.stroke();
  if (showS && s > 1) label(ctx, `${s}`, x, y + 0.5, palette.ink, 11, "center");
  return r;
}

/** The vector plane's range: brightness across, blueness up, wide enough for every patch and token of the cat crop. */
export const PLANE_X: [number, number] = [-3.2, 1.5];
export const PLANE_Y: [number, number] = [-2.2, 1.7];

/** Names of the four kinds of patch, placed beside their clusters but clear of where merged tokens land. */
export function kindNames(ctx: Ctx, at: (v: number[]) => readonly [number, number], names: Record<string, string>) {
  const spots: [string, number[], CanvasTextAlign][] = [
    [names.bg, [1.0, 1.3], "center"], [names.brown, [-1.55, -1.65], "center"], [names.cream, [0.55, -1.95], "center"], [names.eye, [-2.51, 1.45], "center"],
  ];
  spots.forEach(([n, v, al]) => { const [x, y] = at(v); label(ctx, n, x, y, palette.muted, 11, al); });
}

/** Axis names on the two zero lines: brightness at the right end of the horizontal one, blueness at the top of the vertical one. */
export function axisNames(ctx: Ctx, at: (v: number[]) => readonly [number, number], ax: string, ay: string) {
  const [x1, y1] = at([PLANE_X[1], 0]), [x2, y2] = at([0, PLANE_Y[1]]);
  label(ctx, ax, x1 - 5, y1 + 10, palette.muted, 11, "right");
  label(ctx, ay, x2 - 5, y2 + 10, palette.muted, 11, "right");
}

/** A 2-D vector plane: returns a mapping from vector to canvas point for the box (x, y, w, h). */
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
