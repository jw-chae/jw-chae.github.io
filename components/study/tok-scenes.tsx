"use client";

import { useMemo, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, line, rbox } from "./kit";
import { tokCopy } from "./tok-copy";
import { KIND_DOT, PAD, big, desk, gridLines, hatch, isPortrait, kindNames, pc, plane, tag, tint, tintCell, tokenDot, vec } from "./tok-draw";
import {
  FULL, KEY, KIND, ORDER, PRESETS, PUBLISHED, VISUAL, TEXT, X, clsRead, dist, keptN, linearPart, mergeTo, prefill, presetCost, prune,
  quadPart, representation, totalCost, type CutMode, type Token,
} from "./tok-math";

const U = tokCopy.ui;
const GRAY = "rgba(20,24,33,0.55)", GRAY2 = "rgba(20,24,33,0.28)", BLUE2 = `rgba(${palette.normalRgb},0.55)`;

/* ------------------------------------------------------------------ */
/* 01 · The cost of one layer as tokens are removed                    */
/* ------------------------------------------------------------------ */

export function CostScene() {
  const [pi, setPi] = useState(0);
  const [keep, setKeep] = useState(50);
  const T = U.cost;
  const p = PRESETS[pi];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), fs = w < 420 ? 11 : 12;
    const f = keep / 100, n = keptN(p, f);
    const full = presetCost(p), cut = presetCost(p, n), tot = totalCost(full);
    label(ctx, `${T.names[p.key]} · ${T.tokens} ${p.N} · d = ${p.d}`, PAD, 18, palette.ink, 13);
    label(ctx, `${T.keep} ${n}`, w - PAD, 18, palette.accent, 13, "right");

    // two bars on one scale: the full layer and the layer with fewer tokens
    const bx = PAD, bw = w - 2 * PAD, bh = portrait ? 20 : 22;
    const bars: [string, typeof full, number][] = [[T.full, full, portrait ? 56 : 54], [T.cut, cut, portrait ? 112 : 104]];
    bars.forEach(([name, c, y]) => {
      label(ctx, `${name}  ${big(totalCost(c))}`, bx, y - 13, palette.muted, fs);
      ctx.fillStyle = palette.track; ctx.fillRect(bx, y, bw, bh);
      let x = bx;
      ([[c.proj, GRAY], [c.mlp, GRAY2], [c.scores, palette.normal], [c.mix, BLUE2]] as [number, string][]).forEach(([v, col]) => {
        const sw = (v / tot) * bw;
        ctx.fillStyle = col; ctx.fillRect(x, y, sw, bh); x += sw;
      });
    });
    const yR = portrait ? 150 : 140;
    label(ctx, `${T.ratio} ${pc(totalCost(cut) / tot)}`, bx, yR, palette.accent, 13);
    label(ctx, `${T.share} ${pc(quadPart(full) / tot)} · ${T.cut} ${pc(quadPart(cut) / totalCost(cut))}`, w - PAD, yR, palette.normal, fs, "right");
    // legend
    const yL = yR + 22;
    ctx.fillStyle = GRAY; ctx.fillRect(bx, yL - 5, 10, 10);
    label(ctx, `${T.perToken} ${big(linearPart(full))}`, bx + 14, yL, palette.muted, 11);
    const lx = portrait ? bx : bx + bw / 2;
    const ly = portrait ? yL + 18 : yL;
    ctx.fillStyle = palette.normal; ctx.fillRect(lx, ly - 5, 10, 10);
    label(ctx, `${T.between} ${big(quadPart(full))}`, lx + 14, ly, palette.muted, 11);

    // cost ratio against the kept share: straight line, parabola, and this model
    const cx0 = PAD + 30, cx1 = w - PAD - 6, cy0 = ly + 28, cy1 = h - 34;
    const X0 = (v: number) => cx0 + v * (cx1 - cx0), Y0 = (v: number) => cy1 - v * (cy1 - cy0);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(cx0, cy0, cx1 - cx0, cy1 - cy0);
    ctx.strokeStyle = palette.frame; ctx.strokeRect(cx0 + 0.5, cy0 + 0.5, cx1 - cx0 - 1, cy1 - cy0 - 1);
    const curve = (g: (v: number) => number, color: string, lw: number, dash?: number[]) => {
      ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      for (let k = 0; k <= 60; k++) { const v = k / 60; const yy = Y0(g(v)); if (k === 0) ctx.moveTo(X0(v), yy); else ctx.lineTo(X0(v), yy); }
      ctx.stroke(); ctx.restore();
    };
    curve((v) => v, palette.muted, 1, [4, 4]);
    curve((v) => v * v, palette.muted, 1, [2, 4]);
    curve((v) => totalCost(presetCost(p, Math.max(1e-9, p.N * v))) / tot, palette.accent, 2.2);
    label(ctx, T.linear, X0(0.56), Y0(0.56) - 12, palette.muted, 11, "right");
    label(ctx, T.square, X0(0.72), Y0(0.52) + 14, palette.muted, 11, "left");
    const r = totalCost(cut) / tot;
    ctx.fillStyle = palette.accent; ctx.beginPath(); ctx.arc(X0(f), Y0(r), 5, 0, Math.PI * 2); ctx.fill();
    line(ctx, X0(f), Y0(r), X0(f), cy1, palette.accent, 1, [3, 3]);
    label(ctx, `${T.axisX}`, (cx0 + cx1) / 2, h - 14, palette.muted, 11, "center");
    label(ctx, "0", cx0, cy1 + 10, palette.muted, 11, "center");
    label(ctx, "100%", cx1, cy1 + 10, palette.muted, 11, "right");
    label(ctx, T.axisY, PAD, cy0 + 8, palette.muted, 11);
    label(ctx, "100%", cx0 - 4, cy0 + 22, palette.muted, 11, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.model}>
          <span>{T.model}</span>
          {PRESETS.map((q, i) => <button key={q.key} type="button" className={pi === i ? "on" : ""} onClick={() => setPi(i)}>{T.names[q.key]}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{T.keep} <b>{keep}%</b></span>
          <input type="range" min={10} max={100} step={10} value={keep} onChange={(e) => setKeep(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · [CLS] shares as importance; drop the smallest                  */
/* ------------------------------------------------------------------ */

export function PruneScene() {
  const [k, setK] = useState(16);
  const T = U.prune;
  const P = useMemo(() => prune(k), [k]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const S = portrait ? 150 : Math.min(196, w * 0.36);
    const px = portrait ? (w - S) / 2 : PAD, py = 30;
    const c = S / 4;
    desk(ctx, px, py, S, KIND);
    gridLines(ctx, px, py, S);
    for (let i = 0; i < 16; i++) {
      const x = px + (i % 4) * c, y = py + Math.floor(i / 4) * c;
      if (!P.kept.includes(i)) hatch(ctx, x, y, c, c);
      tag(ctx, pc(FULL.weights[i]), x + c / 2, y + c - 9, palette.normal, 11);
    }
    label(ctx, `${T.self} ${pc(FULL.self)}`, px, py - 14, palette.accent, 11);

    // the shares sorted, kept ones in blue, a rule where the cut falls
    const lx = portrait ? PAD : px + S + 22, lx1 = w - PAD;
    const ly0 = portrait ? py + S + 30 : py + 4, textH = 78, rh = Math.min(18, (h - ly0 - textH - 20) / 16);
    label(ctx, T.shares, lx, ly0 - 4, palette.muted, 11);
    const nameW = 54, barX = lx + nameW, barW = lx1 - barX - 50, max = FULL.weights[ORDER[0]];
    ORDER.forEach((j, r) => {
      const y = ly0 + 12 + r * rh, keptRow = r < k;
      label(ctx, T.names[KIND[j]], lx, y + rh / 2, keptRow ? palette.ink : palette.muted, 11);
      ctx.fillStyle = palette.track; ctx.fillRect(barX, y + 3, barW, rh - 6);
      ctx.fillStyle = keptRow ? palette.normal : "rgba(20,24,33,0.22)"; ctx.fillRect(barX, y + 3, Math.max(2, (FULL.weights[j] / max) * barW), rh - 6);
      label(ctx, pc(FULL.weights[j]), lx1, y + rh / 2, keptRow ? palette.normal : palette.muted, 11, "right");
    });
    const yCut = ly0 + 12 + k * rh;
    if (k < 16) line(ctx, lx, yCut, lx1, yCut, palette.accent, 1.5, [4, 3]);

    // what [CLS] reads with everything, and with what is left
    const yT = h - textH + 6;
    line(ctx, PAD, yT - 14, w - PAD, yT - 14, palette.frame, 1);
    const keyKept = P.kept.includes(KEY);
    label(ctx, `${T.dropped} ${pc(P.droppedShare)}`, PAD, yT, palette.ink, 12);
    label(ctx, `${T.key}: ${keyKept ? T.kept : T.gone}`, w - PAD, yT, keyKept ? palette.mint : palette.anomaly, 12, "right");
    label(ctx, `${T.full} ${vec(FULL.read)}`, PAD, yT + 22, palette.muted, 12);
    label(ctx, `${T.now} ${vec(P.read.read)}`, PAD, yT + 44, palette.normal, 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{T.keep} <b>{k}</b></span>
          <input type="range" min={1} max={16} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Same budget, prune or merge: what each keeps and loses         */
/* ------------------------------------------------------------------ */

type Method = "prune" | "merge";

export function MergeScene() {
  const [method, setMethod] = useState<Method>("merge");
  const [k, setK] = useState(16);
  const T = U.merge;
  const tokens: Token[] = useMemo(() => (method === "prune" ? prune(k).tokens : mergeTo(k)), [method, k]);
  const read = useMemo(() => clsRead(tokens).read, [tokens]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const S = portrait ? 140 : Math.min(190, w * 0.34);
    const px = PAD, py = 28, c = S / 4;
    // groups of two or more patches get a tint; the same tint marks their circle in the plane
    const groups = tokens.filter((t) => t.s > 1);
    const tintOf = (t: Token) => groups.indexOf(t);
    desk(ctx, px, py, S, KIND);
    for (let i = 0; i < 16; i++) {
      const x = px + (i % 4) * c, y = py + Math.floor(i / 4) * c, rep = representation(tokens, i);
      if (!rep.token) { hatch(ctx, x, y, c, c); continue; }
      if (rep.token.s > 1) tintCell(ctx, x, y, c, tintOf(rep.token));
    }
    gridLines(ctx, px, py, S);
    for (let i = 0; i < 16; i++) {
      const rep = representation(tokens, i);
      if (rep.err !== null && rep.err > 0.5) {
        ctx.save(); ctx.strokeStyle = palette.anomaly; ctx.lineWidth = 3; ctx.strokeRect(px + (i % 4) * c + 2, py + Math.floor(i / 4) * c + 2, c - 4, c - 4); ctx.restore();
      }
    }
    label(ctx, `${T.tokens} ${tokens.length}`, px, py - 13, palette.accent, 12);

    // the plane: faint dots are the 16 patches, circles are the tokens left
    const qx = portrait ? PAD : px + S + 20, qy = portrait ? py + S + 26 : py, qw = w - PAD - qx, qh = portrait ? Math.min(190, h - (py + S + 26) - 130) : h - py - 100;
    label(ctx, T.plane, qx, qy - 13, palette.muted, 11);
    const at = plane(ctx, qx, qy, qw, qh, [-1.6, 2.7], [-1.5, 2.0]);
    X.forEach((v, i) => { const [x, y] = at(v); ctx.fillStyle = KIND_DOT[KIND[i]]; ctx.globalAlpha = 0.45; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; });
    tokens.forEach((t) => {
      const [x, y] = at(t.v);
      if (t.s > 1) t.members.forEach((m) => { const [mx, my] = at(X[m]); line(ctx, mx, my, x, y, `rgba(${palette.inkRgb},0.18)`, 1); });
    });
    // s is written inside a circle only when no other circle overlaps it
    const pts = tokens.map((t) => { const [x, y] = at(t.v); return { x, y, r: 6 + 2 * Math.sqrt(t.s) }; });
    tokens.forEach((t, i) => {
      const clear = pts.every((q, j) => j === i || Math.hypot(q.x - pts[i].x, q.y - pts[i].y) > q.r + pts[i].r);
      tokenDot(ctx, pts[i].x, pts[i].y, t.s, t.s > 1 ? tint(tintOf(t), 0.5) : "#ffffff", t.members.some((m) => dist(t.v, X[m]) > 0.5), clear);
    });
    kindNames(ctx, at, U.prune.names);

    // legend for the picture
    const legY = portrait ? qy + qh + 22 : py + S + 26;
    [T.legendTint, T.legendHatch, T.legendRed].forEach((t, i) => label(ctx, t, PAD, legY + i * 18, i === 2 ? palette.anomaly : palette.muted, 11));

    // what [CLS] reads now, and what became of the key
    const narrow = w < 420, yT = narrow ? h - 66 : h - 50;
    line(ctx, PAD, yT - 16, w - PAD, yT - 16, palette.frame, 1);
    if (narrow) {
      label(ctx, `${T.read}: ${T.orig} ${vec(FULL.read)}`, PAD, yT, palette.normal, 11);
      label(ctx, `${T.now} ${vec(read)}`, w - PAD, yT + 20, palette.normal, 11, "right");
    } else label(ctx, `${T.read}: ${T.orig} ${vec(FULL.read)} · ${T.now} ${vec(read)}`, PAD, yT, palette.normal, 12);
    const rep = representation(tokens, KEY);
    const keyText = !rep.token ? T.gone : rep.err !== null && rep.err > 0.5 ? `${T.buried} · ${rep.err.toFixed(2)}` : T.same;
    const keyColor = !rep.token || (rep.err ?? 0) > 0.5 ? palette.anomaly : palette.mint;
    label(ctx, `${T.gap} ${dist(read, FULL.read).toFixed(2)}`, PAD, narrow ? yT + 20 : yT + 22, palette.muted, 12);
    label(ctx, `${T.key}: ${keyText}`, w - PAD, narrow ? yT + 42 : yT + 22, keyColor, 12, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.method}>
          <span>{T.method}</span>
          <button type="button" className={method === "prune" ? "on" : ""} onClick={() => setMethod("prune")}>{T.prune}</button>
          <button type="button" className={method === "merge" ? "on" : ""} onClick={() => setMethod("merge")}>{T.merge}</button>
        </div>
        <label className="ad-ctl">
          <span>{T.keep} <b>{k}</b></span>
          <input type="range" min={2} max={16} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · Where an MLLM cuts: inside the LLM (FastV) or before it         */
/* ------------------------------------------------------------------ */

const KEEPS = [256, 128, 64];

export function VtcScene() {
  const [mode, setMode] = useState<CutMode>("none");
  const [keep, setKeep] = useState(64);
  const T = U.vtc;
  const now = prefill(mode, keep), ref0 = prefill("none", keep);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const narrow = w < 420, fs = narrow ? 11 : 12;
    // the path from the picture to the LLM, with the number of tokens through each box
    const boxes: [string, string][] = [
      [T.photo, "336²"],
      [T.vit, `${VISUAL + 1}`],
      [T.early, `${mode === "cls" ? keep : VISUAL} + ${TEXT}`],
      [T.late, `${mode === "none" ? VISUAL : keep} + ${TEXT}`],
    ];
    const gap = narrow ? 12 : 22, bw = (w - 2 * PAD - 3 * gap) / 4, by = 30, bh = 50;
    boxes.forEach(([name, count], i) => {
      const x = PAD + i * (bw + gap);
      const reduced = (i === 2 && mode === "cls") || (i === 3 && mode !== "none");
      rbox(ctx, x, by, bw, bh, 8, i === 1 ? "rgba(20,24,33,0.06)" : i === 2 ? `rgba(${palette.normalRgb},0.08)` : i === 3 ? `rgba(${palette.accentRgb},0.08)` : "#ffffff", palette.frame, 1.2);
      label(ctx, name, x + bw / 2, by + 16, palette.ink, 11, "center");
      label(ctx, count, x + bw / 2, by + 35, reduced ? palette.accent : palette.muted, fs, "center");
      if (i < 3) arrow(ctx, x + bw + 2, by + bh / 2, x + bw + gap - 2, by + bh / 2, palette.muted, 1.3);
    });
    const cutAt = mode === "cls" ? 2 : mode === "fastv" ? 3 : -1;
    if (cutAt > 0) {
      const xc = PAD + cutAt * (bw + gap) - gap / 2;
      line(ctx, xc, by - 10, xc, by + bh + 10, palette.accent, 2.5, [5, 3]);
      label(ctx, `${keep}`, xc, by - 18, palette.accent, 12, "center");
    }

    // multiply-adds before the first answer token for the three places to cut, on one scale; the chosen one is solid
    const bx = PAD, bW = w - 2 * PAD, bH = 18, scale = bW / ref0.total, y0 = by + bh + 48, rowS = narrow ? 64 : 52;
    label(ctx, T.macs, bx, y0 - 22, palette.muted, 11);
    (["none", "fastv", "cls"] as CutMode[]).forEach((m, i) => {
      const p = prefill(m, keep), y = y0 + i * rowS, on = m === mode;
      label(ctx, m === "none" ? T.none : `${T[m]} · ${keep}`, bx, y, on ? palette.ink : palette.muted, 11);
      label(ctx, `${(p.total / 1e12).toFixed(2)}${T.trillion} · ${pc(p.total / ref0.total)}`, w - PAD, y, on ? palette.accent : palette.muted, on ? fs : 11, "right");
      ctx.save(); ctx.globalAlpha = on ? 1 : 0.3;
      let x = bx;
      ([[p.enc, GRAY], [p.early, palette.normal], [p.late, palette.accent]] as [number, string][]).forEach(([v, col]) => { ctx.fillStyle = col; ctx.fillRect(x, y + 10, v * scale, bH); x += v * scale; });
      ctx.restore();
      if (on) { ctx.save(); ctx.strokeStyle = palette.ink; ctx.lineWidth = 1.2; ctx.strokeRect(bx + 0.5, y + 10.5, p.total * scale - 1, bH - 1); ctx.restore(); }
    });
    const yl = y0 + 3 * rowS + 2;
    ([[T.vit, GRAY, now.enc], [T.early, palette.normal, now.early], [T.late, palette.accent, now.late]] as [string, string, number][]).forEach(([name, col, v], i) => {
      const y = yl + i * (narrow ? 22 : 18);
      ctx.fillStyle = col; ctx.fillRect(bx, y - 5, 10, 10);
      label(ctx, name, bx + 16, y, palette.muted, 11);
      label(ctx, `${(v / 1e12).toFixed(2)}${T.trillion}`, bx + (narrow ? 150 : 190), y, palette.ink, 11, "right");
    });

    // what the paper reported at this setting
    const yP = h - 26;
    line(ctx, PAD, yP - 18, w - PAD, yP - 18, palette.frame, 1);
    const score = mode === "none" ? PUBLISHED.vtc.base : PUBLISHED.vtc.avg[keep][mode === "fastv" ? "fastv" : "cls"];
    label(ctx, `${T.reported} ${score.toFixed(1)}`, PAD, yP, mode === "none" ? palette.ink : palette.mint, 12);
    label(ctx, `${T.base} ${PUBLISHED.vtc.base.toFixed(1)}`, w - PAD, yP, palette.muted, 11, "right");
    const secs = (PUBLISHED.vtc.gqaTime as Record<number, number>)[keep];
    if (mode === "cls" && secs) label(ctx, `${T.time} ${PUBLISHED.vtc.gqaTime.base}${T.sec} · ${keep}${U.tempme.count} ${secs}${T.sec}`, PAD, yP - 34, palette.mint, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.cut}>
          <span>{T.cut}</span>
          {(["none", "fastv", "cls"] as CutMode[]).map((m) => <button key={m} type="button" className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{T[m]}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.keep}>
          <span>{T.keep}</span>
          {KEEPS.map((v) => <button key={v} type="button" className={keep === v ? "on" : ""} onClick={() => setKeep(v)}>{v}</button>)}
        </div>
      </div>
    </div>
  );
}

