"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { act, arrow, cells, frame, gray, line, type Ctx } from "./kit";
import { unetWalkUi as U } from "./unet-walk-copy";
import {
  P1, P2, PHOTO8, RULES, TRACKED, TRAIN_STEPS, TRUTH8, WN,
  at, decide, oneNumber, trace, train, type Map2, type Rule, type Source,
} from "./unet-walk-math";

const PAD = 18;
const MINT_RGB = "15,157,106";
const BELOW = palette.accent;       // the number that went down to the bottom and came back up: amber
const ACROSS = palette.normal;      // the number handed across the bridge: blue
const isPortrait = (w: number, h: number) => h > w * 1.15;
const num = (v: number, d = 2) => { const s = v.toFixed(d).replace(/\.?0+$/, ""); return s === "-0" ? "0" : s.replace("-", "−"); };
const pc = (v: number) => `${Math.round(v * 100)}%`;
const idx = ([r, c]: [number, number]) => r * WN + c;
const kind = (v: number) => (v ? U.cell : U.bg);

const T = trace();
const ANSWER = TRACKED.map((p) => at(TRUTH8, p));

/** Numbered dot on one of the three tracked pixels. ① is the one the text follows. */
function marker(ctx: Ctx, x: number, y: number, c: number, i: number) {
  const [r, k] = TRACKED[i], cx = x + (k + 0.5) * c, cy = y + (r + 0.5) * c, rad = Math.min(8.5, c / 2 - 1);
  ctx.save();
  ctx.fillStyle = i === 0 ? palette.accent : "#ffffff"; ctx.strokeStyle = palette.ink; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill(); if (i !== 0) ctx.stroke();
  ctx.restore();
  label(ctx, String(i + 1), cx, cy + 0.5, i === 0 ? "#ffffff" : palette.ink, rad < 7 ? 9 : 11, "center");
}

/** The 8×8 picture as gray cells with the tracked pixels numbered. */
function photo8(ctx: Ctx, x: number, y: number, S: number, marks: number[] = [0, 1, 2]) {
  const c = S / WN;
  cells(ctx, x, y, c, WN, WN, (r, k) => gray(PHOTO8.d[r * WN + k]), 1);
  frame(ctx, x, y, S, S, palette.frame, 1);
  marks.forEach((i) => marker(ctx, x, y, c, i));
}

/** Thin outlines on the tracked pixels of an answer map, so they can be found without covering the cell. */
function outlines(ctx: Ctx, x: number, y: number, S: number) {
  const c = S / WN;
  TRACKED.forEach(([r, k]) => frame(ctx, x + k * c, y + r * c, c, c, palette.ink, 1.5));
}

/** A yes/no answer per pixel. Red = called cell but is background, blue = cell that was missed. */
function answerMap(ctx: Ctx, m: Map2, x: number, y: number, S: number) {
  cells(ctx, x, y, S / WN, WN, WN, (r, k) => {
    const v = m.d[r * WN + k], t = TRUTH8.d[r * WN + k];
    if (v && !t) return palette.anomaly;
    if (!v && t) return palette.normal;
    return v ? `rgba(${MINT_RGB},0.85)` : palette.track;
  }, 1);
  frame(ctx, x, y, S, S, palette.frame, 1);
}

/** A cell probability per pixel (green, darker = higher). A red frame marks a pixel whose thresholded answer is wrong. */
function probMap(ctx: Ctx, p: number[], x: number, y: number, S: number) {
  const c = S / WN;
  cells(ctx, x, y, c, WN, WN, (r, k) => `rgba(${MINT_RGB},${0.05 + 0.85 * p[r * WN + k]})`, 1);
  p.forEach((v, i) => {
    if ((v > 0.5 ? 1 : 0) !== TRUTH8.d[i]) frame(ctx, x + (i % WN) * c + 2, y + Math.floor(i / WN) * c + 2, c - 4, c - 4, palette.anomaly, 2);
  });
  frame(ctx, x, y, S, S, palette.frame, 1);
}

