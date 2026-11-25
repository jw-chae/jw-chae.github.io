/** Drawing helpers for the token-reduction scenes: the desk picture, number formats, hatching and group tints. */

import { label, palette } from "@/components/anomaly/lib";
import type { Ctx } from "./kit";
import type { Kind } from "./tok-math";

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

/** Colours of the things in the picture. Drawn, not photographed. */
export const INK = { wall: "#e9e5db", table: "#bf9566", tableDark: "#9c7448", mug: "#c0623e", mugDark: "#9a4a2c", key: "#c9a227", keyDark: "#8a6d10", hand: "#e2b597", handDark: "#c48f70" };
export const KIND_DOT: Record<Kind, string> = { wall: "#9aa0a8", table: INK.tableDark, mug: INK.mug, key: INK.keyDark, hand: INK.handDark };

/** Tints for tokens that stand for two or more patches. Deliberately not green or red, which mean "same" and "differs". */
export const TINTS = ["194,115,0", "124,58,237", "14,127,199", "120,130,40", "190,60,160", "90,100,120", "160,90,40", "40,140,150"];
export const tint = (i: number, a = 0.32) => `rgba(${TINTS[i % TINTS.length]},${a})`;

/** The desk picture: wall above, table below, a mug in the middle 2 × 2 cells, a key in the lower right cell; `hand` covers cells 11, 14, 15. */
export function desk(ctx: Ctx, x: number, y: number, S: number, kinds: Kind[], shift = 0) {
  const c = S / 4;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, S, S); ctx.clip();
  ctx.fillStyle = INK.wall; ctx.fillRect(x, y, S, S);
  // table top: the back edge runs along the middle of the picture
  ctx.fillStyle = INK.table; ctx.fillRect(x, y + 2 * c, S, 2 * c);
  ctx.strokeStyle = INK.tableDark; ctx.lineWidth = Math.max(1, c * 0.04);
  for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(x, y + 2.3 * c + k * 0.38 * c); ctx.bezierCurveTo(x + S * 0.3, y + 2.2 * c + k * 0.38 * c, x + S * 0.6, y + 2.45 * c + k * 0.38 * c, x + S, y + 2.32 * c + k * 0.38 * c); ctx.stroke(); }
  ctx.fillStyle = INK.tableDark; ctx.fillRect(x, y + 2 * c - c * 0.03, S, c * 0.06);
  // mug: body, rim, handle
  ctx.fillStyle = INK.mug;
  ctx.beginPath(); ctx.moveTo(x + 1.15 * c, y + 1.25 * c); ctx.lineTo(x + 2.65 * c, y + 1.25 * c); ctx.lineTo(x + 2.6 * c, y + 2.7 * c);
  ctx.quadraticCurveTo(x + 1.9 * c, y + 2.95 * c, x + 1.2 * c, y + 2.7 * c); ctx.closePath(); ctx.fill();
  ctx.fillStyle = INK.mugDark; ctx.beginPath(); ctx.ellipse(x + 1.9 * c, y + 1.25 * c, 0.75 * c, 0.16 * c, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = INK.mug; ctx.lineWidth = Math.max(2, c * 0.13);
  ctx.beginPath(); ctx.ellipse(x + 2.68 * c, y + 1.95 * c, 0.24 * c, 0.36 * c, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  // key: ring and blade with two teeth
  if (kinds[15] === "key") {
    ctx.strokeStyle = INK.key; ctx.lineWidth = Math.max(2, c * 0.08);
    ctx.beginPath(); ctx.arc(x + 3.32 * c, y + 3.42 * c, 0.17 * c, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 3.49 * c, y + 3.47 * c); ctx.lineTo(x + 3.86 * c, y + 3.62 * c); ctx.stroke();
    ctx.lineWidth = Math.max(1.5, c * 0.06);
    ctx.beginPath(); ctx.moveTo(x + 3.72 * c, y + 3.57 * c); ctx.lineTo(x + 3.69 * c, y + 3.7 * c); ctx.moveTo(x + 3.82 * c, y + 3.61 * c); ctx.lineTo(x + 3.79 * c, y + 3.74 * c); ctx.stroke();
  }
  // hand: an arm from the lower right edge, palm over the right cell of row 3, fingers up
  if (kinds[11] === "hand") {
    const dx = -shift * c, dy = -shift * 0.5 * c;
    ctx.fillStyle = INK.hand;
    ctx.beginPath(); ctx.moveTo(x + 2.2 * c + dx, y + 4.1 * c); ctx.lineTo(x + 3.0 * c + dx, y + 3.15 * c + dy); ctx.lineTo(x + 4.1 * c, y + 3.0 * c + dy); ctx.lineTo(x + 4.1 * c, y + 4.1 * c); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 3.45 * c + dx, y + 2.9 * c + dy, 0.5 * c, 0.42 * c, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = "round"; ctx.strokeStyle = INK.hand; ctx.lineWidth = Math.max(2, c * 0.15);
    [[3.1, 2.25], [3.35, 2.12], [3.6, 2.12], [3.85, 2.3]].forEach(([fx, fy]) => { ctx.beginPath(); ctx.moveTo(x + fx * c + dx, y + 2.75 * c + dy); ctx.lineTo(x + fx * c + dx, y + fy * c + dy); ctx.stroke(); });
    ctx.strokeStyle = INK.handDark; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(x + 3.45 * c + dx, y + 2.9 * c + dy, 0.5 * c, 0.42 * c, -0.3, 0.3, 1.6); ctx.stroke();
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

/** A picture cell that belongs to a merged token: a light tint and an inner border in the token's colour. */
export function tintCell(ctx: Ctx, x: number, y: number, c: number, idx: number) {
  ctx.fillStyle = tint(idx, 0.26); ctx.fillRect(x, y, c, c);
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

/** Names of the four kinds of patch, placed beside their clusters but clear of where merged tokens land. */
export function kindNames(ctx: Ctx, at: (v: number[]) => readonly [number, number], names: Record<string, string>) {
  const spots: [string, number[], CanvasTextAlign][] = [[names.wall, [0.42, -1.05], "left"], [names.table, [-1.0, -0.42], "center"], [names.mug, [2.05, 0.45], "center"], [names.key, [0.12, 1.6], "right"]];
  spots.forEach(([n, v, al]) => { const [x, y] = at(v); label(ctx, n, x, y, palette.muted, 11, al); });
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
