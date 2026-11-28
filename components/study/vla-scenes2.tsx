"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { rbox, type Ctx } from "./kit";
import { vlaCopy } from "./vla-copy";
import {
  BRANCH, FLOWS, FLOW_STEPS, GAMMAS, MEAN_RUN, METHODS, MU_MEAN, MU_OVER, MU_UNDER, NAIVE_DIFF, NAIVE_TOK, OVER, SIG, SIG_DCT,
  chunkPath, fastQuant, firstHit, positions, type P,
} from "./vla-math";
import { BAD, GT, OUT, PAD, READ, cross, dot, drawGripper, drawPath, drawTable, fitLabel, fix, tableLayout, type TLay } from "./vla-draw";

const U = vlaCopy.ui;

function panel(ctx: Ctx, L: TLay) {
  let y = L.py;
  const fs = L.pw < 330 ? 11.5 : 12;
  return (s: string, color: string = palette.ink, size = fs, dy = 20) => { fitLabel(ctx, s, L.px, y, L.pw, color, size); y += dy; };
}

/* ------------------------------------------------------------------ */
/* 05 · Flow matching: a chunk of noise flows into one way around       */
/* ------------------------------------------------------------------ */

export function FlowScene() {
  const [si, setSi] = useState(0);
  const [j, setJ] = useState(0);
  const [view, setView] = useState(0);
  const T = U.flow;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = tableLayout(w, h, 0.62);
    label(ctx, `${T.views[view]} · τ = ${fix(j / FLOW_STEPS, 1)}`, L.tx, L.ty - 12, palette.muted, 11);
    drawTable(ctx, L, { names: U.names, clear: true });
    drawPath(ctx, L, chunkPath(MU_OVER), "rgba(15,157,106,0.35)", 1.6);
    drawPath(ctx, L, chunkPath(MU_UNDER), "rgba(15,157,106,0.35)", 1.6, [6, 4]);
    const line = panel(ctx, L);
    if (view === 0) {
      const s = FLOWS[si];
      drawPath(ctx, L, chunkPath(s.xs[j]), OUT, 2.2, undefined, true);
      drawGripper(ctx, L, BRANCH, 0, palette.ink, 0.3);
      line(`τ = ${fix(j / FLOW_STEPS, 1)} · ${T.stepN} ${j} / ${FLOW_STEPS} · ${T.update}`, READ);
      if (j < FLOW_STEPS) line(`${T.wOver}: ${fix(s.w[j], 2)}`, OUT);
      else line(`${T.result}: ${s.over ? T.up : T.down} · ${firstHit(chunkPath(s.xs[j])) < 0 ? T.noHit : T.hit}`, GT);
      line(j === 0 ? T.atNoise : T.note, palette.muted, 11);
    } else if (view === 1) {
      FLOWS.forEach((s) => drawPath(ctx, L, chunkPath(s.xs[j]), `rgba(${palette.accentRgb},0.7)`, 1.6));
      drawGripper(ctx, L, BRANCH, 0, palette.ink, 0.3);
      const up = FLOWS.filter((s) => s.over).length, hits = FLOWS.filter((s) => firstHit(chunkPath(s.xs[j])) >= 0).length;
      line(`τ = ${fix(j / FLOW_STEPS, 1)} · ${T.stepN} ${j} / ${FLOW_STEPS}`, READ);
      line(j === FLOW_STEPS ? `${T.count}: ${T.up} ${up}, ${T.down} ${FLOWS.length - up} · ${T.hits} ${hits}` : T.wait, j === FLOW_STEPS ? GT : palette.muted);
      line(T.eightNote, palette.muted, 11);
    } else {
      const path = chunkPath(MU_MEAN), hit = firstHit(path);
      drawPath(ctx, L, path.slice(0, hit + 1), OUT, 2.4, undefined, true);
      cross(ctx, L, path[hit], 6);
      drawGripper(ctx, L, BRANCH, 0, palette.ink, 0.3);
      line(`${T.mean} ${hit}${T.nth}`, BAD);
      line(T.meanNote, palette.muted, 11);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.view}>
          {T.views.map((n, i) => <button key={n} type="button" className={view === i ? "on" : ""} onClick={() => setView(i)}>{n}</button>)}
        </div>
        {view === 0 ? (
          <div className="ad-ctl ad-seg" role="group" aria-label={T.noise}>
            <span>{T.noise}</span>
            {[0, 1, 2, 3].map((i) => <button key={i} type="button" className={si === i ? "on" : ""} onClick={() => setSi(i)}>{i + 1}</button>)}
          </div>
        ) : null}
        {view < 2 ? (
          <label className="ad-ctl">
            <span>{T.stepN} <b>{j}</b></span>
            <input type="range" min={0} max={FLOW_STEPS} step={1} value={j} onChange={(e) => setJ(Number(e.target.value))} />
          </label>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · FAST: one action number over eight steps, as cosine coefficients */
/* ------------------------------------------------------------------ */

export function FastScene() {
  const [view, setView] = useState(0);
  const [gi, setGi] = useState(1);
  const T = U.fast;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = h > w * 1.15, fs = w < 420 ? 11.5 : 12;
    const n = SIG.length, cx = PAD + 34, cw = (w - cx - PAD) / n, bw = Math.min(34, cw * 0.62);
    const top = 44, chartH = port ? 260 : 250, mid = view === 1 ? top + chartH * 0.55 : top + chartH;
    label(ctx, T.views[view], PAD, 18, palette.muted, 11);
    // baseline and axis label
    ctx.fillStyle = palette.frame;
    ctx.fillRect(cx - 4, mid, w - cx - PAD + 4, 1);
    const xs = (i: number) => cx + i * cw + (cw - bw) / 2;
    const fq = fastQuant(GAMMAS[gi]);
    if (view === 0 || view === 2) {
      const k = (chartH - 30) / 1.3;
      label(ctx, "Δy", PAD, top + 6, palette.muted, 11);
      SIG.forEach((v, i) => {
        if (view === 2) {
          ctx.strokeStyle = READ; ctx.lineWidth = 1.2;
          ctx.strokeRect(xs(i), mid - v * k, bw, v * k);
          const r = fq.rec[i];
          ctx.fillStyle = `rgba(${palette.accentRgb},0.7)`;
          ctx.fillRect(xs(i) + bw * 0.2, mid - r * k, bw * 0.6, r * k);
        } else {
          ctx.fillStyle = `rgba(${palette.normalRgb},0.75)`;
          ctx.fillRect(xs(i), mid - v * k, bw, v * k);
        }
        label(ctx, fix(view === 2 ? fq.rec[i] : v, 2), xs(i) + bw / 2, mid - Math.max(v, view === 2 ? fq.rec[i] : v) * k - 10, view === 2 ? OUT : READ, 11, "center");
        if (view === 0) label(ctx, String(NAIVE_TOK[i]), xs(i) + bw / 2, mid + 16, OUT, 11.5, "center");
        if (view === 0 && i > 0) label(ctx, `+${NAIVE_DIFF[i - 1]}`, xs(i) - (cw - bw) / 2, mid + 36, palette.muted, 11, "center");
      });
      if (view === 0) { label(ctx, T.tok, PAD, mid + 16, OUT, 11); label(ctx, T.diff, PAD, mid + 36, palette.muted, 11); }
      if (view === 2) fq.q.forEach((q, i) => label(ctx, String(q), xs(i) + bw / 2, mid + 16, q !== 0 ? OUT : palette.muted, 11.5, "center"));
      if (view === 2) label(ctx, T.ints, PAD, mid + 16, OUT, 11);
    } else {
      const k = (chartH * 0.5) / 2.1;
      SIG_DCT.forEach((c, i) => {
        ctx.fillStyle = c >= 0 ? `rgba(${palette.accentRgb},0.75)` : `rgba(${palette.anomalyRgb},0.6)`;
        const hh = c * k;
        ctx.fillRect(xs(i), hh >= 0 ? mid - hh : mid, bw, Math.max(1, Math.abs(hh)));
        label(ctx, fix(c, 3), xs(i) + bw / 2, hh >= 0 ? mid - hh - 10 : mid - hh + 12, palette.ink, 11, "center");
        label(ctx, `c${i}`, xs(i) + bw / 2, top + chartH + 4, palette.muted, 11, "center");
      });
    }
    let y = top + chartH + (view === 0 ? 62 : 34);
    const line = (s: string, color: string = palette.ink, size = fs, dy = 20) => { fitLabel(ctx, s, PAD, y, w - 2 * PAD, color, size); y += dy; };
    if (view === 0) {
      line(`${T.count} ${n} · ${T.copy}`, OUT);
      line(T.copyNote, palette.muted, 11);
    } else if (view === 1) {
      line(T.energy, OUT);
      line(T.formula, palette.muted, 11);
      line(T.same, palette.muted, 11);
    } else {
      line(`γ = ${GAMMAS[gi]}: ${T.nonzero} ${fq.nonzero} / ${n} · ${T.err} ${fix(fq.err, 3)}`, OUT);
      line(T.trade, palette.ink, 11.5);
      line(T.bpe, palette.muted, 11);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.view}>
          {T.views.map((n, i) => <button key={n} type="button" className={view === i ? "on" : ""} onClick={() => setView(i)}>{n}</button>)}
        </div>
        {view === 2 ? (
          <div className="ad-ctl ad-seg" role="group" aria-label={T.gamma}>
            <span>{T.gamma}</span>
            {GAMMAS.map((g, i) => <button key={g} type="button" className={gi === i ? "on" : ""} onClick={() => setGi(i)}>{g}</button>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · Four ways to write actions, side by side on the same fork       */
/* ------------------------------------------------------------------ */

const REACH = OVER.steps.findIndex((s) => s.a.g === 1);

export function ChooseScene() {
  const [mi, setMi] = useState(1);
  const T = U.choose;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = tableLayout(w, h, 0.5);
    const m = METHODS[mi];
    label(ctx, T.methods[mi], L.tx, L.ty - 12, OUT, 11.5);
    drawTable(ctx, L, { names: U.names, clear: true });
    const reach: P[] = positions(OVER).slice(0, REACH + 1);
    if (m.key === "reg") {
      drawPath(ctx, L, MEAN_RUN.path, OUT, 2.2, undefined, true);
      cross(ctx, L, MEAN_RUN.path[MEAN_RUN.path.length - 1], 6);
    } else {
      drawPath(ctx, L, reach, OUT, 2.2, undefined, m.key === "tok");
      if (m.key !== "tok") reach.forEach((q, i) => { if (i % 10 === 0) dot(ctx, L, q, 4, READ, "#ffffff", 1); });
      else reach.forEach((q) => dot(ctx, L, q, 2.6, READ));
    }
    drawGripper(ctx, L, m.key === "reg" ? MEAN_RUN.path[MEAN_RUN.path.length - 1] : reach[reach.length - 1], 0);

    // the comparison rows: every method, the chosen one highlighted
    const fs = L.pw < 330 ? 11 : 11.5;
    let y = L.py;
    label(ctx, T.head, L.px, y, palette.muted, 11);
    y += 20;
    METHODS.forEach((mm, i) => {
      const on = i === mi, two = L.port;
      if (on) rbox(ctx, L.px - 6, y - 11, L.pw + 12, two ? 42 : 22, 5, `rgba(${palette.accentRgb},0.1)`, null);
      const fork = mm.key === "reg" ? T.collide : T.oneWay;
      const cost = `${T.reads} ${mm.reads} · ${T.calls} ${mm.calls}`;
      if (two) {
        fitLabel(ctx, `${T.methods[i]} · ${fork}`, L.px, y, L.pw, on ? OUT : palette.ink, fs);
        fitLabel(ctx, cost, L.px, y + 19, L.pw, on ? READ : palette.muted, 11);
        y += 46;
      } else {
        fitLabel(ctx, `${T.methods[i]} · ${fork} · ${cost}`, L.px, y, L.pw, on ? OUT : palette.ink, fs);
        y += 24;
      }
    });
    fitLabel(ctx, T.notes[mi], L.px, y + 4, L.pw, mi === 0 ? BAD : palette.muted, 11);
    fitLabel(ctx, T.toy, L.px, y + 24, L.pw, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.method}>
          {T.methods.map((n, i) => <button key={n} type="button" className={mi === i ? "on" : ""} onClick={() => setMi(i)}>{n}</button>)}
        </div>
      </div>
    </div>
  );
}
