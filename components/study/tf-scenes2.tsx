"use client";

import { useMemo, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, bar, frame, line, rbox, signed, type Ctx } from "./kit";
import { tfCopy } from "./tf-copy";
import { TOY_HEAD, attention, dot, embed, norm, sinusoid, softmax } from "./tf-math";

const U = tfCopy.ui;
const PAD = 18;
const isPortrait = (w: number, h: number) => h > w * 1.15;

function disc(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
}

/* ------------------------------------------------------------------ */
/* 01 · What survives in an RNN's memory, against direct access         */
/* ------------------------------------------------------------------ */

export function RnnFadeScene() {
  const [n, setN] = useState(20);
  const [lam, setLam] = useState(0.8);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const x0 = PAD, x1 = w - PAD, bw = (x1 - x0) / n, rowH = Math.min(120, (h - 190) / 2);
    const y1 = 56, y2 = y1 + rowH + 56;

    label(ctx, U.rnn.rnn, x0, y1 - 18, palette.accent, 11);
    for (let i = 0; i < n; i++) {
      const share = Math.pow(lam, n - 1 - i);
      ctx.fillStyle = palette.track; ctx.fillRect(x0 + i * bw + 1, y1, Math.max(1, bw - 2), rowH);
      ctx.fillStyle = `rgba(${palette.accentRgb},0.85)`; ctx.fillRect(x0 + i * bw + 1, y1 + rowH * (1 - share), Math.max(1, bw - 2), rowH * share);
    }
    label(ctx, `${U.rnn.word} 1`, x0, y1 + rowH + 12, palette.muted, 10);
    label(ctx, `${U.rnn.word} ${n}`, x1, y1 + rowH + 12, palette.muted, 10, "right");

    label(ctx, U.rnn.attn, x0, y2 - 18, palette.memory, 11);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = `rgba(${palette.memoryRgb},0.75)`; ctx.fillRect(x0 + i * bw + 1, y2, Math.max(1, bw - 2), rowH);
    }
    // the last word reaches every other word in one hop
    ctx.save();
    ctx.strokeStyle = `rgba(${palette.inkRgb},0.25)`; ctx.lineWidth = 1;
    const lx = x0 + (n - 0.5) * bw;
    for (let i = 0; i < n - 1; i += Math.max(1, Math.round(n / 12))) {
      const tx = x0 + (i + 0.5) * bw;
      ctx.beginPath(); ctx.moveTo(lx, y2 + rowH); ctx.quadraticCurveTo((lx + tx) / 2, y2 + rowH + 26, tx, y2 + rowH); ctx.stroke();
    }
    ctx.restore();

    const ty = h - 44, first = Math.pow(lam, n - 1);
    label(ctx, `${U.rnn.first}: RNN ${(first * 100).toFixed(first < 0.1 ? 1 : 0)}%  ·  attention 100%`, x0, ty, palette.ink, 12);
    label(ctx, `${U.rnn.steps}: RNN ${n}  ·  attention 1`, x0, ty + 22, palette.muted, 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.rnn.length} <b>{n}</b></span>
          <input type="range" min={5} max={50} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
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
/* 02 · Token id → row of the embedding table → a direction             */
/* ------------------------------------------------------------------ */

const EMB: [number, number][] = [[0.8, 0.6], [0.9, 0.4], [0.6, 0.8], [-0.7, 0.6], [-0.8, 0.4], [0.2, -0.8], [0.35, -0.7], [-0.2, -0.75]];

