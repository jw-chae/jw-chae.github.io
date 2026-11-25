/** Small drawing helpers shared by the compression chapter's scenes. */

import { label, palette } from "@/components/anomaly/lib";
import { frame, rbox, type Ctx } from "./kit";

export const PAD = 18;
export const isPortrait = (w: number, h: number) => h > w * 1.15;

/** Up to d decimals, trailing zeros dropped, real minus sign. */
export const num = (v: number, d = 2) => {
  const s = v.toFixed(d).replace(/\.?0+$/, "");
  return s === "-0" || s === "" ? "0" : s.replace("-", "−");
};
/** Fixed decimals with a real minus sign; tiny values print as zero. */
export const fix = (v: number, d = 2) => (Math.abs(v) < 0.5 * 10 ** -d ? (0).toFixed(d) : v.toFixed(d)).replace("-", "−");
/** Signed, fixed decimals: "+0.333", "−0.667". */
export const sgn = (v: number, d = 3) => (Math.abs(v) < 0.5 * 10 ** -d ? (0).toFixed(d) : (v > 0 ? "+" : "") + v.toFixed(d)).replace("-", "−");
export const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
export const vec = (a: number[], d = 2) => `[${a.map((v) => num(v, d)).join(", ")}]`;

/** One colour per class, used wherever the three names appear side by side. */
export const classColor = () => [palette.accent, palette.accent2, palette.muted];
export const tint = (rgb: string, a: number) => `rgba(${rgb},${a})`;

/** Cells with a number written in each; `fill` may return null for white. Font shrinks to fit the cell. */
export function valueGrid(ctx: Ctx, m: number[][], x: number, y: number, cw: number, ch: number,
  o: { fill?: (r: number, c: number) => string | null; text?: (v: number, r: number, c: number) => string; tone?: string; ink?: (r: number, c: number) => string } = {}) {
  m.forEach((row, r) => row.forEach((v, c) => {
    ctx.fillStyle = o.fill?.(r, c) ?? "#ffffff";
    ctx.fillRect(x + c * cw, y + r * ch, cw, ch);
    ctx.strokeStyle = palette.frame; ctx.lineWidth = 1;
    ctx.strokeRect(x + c * cw + 0.5, y + r * ch + 0.5, cw - 1, ch - 1);
    const s = o.text ? o.text(v, r, c) : num(v);
    const size = s.length * 7.4 <= cw - 4 ? 12 : s.length * 6.7 <= cw - 3 ? 11 : 10;
    label(ctx, s, x + c * cw + cw / 2, y + r * ch + ch / 2 + 0.5, o.ink?.(r, c) ?? palette.ink, size, "center");
  }));
  if (o.tone) frame(ctx, x, y, m[0].length * cw, m.length * ch, o.tone, 1.5);
}

/** A horizontal bar of three shares that add up to 100%, each segment labelled when wide enough. */
export const CLASS_RGB = [palette.accentRgb, "124,58,237", "91,100,116"];
export function shareBar(ctx: Ctx, x: number, y: number, w: number, h: number, p: number[]) {
  let cx = x;
  p.forEach((v, i) => {
    const sw = w * v;
    ctx.fillStyle = tint(CLASS_RGB[i], i === 2 ? 0.5 : 0.75);
    ctx.fillRect(cx, y, sw, h);
    const s = pct(v);
    if (sw > s.length * 7 + 6) label(ctx, s, cx + sw / 2, y + h / 2 + 0.5, "#ffffff", 11, "center");
    cx += sw;
  });
  ctx.strokeStyle = palette.frame; ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

/** A labelled rounded box used by the pipeline scene. */
export function tag(ctx: Ctx, text: string, x: number, y: number, w: number, h: number, stroke: string, fill: string | null = "#ffffff", size = 11) {
  rbox(ctx, x, y, w, h, 7, fill, stroke, 1.5);
  label(ctx, text, x + w / 2, y + h / 2 + 0.5, palette.ink, size, "center");
}
