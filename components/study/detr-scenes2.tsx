"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { frame, rbox } from "./kit";
import { detrCopy } from "./detr-copy";
import {
  CUP10, CUP5, DN_NEG, DN_POS, GT_CAT, QUERIES, REF, SCALES, STUDENT, TEACHER, TOK,
  allScaleTokens, argmax, banks, bestAssign, classHead, costMatrix, deformRead, iou, maxShare, pseudoLabels, read, reads, tableEntries, tokens, uniformRead,
} from "./detr-math";
import { BAD, GT, OUT, PAD, READ, TINT, drawBoxes, drawPicture, fitLabel, fix, layout, type BoxItem } from "./yolo-draw";
import { arrowPic, classBars, cross, dotAt, fogOver, heat, pct, tokFill, tokGrid, tokOutline, tokText, wrapLabel } from "./detr-draw";

const U = detrCopy.ui;
const NM = [U.names.cat, U.names.cup, U.names.none];
const seg = (label0: string, items: string[], cur: number, set: (i: number) => void, numbered = false) => (
  <div className="ad-ctl ad-seg" role="group" aria-label={label0}>
    <span>{label0}</span>
    {items.map((n, i) => <button key={n} type="button" className={cur === i ? "on" : ""} onClick={() => set(i)}>{numbered ? `${i + 1}. ${n}` : n}</button>)}
  </div>
);
const big = (v: number) => v.toLocaleString("en-US");

/* ------------------------------------------------------------------ */
/* 06 · What it cost: uniform reading at the start, stride 32 vs 16      */
/* ------------------------------------------------------------------ */

