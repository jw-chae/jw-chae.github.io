/** Canvas helpers for the VLA study scenes: the table seen from above, its objects, the gripper and paths. */

import { label, palette } from "@/components/anomaly/lib";
import { line, rbox, type Ctx } from "./kit";
import { BLUE, CUP_R, PLATE, PLATE_R, RED, TABLE, VASE, CLEAR, type P } from "./vla-math";

export { fitLabel, fix, num, tw } from "./yolo-draw";

export const PAD = 18;
export const isPortrait = (w: number, h: number) => h > w * 1.15;
export const OUT = palette.accent;     // what the model outputs: amber
export const GT = palette.mint;        // the demonstrator's answer: green
export const BAD = palette.anomaly;    // collision, error: red
export const READ = palette.normal;    // what the model reads, decisions: blue
export const RED_CUP = "#d9304b";
export const BLUE_CUP = "#2a6fd6";

/** Where the table goes (cm to canvas) and where the text panel below it starts. */
export type TLay = { port: boolean; tx: number; ty: number; tw: number; th: number; k: number; X: (x: number) => number; Y: (y: number) => number; px: number; py: number; pw: number; ph: number };
export function tableLayout(w: number, h: number, share = 0.55, top = 30): TLay {
  const port = isPortrait(w, h);
  const tw = Math.min(w - 2 * PAD, h * (port ? 0.42 : share) * (TABLE.w / TABLE.h));
  const th = (tw * TABLE.h) / TABLE.w;
  const tx = port ? (w - tw) / 2 : PAD;
  const ty = top;
  const k = tw / TABLE.w;
  const py = ty + th + (port ? 22 : 20);
  return { port, tx, ty, tw, th, k, X: (x) => tx + x * k, Y: (y) => ty + th - y * k, px: PAD, py, pw: w - 2 * PAD, ph: h - py - 8 };
}

function disc(ctx: Ctx, x: number, y: number, r: number, fill: string | null, stroke: string | null, lw = 1.5) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
  ctx.restore();
}

export type TableOpts = { red?: P | null; blue?: P | null; clear?: boolean; names?: { vase: string; plate: string; red: string; blue: string }; redRight?: boolean };
/** The table, the vase, the plate and the cups. Cup positions can be moved or hidden (null). */
export function drawTable(ctx: Ctx, L: TLay, o: TableOpts = {}) {
  rbox(ctx, L.tx, L.ty, L.tw, L.th, 8, "rgba(194,115,0,0.05)", palette.frame, 1.2);
  const fs = L.tw < 300 ? 11 : 11.5;
  // plate
  disc(ctx, L.X(PLATE[0]), L.Y(PLATE[1]), PLATE_R * L.k, "#ffffff", palette.frame, 1.4);
  disc(ctx, L.X(PLATE[0]), L.Y(PLATE[1]), PLATE_R * L.k * 0.62, null, "rgba(15,23,42,0.1)", 1);
  // vase
  if (o.clear) disc(ctx, L.X(VASE.x), L.Y(VASE.y), CLEAR * L.k, null, `rgba(${palette.anomalyRgb},0.35)`, 1);
  disc(ctx, L.X(VASE.x), L.Y(VASE.y), VASE.r * L.k, "rgba(91,100,116,0.28)", "rgba(91,100,116,0.7)", 1.4);
  disc(ctx, L.X(VASE.x), L.Y(VASE.y), VASE.r * L.k * 0.45, "rgba(91,100,116,0.35)", null);
  // cups
  const red = o.red === undefined ? RED : o.red, blue = o.blue === undefined ? BLUE : o.blue;
  if (red) disc(ctx, L.X(red[0]), L.Y(red[1]), CUP_R * L.k, RED_CUP, "rgba(0,0,0,0.25)", 1);
  if (blue) disc(ctx, L.X(blue[0]), L.Y(blue[1]), CUP_R * L.k, BLUE_CUP, "rgba(0,0,0,0.25)", 1);
  if (o.names) {
    label(ctx, o.names.vase, L.X(VASE.x), L.Y(VASE.y) + VASE.r * L.k + 9, palette.muted, fs, "center");
    label(ctx, o.names.plate, L.X(PLATE[0]) + PLATE_R * L.k + 4, L.Y(PLATE[1]), palette.muted, fs);
    if (red && o.redRight) label(ctx, o.names.red, L.X(red[0]) + CUP_R * L.k + 4, L.Y(red[1]), RED_CUP, fs);
    else if (red) label(ctx, o.names.red, L.X(red[0]), L.Y(red[1]) + CUP_R * L.k + 10, RED_CUP, fs, "center");
    if (blue) label(ctx, o.names.blue, L.X(blue[0]) + CUP_R * L.k + 4, L.Y(blue[1]), BLUE_CUP, fs);
  }
}

/** The two-finger gripper seen from above; fingers apart when open, together when closed. */
export function drawGripper(ctx: Ctx, L: TLay, p: P, g: 0 | 1, color: string = palette.ink, alpha = 1) {
  const x = L.X(p[0]), y = L.Y(p[1]), s = L.k;
  const gap = (g ? 1.0 : 2.6) * s, fl = 2.4 * s, fw = Math.max(2, 0.7 * s);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(x - gap - fw, y - fl / 2, fw, fl);
  ctx.fillRect(x + gap, y - fl / 2, fw, fl);
  ctx.fillRect(x - gap - fw, y - fl / 2 - fw, 2 * (gap + fw), fw);
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1.6, 0.35 * s), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A path of positions in cm, optionally with a dot on every step. */
export function drawPath(ctx: Ctx, L: TLay, pts: P[], color: string, lw = 2, dash?: number[], dots = false) {
  for (let i = 1; i < pts.length; i++) line(ctx, L.X(pts[i - 1][0]), L.Y(pts[i - 1][1]), L.X(pts[i][0]), L.Y(pts[i][1]), color, lw, dash);
  if (dots) pts.forEach((q) => disc(ctx, L.X(q[0]), L.Y(q[1]), Math.max(1.6, lw * 0.9), color, null));
}

export function dot(ctx: Ctx, L: TLay, p: P, r: number, fill: string | null, stroke: string | null = null, lw = 1.5) {
  disc(ctx, L.X(p[0]), L.Y(p[1]), r, fill, stroke, lw);
}

/** A red cross at a position in cm. */
export function cross(ctx: Ctx, L: TLay, p: P, size = 6, color: string = BAD) {
  const x = L.X(p[0]), y = L.Y(p[1]);
  line(ctx, x - size, y - size, x + size, y + size, color, 2.4);
  line(ctx, x - size, y + size, x + size, y - size, color, 2.4);
}

/** Signed number with a real minus sign and a plus for positives. */
export const sgn = (v: number, d = 1) => (Math.abs(v) < 0.5 * 10 ** -d ? (0).toFixed(d) : `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(d)}`);
