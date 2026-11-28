"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, frame, rbox, type Ctx } from "./kit";
import { vlaCopy } from "./vla-copy";
import {
  A_MEAN, A_OVER, A_UNDER, BINS, BIN_HI, BIN_LO, BLUE_RUN, BRANCH, BRANCH_AT, CHUNKS, HZ, LOSS0, MEAN_RUN, OVER, PRED0, PUSHED, PUSH_T, RED, UNDER,
  binCenter, binOf, binWidth, ceAtFork, chunkRun, decisions, mseVsDemos, positions, stayOn, tokensOf, type Act, type P,
} from "./vla-math";
import { BAD, GT, OUT, PAD, READ, RED_CUP, cross, dot, drawGripper, drawPath, drawTable, fitLabel, fix, sgn, tableLayout, type TLay } from "./vla-draw";

const U = vlaCopy.ui;
const GRIP = U.grip;
const actText = (a: Act, d = 2) => `(${sgn(a.dx, d)}, ${sgn(a.dy, d)}, ${GRIP[a.g]})`;

/** Lines of text in the panel under the table. */
function panel(ctx: Ctx, L: TLay) {
  let y = L.py;
  const fs = L.pw < 330 ? 11.5 : 12;
  return (s: string, color: string = palette.ink, size = fs, dy = 20) => { fitLabel(ctx, s, L.px, y, L.pw, color, size); y += dy; };
}

/* ------------------------------------------------------------------ */
/* 01 · The policy loop: one picture and one sentence in, one small move out */
/* ------------------------------------------------------------------ */

