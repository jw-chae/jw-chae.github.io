"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { frame, rbox } from "./kit";
import { detrCopy } from "./detr-copy";
import {
  FINAL_ONE, FINAL_TWO, GT_ONE, GT_TWO, LAYER1_BOX, MID_ONE, MID_TWO, QUERIES, TOK, TOKENS,
  argmax, bestAssign, classHead, costMatrix, dot, greedy, iou, layer1, pe, read, selfAttn, totalLoss, type GtItem, type Part, type SlotOut,
} from "./detr-math";
import { CANDS_ONE, CANDS_TWO, SCORE_MIN, nms } from "./yolo-math";
import { BAD, GT, OUT, PAD, READ, TINT, drawBox, drawBoxes, drawGridOver, drawPicture, fitLabel, fix, layout, num, type BoxItem } from "./yolo-draw";
import { classBars, clsColor, cross, heat, pct, probBar, tokFill, tokGrid, tokNo, tokOutline, tokText, wrapLabel } from "./detr-draw";

const U = detrCopy.ui;
const NM = [U.names.cat, U.names.cup, U.names.none];
const seg = (label0: string, items: string[], cur: number, set: (i: number) => void, numbered = false) => (
  <div className="ad-ctl ad-seg" role="group" aria-label={label0}>
    <span>{label0}</span>
    {items.map((n, i) => <button key={n} type="button" className={cur === i ? "on" : ""} onClick={() => set(i)}>{numbered ? `${i + 1}. ${n}` : n}</button>)}
  </div>
);
/** The tag on a slot's box: "1 고양이 0.93". */
const slotTag = (i: number, p: number[], d = 2) => { const k = argmax(p); return `${i + 1} ${NM[k]} ${fix(p[k], d)}`; };
const tagCorner = (i: number) => (["br", "tl", "tl", "tr", "bl"] as const)[i];
const YOLO_TAG: Record<string, "br" | "tr" | "bl" | "tl"> = { A: "br", B: "tr", C: "bl", E: "tl", F: "tr" };

/* ------------------------------------------------------------------ */
/* 01 · The answer is a set: five slots, each with a box and three probabilities */
/* ------------------------------------------------------------------ */