export function EmbedScene() {
  const [a, setA] = useState(0);
  const [b, setB] = useState(1);
  const cos = dot(EMB[a], EMB[b]) / (norm(EMB[a]) * norm(EMB[b]));

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const rh = 20, tw = portrait ? Math.min(w - 2 * PAD, 280) : 176;
    const tx = portrait ? (w - tw) / 2 : PAD, ty = 44;
    const colA = palette.accent, colB = palette.memory;

    label(ctx, U.embed.table, tx, ty - 18, palette.muted, 11);
    EMB.forEach((v, i) => {
      const y = ty + i * rh, on = i === a || i === b, c = i === a ? colA : i === b ? colB : palette.muted;
      if (on) { ctx.fillStyle = i === a ? `rgba(${palette.accentRgb},0.12)` : `rgba(${palette.memoryRgb},0.12)`; ctx.fillRect(tx, y, tw, rh - 2); }
      label(ctx, String(i), tx + 6, y + rh / 2 - 1, c, 11);
      label(ctx, U.embed.words[i], tx + 28, y + rh / 2 - 1, on ? palette.ink : palette.muted, 12);
      v.forEach((x, d) => {
        ctx.fillStyle = signed(x, 1); ctx.fillRect(tx + tw - 92 + d * 46, y + 2, 42, rh - 6);
        label(ctx, x.toFixed(2), tx + tw - 71 + d * 46, y + rh / 2 - 1, palette.ink, 10, "center");
      });
    });

    const S = portrait ? Math.min(w - 2 * PAD, h - (ty + 8 * rh + 30) - 46) : Math.min(w - tx - tw - 30 - PAD, h - 96);
    const mapTop = portrait ? ty + 8 * rh + 30 : Math.max(30, (h - 40 - S) / 2);
    const mx = portrait ? (w - S) / 2 : tx + tw + 30, cx = mx + S / 2, cy = mapTop + S / 2, sc = S / 2 / 1.2;
    const X = (v: number[]) => cx + v[0] * sc, Y = (v: number[]) => cy - v[1] * sc;
    if (!portrait) label(ctx, U.embed.map, mx, mapTop - 12, palette.muted, 11);
    line(ctx, mx, cy, mx + S, cy, palette.frame, 1); line(ctx, cx, mapTop, cx, mapTop + S, palette.frame, 1);
    EMB.forEach((v, i) => {
      if (i === a || i === b) return;
      disc(ctx, X(v), Y(v), 3.5, palette.dotOff);
      label(ctx, U.embed.words[i], X(v) + 7, Y(v), palette.muted, 10);
    });
    for (const [i, c] of [[a, colA], [b, colB]] as [number, string][]) {
      arrow(ctx, cx, cy, X(EMB[i]), Y(EMB[i]), c, 2.5);
      label(ctx, U.embed.words[i], X(EMB[i]) + 8, Y(EMB[i]) - 8, c, 12);
    }
    label(ctx, `${U.embed.cos}: ${cos.toFixed(2)}`, w / 2, h - 22, cos > 0.7 ? palette.mint : cos > 0 ? palette.ink : palette.anomaly, 14, "center");
  });

  const picker = (value: number, set: (i: number) => void, name: string) => (
    <div className="ad-ctl ad-seg" role="group" aria-label={name}>
      <span>{name}</span>
      {U.embed.words.map((wd, i) => <button key={wd} type="button" className={value === i ? "on" : ""} onClick={() => set(i)}>{wd}</button>)}
    </div>
  );

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        {picker(a, setA, U.embed.a)}
        {picker(b, setB, U.embed.b)}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · Sinusoidal position vectors and how alike two positions are     */
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
    label(ctx, U.posenc.fast, x0 + NPOS * cw, y0 - 18, palette.muted, 10, "right");
    label(ctx, U.posenc.slow, x0 + NPOS * cw, y0 + PD * ch + 10, palette.muted, 10, "right");

    // dot product of PE(p) with every PE(q), scaled so identical vectors give 1
    const by = y0 + PD * ch + 40, bh = Math.min(120, h - by - 50), mid = by + bh * 0.72;
    label(ctx, U.posenc.sim, x0, by - 12, palette.muted, 11);
    line(ctx, x0, mid, x0 + NPOS * cw, mid, palette.frame, 1);
    for (let q = 0; q < NPOS; q++) {
      const s = dot(PES[p], PES[q]) / (PD / 2), hh = s * bh * 0.7;
      ctx.fillStyle = q === p ? palette.ink : s >= 0 ? `rgba(${palette.normalRgb},0.8)` : `rgba(${palette.anomalyRgb},0.7)`;
      ctx.fillRect(x0 + q * cw + 1, hh >= 0 ? mid - hh : mid, Math.max(1, cw - 2), Math.abs(hh));
    }
    label(ctx, `${U.posenc.pos} ${p}`, x0 + (p + 0.5) * cw, mid + bh * 0.28 + 8, palette.ink, 11, "center");
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
/* 08 · The causal mask                                                 */
/* ------------------------------------------------------------------ */

const MASK_SCORES = attention(embed(["A", "B", "C", "D", "E"], true), TOY_HEAD).scores;