export function PolicyScene() {
  const [task, setTask] = useState(0);
  const [t, setT] = useState(0);
  const [mode, setMode] = useState(0);
  const T = U.policy;
  const run = task === 0 ? OVER : BLUE_RUN;
  const N = run.steps.length;
  const tt = Math.min(t, N);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = tableLayout(w, h, 0.62);
    const pts = positions(run);
    label(ctx, `${T.cam} · step ${tt} · ${fix(tt / HZ, 1)}${U.sec}`, L.tx, L.ty - 12, READ, 11);
    drawTable(ctx, L, { names: U.names });
    frame(ctx, L.tx - 3, L.ty - 3, L.tw + 6, L.th + 6, READ, 1.2, [5, 4]);
    if (mode === 1) pts.slice(0, N).forEach((q, i) => dot(ctx, L, q, i === tt ? 4.2 : 2.2, i === tt ? GT : `rgba(15,157,106,0.45)`));
    else drawPath(ctx, L, pts.slice(0, tt + 1), "rgba(20,24,33,0.35)", 1.6);
    const p = pts[tt], g = tt > 0 ? run.steps[tt - 1].a.g : 0;
    const a = tt < N ? run.steps[tt].a : null;
    if (a && mode === 0) {
      const q: P = [p[0] + a.dx, p[1] + a.dy];
      drawGripper(ctx, L, q, a.g, OUT, 0.45);
      if (Math.hypot(a.dx, a.dy) > 0.01) arrow(ctx, L.X(p[0]), L.Y(p[1]), L.X(q[0]), L.Y(q[1]), OUT, 2);
    }
    drawGripper(ctx, L, p, g);

    const line = panel(ctx, L);
    line(`${T.input}: ${T.cam} + ${T.instr[task]}`, READ);
    if (mode === 0) {
      line(a ? `${T.output} = (Δx, Δy, ${T.gripName}) = ${actText(a)}` : T.finished, OUT, 12.5, 22);
      line(`${T.next} · ${T.rate}`, palette.muted, 11);
      line(`${T.total} ${N} step = ${fix(N / HZ, 1)}${U.sec}`, palette.muted, 11);
    } else {
      line(`${T.pair}`, GT);
      line(a ? `${T.answer} = ${actText(a)}` : T.finished, GT, 12.5, 22);
      if (tt === 0 && task === 0) {
        line(`${T.pred} = ${actText(PRED0)}`, OUT);
        line(`${T.loss} = (2.00 − 1.80)² + (0.00 − 0.30)² = ${fix(LOSS0, 2)}`, OUT);
      } else line(T.onlyFirst, palette.muted, 11);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.task}>
          <span>{T.task}</span>
          {T.tasks.map((n, i) => <button key={n} type="button" className={task === i ? "on" : ""} onClick={() => { setTask(i); setT(0); }}>{n}</button>)}
        </div>
        <label className="ad-ctl">
          <span>step <b>{tt}</b></span>
          <input type="range" min={0} max={N} step={1} value={tt} onChange={(e) => setT(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.mode}>
          {T.modes.map((n, i) => <button key={n} type="button" className={mode === i ? "on" : ""} onClick={() => setMode(i)}>{n}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · Two demonstrations part at the vase; squared error picks the average */
/* ------------------------------------------------------------------ */

const REACH = OVER.steps.findIndex((s) => s.a.g === 1);  // the step that closes on the cup

export function ForkScene() {
  const [view, setView] = useState(0);
  const [pick, setPick] = useState(0);
  const T = U.fork;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = tableLayout(w, h, 0.62);
    label(ctx, T.views[view], L.tx, L.ty - 12, palette.muted, 11);
    drawTable(ctx, L, { names: U.names, clear: true });
    const over = positions(OVER).slice(0, REACH + 1), under = positions(UNDER).slice(0, REACH + 1);
    const faint = view === 0 ? 1 : 0.35;
    drawPath(ctx, L, over, `rgba(15,157,106,${0.9 * faint})`, 2);
    drawPath(ctx, L, under, `rgba(15,157,106,${0.9 * faint})`, 2, [6, 4]);
    if (view === 1) {
      drawPath(ctx, L, MEAN_RUN.path, OUT, 2.4, undefined, true);
      cross(ctx, L, MEAN_RUN.path[MEAN_RUN.path.length - 1], 6);
    }
    if (view === 2) {
      const chosen = (pick === 0 ? over : under).slice(BRANCH_AT);
      drawPath(ctx, L, chosen, OUT, 2.6, undefined, true);
      // the two probabilities at the fork, drawn as bars beside it
      const bx = L.X(BRANCH[0]) - 34, by = L.Y(BRANCH[1]), bh = 30;
      [1, -1].forEach((s, i) => {
        const y = by - s * 14;
        rbox(ctx, bx - 2, y - 6, bh * 0.5 + 4, 12, 3, null, palette.frame, 1);
        ctx.fillStyle = i === pick ? OUT : `rgba(${palette.accentRgb},0.45)`;
        ctx.fillRect(bx, y - 4, bh * 0.5, 8);
      });
      label(ctx, "50%", bx - 6, by - 14, OUT, 11, "right");
      label(ctx, "50%", bx - 6, by + 14, OUT, 11, "right");
    }
    drawGripper(ctx, L, BRANCH, 0, palette.ink, 0.35);
    dot(ctx, L, BRANCH, 4.5, READ);
    if (view < 2) label(ctx, T.forkName, L.X(BRANCH[0]) - 8, L.Y(BRANCH[1]) - 14, READ, 11, "right");

    const line = panel(ctx, L);
    if (view === 0) {
      line(`${T.at} · ${T.same}`, READ);
      line(`${T.over} a* = ${actText(A_OVER, 1)}`, GT);
      line(`${T.under} a* = ${actText(A_UNDER, 1)}`, GT);
      line(T.noLabel, palette.muted, 11);
    } else if (view === 1) {
      line(`${T.mseOver}: (0² + 2.4²) / 2 = ${fix(mseVsDemos(A_OVER), 2)}`, palette.ink);
      line(`${T.mseMean} ${actText(A_MEAN, 1)}: (1.2² + 1.2²) / 2 = ${fix(mseVsDemos(A_MEAN), 2)}`, OUT);
      line(`${T.hit}: ${fix((MEAN_RUN.hit + 1) / HZ, 1)}${U.sec} · (${MEAN_RUN.path[MEAN_RUN.path.length - 1].map((v) => fix(v, 0)).join(", ")})`, BAD);
    } else {
      line(`${T.share}: Δy ${sgn(A_OVER.dy, 1)} 50% · Δy ${sgn(A_UNDER.dy, 1)} 50%`, OUT);
      line(`${T.sampled}: ${T.draws[pick]}`, OUT);
      line(T.after, palette.muted, 11);
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
          <div className="ad-ctl ad-seg" role="group" aria-label={T.draw}>
            <span>{T.draw}</span>
            {T.draws.map((n, i) => <button key={n} type="button" className={pick === i ? "on" : ""} onClick={() => setPick(i)}>{n}</button>)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Actions as tokens: one number becomes the index of one bin      */
/* ------------------------------------------------------------------ */

export function TokenScene() {
  const [bi, setBi] = useState(1);
  const [which, setWhich] = useState(1);
  const T = U.tokens;
  const n = bi === 0 ? 8 : BINS;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = h > w * 1.15, fs = w < 420 ? 11.5 : 12;
    // the sequence: what the model reads, then the three action tokens it writes
    const toks = tokensOf(A_OVER, n);
    const y0 = 34;
    let x = PAD;
    const promptW = Math.min(port ? w - 2 * PAD : 300, w - 2 * PAD);
    rbox(ctx, x, y0 - 13, promptW, 26, 5, `rgba(${palette.normalRgb},0.08)`, READ, 1.2);
    fitLabel(ctx, T.prompt, x + 8, y0, promptW - 16, READ, 11.5);
    if (port) { x = PAD; } else x += promptW + 10;
    const ty = port ? y0 + 36 : y0;
    const tw = 54;
    toks.forEach((v, i) => {
      const on = which === 2 ? i === 1 : i === which;
      rbox(ctx, x + i * (tw + 6), ty - 13, tw, 26, 5, on ? `rgba(${palette.accentRgb},0.18)` : "#ffffff", OUT, on ? 2 : 1.2);
      label(ctx, which === 2 && i === 1 ? "?" : String(v), x + i * (tw + 6) + tw / 2, ty, OUT, 12.5, "center");
      label(ctx, T.slots[i], x + i * (tw + 6) + tw / 2, ty + 22, palette.muted, 11, "center");
    });

    // the number line with its bins
    const lx = PAD + 6, lw = w - 2 * PAD - 12, ly = port ? 236 : 214;
    const X = (v: number) => lx + ((v - BIN_LO) / (BIN_HI - BIN_LO)) * lw;
    ctx.fillStyle = palette.track;
    ctx.fillRect(lx, ly - 22, lw, 22);
    const step = n <= 16 ? 1 : 16;
    for (let i = 0; i <= n; i += step) {
      const xx = lx + (i / n) * lw;
      ctx.fillStyle = i % (n <= 16 ? 1 : 64) === 0 ? palette.muted : "rgba(91,100,116,0.45)";
      ctx.fillRect(xx - 0.5, ly - (i % (n <= 16 ? 1 : 64) === 0 ? 26 : 22), 1, i % (n <= 16 ? 1 : 64) === 0 ? 30 : 8);
    }
    [-2.5, -1.2, 0, 1.2, 2.5].forEach((v) => label(ctx, sgn(v, 1).replace("+0.0", "0"), X(v), ly + 16, palette.muted, 11, "center"));
    fitLabel(ctx, `${T.range} −2.5 ~ +2.5 cm · ${n}${T.binsUnit} · ${T.width} ${fix(binWidth(n), n > 16 ? 4 : 3)} cm`, PAD, ly + 40, w - 2 * PAD, palette.muted, 11);
    const binX = (i: number) => lx + (i / n) * lw, bw = Math.max(3, lw / n);
    const line = (() => { let y = ly + 70; return (s: string, color: string = palette.ink, size = fs, dy = 20) => { fitLabel(ctx, s, PAD, y, w - 2 * PAD, color, size); y += dy; }; })();

    if (which < 2) {
      const v = which === 0 ? A_OVER.dx : A_OVER.dy, b = binOf(v, n), c = binCenter(b, n);
      ctx.fillStyle = `rgba(${palette.accentRgb},0.75)`;
      ctx.fillRect(binX(b), ly - 22, bw, 22);
      ctx.fillStyle = READ;
      ctx.beginPath(); ctx.moveTo(X(v), ly - 24); ctx.lineTo(X(v) - 5, ly - 33); ctx.lineTo(X(v) + 5, ly - 33); ctx.closePath(); ctx.fill();
      line(`${T.nums[which]} = ${sgn(v, 2)} cm · ${T.bin} ${b}`, OUT, 12.5, 22);
      line(`${T.center}: −2.5 + (${b} + 0.5) × ${fix(binWidth(n), n > 16 ? 5 : 3)} = ${fix(c, 4)}`, palette.ink);
      line(`${T.err} ${fix(Math.abs(c - v), 4)} cm`, palette.muted);
      line(`${T.grip}: ${GRIP[0]} = 0, ${GRIP[1]} = ${n - 1}`, palette.muted, 11);
    } else {
      const bo = binOf(A_OVER.dy, n), bu = binOf(A_UNDER.dy, n), H = 60;
      [bo, bu].forEach((b) => {
        ctx.fillStyle = OUT;
        ctx.fillRect(binX(b), ly - 22 - H * 0.5, bw, H * 0.5 + 22);
        label(ctx, "50%", binX(b) + bw / 2, ly - 30 - H * 0.5, OUT, 11, "center");
      });
      ctx.fillStyle = READ;
      ctx.beginPath(); ctx.moveTo(X(A_MEAN.dy), ly - 24); ctx.lineTo(X(A_MEAN.dy) - 5, ly - 33); ctx.lineTo(X(A_MEAN.dy) + 5, ly - 33); ctx.closePath(); ctx.fill();
      line(`${T.forkAt}: ${T.bin} ${bo} (${T.up}) 50%, ${bu} (${T.down}) 50%`, OUT, 12.5, 22);
      line(`${T.ce} = −(ln 0.5 + ln 0.5) / 2 = ${fix(ceAtFork(0.5), 3)}`, palette.ink);
      line(`${T.skew} ${fix(ceAtFork(0.9), 3)}`, palette.muted);
      line(T.meanNone, BAD, 11.5);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.bins}>
          <span>{T.bins}</span>
          {[8, BINS].map((m, i) => <button key={m} type="button" className={bi === i ? "on" : ""} onClick={() => setBi(i)}>{m}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.num}>
          {T.views.map((m, i) => <button key={m} type="button" className={which === i ? "on" : ""} onClick={() => setWhich(i)}>{m}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · Action chunking: look at the picture every k steps              */
/* ------------------------------------------------------------------ */

export function ChunkScene() {
  const [ki, setKi] = useState(2);
  const [push, setPush] = useState(false);
  const T = U.chunk;
  const k = CHUNKS[ki];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = tableLayout(w, h, 0.62);
    const r = chunkRun(k, push), base = chunkRun(1, push);
    label(ctx, `k = ${k} · ${T.decisions} ${r.decided.length}`, L.tx, L.ty - 12, READ, 11);
    drawTable(ctx, L, { names: U.names, red: push ? PUSHED : RED, redRight: push });
    if (push) {
      dot(ctx, L, RED, 2.5 * L.k, null, RED_CUP, 1.2);
      label(ctx, T.old, L.X(RED[0]) + 2.5 * L.k + 4, L.Y(RED[1]), RED_CUP, 11);
    }
    const pts: P[] = [...r.steps.map((s) => s.p), r.end];
    for (let i = 0; i < r.steps.length; i++) drawPath(ctx, L, [pts[i], pts[i + 1]], r.steps[i].blind ? BAD : OUT, 2.2);
    r.decided.forEach((t) => { if (t < r.steps.length) dot(ctx, L, r.steps[t].p, 4, READ, "#ffffff", 1); });
    r.airGrasp.forEach((t) => cross(ctx, L, pts[t + 1], 5));
    drawGripper(ctx, L, r.end, 0);

    const line = panel(ctx, L);
    if (!push) {
      const n = decisions(OVER.steps.length, k);
      line(`${T.decisions}: ${n} (${T.k1} ${OVER.steps.length})`, READ);
      line(`${T.stay}: 0.98^${n} = ${fix(stayOn(n), 3)}`, palette.ink);
      line(T.stayNote, palette.muted, 11);
    } else {
      const blind = r.steps.filter((s) => s.blind).length;
      line(`${T.pushedAt} ${fix(PUSH_T / HZ, 1)}${U.sec} · ${T.blind} ${blind}`, blind ? BAD : READ);
      line(r.airGrasp.length ? `${T.air}: ${fix(r.airGrasp[0] / HZ, 1)}${U.sec}` : T.noAir, r.airGrasp.length ? BAD : GT);
      line(`${T.done} ${fix(r.done / HZ, 1)}${U.sec} (${T.k1} ${fix(base.done / HZ, 1)}${U.sec})`, palette.ink);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.k}>
          <span>{T.k}</span>
          {CHUNKS.map((m, i) => <button key={m} type="button" className={ki === i ? "on" : ""} onClick={() => setKi(i)}>{m}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.cup}>
          <span>{T.cup}</span>
          {T.cups.map((m, i) => <button key={m} type="button" className={push === (i === 1) ? "on" : ""} onClick={() => setPush(i === 1)}>{m}</button>)}
        </div>
      </div>
    </div>
  );
}