export function SetScene() {
  const [view, setView] = useState(0);
  const [two, setTwo] = useState(false);
  const T = U.set;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    label(ctx, U.pic.size, L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { two, loading: U.pic.loading });
    const fs = L.pw < 260 ? 11.5 : 12;
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };

    if (view === 0) {
      const out: SlotOut[] = two ? FINAL_TWO : FINAL_ONE;
      drawBoxes(ctx, L, out.map((s, i) => ({ s, i })).filter(({ s }) => argmax(s.p) < 2)
        .map(({ s, i }): BoxItem => ({ box: s.box, color: clsColor(argmax(s.p)), lw: 2.4, tag: slotTag(i, s.p), tagAt: tagCorner(i) })));
      line(T.slots, palette.muted, 11, L.port ? 22 : 26);
      const rowH = L.port ? 36 : 42, bw = L.pw * 0.92;
      out.forEach((s, i) => {
        const k = argmax(s.p), none = k === 2;
        ctx.save(); ctx.globalAlpha = none ? 0.5 : 1;
        label(ctx, `${U.pic.slot} ${i + 1}`, L.x, y, palette.ink, fs);
        label(ctx, none ? `${T.dropped}` : `${NM[k]} ${fix(s.p[k], 2)} · ${T.out}`, L.x + bw, y, none ? palette.muted : clsColor(k), 11.5, "right");
        probBar(ctx, L.x, y + 8, bw, 9, s.p);
        ctx.restore();
        y += rowH;
      });
      y += 2;
      line(T.sum1, palette.muted, 11, 19);
      line(T.noIou, GT, 12, 20);
    } else {
      drawGridOver(ctx, L, { letters: false, alpha: 0.22 });
      const cands = two ? CANDS_TWO : CANDS_ONE, run = nms(cands, 0.5);
      const live = cands.filter((c) => c.score > SCORE_MIN);
      drawBoxes(ctx, L, live.map((c): BoxItem => ({ box: c.box, color: c.cls === "cup" ? READ : OUT, lw: 1.8, tag: `${c.id} ${fix(c.score, 2)}`, tagAt: YOLO_TAG[c.id] ?? "tl" })));
      line(T.yolo, palette.muted, 11, 26);
      line(T.fire, palette.muted, 11, 22);
      [...live].sort((a, b) => b.score - a.score).forEach((c) => line(`${c.id}  ${c.cls === "cup" ? U.names.cup : U.names.cat}  ${fix(c.score, 3)}`, c.cls === "cup" ? READ : palette.ink, fs, 21));
      y += 6;
      line(`${T.nmsCount} ${run.comparisons}번`, BAD, 12, 22);
      line(`${T.left}: ${run.kept.join(", ")}`, palette.ink, fs, 22);
      if (two && !run.kept.includes("F")) line("F가 지워져 둘째 고양이를 잃었다", BAD, 11.5, 20);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        {seg(T.view, T.views, view, setView)}
        {seg(T.pic, T.pics, two ? 1 : 0, (i) => setTwo(i === 1))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · Tokens: the 5 × 5 map, flattening, and the toy position vector   */
/* ------------------------------------------------------------------ */

const BASES = [11, 6, 18];       // token 12, 7, 19 (0-based indices)

export function TokenScene() {
  const [step, setStep] = useState(0);
  const [bi, setBi] = useState(0);
  const T = U.tokens;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    label(ctx, `${U.pic.size} · ${U.pic.tokens}`, L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { loading: U.pic.loading, fade: step === 2 ? 0.55 : 1 });
    const fs = L.pw < 260 ? 11.5 : 12;
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };
    tokGrid(ctx, L, TOK, 0.4);

    if (step === 0) {
      TOKENS.forEach((t) => {
        if (t.cup > t.cat) tokText(ctx, L, TOK, t.r, t.c, fix(t.cup, 2), READ);
        else if (t.cat >= 0.005) tokText(ctx, L, TOK, t.r, t.c, fix(t.cat, 2), OUT);
      });
      line(T.share, palette.muted, 11, 19);
      line(T.cupShare, READ, 11, 26);
      [11, 16, 6, 18, 19].forEach((i) => {
        const t = TOKENS[i];
        line(`${i + 1}${T.tok}  [${fix(t.cat, 3)}, ${fix(t.cup, 3)}]`, t.cup > t.cat ? READ : palette.ink, fs, 22);
      });
      y += 4;
      line("컵은 어느 토큰에서도 절반을 덮지 못한다", READ, 11.5, 20);
    } else if (step === 1) {
      const nb = [6, 10, 12, 16];
      tokFill(ctx, L, TOK, 2, 1, TINT);
      nb.forEach((i) => tokFill(ctx, L, TOK, TOKENS[i].r, TOKENS[i].c, `rgba(${palette.normalRgb},0.18)`));
      TOKENS.forEach((t, i) => tokNo(ctx, L, TOK, t.r, t.c, i === 11 ? OUT : nb.includes(i) ? READ : palette.muted));
      line(T.row, palette.muted, 11, 22);
      const chip = 20, per = Math.max(5, Math.floor(L.pw / (chip + 2)));
      TOKENS.forEach((_, i) => {
        const cx = L.x + (i % per) * (chip + 2), cy = y + Math.floor(i / per) * (chip + 6);
        const c = i === 11 ? OUT : nb.includes(i) ? READ : null;
        rbox(ctx, cx, cy - 2, chip, chip - 2, 3, c ? (i === 11 ? TINT : `rgba(${palette.normalRgb},0.18)`) : "#ffffff", c ?? palette.frame, c ? 1.6 : 1);
        label(ctx, String(i + 1), cx + chip / 2, cy + chip / 2 - 3, c ?? palette.muted, 11, "center");
      });
      y += Math.ceil(TOKENS.length / per) * (chip + 6) + 14;
      line(T.nb, OUT, 12, 22);
      line("위 7번, 아래 17번: 다섯 칸 떨어짐", READ, fs, 21);
      line("옆 11번, 13번: 바로 붙어 있음", READ, fs, 24);
      y = wrapLabel(ctx, T.gap5, L.x, y, L.pw, palette.muted, 11, 18);
    } else {
      const b = TOKENS[BASES[bi]], pb = pe(b.x, b.y);
      TOKENS.forEach((t) => {
        const v = dot(pb, pe(t.x, t.y));
        tokFill(ctx, L, TOK, t.r, t.c, heat(Math.max(0, v), 2));
        tokText(ctx, L, TOK, t.r, t.c, fix(v, 2), v > 1.5 ? palette.ink : palette.muted);
      });
      tokOutline(ctx, L, TOK, b.r, b.c, OUT, 2.4);
      line(`${T.peDot}`, palette.muted, 11, 22);
      line(`${T.vec} ${BASES[bi] + 1}${T.tok}: (${b.x}, ${b.y})`, OUT, fs, 22);
      line(`PE = [${pb.map((v) => fix(v, 3)).join(", ")}]`, palette.ink, 11.5, 26);
      line("PE(a)·PE(b) =", palette.muted, 11, 18);
      line("cos(πΔx/160) + cos(πΔy/160)", palette.ink, fs, 26);
      line(T.same, READ, 12, 22);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        {seg(T.step, T.steps, step, setStep, true)}
        {step === 2 ? seg(T.base, T.bases.map((b) => `${b}${T.tok}`), bi, setBi) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · One object query reads the 25 tokens (cross-attention)          */
/* ------------------------------------------------------------------ */

const PARTS: Part[] = ["both", "pos", "content"];

export function QueryScene() {
  const [si, setSi] = useState(0);
  const [pi, setPi] = useState(0);
  const T = U.query;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const L = layout(w, h);
    label(ctx, T.layer1, L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { loading: U.pic.loading, fade: 0.7 });
    const q = QUERIES[si], r = read(q, PARTS[pi]);
    const p = classHead(r.out);
    const mx = Math.max(...r.share);
    TOKENS.forEach((t, i) => tokFill(ctx, L, TOK, t.r, t.c, heat(r.share[i], Math.max(0.12, mx))));
    tokGrid(ctx, L, TOK, 0.25);
    const k = argmax(p);
    drawBox(ctx, L, LAYER1_BOX[si], clsColor(k), { lw: 2, dash: [6, 4] });
    cross(ctx, L, q.u, q.v, BAD, 5);
    // share numbers go on last so the dashed box never runs through them
    TOKENS.forEach((t, i) => tokText(ctx, L, TOK, t.r, t.c, (r.share[i] * 100).toFixed(1), r.share[i] > 0.08 ? palette.ink : palette.muted, -7));

    const fs = L.pw < 260 ? 11.5 : 12;
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };
    const qc = PARTS[pi] === "pos" ? [0, 0] : [q.cat, q.cup];
    line(`${U.pic.slot} ${si + 1}`, palette.ink, 13, 22);
    line(`${T.qc} [${qc.map((v) => num(v)).join(", ")}] · ${T.qp} ${PARTS[pi] === "content" ? "없음" : `(${q.u}, ${q.v})`}`, palette.muted, 11, L.port ? 22 : 26);
    line(`${T.top}`, palette.muted, 11, 19);
    const order = r.share.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]).slice(0, 3);
    order.forEach(([s, i]) => line(`${i + 1}번  ${T.score} ${fix(r.score[i], 3)}  ${T.share} ${pct(s)}`, READ, fs, 20));
    y += 4;
    line(`${T.o} = [${fix(r.out[0], 3)}, ${fix(r.out[1], 3)}]`, READ, fs, L.port ? 24 : 28);
    line(T.probs, palette.muted, 11, 20);
    y = classBars(ctx, L.x, y, L.pw, p, NM, fs, L.port ? 19 : 21) + 6;
    line(`${T.sumShare} · ${T.sumProb}`, palette.muted, 11, 18);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        {seg(T.slot, ["1", "2", "3", "4", "5"], si, setSi)}
        {seg(T.part, T.parts, pi, setPi)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · Hungarian matching: cost table, targets and loss, fixed order    */
/* ------------------------------------------------------------------ */

const gtName = (g: GtItem, two: boolean) => (g.cls === "cup" ? U.names.cup : two ? (g.name === "cat1" ? U.match.cat1 : U.match.cat2) : U.names.cat);

export function MatchScene() {
  const [view, setView] = useState(0);
  const [two, setTwo] = useState(false);
  const [rev, setRev] = useState(false);
  const T = U.match;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const slots = two ? MID_TWO : MID_ONE, base = two ? GT_TWO : GT_ONE;
    const gts = rev ? [base[base.length - 1], ...base.slice(0, -1)] : base;
    const C = costMatrix(slots, gts), Ct = C.map((r) => r.map((c) => c.total));
    const best = bestAssign(Ct), gr = greedy(Ct);
    const port = h > w * 1.15, fs = w < 420 ? 11.5 : 12;

    if (view === 0) {
      let y = 18;
      label(ctx, `${T.moment} · ${two ? T.pics[1] : T.pics[0]}`, PAD, y, palette.muted, 11); y += 30;
      const c0 = port ? 104 : 150, cw = Math.min(port ? 70 : 96, (w - 2 * PAD - c0) / gts.length), rh = port ? 34 : 36;
      gts.forEach((g, j) => label(ctx, gtName(g, two), PAD + c0 + j * cw + cw / 2, y, palette.muted, 11.5, "center"));
      y += 16;
      slots.forEach((s, i) => {
        const yy = y + i * rh, k = argmax(s.p.slice(0, 2));
        label(ctx, `${U.pic.slot} ${i + 1}`, PAD, yy + rh / 2 - 6, palette.ink, fs);
        const pt = port ? `${NM[k]} ${fix(s.p[k], 2)}` : `${U.names.cat} ${fix(s.p[0], 2)} · ${U.names.cup} ${fix(s.p[1], 2)}`;
        fitLabel(ctx, pt, PAD, yy + rh / 2 + 9, c0 - 8, k === 0 ? palette.muted : READ, 11);
        gts.forEach((_, j) => {
          const x = PAD + c0 + j * cw, isBest = best.pick[j] === i, isGr = gr[j] === i;
          ctx.fillStyle = isBest ? TINT : "#ffffff"; ctx.fillRect(x + 2, yy + 2, cw - 4, rh - 4);
          frame(ctx, x + 2, yy + 2, cw - 4, rh - 4, isBest ? OUT : palette.frame, isBest ? 2.2 : 1);
          label(ctx, fix(Ct[i][j], 3), x + cw / 2, yy + rh / 2, isBest ? OUT : palette.ink, 12, "center");
          if (isGr) { ctx.save(); ctx.strokeStyle = BAD; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x + 8, yy + rh - 7); ctx.lineTo(x + cw - 8, yy + rh - 7); ctx.stroke(); ctx.restore(); }
        });
      });
      y += slots.length * rh + 20;
      label(ctx, T.greedy, PAD, y, BAD, 11); y += 18;
      label(ctx, T.best, PAD, y, OUT, 11); y += 24;
      const conflict = new Set(gr).size < gr.length;
      if (conflict) { fitLabel(ctx, `${T.conflict}: ${U.pic.slot} ${gr[0] + 1}`, PAD, y, w - 2 * PAD, BAD, 12); y += 22; }
      fitLabel(ctx, `${T.total} ${fix(best.total, 3)} · ${T.tried} ${best.tried}가지`, PAD, y, w - 2 * PAD, OUT, 12.5); y += 24;
      const c = C[0][0];
      const calc = `−${fix(c.prob, 2)} + 5×${fix(c.L1, 5)} + 2×(1−${fix(c.G, 3)}) = ${fix(c.total, 3)}`;
      if (port) { label(ctx, `${U.pic.slot} 1, ${U.names.cat}:`, PAD, y, palette.muted, 11); y += 18; fitLabel(ctx, calc, PAD, y, w - 2 * PAD, palette.muted, 11.5); }
      else fitLabel(ctx, `${U.pic.slot} 1, ${U.names.cat}: ${calc}`, PAD, y, w - 2 * PAD, palette.muted, 11.5);
    } else {
      const L = layout(w, h);
      label(ctx, `${T.order}: ${rev ? T.orders[1] : T.orders[0]}`, L.px, L.py - 13, palette.muted, 11);
      drawPicture(ctx, L, { two, loading: U.pic.loading, fade: 0.85 });
      const res = totalLoss(slots, gts, view === 2 ? "fixed" : "match");
      const items: BoxItem[] = [];
      gts.forEach((g) => items.push({ box: g.box, color: GT, lw: 1.4, dash: [5, 4] }));
      res.t.forEach((t, i) => {
        if (t.cls === "none") return;
        items.push({ box: slots[i].box, color: t.cls === "cup" ? READ : OUT, lw: 2.2, tag: `${i + 1}`, tagAt: tagCorner(i) });
      });
      drawBoxes(ctx, L, items);
      let y = L.y + 6;
      const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };
      line(view === 2 ? T.views[2] : T.views[1], view === 2 ? BAD : OUT, 12.5, 24);
      line(`${U.pic.slot} · ${T.target} · ${T.cls} + ${T.box}`, palette.muted, 11, 21);
      res.t.forEach((t, i) => {
        const nm = t.cls === "none" ? U.names.none : gtName(gts[t.gt ?? 0], two);
        const tm = res.terms[i];
        line(`${i + 1}  ${nm}  ${fix(tm.cls, 3)}${t.box ? ` + ${fix(tm.box, 3)}` : ""}`, t.cls === "none" ? palette.muted : t.cls === "cup" ? READ : OUT, fs, L.port ? 20 : 22);
      });
      y += 6;
      line(`${T.sum} ${fix(res.total, 3)}`, view === 2 ? BAD : OUT, 13, 24);
      if (view === 1) line(`${T.order}를 바꿔도 같은 짝, 같은 손실`, GT, 11, 18);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        {seg(T.view, T.views, view, setView, true)}
        {seg(T.pic, T.pics, two ? 1 : 0, (i) => setTwo(i === 1))}
        {view > 0 ? seg(T.order, T.orders, rev ? 1 : 0, (i) => setRev(i === 1)) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · Slots reading each other (decoder self-attention)               */
/* ------------------------------------------------------------------ */

export function DedupScene() {
  const [step, setStep] = useState(0);
  const [on, setOn] = useState(true);
  const [two, setTwo] = useState(false);
  const T = U.dedup;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = h > w * 1.15, fs = w < 420 ? 11.5 : 12;
    const l1 = layer1(two), sa = selfAttn(two);
    const share = on ? sa.share : sa.share.map((r, i) => r.map((_, k) => (k === i ? 1 : 0)));

    if (step === 1) {
      let y = 20;
      label(ctx, T.rows, PAD, y, palette.muted, 11); y += 30;
      const c0 = port ? 58 : 74, cw = Math.min(port ? 56 : 80, (w - 2 * PAD - c0) / 5), rh = port ? 38 : 40;
      for (let k = 0; k < 5; k++) label(ctx, `${U.pic.slot} ${k + 1}`, PAD + c0 + k * cw + cw / 2, y, palette.muted, 11, "center");
      y += 14;
      share.forEach((row, i) => {
        const yy = y + i * rh, hi = i === 1;
        if (hi) { ctx.fillStyle = TINT; ctx.fillRect(PAD - 4, yy + 1, c0 + 5 * cw + 4, rh - 2); }
        label(ctx, `${U.pic.slot} ${i + 1}`, PAD, yy + rh / 2, hi ? OUT : palette.ink, fs);
        row.forEach((v, k) => {
          const x = PAD + c0 + k * cw;
          ctx.fillStyle = heat(v, 0.6); ctx.fillRect(x + 2, yy + 3, cw - 4, rh - 6);
          if (hi && k === 0 && on) frame(ctx, x + 2, yy + 3, cw - 4, rh - 6, OUT, 2.2);
          label(ctx, v === 0 ? "0" : (v * 100).toFixed(1), x + cw / 2, yy + rh / 2, v > 0.3 ? palette.ink : palette.muted, 12, "center");
        });
      });
      y += 5 * rh + 24;
      fitLabel(ctx, on ? `${T.gets} ${pct(share[1][0])}` : T.off, PAD, y, w - 2 * PAD, on ? OUT : BAD, 13); y += 24;
      wrapLabel(ctx, on ? "슬롯 1이 고양이를 적는다는 것이 슬롯 2의 계산에 들어온다" : T.nothing, PAD, y, w - 2 * PAD, palette.muted, 11.5, 19);
      return;
    }

    const L = layout(w, h);
    label(ctx, `${T.steps[step]}${step === 2 ? ` · ${T.sa} ${on ? T.sas[0] : T.sas[1]}` : ""}`, L.px, L.py - 13, palette.muted, 11);
    drawPicture(ctx, L, { two, loading: U.pic.loading });
    let y = L.y + 6;
    const line = (s: string, color: string = palette.ink, size = fs, dy = 21) => { fitLabel(ctx, s, L.x, y, L.pw, color, size); y += dy; };
    const rowH = L.port ? 34 : 40, bw = L.pw * 0.92;
    const rows = (ps: number[][], dim: (i: number) => boolean) => ps.forEach((p, i) => {
      const k = argmax(p);
      ctx.save(); ctx.globalAlpha = dim(i) ? 0.45 : 1;
      label(ctx, `${U.pic.slot} ${i + 1}`, L.x, y, palette.ink, fs);
      label(ctx, `${NM[k]} ${fix(p[k], 3)}`, L.x + bw, y, k === 2 ? palette.muted : clsColor(k), 11.5, "right");
      probBar(ctx, L.x, y + 8, bw, 8, p);
      ctx.restore();
      y += rowH;
    });

    if (step === 0) {
      const items: BoxItem[] = l1.map((r, i) => ({ r, i })).filter(({ r }) => argmax(r.p) < 2)
        .map(({ r, i }) => ({ box: LAYER1_BOX[i], color: clsColor(argmax(r.p)), lw: 2.2, tag: slotTag(i, r.p, 3), tagAt: tagCorner(i) }));
      drawBoxes(ctx, L, items);
      rows(l1.map((r) => r.p), (i) => argmax(l1[i].p) === 2);
      y += 2;
      line(`${T.iou} ${fix(iou(LAYER1_BOX[0], LAYER1_BOX[1]), 3)}`, BAD, fs, 20);
      line(T.dup, BAD, 11.5, 20);
    } else {
      const fin = two ? FINAL_TWO : FINAL_ONE;
      if (on) {
        drawBoxes(ctx, L, fin.map((s, i) => ({ s, i })).filter(({ s }) => argmax(s.p) < 2)
          .map(({ s, i }): BoxItem => ({ box: s.box, color: clsColor(argmax(s.p)), lw: 2.4, tag: slotTag(i, s.p), tagAt: tagCorner(i) })));
        if (!two) drawBox(ctx, L, fin[1].box, palette.excluded, { lw: 1.4, dash: [4, 4], tag: `2 ${U.names.none} ${fix(fin[1].p[2], 2)}`, tagAt: "tl" });
        rows(fin.map((s) => s.p), (i) => argmax(fin[i].p) === 2);
        y += 2;
        line(T.handset, palette.muted, 11, 18);
      } else {
        drawBox(ctx, L, fin[0].box, OUT, { lw: 2.4, tag: slotTag(0, fin[0].p), tagAt: "br" });
        drawBox(ctx, L, LAYER1_BOX[1], BAD, { lw: 2, dash: [5, 4], tag: "2 ?", tagAt: "tl" });
        line(`${U.pic.slot} 2 · ${T.sa} ${T.sas[1]}`, BAD, 13, 26);
        y = wrapLabel(ctx, T.nothing, L.x, y, L.pw, palette.ink, fs, 20) + 8;
        y = wrapLabel(ctx, "슬롯 1이 무엇을 적든 슬롯 2의 계산은 같다", L.x, y, L.pw, palette.muted, 11.5, 19) + 6;
        line(`${T.gets} 0%`, BAD, fs, 20);
      }
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        {seg(T.step, T.steps, step, setStep, true)}
        {step > 0 ? seg(T.sa, T.sas, on ? 0 : 1, (i) => setOn(i === 0)) : null}
        {step !== 1 ? seg(T.pic, T.pics, two ? 1 : 0, (i) => setTwo(i === 1)) : null}
      </div>
    </div>
  );
}