/** "점수 = 10 × 아래에서 + 5 × 다리로 − 8", leaving out the input that is not given. */
function ruleText(r: Rule, src: Source, d: number | null): string {
  const f = (v: number) => (d === null ? num(Math.abs(v)) : Math.abs(v).toFixed(d));
  const terms: [number, string][] = [];
  if (src !== "bridge") terms.push([r.a, ` × ${U.fuse.below}`]);
  if (src !== "below") terms.push([r.b, ` × ${U.fuse.bridge}`]);
  terms.push([r.c, ""]);
  return `${U.fuse.score} = ` + terms.map(([v, name], i) => `${i === 0 ? (v < 0 ? "−" : "") : v < 0 ? " − " : " + "}${f(v)}${name}`).join("");
}

/* ------------------------------------------------------------------ */
/* 01 · One number per pixel is not enough: own brightness, or a wide mean */
/* ------------------------------------------------------------------ */

const ONE = [oneNumber("own"), oneNumber("wide")];

export function PixelScene() {
  const [mode, setMode] = useState(0);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), gap = portrait ? 20 : 36, g = Math.max(0, (h - 440) / 5);
    const S = Math.min(portrait ? 150 : 172, (w - 2 * PAD - gap) / 2);
    const x0 = (w - 2 * S - gap) / 2, y0 = 36, x1 = x0 + S + gap;

    label(ctx, U.photo, x0 + S / 2, y0 - 16, palette.muted, 11, "center");
    photo8(ctx, x0, y0, S);
    if (mode >= 1) {
      // the four 4×4 quarters whose means are used
      line(ctx, x0 + S / 2, y0, x0 + S / 2, y0 + S, BELOW, 2, [5, 4]);
      line(ctx, x0, y0 + S / 2, x0 + S, y0 + S / 2, BELOW, 2, [5, 4]);
    }

    label(ctx, U.one.panel[mode], x1 + S / 2, y0 - 16, palette.muted, 11, "center");
    if (mode < 2) {
      answerMap(ctx, ONE[mode].mask, x1, y0, S);
    } else {
      cells(ctx, x1, y0, S / WN, WN, WN, () => palette.track, 1);
      frame(ctx, x1, y0, S, S, palette.frame, 1);
      label(ctx, "?", x1 + S * 0.6, y0 + S * 0.34, palette.muted, 34, "center");
      label(ctx, U.one.unknown, x1 + S / 2, y0 + S - S / 16, palette.muted, 11, "center");
    }
    outlines(ctx, x1, y0, S);

    // what each of the three pixels is given, what it answers, and whether that is right
    const W = w - 2 * PAD, xs = [0, 0.4, 0.66, 0.8].map((f) => PAD + f * W), ty = y0 + S + 30 + g, rh = 30 + g / 2;
    U.one.head.forEach((name, i) => label(ctx, name, xs[i], ty, palette.muted, 11));
    const twin = mode === 0 ? 2 : mode === 1 ? 1 : -1;          // the pixel that receives the same number as ①
    TRACKED.forEach((p, i) => {
      const y = ty + 26 + i * rh, own = at(T.x, p), wide = at(T.up, p);
      const given = mode === 0 ? num(own) : mode === 1 ? num(wide) : `${num(wide)}, ${num(own)}`;
      const clash = i === 0 ? twin >= 0 : i === twin;
      label(ctx, `${U.marks[i]} ${portrait ? U.short[i] : U.names[i]}`, xs[0], y, palette.ink, 12);
      label(ctx, given, xs[1], y, clash ? palette.anomaly : palette.ink, 13);
      label(ctx, kind(ANSWER[i]), xs[3], y, palette.muted, 12);
      if (mode < 2) {
        const said = at(ONE[mode].mask, p), ok = said === ANSWER[i];
        label(ctx, kind(said), xs[2], y, palette.ink, 12);
        label(ctx, ok ? U.right : U.wrong, w - PAD, y, ok ? palette.mint : palette.anomaly, 12, "right");
      } else {
        label(ctx, "?", xs[2], y, palette.muted, 12);
      }
    });
    const ny = ty + 26 + 3 * rh + 8;
    label(ctx, mode === 0 ? U.one.same13 : mode === 1 ? U.one.same12 : U.one.distinct, PAD, ny, mode < 2 ? palette.anomaly : palette.mint, 12);
    label(ctx, mode < 2 ? `${U.one.rule} · ${U.wrongCount} ${ONE[mode].wrong}` : U.one.later, PAD, ny + 22, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.one.by}>
          <span>{U.one.by}</span>
          {U.one.modes.map((name, i) => <button key={name} type="button" className={mode === i ? "on" : ""} onClick={() => setMode(i)}>{name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · The number at pixel ①: down twice, then straight back up        */
/* ------------------------------------------------------------------ */

const TRACE_MAPS = [T.x, T.d1, T.d2, T.up];
const BLOCK = [1, 2, 4, 4];           // how many original pixels (per side) the number at ① stands for
const block4 = (m: Map2, r0: number, c0: number) => [m.d[r0 * m.n + c0], m.d[r0 * m.n + c0 + 1], m.d[(r0 + 1) * m.n + c0], m.d[(r0 + 1) * m.n + c0 + 1]];
const meanText = (v: number[], out: number) => `(${v.map((n) => num(n)).join(" + ")}) ÷ 4 = ${num(out)}`;
const TRACE_LINES: [string, string, string][] = [
  [`${U.trace.at1}  ${num(at(T.x, P1))}`, `${U.trace.own}. ${U.trace.at2} ${num(at(T.x, P2))}`, ""],
  [meanText(block4(T.x, 2 * Math.floor(P1[0] / 2), 2 * Math.floor(P1[1] / 2)), at(T.d1, P1, 2)), U.trace.stands4, U.trace.merged],
  [meanText(block4(T.d1, 2 * Math.floor(P1[0] / 4), 2 * Math.floor(P1[1] / 4)), at(T.d2, P1, 4)), U.trace.stands16, U.trace.noInside],
  [`${U.marks[0]} ${num(at(T.up, P1))} · ${U.marks[1]} ${num(at(T.up, P2))}`, `${U.trace.before} ${num(at(T.x, P1))}, ${num(at(T.x, P2))}`, U.trace.same],
];

export function TraceScene() {
  const [step, setStep] = useState(0);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), gap = portrait ? 20 : 44, g = Math.max(0, (h - 440) / 4);
    const S = Math.min(portrait ? 150 : 184, (w - 2 * PAD - gap) / 2);
    const x0 = (w - 2 * S - gap) / 2, y0 = 38, x1 = x0 + S + gap, c = S / WN, size = BLOCK[step];

    // left: the picture never moves; the amber frame is the set of original pixels the current number stands for
    label(ctx, U.photo, x0 + S / 2, y0 - 16, palette.muted, 11, "center");
    photo8(ctx, x0, y0, S, [0, 1]);
    for (let k = size; size > 1 && k < WN; k += size) {
      line(ctx, x0 + k * c, y0, x0 + k * c, y0 + S, `rgba(${palette.accentRgb},0.5)`, 1);
      line(ctx, x0, y0 + k * c, x0 + S, y0 + k * c, `rgba(${palette.accentRgb},0.5)`, 1);
    }
    frame(ctx, x0 + Math.floor(P1[1] / size) * size * c, y0 + Math.floor(P1[0] / size) * size * c, size * c, size * c, BELOW, 3);
    arrow(ctx, x0 + S + 5, y0 + S / 2, x1 - 5, y0 + S / 2, palette.muted);

    // right: the map at this step, with the cell that pixel ① has gone into
    const m = TRACE_MAPS[step], n = m.n, cc = S / n;
    label(ctx, U.trace.maps[step], x1 + S / 2, y0 - 16, palette.muted, 11, "center");
    cells(ctx, x1, y0, cc, n, n, (r, k) => act(m.d[r * n + k]), n === WN ? 1 : 2);
    if (n < WN) m.d.forEach((v, i) => label(ctx, num(v), x1 + ((i % n) + 0.5) * cc, y0 + (Math.floor(i / n) + 0.5) * cc, palette.ink, n === 2 ? 16 : 12, "center"));
    frame(ctx, x1, y0, S, S, palette.frame, 1);
    if (n === WN) {
      [0, 1].forEach((i) => marker(ctx, x1, y0, cc, i));
      frame(ctx, x1 + P1[1] * cc, y0 + P1[0] * cc, cc, cc, BELOW, 3);
      if (step === 3) frame(ctx, x1 + P2[1] * cc, y0 + P2[0] * cc, cc, cc, BELOW, 3);
    } else {
      const scale = WN / n;
      frame(ctx, x1 + Math.floor(P1[1] / scale) * cc, y0 + Math.floor(P1[0] / scale) * cc, cc, cc, BELOW, 3);
    }

    const [a, b, d] = TRACE_LINES[step], ty = y0 + S + 36 + g;
    label(ctx, a, w / 2, ty, palette.ink, 14, "center");
    label(ctx, b, w / 2, ty + 28 + g / 3, palette.muted, 12, "center");
    if (d) label(ctx, d, w / 2, ty + 52 + g / 2, step === 3 ? palette.anomaly : palette.accent, 12, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.trace.step}>
          <span>{U.trace.step}</span>
          {U.trace.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Two numbers at every pixel, one score, one probability; then cut one path */
/* ------------------------------------------------------------------ */

const SOURCES: Source[] = ["below", "bridge", "both"];
const VERDICT = { below: decide(RULES.below), bridge: decide(RULES.bridge), both: decide(RULES.both) };

export function BridgeScene() {
  const [src, setSrc] = useState<Source>("both");

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), gap = portrait ? 20 : 36, g = Math.max(0, (h - 440) / 5);
    const S = Math.min(portrait ? 140 : 156, (w - 2 * PAD - gap) / 2);
    const x0 = (w - 2 * S - gap) / 2, y0 = 34, x1 = x0 + S + gap, v = VERDICT[src];

    label(ctx, U.photo, x0 + S / 2, y0 - 16, palette.muted, 11, "center");
    photo8(ctx, x0, y0, S);
    label(ctx, U.fuse.prob, x1 + S / 2, y0 - 16, palette.muted, 11, "center");
    probMap(ctx, v.p, x1, y0, S);
    outlines(ctx, x1, y0, S);

    const fy = y0 + S + 28 + g;
    label(ctx, ruleText(RULES[src], src, null), w / 2, fy, palette.ink, 13, "center");

    const W = w - 2 * PAD, xs = [0, 0.17, 0.37, 0.55, 0.71].map((f) => PAD + f * W), ty = fy + 30 + g / 2, rh = 28 + g / 2;
    const useBelow = src !== "bridge", useAcross = src !== "below";
    label(ctx, U.fuse.pixel, xs[0], ty, palette.muted, 11);
    label(ctx, U.fuse.below, xs[1], ty, useBelow ? BELOW : palette.dotOff, 11);
    label(ctx, U.fuse.bridge, xs[2], ty, useAcross ? ACROSS : palette.dotOff, 11);
    label(ctx, U.fuse.score, xs[3], ty, palette.muted, 11);
    label(ctx, U.fuse.p, xs[4], ty, palette.muted, 11);
    TRACKED.forEach((p, i) => {
      const y = ty + 26 + i * rh, k = idx(p), ok = at(v.mask, p) === ANSWER[i];
      label(ctx, U.marks[i], xs[0], y, palette.ink, 12);
      label(ctx, num(at(T.up, p)), xs[1], y, useBelow ? BELOW : palette.dotOff, 13);
      label(ctx, num(at(T.x, p)), xs[2], y, useAcross ? ACROSS : palette.dotOff, 13);
      label(ctx, `${v.z[k] > 0 ? "+" : ""}${num(v.z[k])}`, xs[3], y, palette.ink, 13);
      label(ctx, pc(v.p[k]), xs[4], y, palette.ink, 13);
      label(ctx, ok ? U.right : U.wrong, w - PAD, y, ok ? palette.mint : palette.anomaly, 12, "right");
    });
    const ny = ty + 26 + 3 * rh + 8;
    label(ctx, src === "below" ? U.fuse.same12 : src === "bridge" ? U.fuse.same13 : U.fuse.distinct, PAD, ny, src === "both" ? palette.mint : palette.anomaly, 12);
    label(ctx, `${U.wrongCount} ${v.wrong}`, PAD, ny + 22, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.fuse.given}>
          <span>{U.fuse.given}</span>
          {SOURCES.map((s, i) => <button key={s} type="button" className={src === s ? "on" : ""} onClick={() => setSrc(s)}>{U.fuse.modes[i]}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · The three weights learned from zero, graded pixel by pixel      */
/* ------------------------------------------------------------------ */

const SNAPS = train(TRAIN_STEPS);

export function TrainScene() {
  const [k, setK] = useState(0);
  const s = SNAPS[k];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), gap = portrait ? 16 : 30, g = Math.max(0, (h - 440) / 5);
    const S = Math.min(124, (w - 2 * PAD - 2 * gap) / 3);
    const x0 = (w - 3 * S - 2 * gap) / 2, y0 = 36, xp = x0 + S + gap, xt = xp + S + gap;

    // input → prediction; the answer mask stands apart and is only used to grade the prediction
    label(ctx, U.learn.photo, x0 + S / 2, y0 - 16, palette.muted, 11, "center");
    photo8(ctx, x0, y0, S);
    arrow(ctx, x0 + S + 3, y0 + S / 2, xp - 3, y0 + S / 2, palette.muted);
    label(ctx, U.learn.pred, xp + S / 2, y0 - 16, palette.muted, 11, "center");
    probMap(ctx, s.p, xp, y0, S);
    outlines(ctx, xp, y0, S);
    label(ctx, U.learn.truth, xt + S / 2, y0 - 16, palette.mint, 11, "center");
    answerMap(ctx, TRUTH8, xt, y0, S);
    const by = y0 + S + 7;
    line(ctx, xp + S / 2, by, xp + S / 2, by + 10, palette.anomaly, 1.5);
    line(ctx, xt + S / 2, by, xt + S / 2, by + 10, palette.anomaly, 1.5);
    line(ctx, xp + S / 2, by + 10, xt + S / 2, by + 10, palette.anomaly, 1.5);
    label(ctx, `${U.learn.grade} · ${U.learn.loss} ${s.loss.toFixed(3)}`, (xp + xt + S) / 2, by + 26, palette.anomaly, 12, "center");

    const fy = by + 56 + g;
    label(ctx, ruleText(s.rule, "both", 1), w / 2, fy, palette.ink, portrait ? 11 : 13, "center");
    label(ctx, U.learn.fixed, w / 2, fy + 19, palette.anomaly, 11, "center");

    const ry = fy + 50 + g, rh = 30 + g / 2, bx = PAD + 36, bw = w - 2 * PAD - 36 - 104;
    TRACKED.forEach((p, i) => {
      const y = ry + i * rh, v = s.p[idx(p)], ok = (v > 0.5 ? 1 : 0) === ANSWER[i];
      label(ctx, U.marks[i], PAD, y, palette.ink, 12);
      ctx.fillStyle = palette.track; ctx.fillRect(bx, y - 6, bw, 12);
      ctx.fillStyle = ok ? palette.mint : palette.anomaly; ctx.fillRect(bx, y - 6, Math.max(2, bw * v), 12);
      line(ctx, bx + bw / 2, y - 10, bx + bw / 2, y + 10, palette.xmark, 1, [2, 2]);
      label(ctx, pc(v), bx + bw + 40, y, palette.ink, 12, "right");
      label(ctx, `${U.learn.answer} ${kind(ANSWER[i])}`, w - PAD, y, palette.muted, 11, "right");
    });
    label(ctx, `${U.learn.step} ${s.step} · ${U.wrongCount} ${s.wrong}`, PAD, ry + 3 * rh + 4, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.learn.step} <b>{s.step}</b></span>
          <input type="range" min={0} max={SNAPS.length - 1} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}
