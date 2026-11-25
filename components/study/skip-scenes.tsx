"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, bar, frame, line, rbox } from "./kit";
import { skipCopy } from "./skip-copy";
import {
  BLOCKS, BYTES_16, FFN_V, FFN_W, MASKS, MIX_EXPERT, MIXTRAL, N_EXP, OCC, PUSHES, ROUTER, TAU, TOY_STORED, X_CAT, X_RARE, X_RUN,
  balanceAt, cartesian, countOcc, dsmoe, matVec, mixExperts, route, toyComputed, type Vec,
} from "./skip-math";

const U = skipCopy.ui;
const PAD = 18;
const isPortrait = (w: number, h: number) => h > w * 1.15;
const SHARE = palette.normal;      // the router's shares: blue
const PICK = palette.accent;       // chosen experts and what they output: amber
const ANSWER = palette.mint;       // the layer output: green
const BAD = palette.anomaly;       // dropped tokens, skipped blocks: red
const TINT = `rgba(${palette.accentRgb},0.14)`;
const COOL = `rgba(${palette.normalRgb},0.08)`;

/** Up to d decimals, trailing zeros dropped, real minus sign. */
export const num = (v: number, d = 2) => {
  if (!Number.isFinite(v)) return v > 0 ? "∞" : "−∞";
  const s = v.toFixed(d).replace(/\.?0+$/, "");
  return s === "-0" || s === "" ? "0" : s.replace("-", "−");
};
export const vec = (a: Vec, d = 2) => `[${a.map((v) => num(v, d)).join(", ")}]`;
const pct = (v: number) => `${(100 * v).toFixed(1)}%`;
const par = (v: number) => (v < 0 ? `(${num(v)})` : num(v));
const TOKENS: Record<"cat" | "run", { x: Vec; name: string }> = { cat: { x: X_CAT, name: U.route.cat }, run: { x: X_RUN, name: U.route.run } };

