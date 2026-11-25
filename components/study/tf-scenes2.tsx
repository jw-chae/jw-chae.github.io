"use client";

import { useMemo, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, bar, frame, line, rbox, signed, type Ctx } from "./kit";
import { tfCopy } from "./tf-copy";
import { CROSS_OTHER, OUT_ANSWER, OUT_Z0, TABLE, VOCAB, cosine, dot, idOf, maskedWeights, memoShare, outStep, posSim, sinusoid, softmax } from "./tf-math";
import { fillBlank } from "./walk-math";

const U = tfCopy.ui;
const PAD = 18;
const READ = palette.normal;
const isPortrait = (w: number, h: number) => h > w * 1.15;
const pc = (v: number) => `${v < 0.01 && v > 0 ? (v * 100).toFixed(1) : Math.round(v * 100)}%`;
const f2 = (v: number) => (Math.abs(v) < 0.005 ? "0.00" : v.toFixed(2));

function disc(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/* ------------------------------------------------------------------ */
/* 05 · What is left of cats in a memo, against reading it directly     */
/* ------------------------------------------------------------------ */

export function RnnFadeScene() {
  const [after, setAfter] = useState(7);
  const [lam, setLam] = useState(0.8);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const n = 3 + after, x0 = PAD, x1 = w - PAD, bw = (x1 - x0) / n, g = Math.max(0, (h - 440) / 3);
    const y1 = 56, rowH = 88 + g, y2 = y1 + rowH + 58 + g, cellH = 24, yBlank = y2 + cellH + 30 + g;
    const cx = (i: number) => x0 + (i + 0.5) * bw;

    // the memo after the last word: each word's share relative to the word read last
    label(ctx, U.rnn.memo, x0, 14, palette.accent, 11);
    for (let i = 0; i < n; i++) {
      const share = memoShare(lam, n - 1 - i);
      ctx.fillStyle = palette.track; ctx.fillRect(x0 + i * bw + 1, y1, Math.max(1, bw - 2), rowH);
      ctx.fillStyle = i === 2 ? READ : `rgba(${palette.accentRgb},0.75)`;
      ctx.fillRect(x0 + i * bw + 1, y1 + rowH * (1 - share), Math.max(1, bw - 2), rowH * share);
    }
    label(ctx, "cats", Math.max(cx(2), x0 + 16), y1 - 12, READ, 12, "center");
    label(ctx, U.rnn.sentence, x0, y1 + rowH + 13, palette.muted, 11);
    label(ctx, `${U.rnn.tail} ${after}${U.rnn.unit}`, x1, y1 + rowH + 13, palette.muted, 11, "right");

    // the way of 02: the blank reads the position itself, however many words follow
    label(ctx, U.rnn.direct, x0, y2 - 16, READ, 11);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = i === 2 ? READ : palette.track2; ctx.fillRect(x0 + i * bw + 1, y2, Math.max(1, bw - 2), cellH);
    }
    const stride = Math.max(1, Math.round(n / 12));
    for (let i = 0; i < n; i += stride) if (i !== 2) line(ctx, w / 2, yBlank, cx(i), y2 + cellH + 2, `rgba(${palette.inkRgb},0.14)`, 1);
    line(ctx, w / 2, yBlank, cx(2), y2 + cellH + 2, READ, 2.5);
    rbox(ctx, w / 2 - 58, yBlank, 116, 30, 8, `rgba(${palette.accentRgb},0.1)`, palette.accent, 1.5);
    label(ctx, U.rnn.blank, w / 2, yBlank + 15, palette.ink, 13, "center");

    const ty = h - 58, left = memoShare(lam, after);
    label(ctx, `${U.rnn.left} ${(left * 100).toFixed(left < 0.1 ? 1 : 0)}%`, x0, ty, palette.ink, 12);
    label(ctx, `${U.rnn.path}: ${U.rnn.overwrite} ${after}${U.rnn.times} · ${U.rnn.hop}`, x0, ty + 20, palette.ink, 12);
    label(ctx, `${U.rnn.serial}: ${U.rnn.memoN} ${n}${U.rnn.times} · ${U.rnn.directN}`, x0, ty + 40, palette.muted, 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.rnn.after} <b>{after}</b></span>
          <input type="range" min={0} max={47} step={1} value={after} onChange={(e) => setAfter(Number(e.target.value))} />
        </label>
        <label className="ad-ctl">
          <span>{U.rnn.keep} <b>{lam.toFixed(2)}</b></span>
          <input type="range" min={0.5} max={0.99} step={0.01} value={lam} onChange={(e) => setLam(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · Word → number → row of the embedding table → a vector           */
/* ------------------------------------------------------------------ */

type EmbedMode = "sentence" | "pair";
const VERB_ID = { love: idOf("love"), chase: idOf("chase") };
const ID_I = idOf("I"), ID_CATS = idOf("cats"), ID_DOGS = idOf("dogs");

export function EmbedScene() {
  const [mode, setMode] = useState<EmbedMode>("sentence");
  const [verb, setVerb] = useState<keyof typeof VERB_ID>("love");
  const [a, setA] = useState(ID_CATS);
  const [b, setB] = useState(ID_DOGS);
  const picked = useMemo(() => (mode === "sentence" ? [ID_I, VERB_ID[verb], ID_CATS] : [a, b]), [mode, verb, a, b]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const colors = mode === "sentence" ? [palette.muted, palette.accent2, READ] : [READ, palette.accent];
    const colorOf = (id: number) => { const k = picked.lastIndexOf(id); return k < 0 ? null : colors[k]; };

    // the words that go in, each with the number looked up for it
    label(ctx, mode === "sentence" ? U.embed.lookup : U.embed.compare, PAD, 14, palette.muted, 11);
    const sy = 30, np = picked.length, sbw = Math.min(100, (w - 2 * PAD - (np - 1) * 10) / np), sx0 = (w - (np * sbw + (np - 1) * 10)) / 2;
    picked.forEach((id, k) => {
      const x = sx0 + k * (sbw + 10);
      rbox(ctx, x, sy, sbw, 30, 8, "#ffffff", colors[k], 2);
      label(ctx, VOCAB[id], x + sbw / 2, sy + 15, palette.ink, 13, "center");
      label(ctx, `${U.embed.id} ${id}`, x + sbw / 2, sy + 43, colors[k], 11, "center");
    });

    const rh = portrait ? 18 : 20, tw = portrait ? Math.min(w - 2 * PAD, 280) : 176;
    const tx = portrait ? (w - tw) / 2 : PAD, ty = sy + 78;
    label(ctx, U.embed.table, tx, ty - 12, palette.muted, 11);
    TABLE.forEach((v, i) => {
      const y = ty + i * rh, col = colorOf(i);
      if (col) { ctx.save(); ctx.globalAlpha = 0.14; ctx.fillStyle = col; ctx.fillRect(tx, y, tw, rh - 2); ctx.restore(); frame(ctx, tx, y, tw, rh - 2, col, 1.5); }
      label(ctx, String(i), tx + 6, y + rh / 2 - 1, col ?? palette.muted, 11);
      label(ctx, VOCAB[i], tx + 28, y + rh / 2 - 1, col ? palette.ink : palette.muted, 12);
      v.forEach((x, d) => {
        ctx.fillStyle = signed(x, 1); ctx.fillRect(tx + tw - 92 + d * 46, y + 2, 42, rh - 6);
        label(ctx, x.toFixed(2), tx + tw - 71 + d * 46, y + rh / 2 - 1, palette.ink, 10, "center");
      });
    });

    const mapTop = portrait ? ty + 8 * rh + 26 : ty;
    const S = portrait ? Math.min(w - 2 * PAD, h - mapTop - 44) : Math.min(w - tx - tw - 30 - PAD, h - ty - 50);
    const mx = portrait ? (w - S) / 2 : tx + tw + 30, cx = mx + S / 2, cy = mapTop + S / 2, sc = S / 2 / 1.2;
    const X = (v: number[]) => cx + v[0] * sc, Y = (v: number[]) => cy - v[1] * sc;
    if (!portrait) label(ctx, U.embed.map, mx, mapTop - 12, palette.muted, 11);
    line(ctx, mx, cy, mx + S, cy, palette.frame, 1); line(ctx, cx, mapTop, cx, mapTop + S, palette.frame, 1);
    TABLE.forEach((v, i) => {
      if (picked.includes(i)) return;
      disc(ctx, X(v), Y(v), 3.5, palette.dotOff);
      label(ctx, VOCAB[i], X(v) + 7, Y(v), palette.muted, 10);
    });
    picked.forEach((id, k) => {
      arrow(ctx, cx, cy, X(TABLE[id]), Y(TABLE[id]), colors[k], 2.5);
      label(ctx, VOCAB[id], X(TABLE[id]) + (TABLE[id][0] < 0 ? -8 : 8), Y(TABLE[id]) - 8, colors[k], 12, TABLE[id][0] < 0 ? "right" : "left");
    });

    if (mode === "sentence") {
      label(ctx, U.embed.same, w / 2, h - 22, READ, 12, "center");
    } else {
      const cs = cosine(TABLE[a], TABLE[b]);
      label(ctx, `${U.embed.dot} ${f2(dot(TABLE[a], TABLE[b]))}  ·  ${U.embed.cos} ${f2(cs)}`, w / 2, h - 22, cs > 0.7 ? palette.mint : cs > 0 ? palette.ink : palette.anomaly, 13, "center");
    }
  });

  const picker = (value: number, set: (i: number) => void, name: string) => (
    <div className="ad-ctl ad-seg" role="group" aria-label={name}>
      <span>{name}</span>
      {VOCAB.map((wd, i) => <button key={wd} type="button" className={value === i ? "on" : ""} onClick={() => set(i)}>{wd}</button>)}
    </div>
  );

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.embed.mode}>
          <span>{U.embed.mode}</span>
          <button type="button" className={mode === "sentence" ? "on" : ""} onClick={() => setMode("sentence")}>{U.embed.sentence}</button>
          <button type="button" className={mode === "pair" ? "on" : ""} onClick={() => setMode("pair")}>{U.embed.pair}</button>
        </div>
        {mode === "sentence" ? (
          <div className="ad-ctl ad-seg" role="group" aria-label={U.embed.verb}>
            <span>{U.embed.verb}</span>
            <button type="button" className={verb === "love" ? "on" : ""} onClick={() => setVerb("love")}>love</button>
            <button type="button" className={verb === "chase" ? "on" : ""} onClick={() => setVerb("chase")}>chase</button>
          </div>
        ) : (
          <>
            {picker(a, setA, U.embed.a)}
            {picker(b, setB, U.embed.b)}
          </>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10 · Sinusoidal position vectors and how alike two positions are     */
/* ------------------------------------------------------------------ */

const NPOS = 32, PD = 16;
const PES = Array.from({ length: NPOS }, (_, p) => sinusoid(p, PD));

export function PositionScene() {
  const [p, setP] = useState(10);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const x0 = PAD + 4, cw = (w - 2 * PAD - 8) / NPOS, ch = Math.min(11, (h * 0.42) / PD), y0 = 44;

    label(ctx, U.posenc.stripes, x0, y0 - 18, palette.muted, 11);
    for (let q = 0; q < NPOS; q++) for (let d = 0; d < PD; d++) {
      ctx.fillStyle = signed(PES[q][d], 1);
      ctx.fillRect(x0 + q * cw + 0.5, y0 + d * ch + 0.5, cw - 1, ch - 1);
    }
    frame(ctx, x0 + p * cw, y0 - 1, cw, PD * ch + 2, palette.ink, 2);
    label(ctx, U.posenc.fast, x0 + NPOS * cw, y0 - 18, palette.muted, 11, "right");
    label(ctx, U.posenc.slow, x0 + NPOS * cw, y0 + PD * ch + 11, palette.muted, 11, "right");

    // dot product of PE(p) with every PE(q), scaled so identical vectors give 1
    const by = y0 + PD * ch + 44, bh = Math.min(120, h - by - 62), mid = by + bh * 0.72;
    label(ctx, U.posenc.sim, x0, by - 12, palette.muted, 11);
    line(ctx, x0, mid, x0 + NPOS * cw, mid, palette.frame, 1);
    for (let q = 0; q < NPOS; q++) {
      const s = posSim(p, q, PD), hh = s * bh * 0.7;
      ctx.fillStyle = q === p ? palette.ink : s >= 0 ? `rgba(${palette.normalRgb},0.8)` : `rgba(${palette.anomalyRgb},0.7)`;
      ctx.fillRect(x0 + q * cw + 1, hh >= 0 ? mid - hh : mid, Math.max(1, cw - 2), Math.abs(hh));
    }
    const ly = mid + bh * 0.28 + 10;
    label(ctx, `${U.posenc.pos} ${p}`, x0 + (p + 0.5) * cw, ly, palette.ink, 11, "center");
    // the same two numbers wherever the chosen position is: the dot product depends on the distance only
    const s1 = posSim(p, p + 1 < NPOS ? p + 1 : p - 1, PD), s2 = posSim(p, p + 2 < NPOS ? p + 2 : p - 2, PD);
    label(ctx, `${U.posenc.one} ${s1.toFixed(2)}  ·  ${U.posenc.two} ${s2.toFixed(2)}`, w / 2, ly + 24, READ, 12, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.posenc.pos} <b>{p}</b></span>
          <input type="range" min={0} max={NPOS - 1} step={1} value={p} onChange={(e) => setP(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 12 · The causal mask on the Korean answer line                       */
/* ------------------------------------------------------------------ */

export function MaskScene() {
  const [on, setOn] = useState(false);
  const [row, setRow] = useState(1);
  const weights = useMemo(() => maskedWeights(on), [on]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const n = 4, T = U.mask.tokens, A = U.mask.answers;
    const lw = 56, rw = 56, m = Math.min(64, (w - 2 * PAD - lw - rw) / n, (h - 170) / n);
    const x0 = (w - (lw + n * m + rw)) / 2 + lw, y0 = 70 + Math.max(0, (h - 440) / 4);

    label(ctx, U.mask.key, x0 + (n * m) / 2, y0 - 44, palette.muted, 11, "center");
    T.forEach((t, j) => label(ctx, t, x0 + (j + 0.5) * m, y0 - 16, j <= row || !on ? palette.ink : palette.dotOff, 11, "center"));
    label(ctx, U.mask.query, x0 - 10, y0 - 44, palette.muted, 11, "right");
    label(ctx, U.mask.must, x0 + n * m + 8, y0 - 44, palette.mint, 11);
    for (let i = 0; i < n; i++) {
      label(ctx, T[i], x0 - 10, y0 + (i + 0.5) * m, i === row ? palette.accent : palette.ink, 11, "right");
      label(ctx, A[i], x0 + n * m + 8, y0 + (i + 0.5) * m, i === row ? palette.mint : palette.muted, 11);
      for (let j = 0; j < n; j++) {
        const x = x0 + j * m, y = y0 + i * m, wt = weights[i][j];
        if (on && j > i) {
          ctx.fillStyle = palette.track; ctx.fillRect(x + 1, y + 1, m - 2, m - 2);
          ctx.save();
          ctx.beginPath(); ctx.rect(x + 1, y + 1, m - 2, m - 2); ctx.clip();
          ctx.strokeStyle = palette.dotOff; ctx.lineWidth = 1; ctx.beginPath();
          for (let k = -m; k < m; k += 7) { ctx.moveTo(x + k, y + m); ctx.lineTo(x + k + m, y); }
          ctx.stroke();
          ctx.restore();
        } else {
          ctx.fillStyle = `rgba(${palette.normalRgb},${0.08 + 0.85 * wt})`; ctx.fillRect(x + 1, y + 1, m - 2, m - 2);
          if (m >= 34) label(ctx, pc(wt), x + m / 2, y + m / 2, wt > 0.5 ? "#ffffff" : palette.ink, 11, "center");
          // the slot one step to the right holds this row's own answer
          if (!on && j === i + 1) frame(ctx, x + 2, y + 2, m - 4, m - 4, palette.anomaly, 2);
        }
      }
    }
    frame(ctx, x0, y0 + row * m, n * m, m, palette.ink, 2);
    const visible = on ? T.slice(0, row + 1) : T, by = y0 + n * m + 24;
    label(ctx, `${T[row]} ${U.mask.sees}`, w / 2, by, palette.muted, 11, "center");
    label(ctx, visible.join("  "), w / 2, by + 19, palette.ink, 12, "center");
    if (row < n - 1 && !on) label(ctx, `${U.mask.leak} ${A[row]} ${pc(weights[row][row + 1])}`, w / 2, by + 42, palette.anomaly, 12, "center");
    else label(ctx, `${U.mask.must} ${A[row]}: ${row < n - 1 ? U.mask.hidden : U.mask.last}`, w / 2, by + 42, palette.mint, 12, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.mask.mask}>
          <span>{U.mask.mask}</span>
          <button type="button" className={!on ? "on" : ""} onClick={() => setOn(false)}>{U.mask.off}</button>
          <button type="button" className={on ? "on" : ""} onClick={() => setOn(true)}>{U.mask.on}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.mask.row}>
          <span>{U.mask.row}</span>
          {U.mask.tokens.map((t, i) => <button key={t} type="button" className={row === i ? "on" : ""} onClick={() => setRow(i)}>{t}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 13 · Encoder, decoder, and cross-attention across a word-order gap   */
/* ------------------------------------------------------------------ */

/** Reading shares over I, love, cats of the slot that holds the query: <start>, 나는, 고양이를.
 *  The 나는 slot is the blank of 02: 2%, 19%, 79%. */
const CROSS = [softmax(CROSS_OTHER[0]), fillBlank("cats").weights, softmax(CROSS_OTHER[1])];
/** Masked self-attention of the same slots: the rows of the 12 figure with the mask on (나는 reads 38%, 62%). */
const SELF = maskedWeights(true);

export function EncDecScene() {
  const [step, setStep] = useState<number | null>(null);
  const [own, setOwn] = useState(false);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const s = step ?? Math.min(3, Math.floor(tt / 1.6) % 5);
    const bw = Math.min(104, (w - 2 * PAD - 30) / 4), bh = 38;
    const ys = 84, yt = h - 150;
    const sx = (i: number) => w / 2 + (i - 1) * (bw + 14), tx = (j: number) => w / 2 + (j - 1.5) * (bw + 10);

    rbox(ctx, PAD, ys - 44, w - 2 * PAD, bh + 62, 12, `rgba(${palette.memoryRgb},0.06)`, `rgba(${palette.memoryRgb},0.35)`, 1);
    label(ctx, U.encdec.source, PAD + 12, ys - 28, palette.memory, 11);
    U.encdec.src.forEach((t, i) => {
      rbox(ctx, sx(i) - bw / 2, ys, bw, bh, 8, "#ffffff", palette.memory, 2);
      label(ctx, t, sx(i), ys + bh / 2, palette.ink, 13, "center");
    });

    rbox(ctx, PAD, yt - 20, w - 2 * PAD, bh + 62, 12, `rgba(${palette.accentRgb},0.06)`, `rgba(${palette.accentRgb},0.35)`, 1);
    label(ctx, U.encdec.target, PAD + 12, yt + bh + 28, palette.accent, 11);
    // the slot that holds the query is the last one already on the line; the word it puts out goes in the slot to its right
    const shown = [U.encdec.start, ...U.encdec.tgt], q = s - 1;
    shown.forEach((t, j) => {
      const visible = j <= s, writing = j === s && s >= 1, owner = j === q;
      rbox(ctx, tx(j) - bw / 2, yt, bw, bh, 8, writing ? `rgba(${palette.accentRgb},0.16)` : owner ? `rgba(${palette.normalRgb},0.1)` : "#ffffff", owner ? READ : visible ? palette.accent : palette.dotOff, writing || owner ? 3 : 1.5);
      label(ctx, visible ? t : "?", tx(j), yt + bh / 2, visible ? palette.ink : palette.dotOff, 13, "center");
      if (owner) label(ctx, "Q", tx(j) - bw / 2 + 7, yt + 9, READ, 11);
    });

    if (s >= 1 && own) {
      SELF[q].slice(0, s).forEach((wt, j) => {
        ctx.save(); ctx.strokeStyle = `rgba(${palette.normalRgb},${0.25 + 0.75 * wt})`; ctx.lineWidth = 1 + 7 * wt;
        ctx.beginPath();
        if (j === q) ctx.arc(tx(j), yt - 15, 12, 0, Math.PI * 2);       // the slot reads itself too
        else { ctx.moveTo(tx(q), yt - 2); ctx.quadraticCurveTo((tx(q) + tx(j)) / 2, yt - 54, tx(j), yt - 2); }
        ctx.stroke(); ctx.restore();
        label(ctx, pc(wt), tx(j), yt + bh + 13, READ, 11, "center");
      });
      label(ctx, U.encdec.masked, w / 2, (yt + ys + bh) / 2 - 18, palette.muted, 11, "center");
    } else if (s >= 1) {
      CROSS[q].forEach((wt, i) => {
        if (wt < 0.01) return;
        line(ctx, tx(q), yt - 2, sx(i), ys + bh + 2, `rgba(${palette.normalRgb},${0.25 + 0.75 * wt})`, 1 + 9 * wt);
        label(ctx, pc(wt), sx(i), ys - 12, READ, 13, "center");
      });
    }
    if (s >= 1) {
      label(ctx, `${U.encdec.owner}: ${shown[q]}`, w / 2, h - 44, READ, 12, "center");
      label(ctx, `${U.encdec.writing}: ${U.encdec.tgt[q]}`, w / 2, h - 24, palette.ink, 13, "center");
    } else {
      label(ctx, U.encdec.first, w / 2, h - 30, palette.muted, 12, "center");
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.encdec.step}>
          <span>{U.encdec.step}</span>
          {[0, 1, 2, 3].map((i) => <button key={i} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i}</button>)}
          <button type="button" className={step === null ? "on" : ""} onClick={() => setStep(null)}>{U.encdec.auto}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.encdec.reads}>
          <span>{U.encdec.reads}</span>
          <button type="button" className={!own ? "on" : ""} onClick={() => setOwn(false)}>{U.encdec.cross}</button>
          <button type="button" className={own ? "on" : ""} onClick={() => setOwn(true)}>{U.encdec.self}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 14 · Candidate scores → probabilities → error, and one step of fixing */
/* ------------------------------------------------------------------ */

export function OutputScene() {
  const [state, setState] = useState({ z: OUT_Z0, steps: 0 });
  const p = softmax(state.z), loss = -Math.log(p[OUT_ANSWER]);
  const train = () => setState((s) => ({ z: outStep(s.z), steps: s.steps + 1 }));

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const x0 = PAD, nameW = 78, bx = x0 + nameW, bwid = w - PAD - bx - 108, rh = Math.min(40, (h - 190) / 6), y0 = 78;
    label(ctx, U.output.context, x0, 16, palette.ink, 12);
    label(ctx, U.output.prob, w < 420 ? x0 : bx, y0 - 20, palette.accent, 11);   // on phones the caption starts at the left edge so it clears the right-hand caption
    label(ctx, U.output.fix, w - PAD, y0 - 20, palette.muted, 11, "right");
    U.output.vocab.forEach((t, k) => {
      const y = y0 + k * rh, ans = k === OUT_ANSWER;
      label(ctx, t, x0, y + rh / 2 - 3, ans ? palette.mint : palette.ink, 12);
      bar(ctx, bx, y + rh / 2 - 10, bwid, 14, p[k], ans ? palette.mint : palette.accent);
      if (ans) frame(ctx, bx - 2, y + rh / 2 - 12, bwid + 4, 18, palette.mint, 1.5);
      label(ctx, `${(p[k] * 100).toFixed(1)}%`, bx + bwid + 8, y + rh / 2 - 3, palette.ink, 11);
      const g = p[k] - (ans ? 1 : 0);
      label(ctx, `${g > 0 ? "−" : "+"}${Math.abs(g).toFixed(2)}`, w - PAD, y + rh / 2 - 3, g > 0 ? palette.anomaly : palette.mint, 11, "right");
    });
    const ty = y0 + 6 * rh + 22;
    label(ctx, `${U.output.loss}  −ln(${p[OUT_ANSWER].toFixed(3)}) = ${loss.toFixed(2)}`, x0, ty, palette.ink, 13);
    label(ctx, `${U.output.step} ${state.steps}`, w - PAD, ty, palette.muted, 12, "right");
    bar(ctx, x0, ty + 16, w - 2 * PAD, 6, Math.min(1, loss / 2.2), palette.anomaly);
    label(ctx, U.output.rule, x0, ty + 44, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <button type="button" className="ad-btn" onClick={train}>{U.output.train}</button>
        <button type="button" className="ad-btn" onClick={() => setState({ z: OUT_Z0, steps: 0 })}>{U.output.reset}</button>
      </div>
    </div>
  );
}
