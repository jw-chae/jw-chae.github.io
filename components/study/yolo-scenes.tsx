"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, bar, rbox, type Ctx } from "./kit";
import { yoloCopy } from "./yolo-copy";
import {
  ALPHA, BETA, BOXES, CANDS_ONE, CANDS_TWO, GRID, GT_CAT, GT_CUP, O2M_SCORE, O2O_CHOICES, O2O_SCORE, RC, SCORE_MIN, THRESHOLDS, TRAIN_IDS, TRAIN_P, U_STAR,
  area, assignO2M, assignO2O, cellAt, gap, inter, interBox, metric, nms, rankBy, trainIou, union, type Box, type Cand, type CellId,
} from "./yolo-math";
import { BAD, GT, OUT, PAD, READ, TINT, cellTag, drawBox, drawGridOver, drawPicture, fillCell, fitLabel, fix, layout, mapOf, num, outlineCell, table, tw } from "./yolo-draw";

const U = yoloCopy.ui;

/* ------------------------------------------------------------------ */
/* 01 · What one cell writes                                           */
/* ------------------------------------------------------------------ */

const PICK: (CellId | "bg")[] = ["A", "B", "C", "D", "E", "bg"];
const BG_RC: [number, number] = [0, 3];

export function CellScene() {
  const [pick, setPick] = useState(0);
  const [view, setView] = useState(0);
  const T = U.cell;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    label(ctx, U.pic.size, L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L);
    drawBox(ctx, L, GT_CAT, GT, { lw: 1.5, dash: [5, 4] });
    drawBox(ctx, L, GT_CUP, GT, { lw: 1.5, dash: [5, 4] });
    drawGridOver(ctx, L, { letters: false });

    const id = PICK[pick];
    const [r, c] = id === "bg" ? BG_RC : RC[id];
    const o = cellAt(r, c);
    const fs = L.pw < 260 ? 11.5 : 12, sq = L.port ? 0.88 : 1;
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 22) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy * sq; };

    if (view === 0) {
      fillCell(ctx, L, r, c, TINT);
      (["A", "B", "C", "D", "E"] as CellId[]).forEach((k) => cellTag(ctx, L, k, k === id ? OUT : palette.ink));
      drawBox(ctx, L, o.box, OUT, { lw: 2.5 });
      const name = id === "bg" ? "배경 칸" : `칸 ${id}`;
      line(`${name}${id === "bg" ? "이" : "가"} ${T.writes.trim()}`, OUT, 13, 26);
      line(`${T.box}  x1 y1 x2 y2`, palette.muted, 11, 18);
      line(`      ${o.box.map((v) => num(v, 0)).join("  ")}`, palette.ink, fs, 26);
      line(`${T.obj}  ${num(o.obj, 2)}`, palette.ink, fs, 14);
      bar(ctx, L.x, y - 4, L.pw * 0.8, 8, o.obj, OUT); y += 22 * sq;
      line(`${T.pCat}  ${num(o.pCat, 2)}`, palette.ink, fs, 18);
      line(`${T.pCup}  ${num(o.pCup, 2)}`, palette.ink, fs, 14);
      const bw = L.pw * 0.8;
      ctx.fillStyle = `rgba(${palette.accentRgb},0.55)`; ctx.fillRect(L.x, y - 4, bw * o.pCat, 8);
      ctx.fillStyle = `rgba(${palette.normalRgb},0.4)`; ctx.fillRect(L.x + bw * o.pCat, y - 4, bw * o.pCup, 8);
      y += 16 * sq;
      line(T.sumOne, palette.muted, 11, 26);
      line(T.score, palette.muted, 11, 20);
      line(`${T.catS}  ${num(o.obj, 2)} × ${num(o.pCat, 2)} = ${num(o.obj * o.pCat, 3)}`, palette.ink, fs, 20);
      line(`${T.cupS}  ${num(o.obj, 2)} × ${num(o.pCup, 2)} = ${num(o.obj * o.pCup, 3)}`, palette.ink, fs, 24);
      if (area(o.box) > 1600 * 1.5) line(T.bigger, OUT, 11, 18);
    } else {
      (["A", "B", "C", "D"] as CellId[]).forEach((k) => fillCell(ctx, L, RC[k][0], RC[k][1], TINT));
      (["A", "B", "C", "D", "E"] as CellId[]).forEach((k) => cellTag(ctx, L, k));
      const four: CellId[] = ["A", "B", "C", "D"];
      four.forEach((k, i) => drawBox(ctx, L, BOXES[k], OUT, { lw: k === "A" ? 2.5 : 1.6, tag: k, tagAt: (["tr", "tl", "bl", "tl"] as const)[i] }));
      line(T.four, OUT, 13, 28);
      line(T.catScore, palette.muted, 11, 22);
      four.forEach((k) => {
        const s = cellAt(...RC[k]).obj * cellAt(...RC[k]).pCat;
        label(ctx, `${k}`, L.x, y, palette.ink, 13);
        bar(ctx, L.x + 22, y - 5, L.pw * 0.55, 10, s, OUT);
        label(ctx, num(s, 2), L.x + 30 + L.pw * 0.55, y, palette.ink, fs);
        y += 26;
      });
      y += 6;
      line(T.modelBlind, GT, 11, 20);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        {view === 0 ? (
          <div className="ad-ctl ad-seg" role="group" aria-label={T.cell}>
            <span>{T.cell}</span>
            {T.cells.map((n, i) => <button key={n} type="button" className={pick === i ? "on" : ""} onClick={() => setPick(i)}>{n}</button>)}
          </div>
        ) : null}
        <div className="ad-ctl ad-seg" role="group" aria-label={T.view}>
          <span>{T.view}</span>
          {T.views.map((n, i) => <button key={n} type="button" className={view === i ? "on" : ""} onClick={() => setView(i)}>{n}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · IoU and NMS                                                     */
/* ------------------------------------------------------------------ */

const tagAt = (id: string) => (({ A: "br", B: "tr", C: "bl", D: "tl", E: "tl", F: "tr" }) as const)[id as "A"] ?? "tl";

export function NmsScene() {
  const [step, setStep] = useState(0);
  const [ti, setTi] = useState(0);
  const [two, setTwo] = useState(false);
  const T = U.nms;
  const thr = THRESHOLDS[ti];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    label(ctx, U.pic.size, L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { two });
    drawGridOver(ctx, L, { letters: false, alpha: 0.14 });
    const cands: Cand[] = two ? CANDS_TWO : CANDS_ONE;
    const run = nms(cands, thr);
    const sorted = [...cands].sort((a, b) => b.score - a.score);
    const A = cands.find((c) => c.id === "A")!;
    const fs = L.pw < 260 ? 11.5 : 12;
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };

    if (step === 0) {
      sorted.forEach((c) => {
        const low = c.score <= SCORE_MIN;
        drawBox(ctx, L, c.box, low ? palette.excluded : c.cls === "cup" ? READ : OUT, { lw: 1.6, dash: low ? [4, 4] : undefined, tag: `${c.id} ${num(c.score, 3)}`, tagAt: tagAt(c.id) });
      });
      line(T.order, palette.muted, 11, 24);
      sorted.forEach((c) => {
        const low = c.score <= SCORE_MIN;
        const who = c.cls === "cup" ? U.pic.cup : U.pic.cat;
        line(`${c.id}  ${who}  ${num(c.score, 3)}${low ? `   ${T.below}` : ""}`, low ? palette.muted : c.cls === "cup" ? READ : palette.ink, fs, 22);
      });
    } else if (step === 1) {
      const others = cands.filter((c) => c.cls === "cat" && c.id !== "A" && c.score > SCORE_MIN);
      const B = BOXES.B, ib = interBox(BOXES.A, B);
      const m = mapOf(L);
      ctx.fillStyle = `rgba(${palette.normalRgb},0.22)`;
      ctx.fillRect(m.X(ib[0]), m.Y(ib[1]), m.X(ib[2]) - m.X(ib[0]), m.Y(ib[3]) - m.Y(ib[1]));
      others.forEach((c) => drawBox(ctx, L, c.box, READ, { lw: 1.4, tag: `${c.id} ${fix(iouA(c.box), 3)}`, tagAt: tagAt(c.id) }));
      drawBox(ctx, L, A.box, OUT, { lw: 3, tag: "A", tagAt: "br" });
      line(`A: ${T.top} · ${U.pic.cat} ${num(A.score, 3)}`, OUT, fs, 24);
      line(`A  ${num(BOXES.A[2] - BOXES.A[0], 0)} × ${num(BOXES.A[3] - BOXES.A[1], 0)} = ${area(BOXES.A)}`, palette.ink, fs);
      line(`B  ${num(B[2] - B[0], 0)} × ${num(B[3] - B[1], 0)} = ${area(B)}`, palette.ink, fs);
      line(`${T.inter}  ${num(ib[2] - ib[0], 0)} × ${num(ib[3] - ib[1], 0)} = ${inter(BOXES.A, B)}`, READ, fs);
      line(`${T.union}  ${area(BOXES.A)} + ${area(B)} − ${inter(BOXES.A, B)} = ${union(BOXES.A, B)}`, READ, fs);
      line(`IoU(A, B) = ${inter(BOXES.A, B)} ÷ ${union(BOXES.A, B)} = ${fix(iouA(B), 3)}`, READ, fs, 28);
      others.filter((c) => c.id !== "B").forEach((c) => line(`IoU(A, ${c.id}) = ${fix(iouA(c.box), 3)}`, READ, fs));
      line(`IoU(A, E) = 0   ${T.sameCls}`, palette.muted, 11, 20);
    } else {
      const keptSet = new Set(run.kept);
      sorted.filter((c) => c.score > SCORE_MIN).forEach((c) => {
        const k = keptSet.has(c.id);
        drawBox(ctx, L, c.box, k ? (c.cls === "cup" ? READ : OUT) : BAD, { lw: k ? 2.6 : 1.4, dash: k ? undefined : [5, 4], tag: `${c.id} ${k ? T.kept : T.removed}`, tagAt: tagAt(c.id) });
      });
      line(`${T.thr} ${num(thr, 1)}`, palette.muted, 11, 24);
      run.steps.forEach((s, i) => {
        line(`${i + 1}. ${s.keep} ${T.kept}`, palette.ink, fs, 19);
        s.removed.forEach((x) => line(`   ${x.id}  ${fix(x.iou, 3)} > ${num(thr, 1)}  ${T.removed}`, BAD, 11.5, 18));
        s.spared.forEach((x) => line(`   ${x.id}  ${fix(x.iou, 3)} ≤ ${num(thr, 1)}`, palette.muted, 11.5, 18));
      });
      y += 6;
      const catsKept = run.kept.filter((k) => k !== "E");
      const verdict = two
        ? (!catsKept.includes("F") ? T.miss : catsKept.length > 2 ? T.dup : T.ok)
        : catsKept.length > 1 ? T.dup : T.ok;
      line(verdict, verdict === T.ok ? GT : BAD, 12, 22);
      line(`${T.count} ${run.comparisons}번`, palette.muted, 11, 20);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.step}>
          <span>{T.step}</span>
          {T.steps.map((n, i) => <button key={n} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {n}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.thr}>
          <span>{T.thr}</span>
          {THRESHOLDS.map((v, i) => <button key={v} type="button" className={ti === i ? "on" : ""} onClick={() => setTi(i)}>{num(v, 1)}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.pic}>
          <span>{T.pic}</span>
          {T.pics.map((n, i) => <button key={n} type="button" className={two === (i === 1) ? "on" : ""} onClick={() => setTwo(i === 1)}>{n}</button>)}
        </div>
      </div>
    </div>
  );
}

const iouA = (b: Box) => inter(BOXES.A, b) / union(BOXES.A, b);

/* ------------------------------------------------------------------ */
/* 03 · One-to-many and one-to-one assignment                           */
/* ------------------------------------------------------------------ */

export function AssignScene() {
  const [rule, setRule] = useState(0);
  const [view, setView] = useState(0);
  const T = U.assign;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    label(ctx, view === 0 ? T.moment : T.views[1], L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L);
    drawGridOver(ctx, L, { letters: false, alpha: 0.18 });
    const fs = L.pw < 260 ? 11.5 : 12;
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };
    const asg = rule === 0 ? assignO2M() : assignO2O();
    const cs = L.s / GRID;

    if (view === 0) {
      TRAIN_IDS.forEach((k) => {
        const [r, c] = RC[k];
        const pos = asg.pos.includes(k);
        if (pos) fillCell(ctx, L, r, c, TINT);
        outlineCell(ctx, L, r, c, pos ? OUT : palette.muted, pos ? 2.2 : 1.2);
        const tv = fix(asg.target[k], 3), tx = L.px + c * cs + cs / 2, ty = L.py + r * cs + cs / 2 + 8, tW = tw(ctx, tv, 12) + 8;
        rbox(ctx, tx - tW / 2, ty - 8, tW, 16, 4, "rgba(255,255,255,0.92)", null);
        label(ctx, tv, tx, ty, pos ? OUT : palette.muted, 12, "center");
        cellTag(ctx, L, k, pos ? OUT : palette.ink);
      });
      drawBox(ctx, L, GT_CAT, GT, { lw: 2, dash: [5, 4], tag: U.pic.gt, tagAt: "bl" });
      line(`${T.rules[rule]}: ${T.pos} ${asg.pos.join(", ")}`, OUT, 12.5, 26);
      const cw = L.pw < 260 ? [30, 44, 52, 62, 54] : [34, 50, 62, 72, 66];
      const rows = [T.cols, ...TRAIN_IDS.map((k) => [k, fix(TRAIN_P[k], 2), fix(trainIou(k), 3), fix(metric(k), 4), fix(asg.target[k], 3)])];
      table(ctx, L.x, y, cw, rows, { rowH: 22, size: fs, fill: (r) => (r > 0 && asg.pos.includes(TRAIN_IDS[r - 1]) ? TINT : null), color: (r, c) => (r === 0 ? palette.muted : c === 4 && asg.pos.includes(TRAIN_IDS[r - 1]) ? OUT : palette.ink) });
      y += 22 * rows.length + 8;
      line(`m = s · p^${num(ALPHA)} · IoU^${num(BETA)}`, palette.muted, 11, 19);
      line(`${T.ustar} = ${fix(U_STAR, 3)}`, palette.muted, 11, 19);
      line(T.zero, palette.muted, 11, 19);
    } else {
      const sc = rule === 0 ? O2M_SCORE : O2O_SCORE;
      const ids: CellId[] = ["A", "B", "C", "D", "E"];
      ids.forEach((k) => {
        const on = sc[k] > SCORE_MIN;
        if (on) drawBox(ctx, L, BOXES[k], k === "E" ? READ : OUT, { lw: 2, tag: `${k} ${num(sc[k], 3)}`, tagAt: tagAt(k) });
      });
      line(T.fire, palette.muted, 11, 24);
      ids.forEach((k) => {
        const on = sc[k] > SCORE_MIN;
        label(ctx, k, L.x, y, on ? palette.ink : palette.muted, 13);
        bar(ctx, L.x + 22, y - 5, L.pw * 0.55, 10, sc[k], on ? (k === "E" ? READ : OUT) : palette.excluded);
        label(ctx, num(sc[k], 3), L.x + 30 + L.pw * 0.55, y, on ? palette.ink : palette.muted, fs);
        y += 25;
      });
      y += 8;
      line(rule === 0 ? T.needNms : T.noNms, rule === 0 ? BAD : GT, 12, 22);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.rule}>
          <span>{T.rule}</span>
          {T.rules.map((n, i) => <button key={n} type="button" className={rule === i ? "on" : ""} onClick={() => setRule(i)}>{n}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.view}>
          <span>{T.view}</span>
          {T.views.map((n, i) => <button key={n} type="button" className={view === i ? "on" : ""} onClick={() => setView(i)}>{n}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · YOLOv10: two heads in training, one at inference                */
/* ------------------------------------------------------------------ */

function headBox(ctx: Ctx, x: number, y: number, w: number, h: number, text: string, sub: string, color: string, faded: boolean) {
  ctx.save();
  ctx.globalAlpha = faded ? 0.35 : 1;
  rbox(ctx, x, y, w, h, 8, faded ? "#ffffff" : `rgba(${color === OUT ? palette.accentRgb : palette.normalRgb},0.12)`, color, 1.6);
  label(ctx, text, x + w / 2, y + (sub ? h / 2 - 8 : h / 2), palette.ink, 12, "center");
  if (sub) fitLabel(ctx, sub, x + w / 2, y + h / 2 + 9, w - 8, palette.muted, 11, "center");
  ctx.restore();
}

export function DualScene() {
  const [view, setView] = useState(0);
  const [mi, setMi] = useState(0);
  const [head, setHead] = useState(0);
  const T = U.dual;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = h > w * 1.15, fs = w < 420 ? 11.5 : 12;
    const ch = O2O_CHOICES[mi];
    const o2m = assignO2M(), o2o = assignO2O(ch.a, ch.b);

    // the network: picture, backbone + PAN, and two heads side by side
    const dTop = 14, bw = Math.min(150, (w - 2 * PAD - 40) / 3), bh = 40;
    const xIn = PAD, xBb = PAD + bw + 20, xHd = PAD + 2 * bw + 40;
    const yHead1 = dTop, yHead2 = dTop + bh + 12, yMid = dTop + bh + 6 - bh / 2;
    const useO2o = view === 0 || head === 0, useO2m = view === 0 || head === 1;
    headBox(ctx, xIn, yMid, bw, bh, T.input, "160 × 160", palette.muted, false);
    headBox(ctx, xBb, yMid, bw, bh, T.backbone, "", palette.muted, false);
    arrow(ctx, xIn + bw + 3, yMid + bh / 2, xBb - 3, yMid + bh / 2, palette.muted);
    headBox(ctx, xHd, yHead1, bw, bh, T.o2m, view === 1 && !useO2m ? T.dropped : T.o2mRule, OUT, !useO2m);
    headBox(ctx, xHd, yHead2, bw, bh, T.o2o, view === 1 && !useO2o ? T.dropped : view === 0 ? ch.key === "b2" ? "α 0.5, β 2" : `α ${num(ch.a)}, β ${num(ch.b)}` : "", READ, !useO2o);
    arrow(ctx, xBb + bw + 3, yMid + bh / 2 - 4, xHd - 3, yHead1 + bh / 2, useO2m ? palette.muted : palette.frame);
    arrow(ctx, xBb + bw + 3, yMid + bh / 2 + 4, xHd - 3, yHead2 + bh / 2, useO2o ? palette.muted : palette.frame);

    const top = dTop + 2 * bh + 34;
    if (view === 0) {
      let y = top;
      label(ctx, T.targets, PAD, y, palette.muted, 11); y += 26;
      const cw = port ? [36, 92, 92, 0] : [44, 110, 110, 150];
      const cols = port ? ["칸", T.o2m, T.o2o] : ["칸", T.o2m, T.o2o, T.rank];
      const order = rankBy(ch.a, ch.b);
      const rows = [cols, ...TRAIN_IDS.map((k) => {
        const r = [k, fix(o2m.target[k], 3), fix(o2o.target[k], 3)];
        if (!port) r.push(`${order.indexOf(k) + 1}등  m ${fix(metric(k, ch.a, ch.b), 4)}`);
        return r;
      })];
      table(ctx, PAD, y, cw.slice(0, cols.length), rows, {
        rowH: 24, size: fs,
        color: (r, c) => {
          if (r === 0) return c === 1 ? OUT : c === 2 ? READ : palette.muted;
          const k = TRAIN_IDS[r - 1];
          if (c === 1 && o2m.target[k] > 0) return OUT;
          if (c === 2 && o2o.target[k] > 0) return READ;
          return palette.ink;
        },
      });
      y += 24 * rows.length + 10;
      if (port) {
        order.forEach((k, i) => { label(ctx, `${T.rank} ${i + 1}등 ${k}  m ${fix(metric(k, ch.a, ch.b), 4)}`, PAD, y, palette.muted, 11); y += 18; });
        y += 6;
      }
      const same = o2o.pos[0] === rankBy(ALPHA, BETA)[0];
      label(ctx, same ? T.same : T.differ, PAD, y, same ? GT : BAD, 13); y += 26;
      label(ctx, `${T.gap} = ${fix(gap(o2m, o2o), 2)}`, PAD, y, same ? palette.ink : BAD, 13);
    } else {
      const L = layout(w, h - top + 40, 0.47, top);
      const Lp = port ? { ...L, py: top, y: top + L.s + 22 } : L;
      drawPicture(ctx, Lp);
      drawGridOver(ctx, Lp, { letters: false, alpha: 0.16 });
      const sc = head === 0 ? O2O_SCORE : O2M_SCORE;
      const ids: CellId[] = ["A", "B", "C", "D", "E"];
      ids.forEach((k) => { if (sc[k] > SCORE_MIN) drawBox(ctx, Lp, BOXES[k], k === "E" ? READ : OUT, { lw: 2, tag: `${k} ${num(sc[k], 3)}`, tagAt: tagAt(k) }); });
      let y = Lp.y + 4;
      label(ctx, `${T.heads[head]} · ${T.out}`, Lp.x, y, palette.muted, 11); y += 24;
      ids.forEach((k) => {
        const on = sc[k] > SCORE_MIN;
        label(ctx, k, Lp.x, y, on ? palette.ink : palette.muted, 13);
        bar(ctx, Lp.x + 22, y - 5, Lp.pw * 0.5, 10, sc[k], on ? (k === "E" ? READ : OUT) : palette.excluded);
        label(ctx, num(sc[k], 3), Lp.x + 30 + Lp.pw * 0.5, y, on ? palette.ink : palette.muted, fs);
        y += port ? 22 : 25;
      });
      y += 8;
      fitLabel(ctx, head === 0 ? T.noIou : T.nmsNeeded, Lp.x, y, Lp.pw, head === 0 ? GT : BAD, 12);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={T.view}>
          <span>{T.view}</span>
          {T.views.map((n, i) => <button key={n} type="button" className={view === i ? "on" : ""} onClick={() => setView(i)}>{i + 1}. {n}</button>)}
        </div>
        {view === 0 ? (
          <div className="ad-ctl ad-seg" role="group" aria-label={T.metric}>
            <span>{T.metric}</span>
            {T.metrics.map((n, i) => <button key={n} type="button" className={mi === i ? "on" : ""} onClick={() => setMi(i)}>{n}</button>)}
          </div>
        ) : (
          <div className="ad-ctl ad-seg" role="group" aria-label={T.head}>
            <span>{T.head}</span>
            {T.heads.map((n, i) => <button key={n} type="button" className={head === i ? "on" : ""} onClick={() => setHead(i)}>{n}</button>)}
          </div>
        )}
      </div>
    </div>
  );
}

