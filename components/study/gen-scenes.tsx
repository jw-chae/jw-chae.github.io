"use client";

import { useMemo, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, cells, frame, line, rbox, signed } from "./kit";
import { genCopy } from "./gen-copy";
import { PAD, dot, isPortrait, ko, num, patchGrid, pct, picture, point } from "./gen-draw";
import {
  BLOBS, DIRS, FOLLOW, IMG, NP, PATCHES, PD, PICTURE, PS, TRACK, TRACK_COL, TRACK_ROW, WALK_SEED,
  aimAt, bind, cellError, decodeLearned, decodeShrink, encodeLearned, encodeShrink, imageTokens, learnedRecon, lost, nearest, shrinkBlock, shrinkRecon, trainPairs, walk,
  type Img, type P2, type Road,
} from "./gen-math";

const U = genCopy.ui;

/* ------------------------------------------------------------------ */
/* 01 · One patch: 16 numbers, the few it is cut down to, and back      */
/* ------------------------------------------------------------------ */

const KEEP = [1, 2, 4, 8];
const TP = PATCHES[TRACK];
const err = (v: number) => (v < 0.01 ? v.toFixed(3) : v.toFixed(2));

export function LatentScene() {
  const [step, setStep] = useState(0);
  const [ki, setKi] = useState(3);
  const k = KEEP[ki];
  const shrunk = useMemo(() => shrinkRecon(k), [k]);
  const learned = useMemo(() => learnedRecon(k), [k]);
  const one = useMemo(() => {
    const zs = encodeShrink(TP, k), zl = encodeLearned(TP, k), [bh, bw] = shrinkBlock(k), perRow = PS / bw;
    // the 16 weights behind each number that plain averaging keeps
    const ws = zs.map((_, n) => {
      const j0 = Math.floor(n / perRow) * bh, i0 = (n % perRow) * bw;
      return Array.from({ length: PD }, (__, i) => { const r = Math.floor(i / PS), c = i % PS; return r >= j0 && r < j0 + bh && c >= i0 && c < i0 + bw ? 1 / (bh * bw) : 0; });
    });
    return { zs, zl, ws, wmax: 1 / (bh * bw), rs: decodeShrink(zs), rl: decodeLearned(zl) };
  }, [k]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);

    if (step === 3) {
      // the whole picture: original, plain averaging, learned weights, with the followed patch marked on each
      const items: [Img, string, string, number | null][] = [
        [PICTURE, U.latent.original, palette.muted, null],
        [shrunk, U.latent.shrink, palette.anomaly, lost(shrunk)],
        [learned, U.latent.learned, palette.mint, lost(learned)],
      ];
      const cap = (x: number, y: number, S: number, it: [Img, string, string, number | null]) => {
        label(ctx, it[1], x + S / 2, y - 12, it[2], 12, "center");
        picture(ctx, it[0], x, y, S);
        frame(ctx, x + (TRACK_COL * S) / NP, y + (TRACK_ROW * S) / NP, S / NP, S / NP, palette.accent, 2);
        if (it[3] !== null) label(ctx, `${U.latent.lost} ${pct(it[3])}`, x + S / 2, y + S + 16, it[2], 13, "center");
      };
      let bottom = 0;
      if (portrait) {
        const gap = 16, S = Math.min((w - 2 * PAD - gap) / 2, (h - 150) / 2);
        cap((w - S) / 2, 34, S, items[0]);
        const y2 = 34 + S + 44, x0 = (w - 2 * S - gap) / 2;
        cap(x0, y2, S, items[1]); cap(x0 + S + gap, y2, S, items[2]);
        bottom = y2 + S + 50;
      } else {
        const gap = 14, S = Math.min((w - 2 * PAD - 2 * gap) / 3, h - 150), x0 = (w - 3 * S - 2 * gap) / 2, y0 = 44;
        items.forEach((it, i) => cap(x0 + i * (S + gap), y0, S, it));
        bottom = y0 + S + 58;
      }
      label(ctx, `${U.latent.total}  ${(NP * NP * PD).toLocaleString("en-US")} → ${(NP * NP * k).toLocaleString("en-US")}`, w / 2, bottom, palette.ink, 13, "center");
      return;
    }

    // the picture and the enlarged patch stay in the same place through the first three steps
    const wide = w > 540, Sp = portrait ? 112 : wide ? 140 : 124, zc = portrait ? 30 : wide ? 36 : 32, Z = 4 * zc;
    const px = PAD, py = 34, zx = portrait ? w - PAD - Z : PAD, zy = portrait ? 38 : py + Sp + 44;
    label(ctx, U.latent.pic, px, py - 14, palette.muted, 11);
    picture(ctx, PICTURE, px, py, Sp);
    const pc = Sp / NP, fx = px + TRACK_COL * pc, fy = py + TRACK_ROW * pc, guide = `rgba(${palette.accentRgb},0.5)`;
    frame(ctx, fx, fy, pc, pc, palette.accent, 2);
    if (portrait) { line(ctx, fx + pc, fy, zx, zy, guide, 1); line(ctx, fx + pc, fy + pc, zx, zy + Z, guide, 1); }
    else { line(ctx, fx, fy + pc, zx, zy, guide, 1); line(ctx, fx + pc, fy + pc, zx + Z, zy, guide, 1); }
    label(ctx, U.latent.patch, zx, portrait ? zy - 16 : zy + Z + 14, palette.accent, 11);
    patchGrid(ctx, TP, zx, zy, zc, true);
    frame(ctx, zx, zy, Z, Z, palette.accent, 2);

    const x0 = portrait ? PAD : PAD + Z + 26, cw = w - PAD - x0, y0 = portrait ? zy + Z + 36 : 40;

    if (step === 0) {
      label(ctx, U.latent.given, x0, y0, palette.ink, 13);
      label(ctx, U.latent.sky, x0, y0 + 28, palette.muted, 12);
      label(ctx, U.latent.post, x0, y0 + 50, palette.muted, 12);
      label(ctx, `${U.latent.goal[0]} ${k}${U.latent.goal[1]}`, x0, y0 + 90, palette.accent, 12);
      label(ctx, U.latent.goal[2], x0, y0 + 112, palette.accent, 12);
      label(ctx, U.latent.whole, x0, y0 + 152, palette.muted, 11);
    } else if (step === 1) {
      // each kept number is a weighted sum of the 16 cells: the small tile is its 16 weights
      const ts = Math.min(34, Math.floor((cw - (k - 1) * 6) / k)), pitch = ts + 6;
      const block = (y: number, title: string, color: string, weights: number[][], values: number[], max: number) => {
        label(ctx, `${title} · ${U.latent.kept} ${k}`, x0, y, color, 12);
        weights.forEach((wt, n) => {
          const tx = x0 + n * pitch, ty = y + 12;
          cells(ctx, tx, ty, ts / PS, PS, PS, (r, c) => signed(wt[r * PS + c], max), 1);
          frame(ctx, tx, ty, ts, ts, palette.frame, 1);
          label(ctx, num(values[n]), tx + ts / 2, ty + ts + 13, palette.ink, 11, "center");
        });
      };
      block(y0, U.latent.shrink, palette.anomaly, one.ws, one.zs, one.wmax);
      block(y0 + ts + 64, U.latent.learned, palette.mint, DIRS.slice(0, k), one.zl, 0.5);
      U.latent.cap.forEach((text, i) => label(ctx, text, x0, y0 + 2 * (ts + 64) + 6 + i * 20, palette.muted, 11));
    } else {
      // rebuilt patches, on the same rows as the original so they can be compared cell by cell
      const ry = portrait ? y0 + 8 : zy;
      if (!portrait) U.latent.dec.forEach((text, i) => label(ctx, text, x0, y0 + 20 + i * 24, i === 0 ? palette.anomaly : palette.mint, 11));
      ([[one.rs, U.latent.fromShrink, palette.anomaly], [one.rl, U.latent.fromLearned, palette.mint]] as [number[], string, string][]).forEach(([r, name, color], i) => {
        const rx = x0 + i * (Z + 14);
        label(ctx, name, rx, ry - 12, color, 11);
        patchGrid(ctx, r, rx, ry, zc, true, (n) => Math.abs(r[n] - TP[n]) > 0.1);
        label(ctx, `${U.latent.cellErr} ${err(cellError(r, TP))}`, rx, ry + Z + 16, palette.ink, 12);
      });
      label(ctx, U.latent.badNote, x0, ry + Z + 42, palette.anomaly, 11);
      if (portrait) U.latent.dec.forEach((text, i) => label(ctx, text, x0, ry + Z + 70 + i * 22, i === 0 ? palette.anomaly : palette.mint, 11));
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.latent.step}>
          <span>{U.latent.step}</span>
          {U.latent.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.latent.keep}>
          <span>{U.latent.keep}</span>
          {KEEP.map((v, i) => <button key={v} type="button" className={ki === i ? "on" : ""} onClick={() => setKi(i)}>{v}</button>)}
          <span>{U.latent.of}</span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · A picture as a grid of tokens, and what one token has to read    */
/* ------------------------------------------------------------------ */

const SIDES = [64, 256, 1024, 2048], PACK = [1, 4, 8], GROUP = [1, 2, 4];

export function DitScene() {
  const [si, setSi] = useState(0);
  const [fi, setFi] = useState(1);
  const [gi, setGi] = useState(0);
  const side = SIDES[si], f = PACK[fi], p = GROUP[gi];
  const tokens = imageTokens(side, f, p), n = Math.sqrt(tokens);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const S = Math.min(w - 2 * PAD, h - 166), x0 = (w - S) / 2, y0 = 44;
    picture(ctx, PICTURE, x0, y0, S);
    if (n <= 64) {
      const c = S / n, grid = `rgba(${palette.normalRgb},0.6)`;
      for (let i = 1; i < n; i++) {
        line(ctx, x0 + i * c, y0, x0 + i * c, y0 + S, grid, n > 32 ? 0.5 : 1);
        line(ctx, x0, y0 + i * c, x0 + S, y0 + i * c, grid, n > 32 ? 0.5 : 1);
      }
      // the token whose cell contains the patch followed since section 01
      const col = Math.floor((((TRACK_COL + 0.5) * PS) / IMG) * n), row = Math.floor((((TRACK_ROW + 0.5) * PS) / IMG) * n);
      ctx.fillStyle = `rgba(${palette.accentRgb},0.35)`; ctx.fillRect(x0 + col * c, y0 + row * c, c, c);
      frame(ctx, x0 + col * c, y0 + row * c, c, c, palette.accent, 2);
      label(ctx, `${n} × ${n} · ${U.dit.cell}`, x0, y0 - 28, palette.normal, 11);
      label(ctx, U.dit.ours, x0, y0 - 12, palette.accent, 11);
    } else {
      ctx.fillStyle = `rgba(${palette.normalRgb},0.55)`; ctx.fillRect(x0, y0, S, S);
      label(ctx, `${n.toLocaleString("en-US")} × ${n.toLocaleString("en-US")}`, w / 2, y0 + S / 2 - 12, "#ffffff", 16, "center");
      label(ctx, U.dit.dense, w / 2, y0 + S / 2 + 14, "#ffffff", 12, "center");
    }
    const rows: [string, string, string][] = [
      [U.dit.tokens, tokens.toLocaleString("en-US"), palette.ink],
      [U.dit.covers, `${f * p} × ${f * p}`, palette.ink],
      [U.dit.perToken, tokens.toLocaleString("en-US"), palette.normal],
      [U.dit.pairs, ko(tokens * tokens), tokens > 20000 ? palette.anomaly : palette.mint],
    ];
    rows.forEach(([name, value, color], i) => {
      const y = y0 + S + 24 + i * 23;
      label(ctx, name, PAD, y, palette.muted, 12);
      label(ctx, value, w - PAD, y, color, 15, "right");
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.dit.side}>
          <span>{U.dit.side}</span>
          {SIDES.map((v, i) => <button key={v} type="button" className={si === i ? "on" : ""} onClick={() => setSi(i)}>{v}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.dit.compress}>
          <span>{U.dit.compress}</span>
          {U.dit.packs.map((name, i) => <button key={name} type="button" className={fi === i ? "on" : ""} onClick={() => setFi(i)}>{name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.dit.group}>
          <span>{U.dit.group}</span>
          {GROUP.map((v, i) => <button key={v} type="button" className={gi === i ? "on" : ""} onClick={() => setGi(i)}>{v} × {v}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · One point: the straight lines it is trained on, the path it walks */
/* ------------------------------------------------------------------ */

const STEPS = [1, 2, 4, 8, 16, 64];
const ROADS: Road[] = ["curved", "straight"];
const FINE = 100, T_TICKS = 20;
type FlowView = "walk" | "learn";
const VIEWS: FlowView[] = ["walk", "learn"];

export function FlowScene() {
  const [view, setView] = useState<FlowView>("walk");
  const [kind, setKind] = useState<Road>("curved");
  const [si, setSi] = useState(2);
  const [ti, setTi] = useState(5);
  const steps = STEPS[si], t = 1 - ti / T_TICKS;
  const paths = useMemo(() => walk(kind, steps, 400, WALK_SEED), [kind, steps]);
  const dist = useMemo(() => nearest(paths.map((p) => p[p.length - 1])), [paths]);
  // the followed point on a finely walked straight road, and the training pairs whose mix at time t passes next to it
  const fine = useMemo(() => walk("straight", FINE, FOLLOW + 1, WALK_SEED)[FOLLOW], []);
  const pairs = useMemo(() => trainPairs(20000, 11), []);
  const at = Math.round((1 - t) * FINE), here = fine[at];
  const told = useMemo(() => aimAt(here, "straight", t), [here, t]);
  const near = useMemo(() => pairs.filter((p) => Math.hypot((1 - t) * p.x0[0] + t * p.eps[0] - here[0], (1 - t) * p.x0[1] + t * p.eps[1] - here[1]) < 0.12).slice(0, 40), [pairs, here, t]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const S = Math.min(w - 2 * PAD, h - 84), cx = w / 2, cy = 12 + S / 2, sc = S / 2 / 2.7;
    const X = (p: P2) => cx + p[0] * sc, Y = (p: P2) => cy - p[1] * sc;
    for (const m of BLOBS.mu) {
      ctx.save(); ctx.fillStyle = "rgba(15,157,106,0.16)"; ctx.strokeStyle = palette.mint; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(m), Y(m), 2.5 * BLOBS.s * sc, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
    }
    const ty = 12 + S + 24;

    if (view === "walk") {
      ctx.save(); ctx.strokeStyle = `rgba(${palette.accentRgb},0.28)`; ctx.lineWidth = 1;
      paths.slice(0, 70).forEach((p, j) => { if (j === FOLLOW) return; ctx.beginPath(); p.forEach((q, i) => (i === 0 ? ctx.moveTo(X(q), Y(q)) : ctx.lineTo(X(q), Y(q)))); ctx.stroke(); });
      ctx.restore();
      paths.slice(0, 70).forEach((p) => dot(ctx, X(p[0]), Y(p[0]), 2, palette.dotOff));
      paths.forEach((p, i) => { const e = p[p.length - 1]; dot(ctx, X(e), Y(e), i < 70 ? 2.6 : 1.6, i < 70 ? `rgba(${palette.accentRgb},0.75)` : `rgba(${palette.accentRgb},0.35)`); });
      // the followed point: a thick path with a dot where each step ends
      const mine = paths[FOLLOW], end = mine[mine.length - 1];
      ctx.save(); ctx.strokeStyle = palette.ink; ctx.lineWidth = 2.5; ctx.lineJoin = "round";
      ctx.beginPath(); mine.forEach((q, i) => (i === 0 ? ctx.moveTo(X(q), Y(q)) : ctx.lineTo(X(q), Y(q)))); ctx.stroke(); ctx.restore();
      if (steps <= 16) mine.slice(1, -1).forEach((q) => dot(ctx, X(q), Y(q), 3.5, "#ffffff", palette.ink, 2));
      dot(ctx, X(mine[0]), Y(mine[0]), 5, palette.ink);
      label(ctx, U.flow.from, X(mine[0]) + 9, Y(mine[0]) - 9, palette.ink, 11);
      dot(ctx, X(end), Y(end), 5.5, palette.accent, palette.ink, 2);
      dot(ctx, PAD + 4, 18, 3, palette.dotOff); label(ctx, U.flow.start, PAD + 12, 18, palette.muted, 11);
      dot(ctx, PAD + 4, 36, 3, palette.accent); label(ctx, U.flow.end, PAD + 12, 36, palette.accent, 11);
      const own = Math.min(...BLOBS.mu.map((m) => Math.hypot(end[0] - m[0], end[1] - m[1])));
      label(ctx, U.flow.one, PAD, ty, palette.muted, 11);
      label(ctx, own.toFixed(2), PAD, ty + 27, own < 0.18 ? palette.mint : palette.anomaly, 18);
      label(ctx, U.flow.all, w - PAD, ty, palette.muted, 11, "right");
      label(ctx, dist.toFixed(2), w - PAD, ty + 27, dist < 0.18 ? palette.mint : palette.anomaly, 18, "right");
      label(ctx, U.flow.ideal, w / 2, ty + 27, palette.muted, 11, "center");
    } else {
      ctx.save();
      ctx.beginPath(); ctx.rect(2, 2, w - 4, S + 16); ctx.clip();
      // training lines that pass next to the point at this time: each joins one noise sample to one data sample
      near.forEach((p) => {
        line(ctx, X(p.eps), Y(p.eps), X(p.x0), Y(p.x0), `rgba(${palette.normalRgb},0.4)`, 1);
        dot(ctx, X(p.eps), Y(p.eps), 2, palette.dotOff); dot(ctx, X(p.x0), Y(p.x0), 2.2, palette.mint);
      });
      // where the point has been so far
      ctx.strokeStyle = `rgba(${palette.inkRgb},0.45)`; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); fine.slice(0, at + 1).forEach((q, i) => (i === 0 ? ctx.moveTo(X(q), Y(q)) : ctx.lineTo(X(q), Y(q)))); ctx.stroke();
      ctx.restore();
      BLOBS.mu.forEach((m, k) => label(ctx, `${Math.round(told.w[k] * 100)}%`, X([m[0] * 1.36, m[1] * 1.36]), Y([m[0] * 1.36, m[1] * 1.36]), palette.normal, 13, "center"));
      if (Math.hypot(X(told.aim) - X(here), Y(told.aim) - Y(here)) > 16) arrow(ctx, X(here), Y(here), X(told.aim), Y(told.aim), palette.accent, 2.5);
      dot(ctx, X(here), Y(here), 5.5, palette.ink, "#ffffff", 2);
      rbox(ctx, X(told.aim) - 5, Y(told.aim) - 5, 10, 10, 2, palette.accent, "#ffffff", 1.5);
      line(ctx, PAD, 18, PAD + 16, 18, `rgba(${palette.normalRgb},0.7)`, 1.5); label(ctx, U.flow.seg, PAD + 22, 18, palette.normal, 11);
      label(ctx, U.flow.cap1, PAD, ty, palette.normal, 11);
      label(ctx, `${U.flow.cap2} ${point(told.aim)}`, PAD, ty + 24, palette.accent, 11);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.flow.view}>
          <span>{U.flow.view}</span>
          {VIEWS.map((v) => <button key={v} type="button" className={view === v ? "on" : ""} onClick={() => setView(v)}>{U.flow[v]}</button>)}
        </div>
        {view === "walk" ? (
          <>
            <div className="ad-ctl ad-seg" role="group" aria-label={U.flow.road}>
              <span>{U.flow.road}</span>
              {ROADS.map((r) => <button key={r} type="button" className={kind === r ? "on" : ""} onClick={() => setKind(r)}>{U.flow[r]}</button>)}
            </div>
            <div className="ad-ctl ad-seg" role="group" aria-label={U.flow.steps}>
              <span>{U.flow.steps}</span>
              {STEPS.map((v, i) => <button key={v} type="button" className={si === i ? "on" : ""} onClick={() => setSi(i)}>{v}</button>)}
            </div>
          </>
        ) : (
          <label className="ad-ctl">
            <span>{U.flow.time} <b>{t.toFixed(2)}</b></span>
            <input type="range" min={0} max={T_TICKS - 2} step={1} value={ti} onChange={(e) => setTi(Number(e.target.value))} />
          </label>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · Which word gives the ball its colour                            */
/* ------------------------------------------------------------------ */

const RED = [224, 49, 79], BLUE = [42, 111, 214];
const mix = (red: number, a = 1) => `rgba(${RED.map((v, i) => Math.round(v * red + BLUE[i] * (1 - red))).join(",")},${a})`;
const share = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
/** Amounts written without trailing zeros: 1, 0.25, 0. */
const amount = (v: number) => num(v).replace(/\.?0+$/, "");

export function TextScene() {
  const [c, setC] = useState(0);
  const [obj, setObj] = useState(0);
  const b = useMemo(() => bind(c), [c]);
  const cur = b[obj];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const n = 4, gap = 10, bw = Math.min(104, (w - 2 * PAD - (n - 1) * gap) / n), x0 = (w - n * bw - (n - 1) * gap) / 2, x1 = x0 + n * bw + (n - 1) * gap;
    const g = Math.max(0, (h - 396) / 4), y0 = 34, bh = 34;
    label(ctx, U.text.prompt, x0, y0 - 16, palette.muted, 11);
    label(ctx, U.text.carries, x1, y0 - 16, palette.muted, 11, "right");
    // what colour each word's vector carries: adjectives always, nouns only as far as the encoder read the context
    const carried = [mix(1), mix(1, c), mix(0), mix(0, c)];
    U.text.words.forEach((word, i) => {
      const x = x0 + i * (bw + gap), col = cur.colour[i], hot = i === 1 + 2 * obj;
      rbox(ctx, x, y0, bw, bh, 8, "#ffffff", palette.frame, 1.5);
      label(ctx, word, x + bw / 2, y0 + bh / 2, palette.ink, 14, "center");
      ctx.fillStyle = palette.track; ctx.fillRect(x + 6, y0 + bh + 7, bw - 12, 6);
      ctx.fillStyle = carried[i]; ctx.fillRect(x + 6, y0 + bh + 7, bw - 12, 6);
      label(ctx, `${U.text.red} ${amount(col[0])}`, x + bw / 2, y0 + bh + 26, hot ? palette.ink : palette.muted, 11, "center");
      label(ctx, `${U.text.blue} ${amount(col[1])}`, x + bw / 2, y0 + bh + 41, hot ? palette.ink : palette.muted, 11, "center");
    });

    // reading shares of the chosen image token over the four words
    const ay = y0 + bh + 66 + g, ah = 46;
    label(ctx, `${U.text.readers[obj]} ${U.text.attn}`, x0, ay, palette.normal, 11);
    cur.w.forEach((wt, i) => {
      const x = x0 + i * (bw + gap), hh = Math.max(2, wt * ah);
      ctx.fillStyle = palette.track; ctx.fillRect(x + bw / 2 - 12, ay + 12, 24, ah);
      ctx.fillStyle = palette.normal; ctx.fillRect(x + bw / 2 - 12, ay + 12 + ah - hh, 24, hh);
      label(ctx, share(wt), x + bw / 2, ay + ah + 24, palette.normal, 12, "center");
      label(ctx, `${U.text.score} ${num(cur.scores[i], 0)}`, x + bw / 2, ay + ah + 40, palette.muted, 11, "center");
    });

    // the colour that arrives, and what gets drawn
    const my = ay + ah + 64 + g;
    label(ctx, `${U.text.mixed}  ${U.text.red} ${num(cur.mixed[0], 3)} · ${U.text.blue} ${num(cur.mixed[1], 3)}`, x0, my, palette.ink, 12);
    const ry = my + 24 + g, R = Math.min(34, (h - ry - 62) / 2), cy = ry + 20 + R, bx = w / 2 - R * 2.4, sx = w / 2 + R * 2.4;
    label(ctx, U.text.result, x0, ry, palette.muted, 11);
    ctx.fillStyle = mix(b[0].red); ctx.beginPath(); ctx.arc(bx, cy, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = mix(b[1].red); ctx.fillRect(sx - R, cy - R, 2 * R, 2 * R);
    if (obj === 0) { ctx.save(); ctx.strokeStyle = palette.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(bx, cy, R + 4, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    else frame(ctx, sx - R - 4, cy - R - 4, 2 * R + 8, 2 * R + 8, palette.ink, 2);
    label(ctx, `${U.text.ball}: ${U.text.red} ${Math.round(b[0].red * 100)}%`, bx, cy + R + 18, palette.ink, 12, "center");
    label(ctx, `${U.text.box}: ${U.text.blue} ${Math.round((1 - b[1].red) * 100)}%`, sx, cy + R + 18, palette.ink, 12, "center");
    label(ctx, U.text.sum, w / 2, cy + R + 38, palette.muted, 11, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.text.context} <b>{c.toFixed(2)}</b></span>
          <input type="range" min={0} max={1} step={0.05} value={c} onChange={(e) => setC(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.text.reader}>
          <span>{U.text.reader}</span>
          {U.text.readers.map((name, i) => <button key={name} type="button" className={obj === i ? "on" : ""} onClick={() => setObj(i)}>{name}</button>)}
        </div>
      </div>
    </div>
  );
}
