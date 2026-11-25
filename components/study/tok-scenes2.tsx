"use client";

import { useMemo, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { frame, line, rbox } from "./kit";
import { tokCopy } from "./tok-copy";
import {
  KIND_DOT, PAD, PLANE_X, PLANE_Y, axisNames, catCrop, isPortrait, kindNames, num, pc, plane, tint, tintCell, tokenDot, useCatImage, vec,
} from "./tok-draw";
import {
  ANSWER, CLOSE_AT, EYE, FAR, FRAMES, IMPORTANCE, KIND, KV_BYTES_PER_TOKEN, PROMPT, STILL, TOY_LAYERS, TRANS, acrossFrames, closedAnchor, dist,
  dyseg, fixedSeg, frameKinds, keptImportance, passes, perFrame, prefixKV, sameRatio, stillVec, worstErr, type Token,
} from "./tok-math";

const U = tokCopy.ui;
const NAMES = U.prune.names;
const closedAt = (f: number) => f >= CLOSE_AT;

/* ------------------------------------------------------------------ */
/* 05 · FastVID: cut where neighbouring frames stop looking alike      */
/* ------------------------------------------------------------------ */

const SEGS = { dyseg: dyseg(), fixed: fixedSeg(4) };
type SegMode = keyof typeof SEGS;

export function FastVidScene() {
  const [mode, setMode] = useState<SegMode>("dyseg");
  const T = U.fastvid;
  const segs = SEGS[mode];
  const img = useCatImage();

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), gap = portrait ? 4 : 10;
    const fw = Math.min(80, (w - 2 * PAD - 5 * gap) / 6), x0 = (w - (6 * fw + 5 * gap)) / 2, yF = 34;
    const fx = (f: number) => x0 + f * (fw + gap);
    const anchors = segs.map((s) => s[0]);
    FRAMES.forEach((_, f) => {
      catCrop(ctx, img.current, fx(f), yF, fw, closedAt(f));
      frame(ctx, fx(f), yF, fw, fw, anchors.includes(f) ? palette.accent : palette.frame, anchors.includes(f) ? 3 : 1);
      label(ctx, `${f + 1}${U.tempme.frame}`, fx(f) + fw / 2, yF - 12, anchors.includes(f) ? palette.accent : palette.muted, 11, "center");
    });
    // similarity of each frame with the next; the lowest one is red
    const yS = yF + fw + 16, low = Math.min(...TRANS);
    TRANS.forEach((t, i) => label(ctx, t.toFixed(3), fx(i + 1) - gap / 2, yS, t === low ? palette.anomaly : palette.muted, 11, "center"));
    label(ctx, T.sim, PAD, yS + 20, palette.muted, 11);
    label(ctx, T.lowest, w - PAD, yS + 20, palette.anomaly, 11, "right");
    // the segments
    const yB = yS + 36;
    segs.forEach((s, i) => {
      const xa = fx(s[0]), xb = fx(s[s.length - 1]) + fw;
      rbox(ctx, xa, yB, xb - xa, 20, 6, tint(i, 0.22), tint(i, 0.9), 1.2);
      label(ctx, `${T.seg} ${i + 1}`, (xa + xb) / 2, yB + 10.5, palette.ink, 11, "center");
    });
    label(ctx, `${T.anchor}: ${anchors.map((f) => `${f + 1}${U.tempme.frame}`).join(", ")}`, w - PAD, yB + 36, palette.accent, 11, "right");

    // where the closed eye of frame 4 went
    const { anchor: a, own } = closedAnchor(segs);
    const before = FRAMES[a.frame][a.patch], after = a.v, gapClosed = dist(after, FRAMES[CLOSE_AT][EYE]);
    const yP = yB + 62, Z = portrait ? 92 : 84, Z2 = portrait ? 92 : Z * 0.75;
    line(ctx, PAD, yP - 12, w - PAD, yP - 12, palette.frame, 1);
    label(ctx, T.closed, PAD, yP + 4, palette.ink, 12);
    catCrop(ctx, img.current, PAD, yP + 18, Z, true, EYE);
    frame(ctx, PAD, yP + 18, Z, Z, palette.frame, 1);
    const jx = portrait ? w - PAD - Z2 : PAD + Z + 16, jy = portrait ? yP + 18 : yP + 40;
    label(ctx, `${T.joined}`, jx, jy - 10, palette.muted, 11);
    catCrop(ctx, img.current, jx, jy, Z2, closedAt(a.frame), a.patch);
    frame(ctx, jx, jy, Z2, Z2, palette.frame, 1);
    if (portrait) line(ctx, PAD + Z + 8, yP + 18 + Z / 2, jx - 8, jy + Z2 / 2, palette.muted, 1, [3, 3]);
    const tx = portrait ? PAD : PAD + Z + 16 + Z2 + 14, ty = portrait ? yP + Z + 46 : yP + 46, gl = portrait ? 22 : 18;
    const bad = gapClosed > FAR;
    const whose = `${a.frame + 1}${U.tempme.frame} ${NAMES[frameKinds(a.frame)[a.patch]]} ${T.anchorTok}`;
    label(ctx, own ? T.own : whose, tx, ty, bad ? palette.anomaly : palette.mint, 12);
    label(ctx, `${T.before} ${vec(before)}`, tx, ty + gl, palette.muted, 11);
    label(ctx, `${T.after} ${vec(after)}`, tx, ty + 2 * gl, palette.ink, 11);
    label(ctx, `${T.fromClosed} ${gapClosed.toFixed(2)}`, tx, ty + 3 * gl, bad ? palette.anomaly : palette.mint, 12);
    label(ctx, `${T.kept} ${segs.length * 16} · ${T.per}`, PAD, portrait ? ty + 4 * gl + 18 : h - 16, palette.accent, 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.mode}>
          <span>{T.mode}</span>
          <button type="button" className={mode === "dyseg" ? "on" : ""} onClick={() => setMode("dyseg")}>{T.dyseg}</button>
          <button type="button" className={mode === "fixed" ? "on" : ""} onClick={() => setMode("fixed")}>{T.fixed}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · TempMe: merge inside each frame, or across frames too          */
/* ------------------------------------------------------------------ */

type Scope = "within" | "across";
const TM_KEEPS = [32, 16, 8];

export function TempMeScene() {
  const [scope, setScope] = useState<Scope>("within");
  const [keep, setKeep] = useState(32);
  const T = U.tempme;
  const tokens: Token[] = useMemo(() => (scope === "within" ? perFrame(keep) : acrossFrames(keep)), [scope, keep]);
  const img = useCatImage();

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), gap = portrait ? 6 : 14;
    const fw = Math.min(110, (w - 2 * PAD - 3 * gap) / 4), x0 = (w - (4 * fw + 3 * gap)) / 2, yF = 30, c = fw / 4;
    const groups = tokens.filter((t) => t.s > 1);
    const owner = (m: number) => tokens.find((t) => t.members.includes(m))!;
    STILL.forEach((_, f) => {
      const x = x0 + f * (fw + gap);
      catCrop(ctx, img.current, x, yF, fw);
      for (let p = 0; p < 16; p++) {
        const t = owner(f * 16 + p), cx = x + (p % 4) * c, cy = yF + Math.floor(p / 4) * c;
        if (t.s > 1) tintCell(ctx, cx, cy, c, groups.indexOf(t));
        if (dist(t.v, stillVec(f * 16 + p)) > FAR) { ctx.save(); ctx.strokeStyle = palette.anomaly; ctx.lineWidth = 2.5; ctx.strokeRect(cx + 1.5, cy + 1.5, c - 3, c - 3); ctx.restore(); }
      }
      frame(ctx, x, yF, fw, fw, palette.frame, 1);
      label(ctx, `${f + 1}${T.frame}`, x + fw / 2, yF - 12, palette.muted, 11, "center");
    });

    // the plane: 64 faint dots, one circle per token left
    const qy = yF + fw + 34, qh = h - qy - 76;
    label(ctx, T.plane, PAD, qy - 12, palette.muted, 11);
    const at = plane(ctx, PAD, qy, w - 2 * PAD, qh, PLANE_X, PLANE_Y);
    axisNames(ctx, at, U.merge.axisX, U.merge.axisY);
    STILL.forEach((fr) => fr.forEach((v, p) => { const [x, y] = at(v); ctx.fillStyle = KIND_DOT[KIND[p]]; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }));
    // tokens that sit on top of each other (the same thing in four frames) are labelled once, as s × count
    // labels are drawn only where they do not collide with another circle
    const stacks: { v: number[]; n: number; s: number; x: number; y: number; r: number }[] = [];
    tokens.forEach((t) => {
      const [x, y] = at(t.v), near = stacks.find((q) => dist(q.v, t.v) < 0.09 && q.s === t.s);
      const r = tokenDot(ctx, x, y, t.s, t.s > 1 ? tint(groups.indexOf(t), 0.5) : "#ffffff", t.members.some((m) => dist(t.v, stillVec(m)) > FAR), false);
      if (near) near.n += 1; else stacks.push({ v: t.v, n: 1, s: t.s, x, y, r });
    });
    stacks.forEach((q, i) => {
      const clear = stacks.every((o, j) => j === i || Math.hypot(o.x - q.x, o.y - q.y) > o.r + q.r);
      if (q.n > 1 && clear) label(ctx, `${q.s}×${q.n}`, q.x + q.r + 4, q.y, palette.ink, 11);
      else if (q.s > 1 && clear) label(ctx, `${q.s}`, q.x, q.y + 0.5, palette.ink, 11, "center");
    });
    kindNames(ctx, at, NAMES);

    // what the tokens left are made of, by kind
    const comp = new Map<string, number>();
    tokens.forEach((t) => { const k = [...new Set(t.members.map((m) => NAMES[KIND[m % 16]]))].join("+"); comp.set(k, (comp.get(k) ?? 0) + 1); });
    label(ctx, [...comp].map(([k, n]) => `${k} ${n}${T.count}`).join(" · "), PAD, h - 48, palette.ink, 11);
    const worst = worstErr(tokens);
    label(ctx, `${T.keep} ${tokens.length}`, PAD, h - 22, palette.accent, 13);
    label(ctx, `${T.worst} ${worst.toFixed(2)}`, w - PAD, h - 22, worst > FAR ? palette.anomaly : palette.mint, 12, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.scope}>
          <span>{T.scope}</span>
          <button type="button" className={scope === "within" ? "on" : ""} onClick={() => setScope("within")}>{T.within}</button>
          <button type="button" className={scope === "across" ? "on" : ""} onClick={() => setScope("across")}>{T.across}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.keep}>
          <span>{T.keep}</span>
          {TM_KEEPS.map((v) => <button key={v} type="button" className={keep === v ? "on" : ""} onClick={() => setKeep(v)}>{v}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · The KV cache while the answer is written                       */
/* ------------------------------------------------------------------ */

const sumPasses = (step: number, cache: boolean) => Array.from({ length: step + 1 }, (_, s) => passes(s, cache)).reduce((a, b) => a + b, 0);

export function KvScene() {
  const [step, setStep] = useState(0);
  const [cache, setCache] = useState(true);
  const T = U.kv;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), cols = PROMPT + ANSWER, labelW = 32;
    const cw = (w - 2 * PAD - labelW) / cols, ch = portrait ? 32 : 28, gx = PAD + labelW, gy = 30;
    const present = (col: number) => col < PROMPT + step;
    const computed = (col: number) => (!present(col) ? false : !cache ? true : step === 0 ? col < PROMPT : col === PROMPT + step - 1);
    for (let r = 0; r < TOY_LAYERS; r++) {
      label(ctx, `${r + 1}${T.layer}`, PAD, gy + r * ch + ch / 2, palette.muted, 11);
      for (let col = 0; col < cols; col++) {
        const x = gx + col * cw, y = gy + r * ch;
        ctx.fillStyle = computed(col) ? `rgba(${palette.accentRgb},0.78)` : present(col) ? `rgba(${palette.normalRgb},0.42)` : palette.track;
        ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      }
    }
    // which columns are image, question, answer
    const yG = gy + TOY_LAYERS * ch + 14;
    const span = (a: number, b: number, text: string) => {
      line(ctx, gx + a * cw + 2, yG - 6, gx + b * cw - 2, yG - 6, palette.frame, 1);
      label(ctx, text, gx + ((a + b) / 2) * cw, yG + 6, palette.muted, 11, "center");
    };
    span(0, 16, T.image); span(16, 20, portrait ? T.questionShort : T.question);
    for (let s = 1; s <= ANSWER; s++) label(ctx, `${s}`, gx + (PROMPT + s - 0.5) * cw, yG + 6, s <= step ? palette.accent : palette.muted, 11, "center");
    label(ctx, T.answer, gx + (PROMPT + ANSWER / 2) * cw, yG + 24, palette.muted, 11, "center");

    // legend
    const yL = yG + 48;
    ctx.fillStyle = `rgba(${palette.accentRgb},0.78)`; ctx.fillRect(PAD, yL - 6, 12, 12);
    label(ctx, T.computed, PAD + 18, yL, palette.muted, 11);
    const lx = portrait ? PAD : PAD + 150;
    const ly = portrait ? yL + 20 : yL;
    ctx.fillStyle = `rgba(${palette.normalRgb},0.42)`; ctx.fillRect(lx, ly - 6, 12, 12);
    label(ctx, T.reused, lx + 18, ly, palette.muted, 11);

    // counts for this mode, and the other mode for comparison
    const yN = ly + 34;
    line(ctx, PAD, yN - 14, w - PAD, yN - 14, palette.frame, 1);
    label(ctx, `${T.now} ${passes(step, cache)}`, PAD, yN, palette.accent, 12);
    label(ctx, `${T.sum} ${sumPasses(step, cache)}`, w - PAD, yN, palette.ink, 12, "right");
    label(ctx, `${T.cache} ${T.off} ${sumPasses(step, false)} · ${T.cache} ${T.on} ${sumPasses(step, true)}`, PAD, yN + 22, palette.muted, 11);
    const cells = cache ? (PROMPT + step) * TOY_LAYERS : 0;
    label(ctx, `${T.cells} ${cells}`, w - PAD, yN + 22, palette.normal, 11, "right");
    const n = PROMPT + step, mb = (n * KV_BYTES_PER_TOKEN) / 2 ** 20;
    label(ctx, `${T.real}: ${n} × 512KB = ${mb.toFixed(1)}MB`, PAD, yN + 46, palette.muted, 11);

    // passes so far against the step, with and without the cache
    const c0 = yN + 72, c1 = h - 22, gx0 = PAD + 26, gx1 = w - PAD - 34, top = sumPasses(ANSWER, false);
    if (c1 - c0 > 50) {
      const X0 = (s: number) => gx0 + (s / ANSWER) * (gx1 - gx0), Y0 = (v: number) => c1 - (v / top) * (c1 - c0);
      ctx.fillStyle = "#ffffff"; ctx.fillRect(gx0, c0, gx1 - gx0, c1 - c0);
      ctx.strokeStyle = palette.frame; ctx.strokeRect(gx0 + 0.5, c0 + 0.5, gx1 - gx0 - 1, c1 - c0 - 1);
      ([[false, "rgba(20,24,33,0.55)"], [true, palette.accent]] as [boolean, string][]).forEach(([on, col]) => {
        ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = on === cache ? 2.4 : 1.2; ctx.beginPath();
        for (let s = 0; s <= ANSWER; s++) { const y = Y0(sumPasses(s, on)); if (s === 0) ctx.moveTo(X0(s), y); else ctx.lineTo(X0(s), y); }
        ctx.stroke(); ctx.restore();
        label(ctx, `${sumPasses(ANSWER, on)}`, gx1 + 4, Y0(sumPasses(ANSWER, on)), col, 11);
      });
      line(ctx, X0(step), c0, X0(step), c1, palette.normal, 1, [3, 3]);
      label(ctx, T.sum, gx0 + 6, c0 + 10, palette.muted, 11);
      label(ctx, "0", X0(0), c1 + 10, palette.muted, 11, "center");
      label(ctx, `${ANSWER}`, X0(ANSWER), c1 + 10, palette.muted, 11, "center");
      label(ctx, T.step, (gx0 + gx1) / 2, c1 + 10, palette.muted, 11, "center");
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{T.step} <b>{step}</b></span>
          <input type="range" min={0} max={ANSWER} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.cache}>
          <span>{T.cache}</span>
          <button type="button" className={!cache ? "on" : ""} onClick={() => setCache(false)}>{T.off}</button>
          <button type="button" className={cache ? "on" : ""} onClick={() => setCache(true)}>{T.on}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · PrefixKV: one common threshold sets each layer's cache size    */
/* ------------------------------------------------------------------ */

type Rule = "same" | "prefix";
const BUDGETS = [0.1, 0.2, 0.3, 0.4];
const MAXI = Math.max(...IMPORTANCE.map((r) => r[0]));

export function PrefixScene() {
  const [rule, setRule] = useState<Rule>("same");
  const [budget, setBudget] = useState(0.2);
  const T = U.prefixkv;
  const search = useMemo(() => prefixKV(budget), [budget]);
  const counts = rule === "same" ? sameRatio(budget) : search.counts;
  const kept = keptImportance(counts);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), barH = portrait ? 46 : 42, rowH = barH + 34;
    const bw = (w - 2 * PAD) / PROMPT, low = Math.min(...kept);
    IMPORTANCE.forEach((row, l) => {
      const y = 22 + l * rowH;
      label(ctx, `${l + 1}${T.layer}`, PAD, y, palette.ink, 12);
      label(ctx, `${counts[l]}${T.cells} · ${T.sum} ${pc(kept[l])}`, w - PAD, y, kept[l] === low ? palette.anomaly : palette.normal, 12, "right");
      row.forEach((v, j) => {
        const x = PAD + j * bw, hh = Math.max(2, (v / MAXI) * barH);
        ctx.fillStyle = palette.track; ctx.fillRect(x + 1, y + 12, bw - 2, barH);
        ctx.fillStyle = j < counts[l] ? palette.normal : "rgba(20,24,33,0.22)";
        ctx.fillRect(x + 1, y + 12 + barH - hh, bw - 2, hh);
      });
    });
    const yB = 22 + 4 * rowH + 4;
    line(ctx, PAD, yB - 12, w - PAD, yB - 12, palette.frame, 1);
    label(ctx, `${T.min} ${pc(low)}`, PAD, yB + 4, palette.anomaly, 12);
    label(ctx, `${T.budget} ${Math.round(budget * 100)}% · ${counts.reduce((a, b) => a + b, 0)}${T.cells}`, w - PAD, yB + 4, palette.muted, 11, "right");
    if (rule === "same") {
      label(ctx, `${T.each} ${counts[0]}${T.cells}`, PAD, yB + 28, palette.muted, 11);
    } else {
      const per = portrait ? 2 : 3;
      const items = search.trail.slice(0, portrait ? 6 : 9).map((t) => `p ${num(t.p, 4)} ${t.total}${T.cells} ${t.total <= Math.round(budget * PROMPT * TOY_LAYERS) ? T.fits : T.over}`);
      label(ctx, T.search, PAD, yB + 28, palette.muted, 11);
      items.forEach((s, i) => label(ctx, s, PAD + (i % per) * ((w - 2 * PAD) / per), yB + 48 + Math.floor(i / per) * 18, palette.ink, 11));
      label(ctx, `p = ${search.p.toFixed(3)}`, w - PAD, yB + 28, palette.accent, 12, "right");
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.mode}>
          <span>{T.mode}</span>
          <button type="button" className={rule === "same" ? "on" : ""} onClick={() => setRule("same")}>{T.same}</button>
          <button type="button" className={rule === "prefix" ? "on" : ""} onClick={() => setRule("prefix")}>{T.prefix}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.budget}>
          <span>{T.budget}</span>
          {BUDGETS.map((b) => <button key={b} type="button" className={budget === b ? "on" : ""} onClick={() => setBudget(b)}>{Math.round(b * 100)}%</button>)}
        </div>
      </div>
    </div>
  );
}