export function MaskScene() {
  const [on, setOn] = useState(true);
  const [row, setRow] = useState<number | null>(null);
  const weights = useMemo(() => MASK_SCORES.map((s, i) => softmax(s.map((v, j) => (on && j > i ? -Infinity : v)))), [on]);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const n = 5, r = row ?? Math.floor(tt / 1.5) % n;
    const lw = 62, m = Math.min(58, (w - 2 * PAD - lw) / n, (h - 150) / n);
    const x0 = (w - (lw + n * m)) / 2 + lw, y0 = 64;

    label(ctx, U.mask.key, x0 + (n * m) / 2, y0 - 44, palette.muted, 11, "center");
    U.mask.tokens.forEach((t, j) => label(ctx, t, x0 + (j + 0.5) * m, y0 - 16, j <= r || !on ? palette.ink : palette.dotOff, 11, "center"));
    label(ctx, U.mask.query, x0 - lw, y0 - 16, palette.muted, 11);
    for (let i = 0; i < n; i++) {
      label(ctx, U.mask.tokens[i], x0 - 10, y0 + (i + 0.5) * m, i === r ? palette.accent : palette.ink, 11, "right");
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
          ctx.fillStyle = `rgba(${palette.accentRgb},${0.08 + 0.9 * wt})`; ctx.fillRect(x + 1, y + 1, m - 2, m - 2);
          if (m >= 34) label(ctx, wt.toFixed(2), x + m / 2, y + m / 2, wt > 0.55 ? "#ffffff" : palette.ink, 11, "center");
        }
      }
    }
    frame(ctx, x0, y0 + r * m, n * m, m, palette.ink, 2);
    const visible = on ? U.mask.tokens.slice(0, r + 1) : U.mask.tokens;
    label(ctx, `${U.mask.tokens[r]}: ${U.mask.sees} ${visible.length} / ${n}`, w / 2, y0 + n * m + 26, palette.ink, 12, "center");
    label(ctx, visible.join("  "), w / 2, y0 + n * m + 48, palette.accent, 12, "center");
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
          {[0, 1, 2, 3, 4].map((i) => <button key={i} type="button" className={row === i ? "on" : ""} onClick={() => setRow(i)}>{i + 1}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 09 · Encoder, decoder, and cross-attention across a word-order gap   */
/* ------------------------------------------------------------------ */

const SRC_V: [number, number][] = [[1, 0], [0, 1], [-0.707, -0.707]];      // 나는, 고양이를, 좋아한다
const TGT_Q: [number, number][] = [[1, 0], [-0.707, -0.707], [0, 1]];      // I, like, cats
const CROSS = TGT_Q.map((q) => softmax(SRC_V.map((k) => 4 * dot(q, k))));

export function EncDecScene() {
  const [step, setStep] = useState<number | null>(null);

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
    const shown = [U.encdec.start, ...U.encdec.tgt];
    shown.forEach((t, j) => {
      const visible = j <= s, writing = j === s && s >= 1;
      rbox(ctx, tx(j) - bw / 2, yt, bw, bh, 8, writing ? `rgba(${palette.accentRgb},0.16)` : "#ffffff", visible ? palette.accent : palette.dotOff, writing ? 3 : 1.5);
      label(ctx, visible ? t : "?", tx(j), yt + bh / 2, visible ? palette.ink : palette.dotOff, 13, "center");
    });

    if (s >= 1) {
      const wts = CROSS[s - 1];
      wts.forEach((wt, i) => {
        if (wt < 0.01) return;
        line(ctx, tx(s), yt - 2, sx(i), ys + bh + 2, `rgba(${palette.accentRgb},${0.25 + 0.75 * wt})`, 1 + 9 * wt);
        if (wt > 0.1) label(ctx, `${(wt * 100).toFixed(0)}%`, (tx(s) + sx(i)) / 2 + 12, (yt + ys + bh) / 2, palette.accent, 11);
      });
      label(ctx, `${U.encdec.writing}: ${U.encdec.tgt[s - 1]}`, w / 2, h - 30, palette.ink, 13, "center");
    } else {
      label(ctx, U.encdec.start, w / 2, h - 30, palette.muted, 13, "center");
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
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 10 · Logits → softmax → cross-entropy, and one gradient step         */
/* ------------------------------------------------------------------ */

const Z0 = [0.2, 1.0, 0.1, 0.4, 0.6, -0.5];
const ANSWER = 0;

export function OutputScene() {
  const [state, setState] = useState({ z: Z0, steps: 0 });
  const p = softmax(state.z), loss = -Math.log(p[ANSWER]);
  // dL/dz_k = p_k − 1[k = answer]; one step of size 1 down that gradient
  const train = () => setState((s) => {
    const q = softmax(s.z);
    return { z: s.z.map((v, k) => v - (q[k] - (k === ANSWER ? 1 : 0))), steps: s.steps + 1 };
  });

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const x0 = PAD, nameW = 78, bx = x0 + nameW, bwid = w - PAD - bx - 108, rh = Math.min(40, (h - 170) / 6), y0 = 64;
    label(ctx, U.output.context, x0, y0 - 30, palette.ink, 13);
    U.output.vocab.forEach((t, k) => {
      const y = y0 + k * rh, ans = k === ANSWER;
      label(ctx, t, x0, y + rh / 2 - 3, ans ? palette.mint : palette.ink, 12);
      bar(ctx, bx, y + rh / 2 - 10, bwid, 14, p[k], ans ? palette.mint : palette.accent);
      if (ans) frame(ctx, bx - 2, y + rh / 2 - 12, bwid + 4, 18, palette.mint, 1.5);
      label(ctx, `${(p[k] * 100).toFixed(1)}%`, bx + bwid + 8, y + rh / 2 - 3, palette.ink, 11);
      const g = p[k] - (ans ? 1 : 0);
      label(ctx, `${g > 0 ? "−" : "+"}${Math.abs(g).toFixed(2)}`, w - PAD, y + rh / 2 - 3, g > 0 ? palette.anomaly : palette.mint, 11, "right");
    });
    const ty = y0 + 6 * rh + 22;
    label(ctx, `${U.output.loss}  −ln(${p[ANSWER].toFixed(3)}) = ${loss.toFixed(2)}`, x0, ty, palette.ink, 13);
    label(ctx, `${U.output.step} ${state.steps}`, w - PAD, ty, palette.muted, 12, "right");
    bar(ctx, x0, ty + 16, w - 2 * PAD, 6, Math.min(1, loss / 2.2), palette.anomaly);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <button type="button" className="ad-btn" onClick={train}>{U.output.train}</button>
        <button type="button" className="ad-btn" onClick={() => setState({ z: Z0, steps: 0 })}>{U.output.reset}</button>
      </div>
    </div>
  );
}