function Seg<T extends string | number>({ name, items, value, onPick }: { name: string; items: [T, string][]; value: T; onPick: (v: T) => void }) {
  return (
    <div className="ad-ctl ad-seg" role="group" aria-label={name}>
      <span>{name}</span>
      {items.map(([v, text]) => <button key={String(v)} type="button" className={value === v ? "on" : ""} onClick={() => onPick(v)}>{text}</button>)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 01 · One token through a four-expert layer                          */
/* ------------------------------------------------------------------ */

export function RouteScene() {
  const [step, setStep] = useState(0);
  const [tok, setTok] = useState<"cat" | "run">("cat");
  const T = U.route;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = isPortrait(w, h), { x, name } = TOKENS[tok], r = route(x, 2);
    const fs = w < 420 ? 11 : 12;
    label(ctx, `${T.token} '${name}'  x = ${vec(x)}`, PAD, 18, palette.ink, 13);
    label(ctx, T.say[step], PAD, 40, palette.muted, 11);

    const gap = 8, cols = port ? 2 : 4, cw = (w - 2 * PAD - (cols - 1) * gap) / cols, ch = 166, y0 = 58;
    for (let i = 0; i < N_EXP; i++) {
      const cx = PAD + (i % cols) * (cw + gap), cy = y0 + Math.floor(i / cols) * (ch + 10);
      const chosen = r.chosen.includes(i), dim = step >= 2 && !chosen;
      ctx.save();
      if (dim) ctx.globalAlpha = 0.38;
      rbox(ctx, cx, cy, cw, ch, 8, step >= 2 && chosen ? TINT : "#ffffff", step >= 2 && chosen ? PICK : palette.frame, step >= 2 && chosen ? 2.2 : 1);
      const lx = cx + 10;
      label(ctx, `${T.expert} ${i + 1}`, lx, cy + 16, palette.ink, 12);
      label(ctx, `${T.row} ${vec(ROUTER[i])}`, lx, cy + 36, palette.muted, 11);
      label(ctx, `${par(ROUTER[i][0])}×${num(x[0])} + ${par(ROUTER[i][1])}×${num(x[1])}`, lx, cy + 56, palette.ink, fs);
      label(ctx, `= ${num(r.logits[i])}`, lx, cy + 76, palette.ink, 13);
      if (step >= 1) {
        bar(ctx, lx, cy + 92, cw - 20, 9, r.shares[i], SHARE);
        label(ctx, `${T.share} ${pct(r.shares[i])}`, lx, cy + 112, SHARE, fs);
      }
      if (step >= 2 && !chosen) label(ctx, T.skipped, lx, cy + 136, BAD, fs);
      if (step >= 3 && chosen) {
        label(ctx, `E${i + 1}(x) = ${vec(r.outs[i])}`, lx, cy + 134, PICK, fs);
        label(ctx, `${T.renorm} ${pct(r.weights[i])}`, lx, cy + 152, PICK, 11);
      } else if (step === 2 && chosen) label(ctx, T.computed, lx, cy + 136, PICK, fs);
      ctx.restore();
    }

    const by = y0 + Math.ceil(N_EXP / cols) * (ch + 10) + 14 + Math.max(0, (h - (y0 + Math.ceil(N_EXP / cols) * (ch + 10) + 110)) / 3);
    if (step === 1) label(ctx, T.sum100, PAD, by, SHARE, 12);
    if (step >= 3) {
      const [a, b] = r.chosen;
      const expr = `${r.weights[a].toFixed(3)} × ${vec(r.outs[a])} + ${r.weights[b].toFixed(3)} × ${vec(r.outs[b])}`;
      label(ctx, expr, PAD, by, PICK, w < 420 ? 11 : 12);
      label(ctx, `${T.out} = ${vec(r.y)}`, PAD, by + 26, ANSWER, 14);
    } else {
      label(ctx, `${T.out} = ?`, PAD, by + 26, palette.muted, 13);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <Seg name={T.step} items={T.steps.map((s, i) => [i, `${i + 1}. ${s}`] as [number, string])} value={step} onPick={setStep} />
        <Seg name={T.token} items={[["cat", `${T.cat} ${vec(X_CAT)}`], ["run", `${T.run} ${vec(X_RUN)}`]]} value={tok} onPick={setTok} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · Stored versus used                                              */
/* ------------------------------------------------------------------ */

const eok = (v: number) => `${Math.round(v / 1e8).toLocaleString("en-US")}${U.count.billion}`;

export function CountScene() {
  const [k, setK] = useState<1 | 2 | 4>(2);
  const [scale, setScale] = useState<"toy" | "mix">("toy");
  const T = U.count;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const g = Math.max(0, (h - 440) / 4), fs = w < 420 ? 11 : 12;
    const toy = scale === "toy", nExp = toy ? N_EXP : MIXTRAL.experts, kk = k === 4 ? nExp : k;
    const chosen = toy ? route(X_CAT, kk).chosen : Array.from({ length: kk }, (_, i) => i);
    const routerN = toy ? ROUTER.length * ROUTER[0].length : 0, expN = toy ? 4 : MIX_EXPERT * MIXTRAL.layers;
    const total = toy ? TOY_STORED : mixExperts(nExp), bw = w - 2 * PAD, sc = bw / total;
    label(ctx, toy ? `${T.toy}: ${T.router} ${routerN} + ${T.expert} ${N_EXP} × 4` : `${T.mixtral}: ${T.mixNote}`, PAD, 18, palette.ink, 12);

    const drawBar = (y: number, used: boolean) => {
      let xx = PAD;
      if (routerN > 0) {
        ctx.fillStyle = "rgba(91,100,116,0.35)";
        ctx.fillRect(xx, y, routerN * sc, 30);
        label(ctx, T.router, xx + (routerN * sc) / 2, y + 15, palette.ink, 11, "center");
        xx += routerN * sc;
      }
      for (let i = 0; i < nExp; i++) {
        const on = !used || chosen.includes(i), wSeg = expN * sc;
        if (on) { ctx.fillStyle = used ? `rgba(${palette.accentRgb},0.55)` : `rgba(${palette.accentRgb},0.22)`; ctx.fillRect(xx, y, wSeg, 30); }
        ctx.save(); ctx.strokeStyle = on ? PICK : palette.frame; ctx.lineWidth = 1; if (!on) ctx.setLineDash([3, 3]);
        ctx.strokeRect(xx + 0.5, y + 0.5, wSeg - 1, 29); ctx.restore();
        label(ctx, String(i + 1), xx + wSeg / 2, y + 15, on ? palette.ink : palette.muted, 11, "center");
        xx += wSeg;
      }
    };
    const usedN = toy ? toyComputed(kk) : mixExperts(kk);
    const y1 = 58 + g, y2 = y1 + 84 + g;
    label(ctx, T.stored, PAD, y1 - 12, palette.ink, 12);
    label(ctx, toy ? `${total}` : eok(total), w - PAD, y1 - 12, palette.ink, 12, "right");
    drawBar(y1, false);
    label(ctx, T.used, PAD, y2 - 12, PICK, 12);
    label(ctx, toy ? `${usedN}` : eok(usedN), w - PAD, y2 - 12, PICK, 12, "right");
    drawBar(y2, true);

    const yT = y2 + 64 + g;
    line(ctx, PAD, yT - 18, w - PAD, yT - 18, palette.frame, 1);
    if (toy) {
      (["cat", "run"] as const).forEach((key, j) => {
        const r = route(TOKENS[key].x, kk), dropped = 1 - r.chosen.reduce((s, i) => s + r.shares[i], 0), yy = yT + j * 70;
        label(ctx, `'${TOKENS[key].name}'`, PAD, yy, palette.ink, 12);
        label(ctx, `${T.outK} ${vec(r.y)}`, PAD, yy + 20, PICK, fs);
        label(ctx, `${T.outAll} ${vec(r.yAll)}`, PAD, yy + 40, palette.muted, fs);
        label(ctx, `${T.dropped} ${pct(dropped)}`, w - PAD, yy, palette.muted, 11, "right");
      });
    } else {
      label(ctx, `${T.perToken} ${eok(usedN)} / ${eok(total)}`, PAD, yT, PICK, 13);
      label(ctx, `${T.mem16}: ${(total * BYTES_16 / 1e9).toFixed(1)}GB`, PAD, yT + 26, palette.ink, 12);
      label(ctx, `${T.expert} 1 = 3 × ${MIXTRAL.dim} × ${MIXTRAL.hidden} × ${MIXTRAL.layers}${T.layers} = ${eok(MIX_EXPERT * MIXTRAL.layers)}`, PAD, yT + 52, palette.muted, 11);
      label(ctx, T.reported, PAD, yT + 78, palette.muted, 11);
      if (kk !== MIXTRAL.topK) label(ctx, T.mixUses, PAD, yT + 100, palette.muted, 11);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <Seg name={T.k} items={[[1, "1"], [2, "2"], [4, T.all]]} value={k} onPick={setK} />
        <Seg name={T.scale} items={[["toy", T.toy], ["mix", T.mixtral]]} value={scale} onPick={setScale} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Eight tokens, top-1, capacity and the balancing loss            */
/* ------------------------------------------------------------------ */

export function BalanceScene() {
  const [pi, setPi] = useState(0);
  const T = U.balance;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const b = balanceAt(PUSHES[pi]), g = Math.max(0, (h - 440) / 5), fs = w < 420 ? 11 : 12;
    label(ctx, `${T.token}  1 '${U.route.cat}'  2 '${U.route.run}'`, PAD, 16, palette.muted, 11);

    // the eight tokens, each with the expert it picked
    const tw = (w - 2 * PAD - 7 * 5) / 8;
    b.pick.forEach((e, i) => {
      const x = PAD + i * (tw + 5);
      rbox(ctx, x, 30, tw, 24, 5, b.kept[i] ? "#ffffff" : `rgba(${palette.anomalyRgb},0.12)`, b.kept[i] ? palette.frame : BAD, 1.2);
      label(ctx, String(i + 1), x + tw / 2, 42, palette.ink, 12, "center");
      label(ctx, `→${e + 1}`, x + tw / 2, 66, b.kept[i] ? PICK : BAD, 11, "center");
    });

    // four bins with two slots each; overflow below in red
    const gap = 10, bw = (w - 2 * PAD - 3 * gap) / 4, by = 92 + g, sh = 24;
    for (let e = 0; e < N_EXP; e++) {
      const bx = PAD + e * (bw + gap);
      const mine = b.pick.map((p, i) => [p, i] as const).filter(([p]) => p === e).map(([, i]) => i);
      label(ctx, `${T.expert} ${e + 1}`, bx + bw / 2, by, palette.ink, 12, "center");
      frame(ctx, bx, by + 10, bw, 2 * sh + 12, palette.frame, 1.2);
      label(ctx, T.slots, bx + bw - 4, by + 10 + 2 * sh + 22, palette.muted, 11, "right");
      mine.forEach((tok, j) => {
        const kept = j < 2;
        const sx = kept ? bx + 6 : bx + 4 + (j - 2) % 2 * (bw / 2), sy = kept ? by + 16 + j * sh : by + 2 * sh + 40 + Math.floor((j - 2) / 2) * 24;
        const sw = kept ? bw - 12 : bw / 2 - 8;
        rbox(ctx, sx, sy, sw, sh - 4, 5, kept ? TINT : `rgba(${palette.anomalyRgb},0.14)`, kept ? PICK : BAD, 1.2);
        label(ctx, String(tok + 1), sx + sw / 2, sy + (sh - 4) / 2, palette.ink, 12, "center");
      });
    }
    const yO = by + 2 * sh + 40 + 3 * 24 + 16;
    label(ctx, b.dropped > 0 ? `${T.dropped} ${b.dropped}${T.unit}: ${T.over}` : T.even, PAD, yO, b.dropped > 0 ? BAD : palette.muted, fs);

    // f and P per expert
    const yB = yO + 30 + g;
    for (let e = 0; e < N_EXP; e++) {
      const bx = PAD + e * (bw + gap);
      bar(ctx, bx, yB, bw, 9, b.f[e], PICK);
      label(ctx, b.f[e].toFixed(3), bx, yB + 19, PICK, 11);
      bar(ctx, bx, yB + 30, bw, 9, b.P[e], SHARE);
      label(ctx, b.P[e].toFixed(3), bx, yB + 49, SHARE, 11);
    }
    label(ctx, T.f, PAD, yB - 12, PICK, 11);
    label(ctx, T.P, w / 2, yB - 12, SHARE, 11);
    const yL = yB + 72 + g;
    label(ctx, `${T.loss} = ${b.loss.toFixed(3)}`, PAD, yL, palette.ink, 14);
    if (b.grad > 1e-9) label(ctx, T.down, PAD, yL + 24, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{T.push} <b>{num(PUSHES[pi], 1)}</b></span>
          <input type="range" min={0} max={PUSHES.length - 1} step={1} value={pi} onChange={(e) => setPi(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · MaskMoE: where one token's occurrences go                       */
/* ------------------------------------------------------------------ */

export function MaskScene() {
  const [tok, setTok] = useState<"rare" | "freq">("rare");
  const [rule, setRule] = useState<"learned" | "hash" | "mask">("learned");
  const T = U.mask;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const g = Math.max(0, (h - 440) / 5), x = tok === "rare" ? X_RARE : X_CAT;
    const occ = OCC[tok][rule], counts = countOcc(occ);
    const mask = rule === "mask" ? MASKS[tok] : [0, 0, 0, 0];
    const r = route(x, 1, [0, 0, 0, 0], mask), raw = route(x, 1);
    const fixedTo = occ[0];
    label(ctx, `${tok === "rare" ? "'삵'" : `'${U.route.cat}'`}  x = ${vec(x)}`, PAD, 16, palette.ink, 13);

    // the routing rows for this token
    const lw = w < 420 ? 50 : 62, cw = (w - 2 * PAD - lw) / 4, rh = 24;
    const rows: { name: string; vals: string[]; tone: string; on: boolean[] }[] = [];
    rows.push({ name: T.score, vals: raw.logits.map((v) => num(v)), tone: palette.ink, on: [true, true, true, true] });
    if (rule === "mask") rows.push({ name: T.maskRow, vals: mask.map((v) => num(v)), tone: palette.muted, on: mask.map((v) => v === 0) });
    if (rule === "hash") rows.push({ name: T.share, vals: [0, 1, 2, 3].map((i) => (i === fixedTo ? "100%" : "0%")), tone: SHARE, on: [0, 1, 2, 3].map((i) => i === fixedTo) });
    else rows.push({ name: T.share, vals: (rule === "mask" ? r.shares : raw.shares).map((v) => pct(v)), tone: SHARE, on: (rule === "mask" ? r.shares : raw.shares).map((v) => v > 0.001) });
    rows.forEach((row, j) => {
      const y = 34 + j * (rh + 4);
      label(ctx, row.name, PAD, y + rh / 2, row.tone, 11);
      row.vals.forEach((s, i) => {
        const x0 = PAD + lw + i * cw;
        rbox(ctx, x0 + 2, y, cw - 4, rh, 4, row.on[i] ? "#ffffff" : palette.track, palette.frame, 1);
        label(ctx, s, x0 + cw / 2, y + rh / 2, row.on[i] ? row.tone : palette.muted, 12, "center");
      });
    });
    if (rule === "hash") label(ctx, `${T.fixed}: ${fixedTo + 1}`, w - PAD, 16, palette.muted, 11, "right");

    // four expert columns with one dot per occurrence
    const yC = 34 + rows.length * (rh + 4) + 26 + g, colW = (w - 2 * PAD - 3 * 8) / 4, dr = Math.min(10, colW / 7.5);
    for (let e = 0; e < N_EXP; e++) {
      const cx = PAD + e * (colW + 8), hidden = rule === "mask" && mask[e] !== 0;
      ctx.save();
      if (hidden) ctx.globalAlpha = 0.4;
      rbox(ctx, cx, yC, colW, 128, 6, hidden ? palette.track : COOL, palette.frame, 1);
      label(ctx, `${U.route.expert} ${e + 1}`, cx + colW / 2, yC + 14, palette.ink, 11, "center");
      ctx.restore();
      const mine = occ.map((p, i) => [p, i] as const).filter(([p]) => p === e).map(([, i]) => i);
      mine.forEach((o, j) => {
        const px = cx + colW / 2 + ((j % 3) - 1) * (2.3 * dr), py = yC + 36 + Math.floor(j / 3) * (2.3 * dr);
        ctx.fillStyle = PICK;
        ctx.beginPath(); ctx.arc(px, py, dr, 0, Math.PI * 2); ctx.fill();
        label(ctx, String(o + 1), px, py + 0.5, "#ffffff", 10, "center");
      });
      label(ctx, `${counts[e]}${T.times}`, cx + colW / 2, yC + 116, counts[e] > 0 ? PICK : palette.muted, 12, "center");
    }
    const yS = yC + 128 + 28 + g;
    const people = counts.filter((c) => c > 0).length, most = Math.max(...counts);
    label(ctx, `${T.experts} ${people}${T.people}`, PAD, yS, palette.ink, 13);
    label(ctx, `${T.most} ${most}${T.times}`, w / 2, yS, palette.ink, 13);
    label(ctx, T.order, PAD, yS + 24, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <Seg name={T.token} items={[["rare", T.rare], ["freq", T.freq]]} value={tok} onPick={setTok} />
        <Seg name={T.rule} items={[["learned", T.learned], ["hash", T.hash], ["mask", T.mask]]} value={rule} onPick={setRule} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · CartesianMoE: the second group reads the first group's result   */
/* ------------------------------------------------------------------ */

export function CartScene() {
  const [kind, setKind] = useState<"flat" | "cart">("flat");
  const [swap, setSwap] = useState(false);
  const T = U.cart;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const c = cartesian(X_CAT, kind, swap ? 0 : undefined), port = isPortrait(w, h), g = Math.max(0, (h - 440) / 4);
    const fs = w < 420 ? 11 : 12;
    label(ctx, `'${U.route.cat}'  x = ${vec(X_CAT)}`, PAD, 16, palette.ink, 13);

    // main line: x, A group, h̄, plus, output. B group hangs below and feeds the plus node.
    const yM = 70 + g / 2, bh = 40;
    const wx = port ? 54 : 70, wa = port ? 74 : 96, wm = port ? 58 : 76, wy = port ? 62 : 80, plus = 22;
    const free = w - 2 * PAD - (wx + wa + wm + plus + wy), sp = free / 4;
    const xX = PAD, xA = xX + wx + sp, xM = xA + wa + sp, xP = xM + wm + sp, xY = xP + plus + sp;
    const box = (x: number, wd: number, title: string, value: string, tone: string, fill = "#ffffff") => {
      rbox(ctx, x, yM, wd, bh, 6, fill, tone, 1.5);
      label(ctx, title, x + wd / 2, yM - 10, palette.muted, 11, "center");
      label(ctx, value, x + wd / 2, yM + bh / 2, palette.ink, fs, "center");
    };
    box(xX, wx, "x", vec(X_CAT), palette.ink);
    // A group: two cells, the chosen one tinted
    label(ctx, T.groupA, xA + wa / 2, yM - 10, palette.muted, 11, "center");
    [0, 1].forEach((i) => {
      const cx = xA + i * (wa / 2);
      rbox(ctx, cx + 2, yM, wa / 2 - 4, bh, 6, c.a === i ? TINT : "#ffffff", c.a === i ? PICK : palette.frame, c.a === i ? 2 : 1);
      label(ctx, `A${i + 1}`, cx + wa / 4, yM + bh / 2, c.a === i ? palette.ink : palette.muted, 12, "center");
    });
    box(xM, wm, "h̄", vec(c.mid), palette.ink);
    ctx.save(); ctx.strokeStyle = palette.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(xP + plus / 2, yM + bh / 2, plus / 2, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    label(ctx, "+", xP + plus / 2, yM + bh / 2, palette.ink, 14, "center");
    box(xY, wy, T.out, vec(c.y), ANSWER, `rgba(15,157,106,0.08)`);
    arrow(ctx, xX + wx + 2, yM + bh / 2, xA - 3, yM + bh / 2, palette.muted);
    arrow(ctx, xA + wa + 2, yM + bh / 2, xM - 3, yM + bh / 2, palette.muted);
    arrow(ctx, xM + wm + 2, yM + bh / 2, xP - 3, yM + bh / 2, palette.muted);
    arrow(ctx, xP + plus + 2, yM + bh / 2, xY - 3, yM + bh / 2, palette.muted);
    label(ctx, `+${vec(c.aOut)}`, xA + wa / 2, yM + bh + 14, PICK, 11, "center");

    // B group below, between h̄ and the plus node
    const yB = yM + bh + 58 + g / 2, wb = port ? 84 : 100, xB = Math.min(w - PAD - wb, xP + plus / 2 - wb / 2);
    label(ctx, T.groupB, xB + wb / 2, yB + bh + 14, palette.muted, 11, "center");
    [0, 1].forEach((i) => {
      const cx = xB + i * (wb / 2);
      rbox(ctx, cx + 2, yB, wb / 2 - 4, bh, 6, c.b === i ? TINT : "#ffffff", c.b === i ? PICK : palette.frame, c.b === i ? 2 : 1);
      label(ctx, `B${i + 1}`, cx + wb / 4, yB + bh / 2, c.b === i ? palette.ink : palette.muted, 12, "center");
    });
    arrow(ctx, xP + plus / 2, yB - 2, xP + plus / 2, yM + bh + 2, PICK);
    label(ctx, `+${vec(c.bOut)}`, xP + plus / 2 + 8, yB - 22, PICK, 11);
    // what B reads: from x (flat) or from h̄ (Cartesian)
    const src = kind === "flat" ? xX + wx / 2 : xM + wm / 2, yIn = yB + bh / 2;
    ctx.save(); ctx.strokeStyle = SHARE; ctx.lineWidth = 1.8; ctx.beginPath();
    ctx.moveTo(src, yM + bh + (kind === "flat" ? 2 : 24)); ctx.lineTo(src, yIn); ctx.lineTo(xB - 4, yIn); ctx.stroke(); ctx.restore();
    arrow(ctx, xB - 14, yIn, xB - 3, yIn, SHARE, 1.8);
    label(ctx, `${T.bReads}: ${kind === "flat" ? "x" : "h̄"} = ${vec(c.bIn)}`, PAD, yB + bh + 38, SHARE, fs);

    // the four pairs
    const yT = yB + bh + 70 + g, cw2 = Math.min(110, (w - 2 * PAD - 40) / 2), rh = 30;
    label(ctx, T.combos, PAD, yT - 14, palette.ink, 12);
    [0, 1].forEach((b) => label(ctx, `B${b + 1}`, PAD + 40 + b * cw2 + cw2 / 2, yT + 2, palette.muted, 11, "center"));
    [0, 1].forEach((a) => {
      label(ctx, `A${a + 1}`, PAD + 16, yT + 22 + a * rh + rh / 2, palette.muted, 11, "center");
      [0, 1].forEach((b) => {
        const y = cartesian(X_CAT, kind, a, b).y, on = a === c.a && b === c.b;
        const x0 = PAD + 40 + b * cw2, y0 = yT + 14 + a * rh;
        rbox(ctx, x0 + 2, y0 + 2, cw2 - 4, rh - 4, 4, on ? TINT : "#ffffff", on ? PICK : palette.frame, on ? 2 : 1);
        label(ctx, vec(y), x0 + cw2 / 2, y0 + rh / 2, palette.ink, fs, "center");
      });
    });
    const xN = port ? PAD : PAD + 40 + 2 * cw2 + 24, yN = port ? yT + 14 + 2 * rh + 22 : yT + 24;
    label(ctx, T.stored, xN, yN, palette.muted, 11);
    label(ctx, T.paper, xN, yN + 20, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <Seg name={T.kind} items={[["flat", T.flat], ["cart", T.cart]]} value={kind} onPick={setKind} />
        <Seg name={T.pickA} items={[[0, T.router], [1, T.swap]]} value={swap ? 1 : 0} onPick={(v) => setSwap(v === 1)} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · DSMoE: cut a trained FFN into blocks, then gate the blocks      */
/* ------------------------------------------------------------------ */

export function DenseScene() {
  const [step, setStep] = useState(0);
  const [tok, setTok] = useState<"cat" | "run">("cat");
  const T = U.dense;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const x = TOKENS[tok].x, d = dsmoe(x), pre = matVec(FFN_W, x), g = Math.max(0, (h - 440) / 5), fs = w < 420 ? 11 : 12;
    label(ctx, `${T.token} '${TOKENS[tok].name}'  x = ${vec(x)}`, PAD, 16, palette.ink, 13);

    // four hidden units: pre-activation and after ReLU, with each unit's share of the output below
    const lw = w < 420 ? 46 : 64, cw = (w - 2 * PAD - lw) / 4, y1 = 44 + g / 2, rh = 26;
    const blockOf = (j: number) => BLOCKS.findIndex((b) => b.includes(j));
    const dim = (j: number) => step === 2 && !d.on[blockOf(j)];
    const parts = [0, 1, 2, 3].map((j) => FFN_V.map((row) => row[j] * d.hidden[j]));
    const rowsDef: [string, (j: number) => string, string][] = [
      [T.pre, (j) => num(pre[j]), palette.muted],
      [T.relu, (j) => num(d.hidden[j]), palette.ink],
      [T.col, (j) => vec(FFN_V.map((row) => row[j]), 1), palette.muted],
      ["×", (j) => vec(parts[j]), PICK],
    ];
    rowsDef.forEach(([name, val, tone], r) => {
      const y = y1 + r * (rh + 6);
      label(ctx, name, PAD, y + rh / 2, tone, 11);
      for (let j = 0; j < 4; j++) {
        ctx.save(); if (dim(j)) ctx.globalAlpha = 0.35;
        rbox(ctx, PAD + lw + j * cw + 2, y, cw - 4, rh, 4, r === 3 ? TINT : "#ffffff", palette.frame, 1);
        label(ctx, val(j), PAD + lw + j * cw + cw / 2, y + rh / 2, tone === palette.muted ? palette.ink : tone, w < 420 ? 10 : 11, "center");
        ctx.restore();
      }
    });
    // block frames
    if (step >= 1) BLOCKS.forEach((b, i) => {
      const x0 = PAD + lw + b[0] * cw, wd = b.length * cw;
      frame(ctx, x0, y1 - 6, wd, 4 * (rh + 6) + 6, i === 0 ? SHARE : palette.accent2, 1.6, dim(b[0]) ? [4, 3] : undefined);
      label(ctx, `${T.block} ${i + 1}`, x0 + wd / 2, y1 - 14, i === 0 ? SHARE : palette.accent2, 11, "center");
    });

    const yS = y1 + 4 * (rh + 6) + 26 + g;
    if (step === 0) {
      label(ctx, `${T.full} = ${vec(d.full)}`, PAD, yS, ANSWER, 14);
    } else if (step === 1) {
      label(ctx, `${T.block} 1: ${vec(d.blockOut[0])}`, PAD, yS, SHARE, fs + 1);
      label(ctx, `${T.block} 2: ${vec(d.blockOut[1])}`, w / 2, yS, palette.accent2, fs + 1);
      label(ctx, `${T.sum} = ${vec(d.blockOut[0].map((v, i) => v + d.blockOut[1][i]))}`, PAD, yS + 26, palette.ink, fs + 1);
      label(ctx, `${T.full} = ${vec(d.full)}  ${T.same}`, PAD, yS + 50, ANSWER, fs + 1);
    } else {
      // gates as bars with the threshold at 0.5
      const gw = (w - 2 * PAD - 20) / 2;
      d.gate.forEach((gv, i) => {
        const x0 = PAD + i * (gw + 20);
        label(ctx, `${T.gate} ${i + 1} = ${gv.toFixed(3)}${d.on[i] ? "" : `  ${T.off}`}`, x0, yS, d.on[i] ? (i === 0 ? SHARE : palette.accent2) : BAD, fs);
        bar(ctx, x0, yS + 12, gw, 10, gv, d.on[i] ? (i === 0 ? SHARE : palette.accent2) : palette.dotOff);
        line(ctx, x0 + gw * TAU, yS + 8, x0 + gw * TAU, yS + 26, palette.ink, 1, [3, 2]);
      });
      const kept = d.on.map((o, i) => (o ? i : -1)).filter((i) => i >= 0);
      const terms = kept.map((i) => `${d.gate[i].toFixed(3)} × ${vec(d.blockOut[i])}`).join(" + ");
      label(ctx, `${T.scaleBy} = ${BLOCKS.length} ÷ ${kept.length} = ${num(d.scaleBy)}`, PAD, yS + 46, palette.muted, 11);
      label(ctx, `${num(d.scaleBy)} × (${terms})`, PAD, yS + 68, palette.ink, w < 420 ? 10 : 11);
      label(ctx, `${T.out} = ${vec(d.y)}`, PAD, yS + 94, PICK, 14);
      label(ctx, `${T.full} = ${vec(d.full)}`, PAD, yS + 118, palette.muted, 12);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <Seg name={T.step} items={T.steps.map((s, i) => [i, `${i + 1}. ${s}`] as [number, string])} value={step} onPick={setStep} />
        <Seg name={T.token} items={[["cat", `${T.cat} ${vec(X_CAT)}`], ["run", `${T.run} ${vec(X_RUN)}`]]} value={tok} onPick={setTok} />
      </div>
    </div>
  );
}