export function CostScene() {
  const [view, setView] = useState(1);
  const [si, setSi] = useState(0);
  const [fine, setFine] = useState(false);
  const T = U.cost;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    const n = fine ? 2 * TOK : TOK, toks = tokens(n), q = QUERIES[si === 0 ? 0 : 2];
    label(ctx, `${T.stride} ${fine ? 16 : 32} · ${n} × ${n}`, L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { loading: U.pic.loading, fade: 0.7 });
    const r = read(q, "both", toks), uni = uniformRead(n);
    const share = view === 0 ? toks.map(() => uni.share) : r.share;
    const out = view === 0 ? uni.out : r.out, p = view === 0 ? uni.p : classHead(r.out);
    const mx = Math.max(...share);
    toks.forEach((t, i) => {
      tokFill(ctx, L, n, t.r, t.c, heat(share[i], Math.max(0.12, mx)));
      if (n === TOK) tokText(ctx, L, n, t.r, t.c, (share[i] * 100).toFixed(1), share[i] > 0.08 ? palette.ink : palette.muted);
    });
    tokGrid(ctx, L, n, n === TOK ? 0.25 : 0.32);
    const cup = fine ? CUP10 : CUP5, cm = maxShare(cup);
    cup.forEach((row, rr) => row.forEach((v, cc) => { if (v === cm) tokOutline(ctx, L, n, rr, cc, READ, 2); }));
    if (view === 1) cross(ctx, L, q.u, q.v, BAD, 5);

    const fs = L.pw < 260 ? 11.5 : 12;
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };
    line(`${T.tokens} ${n * n}`, palette.ink, fs, 21);
    line(`${T.table} ${n * n} × ${n * n} = ${big(tableEntries(n * n))}`, palette.ink, fs, 21);
    line(`${T.maxCup} ${fix(cm, 3)}`, READ, fs, L.port ? 24 : 30);
    line(`${U.pic.slot} ${si === 0 ? 1 : 3} · ${T.views[view]}`, OUT, 12.5, 22);
    if (view === 0) line(`${T.uniform} ${pct(uni.share, 0)}`, palette.muted, 11, 20);
    line(`${T.gathered} [${fix(out[0], 3)}, ${fix(out[1], 3)}]`, READ, fs, 24);
    line(T.prob, palette.muted, 11, 20);
    classBars(ctx, L.x, y, L.pw, p, NM, fs, L.port ? 19 : 21);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        {seg(T.view, T.views, view, setView)}
        {seg(T.slot, T.slots, si, setSi)}
        {seg(T.stride, T.strides, fine ? 1 : 0, (i) => setFine(i === 1))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · Deformable DETR: a reference point and four sampled points       */
/* ------------------------------------------------------------------ */

export function DeformScene() {
  const [mode, setMode] = useState(1);
  const T = U.deform;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    label(ctx, `${U.pic.slot} 1 · ${T.modes[mode]}`, L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { loading: U.pic.loading, fade: 0.75 });
    const dense = read(QUERIES[0]), dr = deformRead();
    if (mode === 0) {
      const mx = Math.max(...dense.share);
      tokens().forEach((t, i) => {
        tokFill(ctx, L, TOK, t.r, t.c, heat(dense.share[i], mx));
        tokText(ctx, L, TOK, t.r, t.c, (dense.share[i] * 100).toFixed(1), dense.share[i] > 0.08 ? palette.ink : palette.muted);
      });
      tokGrid(ctx, L, TOK, 0.25);
      cross(ctx, L, REF.x, REF.y, BAD, 5);
    } else {
      tokGrid(ctx, L, TOK, 0.3);
      dr.pts.forEach((pt) => arrowPic(ctx, L, REF.x, REF.y, pt.x, pt.y, OUT));
      dr.pts.forEach((pt) => dotAt(ctx, L, pt.x, pt.y, OUT, 3 + 6 * pt.w));
      cross(ctx, L, REF.x, REF.y, BAD, 5);
      dr.pts.forEach((pt, k) => {
        const [cx, cy] = [L.px + (pt.x * L.s) / 160, L.py + (pt.y * L.s) / 160];
        const t = `${k + 1}`, right = pt.x < 45;
        rbox(ctx, right ? cx + 8 : cx - 22, cy - 8, 14, 16, 3, "rgba(255,255,255,0.9)", null);
        label(ctx, t, right ? cx + 15 : cx - 15, cy, OUT, 11.5, "center");
      });
    }
    const fs = L.pw < 260 ? 11.5 : 12;
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };
    if (mode === 1) {
      line(`${T.ref} (${REF.x}, ${REF.y})`, BAD, fs, 21);
      dr.pts.forEach((pt, k) => line(`${k + 1}  (${pt.x}, ${pt.y})  ${T.w} ${fix(pt.w, 3)}  ${T.v} ${fix(pt.cat, 3)}`, palette.ink, 11.5, L.port ? 19 : 20));
      y += 4;
    }
    const out = mode === 0 ? dense.out : dr.out, p = mode === 0 ? classHead(dense.out) : dr.p;
    line(`${T.gathered} ${fix(out[0], 3)} · ${T.prob} ${fix(p[0], 3)}`, OUT, fs, L.port ? 24 : 30);
    label(ctx, T.count, L.x, y, palette.muted, 11); y += 20;
    const r32 = reads(TOK * TOK), r16 = reads(4 * TOK * TOK);
    const rows: [string, number, number, boolean][] = [
      [T.rows[0], r32.denseQuery, r16.denseQuery, mode === 0], [T.rows[1], r32.deformQuery, r16.deformQuery, mode === 1],
      [T.rows[2], r32.denseEnc, r16.denseEnc, mode === 0], [T.rows[3], r32.deformEnc, r16.deformEnc, mode === 1],
    ];
    const cw = Math.min(60, L.pw * 0.24), c0 = L.pw - 2 * cw;
    label(ctx, T.cols[1], L.x + c0 + cw - 4, y, palette.muted, 11, "right");
    label(ctx, T.cols[2], L.x + c0 + 2 * cw - 4, y, palette.muted, 11, "right");
    y += 20;
    rows.forEach(([name, a, b, hi]) => {
      if (hi) { ctx.fillStyle = TINT; ctx.fillRect(L.x - 4, y - 10, L.pw + 4, 19); }
      fitLabel(ctx, name, L.x, y, c0 - 6, hi ? OUT : palette.ink, 11.5);
      label(ctx, big(a), L.x + c0 + cw - 4, y, palette.ink, fs, "right");
      label(ctx, big(b), L.x + c0 + 2 * cw - 4, y, palette.ink, fs, "right");
      y += L.port ? 20 : 21;
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        {seg(T.mode, T.modes, mode, setMode)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 08 · DINO's noised boxes and RT-DETR's encoder                        */
/* ------------------------------------------------------------------ */

export function LaterScene() {
  const [view, setView] = useState(0);
  const [gi, setGi] = useState(2);
  const T = U.later;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    label(ctx, T.views[view], L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { loading: U.pic.loading, fade: view === 1 ? 0.8 : 1 });
    const fs = L.pw < 260 ? 11.5 : 12;
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };
    if (view === 0) {
      drawBoxes(ctx, L, [
        { box: GT_CAT, color: GT, lw: 1.6, dash: [5, 4], tag: U.pic.gt, tagAt: "bl" },
        { box: DN_POS, color: OUT, lw: 2.2, tag: "+", tagAt: "tr" },
        { box: DN_NEG, color: BAD, lw: 2.2, tag: "−", tagAt: "br" },
      ]);
      line(T.pos, OUT, 12.5, 21);
      line(`IoU ${fix(iou(DN_POS, GT_CAT), 3)}`, palette.ink, fs, 20);
      y = wrapLabel(ctx, T.toGt, L.x, y, L.pw, OUT, fs, 19) + 12;
      line(T.neg, BAD, 12.5, 21);
      line(`IoU ${fix(iou(DN_NEG, GT_CAT), 3)}`, palette.ink, fs, 20);
      line(T.toNone, BAD, fs, 32);
      y = wrapLabel(ctx, T.queries, L.x, y, L.pw, palette.ink, fs, 19) + 4;
      wrapLabel(ctx, T.trainOnly, L.x, y, L.pw, palette.muted, 11, 18);
    } else {
      const sc = SCALES[gi], n = Math.round(Math.sqrt(sc.n));
      tokGrid(ctx, L, n, n > 10 ? 0.35 : 0.5, n === TOK ? "194,115,0" : "20,24,33");
      if (n === TOK) tokGrid(ctx, L, n, 0.85, "194,115,0");
      SCALES.forEach((s, i) => line(`${s.name} · ${T.grids[i]}: ${s.n}`, i === gi ? OUT : palette.ink, fs, 21));
      y += 8;
      line(T.entries, palette.muted, 11, 22);
      const all = allScaleTokens ** 2, s5 = SCALES[2].n ** 2, bw = L.pw * 0.9;
      line(`${T.all}`, palette.ink, 11.5, 14);
      ctx.fillStyle = `rgba(${palette.normalRgb},0.55)`; ctx.fillRect(L.x, y, bw, 10); y += 26;
      line(`${allScaleTokens}² = ${big(all)}`, palette.ink, fs, 26);
      line(`${T.s5}`, OUT, 11.5, 14);
      ctx.fillStyle = palette.track; ctx.fillRect(L.x, y, bw, 10);
      ctx.fillStyle = OUT; ctx.fillRect(L.x, y, Math.max(2, (bw * s5) / all), 10); y += 26;
      line(`25² = ${big(s5)} · ${pct(s5 / all, 2)}`, OUT, fs, 22);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        {seg(T.view, T.views, view, setView)}
        {view === 1 ? seg(T.grid, T.grids, gi, setGi) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 · FRANCK: pseudo-labels, matching the student's slots, memory banks */
/* ------------------------------------------------------------------ */

export function SfodScene() {
  const [step, setStep] = useState(0);
  const [rule, setRule] = useState(0);
  const T = U.sfod;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = h > w * 1.15, fs = w < 420 ? 11.5 : 12;
    const pl = pseudoLabels(), C = costMatrix(STUDENT, pl).map((r) => r.map((c) => c.total)), best = bestAssign(C);

    if (step === 1) {
      let y = 18;
      label(ctx, `${T.student} · ${T.pseudo}`, PAD, y, palette.muted, 11); y += 30;
      const c0 = port ? 120 : 200, cw = Math.min(port ? 90 : 100, (w - 2 * PAD - c0) / pl.length), rh = 36;
      pl.forEach((g, j) => label(ctx, g.cls === "cat" ? U.names.cat : U.names.cup, PAD + c0 + j * cw + cw / 2, y, GT, 11.5, "center"));
      y += 16;
      STUDENT.forEach((s, i) => {
        const yy = y + i * rh, k = argmax(s.p.slice(0, 2));
        label(ctx, `${U.pic.slot} ${i + 1}`, PAD, yy + rh / 2 - 6, palette.ink, fs);
        fitLabel(ctx, port ? `${NM[k]} ${fix(s.p[k], 2)}` : `${NM[k]} ${fix(s.p[k], 2)} · ${U.names.none} ${fix(s.p[2], 2)}`, PAD, yy + rh / 2 + 9, c0 - 8, palette.muted, 11);
        pl.forEach((_, j) => {
          const x = PAD + c0 + j * cw, isBest = best.pick[j] === i;
          ctx.fillStyle = isBest ? TINT : "#ffffff"; ctx.fillRect(x + 2, yy + 2, cw - 4, rh - 4);
          frame(ctx, x + 2, yy + 2, cw - 4, rh - 4, isBest ? OUT : palette.frame, isBest ? 2.2 : 1);
          label(ctx, fix(C[i][j], 3), x + cw / 2, yy + rh / 2, isBest ? OUT : palette.ink, 12, "center");
        });
      });
      y += STUDENT.length * rh + 22;
      fitLabel(ctx, `${U.match.best}: ${best.pick.map((s, j) => `${pl[j].cls === "cat" ? U.names.cat : U.names.cup} ${U.pic.slot} ${s + 1}`).join(", ")}`, PAD, y, w - 2 * PAD, OUT, 12); y += 22;
      fitLabel(ctx, "04절과 같은 비용, 같은 짝짓기. 정답 자리에 가짜 정답", PAD, y, w - 2 * PAD, palette.muted, 11.5);
      return;
    }

    const L = layout(w, h);
    label(ctx, `${U.pic.fog} · ${step === 0 ? T.teacher : T.student}`, L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { loading: U.pic.loading });
    fogOver(ctx, L, 0.55);
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };

    if (step === 0) {
      const items: BoxItem[] = [];
      TEACHER.forEach((s, i) => {
        const k = argmax(s.p.slice(0, 2)), keep = s.p[k] > 0.3;
        if (keep) items.push({ box: s.box, color: GT, lw: 2, dash: [5, 4], tag: `${i + 1} ${NM[k]} ${fix(s.p[k], 2)}`, tagAt: i === 0 ? "br" : "tl" });
        else if (i === 1) items.push({ box: s.box, color: palette.excluded, lw: 1.2, dash: [3, 4], tag: `${i + 1} ${fix(s.p[k], 2)}`, tagAt: "tl" });
      });
      drawBoxes(ctx, L, items);
      line(`${T.teacher} · ${T.keep}`, palette.muted, 11, 24);
      TEACHER.forEach((s, i) => {
        const k = argmax(s.p.slice(0, 2)), keep = s.p[k] > 0.3;
        line(`${U.pic.slot} ${i + 1}  ${NM[k]} ${fix(s.p[k], 2)}  ${keep ? T.pseudo : ""}`, keep ? GT : palette.muted, fs, L.port ? 21 : 24);
      });
      y += 6;
      line(`${T.pseudo}: ${pl.map((g) => (g.cls === "cat" ? U.names.cat : U.names.cup)).join(", ")}`, GT, 12.5, 22);
    } else {
      const bk = banks(rule === 0 ? "match" : "thr");
      const items: BoxItem[] = STUDENT.map((s, i) => ({ s, i })).filter(({ i }) => bk[i] !== "bg" || i === 1 || i === 3)
        .map(({ s, i }) => ({ box: s.box, color: bk[i] === "cat" ? (i === 3 ? BAD : OUT) : bk[i] === "cup" ? READ : palette.excluded, lw: bk[i] === "bg" ? 1.2 : 2.2, dash: bk[i] === "bg" ? [3, 4] : undefined, tag: `${i + 1}`, tagAt: (["br", "tl", "tl", "tr", "bl"] as const)[i] }));
      drawBoxes(ctx, L, items);
      line(`${T.rule}: ${T.rules[rule]}`, palette.muted, 11, 24);
      (["cat", "cup", "bg"] as const).forEach((b, bi) => {
        const ids = bk.map((v, i) => (v === b ? i : -1)).filter((i) => i >= 0);
        const color = b === "cat" ? OUT : b === "cup" ? READ : palette.muted;
        rbox(ctx, L.x, y - 10, L.pw, 42, 6, b === "cat" ? TINT : b === "cup" ? `rgba(${palette.normalRgb},0.1)` : "rgba(15,23,42,0.04)", color, 1.2);
        label(ctx, T.banks[bi], L.x + 8, y + 1, color, 12);
        fitLabel(ctx, ids.map((i) => `${U.pic.slot} ${i + 1}`).join(", ") || "-", L.x + 8, y + 20, L.pw - 16, palette.ink, fs);
        y += 52;
      });
      if (bk[3] === "cat") {
        line(`${T.wall}: ${U.pic.slot} 4 [${STUDENT[3].feat.map((v) => fix(v, 2)).join(", ")}]`, BAD, 11.5, 20);
      } else {
        line(`짝: ${best.pick.map((s, j) => `${pl[j].cls === "cat" ? U.names.cat : U.names.cup} ${U.pic.slot} ${s + 1}`).join(", ")}`, OUT, 11.5, 20);
      }
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        {seg(T.step, T.steps, step, setStep, true)}
        {step === 2 ? seg(T.rule, T.rules, rule, setRule) : null}
      </div>
    </div>
  );
}

