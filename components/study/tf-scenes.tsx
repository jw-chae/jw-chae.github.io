"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { clamp, drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, bar, cells, frame, line, rbox, signed } from "./kit";
import { tfCopy } from "./tf-copy";
import { HEAD_A, HEAD_B, HEAD_TOKENS, attendByName, attention, dot, headEmbedding, norm, randMat, seeded, sinusoid, softmax, traceBlock, D } from "./tf-math";

const U = tfCopy.ui;
const PAD = 18;
const isPortrait = (w: number, h: number) => h > w * 1.15;
const at = (e: PointerEvent<HTMLCanvasElement>) => {
  const r = e.currentTarget.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
};

/* ------------------------------------------------------------------ */
/* 01 · Image → patches → tokens                                       */
/* ------------------------------------------------------------------ */

const IMG_SRC = "/anomaly/hazelnut-good.webp";
const PATCH_SIZES = [98, 56, 28, 14];
const PROJ = randMat(24, 48, seeded(7), 0.35);       // stand-in for the learned patch-embedding matrix

export function PatchScene() {
  const [P, setP] = useState(56);
  const [sel, setSel] = useState<number | null>(null);          // null = cycle automatically
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dataRef = useRef<Uint8ClampedArray | null>(null);
  const rectRef = useRef({ x: 0, y: 0, s: 1 });

  useEffect(() => {
    const img = new window.Image();
    img.src = IMG_SRC;
    img.onload = () => {
      const off = document.createElement("canvas");
      off.width = 392; off.height = 392;
      const c = off.getContext("2d");
      if (!c) return;
      c.drawImage(img, 0, 0, 392, 392);
      dataRef.current = c.getImageData(0, 0, 392, 392).data;
      imgRef.current = img;
    };
  }, []);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const img = imgRef.current, data = dataRef.current;
    const G = 392 / P, N = G * G;
    const idx = (sel ?? Math.floor(tt / 0.9)) % N;
    const pr = Math.floor(idx / G), pc = idx % G;
    const portrait = isPortrait(w, h);
    const S = portrait ? Math.min(w - 2 * PAD, h * 0.46) : Math.min(h - 80, w * 0.5);
    const ix = portrait ? (w - S) / 2 : PAD, iy = portrait ? 34 : (h - S) / 2 - 6;
    rectRef.current = { x: ix, y: iy, s: S };
    const k = S / 392;

    label(ctx, U.patch.image, ix + S / 2, iy - 14, palette.muted, 11, "center");
    if (!img || !data) {
      ctx.fillStyle = palette.track;
      ctx.fillRect(ix, iy, S, S);
      label(ctx, U.patch.loading, ix + S / 2, iy + S / 2, palette.muted, 12, "center");
      return;
    }
    ctx.drawImage(img, ix, iy, S, S);
    ctx.save();
    ctx.strokeStyle = `rgba(255,255,255,${G > 14 ? 0.28 : 0.55})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= G; i++) {
      ctx.moveTo(ix + i * P * k, iy); ctx.lineTo(ix + i * P * k, iy + S);
      ctx.moveTo(ix, iy + i * P * k); ctx.lineTo(ix + S, iy + i * P * k);
    }
    ctx.stroke();
    ctx.restore();
    frame(ctx, ix + pc * P * k, iy + pr * P * k, P * k, P * k, palette.accent, 2.5);

    // details: enlarged patch → flattened pixels → token vector
    const dx = portrait ? PAD : ix + S + 26, dw = w - dx - PAD;
    let y = portrait ? iy + S + 34 : iy + 4;
    label(ctx, `${U.patch.patch}: ${P}×${P}×3 = ${P * P * 3}`, dx, y, palette.ink, 12);
    y += 14;
    const E = portrait ? 72 : Math.min(96, dw * 0.5);
    const sc = img.naturalWidth / 392;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, pc * P * sc, pr * P * sc, P * sc, P * sc, dx, y, E, E);
    ctx.restore();
    frame(ctx, dx, y, E, E, palette.accent, 2);

    // 4×4 block means of the patch: 48 real pixel numbers that stand in for the flattened patch
    const feat: number[] = [], colors: string[] = [];
    const q = P / 4, st = Math.max(1, Math.floor(q / 4));
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) {
      let r = 0, g = 0, bl = 0, n = 0;
      for (let yy = 0; yy < q; yy += st) for (let xx = 0; xx < q; xx += st) {
        const o = ((Math.floor(pr * P + a * q + yy)) * 392 + Math.floor(pc * P + b * q + xx)) * 4;
        r += data[o]; g += data[o + 1]; bl += data[o + 2]; n++;
      }
      feat.push(r / n / 255 - 0.5, g / n / 255 - 0.5, bl / n / 255 - 0.5);
      colors.push(`rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(bl / n)})`);
    }
    const token = PROJ.map((row) => dot(row, feat));
    const tAbs = Math.max(...token.map(Math.abs), 1e-6);

    const sx = portrait ? dx + E + 22 : dx, sw = portrait ? w - sx - PAD : dw;
    let sy = portrait ? y + 18 : y + E + 30;
    label(ctx, U.patch.flat, sx, sy - 10, palette.muted, 11);
    const fc = Math.min(15, sw / 16);
    colors.forEach((cst, i) => { ctx.fillStyle = cst; ctx.fillRect(sx + i * fc + 0.5, sy, fc - 1, fc - 1); });
    arrow(ctx, sx + 8 * fc, sy + fc + 4, sx + 8 * fc, sy + fc + 20, palette.muted);
    label(ctx, "× E", sx + 8 * fc + 10, sy + fc + 12, palette.muted, 11);
    sy += fc + 38;
    label(ctx, `${U.patch.token} (768)`, sx, sy - 10, palette.muted, 11);
    const tc = Math.min(15, sw / 24);
    token.forEach((v, i) => { ctx.fillStyle = signed(v, tAbs); ctx.fillRect(sx + i * tc + 0.5, sy, tc - 1, fc - 1); });

    const by = portrait ? Math.max(sy + fc + 40, y + E + 34) : sy + fc + 44;
    label(ctx, `${U.patch.tokens}: ${G} × ${G} = ${N}`, portrait ? w / 2 : dx, by, palette.accent, 14, portrait ? "center" : "left");
  });

  return (
    <div className="ad-scene">
      <canvas
        ref={ref}
        className="ad-canvas"
        aria-hidden="true"
        onPointerDown={(e) => {
          const p = at(e), r = rectRef.current, G = 392 / P;
          const c = Math.floor(((p.x - r.x) / r.s) * G), rr = Math.floor(((p.y - r.y) / r.s) * G);
          if (c >= 0 && rr >= 0 && c < G && rr < G) setSel(rr * G + c);
        }}
      />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.patch.size}>
          <span>{U.patch.size}</span>
          {PATCH_SIZES.map((v) => <button key={v} type="button" className={P === v ? "on" : ""} onClick={() => { setP(v); setSel(null); }}>{v}px</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · One attention step: scores → softmax → weighted average        */
/* ------------------------------------------------------------------ */

const TOK: [number, number][] = [[1.05, 0.1], [0.7, 0.7], [0.6, -0.45], [-0.5, 0.85], [-0.05, 1.1], [-0.85, -0.5]];

export function AttentionScene() {
  const [q, setQ] = useState(0);
  const [beta, setBeta] = useState(3);
  const calc = useMemo(() => {
    const scores = TOK.map((k) => beta * dot(TOK[q], k));
    const weights = softmax(scores);
    const out: [number, number] = [0, 1].map((d) => weights.reduce((s, wj, j) => s + wj * TOK[j][d], 0)) as [number, number];
    return { scores, weights, out };
  }, [q, beta]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h);
    const Pz = portrait ? Math.min(w - 2 * PAD, h * 0.5 - 10) : Math.min(h - 40, w * 0.56);
    const px = portrait ? (w - Pz) / 2 : PAD, py = portrait ? 16 : (h - Pz) / 2;
    const cx = px + Pz / 2 - Pz * 0.04, cy = py + Pz / 2 + Pz * 0.1, sc = Pz / 2 / 1.3;
    const X = (v: [number, number]) => cx + v[0] * sc, Y = (v: [number, number]) => cy - v[1] * sc;
    const { scores, weights, out } = calc;

    line(ctx, px, cy, px + Pz, cy, palette.frame, 1);
    line(ctx, cx, py, cx, py + Pz, palette.frame, 1);
    TOK.forEach((v) => line(ctx, cx, cy, X(v), Y(v), palette.dotOff, 1));
    TOK.forEach((v, j) => {
      if (j !== q) line(ctx, X(TOK[q]), Y(TOK[q]), X(v), Y(v), `rgba(${palette.accentRgb},${0.2 + 0.7 * weights[j]})`, 1 + 9 * weights[j]);
    });
    TOK.forEach((v, j) => {
      ctx.fillStyle = j === q ? palette.accent : palette.normal;
      ctx.beginPath(); ctx.arc(X(v), Y(v), j === q ? 11 : 9, 0, Math.PI * 2); ctx.fill();
      label(ctx, String(j + 1), X(v), Y(v) + 0.5, "#ffffff", 11, "center");
    });
    // output = weighted average of the token vectors
    ctx.save();
    ctx.translate(X(out), Y(out)); ctx.rotate(Math.PI / 4);
    ctx.fillStyle = palette.mint; ctx.fillRect(-6, -6, 12, 12);
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 1.5; ctx.strokeRect(-6, -6, 12, 12);
    ctx.restore();
    label(ctx, U.attention.out, X(out) - 12, Y(out) - 13, palette.mint, 11, "right");

    const tx = portrait ? PAD : px + Pz + 16, tw = w - tx - PAD;
    const rh = 24, ty = portrait ? py + Pz + 30 : (h - 7 * rh) / 2 + 8;
    label(ctx, U.attention.token, tx, ty - 6, palette.muted, 11);
    label(ctx, U.attention.score, tx + 74, ty - 6, palette.muted, 11, "right");
    label(ctx, U.attention.weight, tx + tw, ty - 6, palette.muted, 11, "right");
    TOK.forEach((_, j) => {
      const y = ty + 14 + j * rh;
      label(ctx, `${j + 1}${j === q ? " q" : ""}`, tx, y + 5, j === q ? palette.accent : palette.ink, 12);
      label(ctx, scores[j].toFixed(2), tx + 74, y + 5, palette.muted, 11, "right");
      bar(ctx, tx + 82, y, tw - 82 - 40, 10, weights[j], palette.accent);
      label(ctx, weights[j].toFixed(2), tx + tw, y + 5, palette.ink, 11, "right");
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.attention.query}>
          <span>{U.attention.query}</span>
          {TOK.map((_, j) => <button key={j} type="button" className={q === j ? "on" : ""} onClick={() => setQ(j)}>{j + 1}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{U.attention.beta} <b>{beta.toFixed(1)}</b></span>
          <input type="range" min={0} max={8} step={0.5} value={beta} onChange={(e) => setBeta(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Two heads read different parts of the same token               */
/* ------------------------------------------------------------------ */

const HX = HEAD_TOKENS.map((_, i) => headEmbedding(i));
const WA = attention(HX, HEAD_A).weights;
const WB = attention(HX, HEAD_B).weights;
const maxIn = (m: number[][]) => Math.max(...m.flat());

export function HeadsScene() {
  const [q, setQ] = useState<number | null>(null);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const n = HEAD_TOKENS.length;
    const qi = q ?? Math.floor(tt / 1.6) % n;
    const m = Math.min((w - 2 * PAD - 28) / 16, (h - 250) / 8, 30);
    const contentH = 92 + 100 + 8 * m + 28;
    const ty = Math.max(8, (h - contentH) / 2) + 92;
    const sp = Math.min(64, (w - 2 * PAD) / n), x0 = (w - sp * n) / 2;
    const X = (i: number) => x0 + (i + 0.5) * sp;

    const arcs = (W: number[][], dir: 1 | -1, rgb: string) => {
      for (let j = 0; j < n; j++) {
        const wj = W[qi][j];
        if (j === qi || wj < 0.02) continue;
        const x1 = X(qi), x2 = X(j), lift = Math.min(74, 18 + Math.abs(x2 - x1) * 0.42);
        ctx.save();
        ctx.strokeStyle = `rgba(${rgb},${0.2 + 0.8 * clamp(wj * 2.2, 0, 1)})`;
        ctx.lineWidth = 1 + 8 * wj;
        ctx.beginPath();
        ctx.moveTo(x1, ty - dir * 14);
        ctx.quadraticCurveTo((x1 + x2) / 2, ty - dir * (14 + lift), x2, ty - dir * 14);
        ctx.stroke();
        ctx.restore();
      }
    };
    arcs(WA, 1, palette.memoryRgb);
    arcs(WB, -1, palette.accentRgb);
    label(ctx, U.heads.a, PAD, ty - 84, palette.memory, 11);
    label(ctx, U.heads.b, PAD, ty + 84, palette.accent, 11);

    HEAD_TOKENS.forEach((t, i) => {
      ctx.fillStyle = t.type === 0 ? palette.normal : palette.accent2;
      if (t.type === 0) { ctx.beginPath(); ctx.arc(X(i), ty, 11, 0, Math.PI * 2); ctx.fill(); }
      else ctx.fillRect(X(i) - 10, ty - 10, 20, 20);
      if (i === qi) {
        ctx.save(); ctx.strokeStyle = palette.ink; ctx.lineWidth = 2.5;
        if (t.type === 0) { ctx.beginPath(); ctx.arc(X(i), ty, 14, 0, Math.PI * 2); ctx.stroke(); }
        else ctx.strokeRect(X(i) - 13, ty - 13, 26, 26);
        ctx.restore();
      }
      label(ctx, String(i + 1), X(i), ty + 0.5, "#ffffff", 11, "center");
    });

    // full weight matrices: row = query, column = key
    const my = ty + 104, total = 16 * m + 28, mx0 = (w - total) / 2;
    const mats: [number[][], string, string, number][] = [[WA, palette.memoryRgb, U.heads.a, maxIn(WA)], [WB, palette.accentRgb, U.heads.b, maxIn(WB)]];
    mats.forEach(([W, rgb, name, mx], b) => {
      const gx = mx0 + b * (8 * m + 28);
      cells(ctx, gx, my, m, n, n, (r, c) => `rgba(${rgb},${0.06 + 0.94 * (W[r][c] / mx)})`);
      frame(ctx, gx - 1, my + qi * m - 1, 8 * m + 2, m + 2, palette.ink, 2);
      label(ctx, name, gx + 4 * m, my + 8 * m + 14, `rgb(${rgb})`, 11, "center");
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.heads.query}>
          <span>{U.heads.query}</span>
          {HEAD_TOKENS.map((_, i) => <button key={i} type="button" className={q === i ? "on" : ""} onClick={() => setQ(i)}>{i + 1}</button>)}
          <button type="button" className={q === null ? "on" : ""} onClick={() => setQ(null)}>{U.heads.auto}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · Attention alone cannot see order                               */
/* ------------------------------------------------------------------ */

const BASE = ["A", "B", "C", "D", "E"];
const LETTER_RGB: Record<string, string> = { A: "42,111,214", B: "194,115,0", C: "15,157,106", D: "124,58,237", E: "224,49,79" };

export function OrderScene() {
  const [order, setOrder] = useState(["D", "A", "E", "C", "B"]);
  const [usePos, setUsePos] = useState(false);
  const calc = useMemo(() => {
    const a = attendByName(BASE, usePos), b = attendByName(order, usePos);
    const delta = Object.fromEntries(BASE.map((k) => [k, norm(a[k].map((v, i) => v - b[k][i]))]));
    const mAbs = Math.max(...BASE.flatMap((k) => [...a[k], ...b[k]]).map(Math.abs), 1e-6);
    return { a, b, delta, mAbs };
  }, [order, usePos]);
  const shuffle = () => {
    let next = BASE;
    while (next.join("") === BASE.join("") || next.join("") === order.join("")) {
      next = [...BASE];
      for (let i = next.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [next[i], next[j]] = [next[j], next[i]];
      }
    }
    setOrder(next);
  };

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const sw = Math.min(96, (w - 2 * PAD) / 5), x0 = (w - 5 * sw) / 2;
    const bs = Math.min(42, sw - 14), cs = Math.min(9, (sw - 10) / D);
    const posH = usePos ? cs + 8 : 0;
    const rowH = 20 + bs + posH + 8 + 16;
    const top = Math.max(14, (h - (2 * rowH + 56 + 60)) / 2);
    const rows: [string[], Record<string, number[]>, string, number][] = [[BASE, calc.a, U.order.original, top], [order, calc.b, U.order.shuffled, top + rowH + 56]];
    const anchor: Record<string, { bottom: [number, number]; top: [number, number] }[]> = {};

    rows.forEach(([seq, outs, name, y], ri) => {
      label(ctx, name, x0, y + 4, palette.ink, 12);
      seq.forEach((k, i) => {
        const cx = x0 + (i + 0.5) * sw, by = y + 20, rgb = LETTER_RGB[k];
        rbox(ctx, cx - bs / 2, by, bs, bs, 8, `rgba(${rgb},0.14)`, `rgb(${rgb})`, 2);
        label(ctx, k, cx, by + bs / 2 + 1, `rgb(${rgb})`, 17, "center");
        let sy = by + bs + 6;
        if (usePos) {
          const pe = sinusoid(i, D);
          pe.forEach((v, d) => { ctx.fillStyle = signed(v, 1); ctx.fillRect(cx - (D * cs) / 2 + d * cs + 0.5, sy, cs - 1, cs - 1); });
          sy += cs + 8;
        }
        outs[k].forEach((v, d) => { ctx.fillStyle = signed(v, calc.mAbs); ctx.fillRect(cx - (D * cs) / 2 + d * cs + 0.5, sy, cs - 1, 15); });
        (anchor[k] ??= [])[ri] = { top: [cx, by - 2], bottom: [cx, sy + 17] };
      });
      if (usePos && ri === 0) label(ctx, U.order.plusPos, x0 + 5 * sw, y + 4, palette.muted, 11, "right");
    });
    BASE.forEach((k) => {
      const a = anchor[k][0].bottom, b = anchor[k][1].top;
      line(ctx, a[0], a[1], b[0], b[1], `rgba(${LETTER_RGB[k]},0.45)`, 1.5);
    });
    const dy = rows[1][3] + rowH + 6;
    order.forEach((k, i) => {
      const dlt = calc.delta[k];
      label(ctx, `${U.order.delta} ${dlt.toFixed(2)}`, x0 + (i + 0.5) * sw, dy, dlt < 1e-6 ? palette.mint : palette.anomaly, 11, "center");
    });
    label(ctx, usePos ? U.order.differ : U.order.same, w / 2, dy + 30, usePos ? palette.anomaly : palette.mint, 12, "center");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <button type="button" className="ad-btn" onClick={shuffle}>{U.order.shuffle}</button>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.order.pos}>
          <span>{U.order.pos}</span>
          <button type="button" className={!usePos ? "on" : ""} onClick={() => setUsePos(false)}>{U.order.off}</button>
          <button type="button" className={usePos ? "on" : ""} onClick={() => setUsePos(true)}>{U.order.on}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · One pre-norm block, traced on one token                        */
/* ------------------------------------------------------------------ */

export function BlockScene() {
  const [step, setStep] = useState<number | null>(null);
  const rows = useMemo(() => {
    const t = traceBlock(BASE, 2);
    return [t.x, t.n1, t.attn, t.mid, t.n2, t.mlp, t.out];
  }, []);
  const mAbs = useMemo(() => Math.max(...rows.flat().map(Math.abs)), [rows]);

  const ref = useCanvas((ctx, w, h, tt) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const s = step ?? Math.min(6, Math.floor(tt / 1.3) % 9);
    const rowH = Math.min(58, (h - 40) / 7);
    const y0 = (h - 7 * rowH) / 2 + rowH / 2;
    const Y = (i: number) => y0 + i * rowH;
    const bw = w < 420 ? 78 : 96, bh = 26;
    const dxc = PAD + 22 + bw / 2, skipX = PAD + 4;
    const col = (i: number) => (i === s ? palette.accent : i < s ? palette.ink : palette.dotOff);

    // main path and the two skip connections
    for (let i = 0; i < 6; i++) arrow(ctx, dxc, Y(i) + (i === 3 ? 12 : bh / 2), dxc, Y(i + 1) - (i + 1 === 3 || i + 1 === 6 ? 13 : bh / 2 + 1), i < s ? palette.ink : palette.dotOff, 1.5);
    const skip = (ya: number, yb: number, on: boolean) => {
      const c = on ? palette.accent2 : palette.dotOff;
      line(ctx, dxc, ya, skipX, ya, c, 1.5); line(ctx, skipX, ya, skipX, yb, c, 1.5);
      arrow(ctx, skipX, yb, dxc - 13, yb, c, 1.5);
    };
    skip(Y(0) + bh / 2 + 6, Y(3), s >= 3);
    skip(Y(3) + 12 + 6, Y(6), s >= 6);

    U.block.boxes.forEach((name, i) => {
      const c = col(i);
      if (i === 3 || i === 6) {
        ctx.save();
        ctx.fillStyle = "#ffffff"; ctx.strokeStyle = c; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(dxc, Y(i), 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.restore();
        label(ctx, "+", dxc, Y(i) + 0.5, c, 15, "center");
      } else {
        const ww = i === 0 ? 40 : bw;
        rbox(ctx, dxc - ww / 2, Y(i) - bh / 2, ww, bh, 7, i === s ? `rgba(${palette.accentRgb},0.14)` : "#ffffff", c, 2);
        label(ctx, name, dxc, Y(i) + 0.5, c, 12, "center");
      }
    });

    // the token's 8 numbers after each step
    const vx = dxc + bw / 2 + 20, cw = Math.min(36, (w - vx - PAD) / D);
    rows.forEach((v, i) => {
      const shown = i <= s;
      const delta = i === 2 || i === 5;
      label(ctx, `${delta ? "+ " : ""}${U.block.rows[i]}`, vx, Y(i) - 15, !shown ? palette.dotOff : delta ? palette.accent2 : palette.ink, 11);
      v.forEach((x, d) => {
        ctx.fillStyle = shown ? signed(x, mAbs) : palette.track;
        ctx.fillRect(vx + d * cw + 0.5, Y(i) - 6, cw - 1, 18);
        if (shown && cw >= 20) label(ctx, x.toFixed(1), vx + d * cw + cw / 2, Y(i) + 3.5, palette.ink, cw >= 28 ? 10 : 9, "center");
      });
      if (i === s) frame(ctx, vx - 2, Y(i) - 8, D * cw + 3, 22, palette.accent, 2);
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.block.step}>
          <span>{U.block.step}</span>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <button key={i} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i}</button>)}
          <button type="button" className={step === null ? "on" : ""} onClick={() => setStep(null)}>{U.block.auto}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · What one position can see: CNN vs attention                    */
/* ------------------------------------------------------------------ */

const CG = 11;
const isObj = (r: number, c: number) => (r - 3) ** 2 + (c - 7) ** 2 <= 2.3 ** 2 || (r - 8) ** 2 + (c - 2) ** 2 <= 1.6 ** 2;

export function CompareScene() {
  const [q, setQ] = useState<[number, number]>([3, 7]);
  const [L, setL] = useState(2);
  const rectRef = useRef({ x0: 0, y0: 0, cell: 1, gap: 24 });
  const weights = useMemo(() => {
    const mine = isObj(q[0], q[1]);
    const scores = Array.from({ length: CG * CG }, (_, i) => (isObj(Math.floor(i / CG), i % CG) === mine ? 4 : 0));
    return softmax(scores);
  }, [q]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const gap = 24;
    const cell = Math.min(24, (w - 2 * PAD - gap) / (2 * CG), (h - 130) / CG);
    const x0 = (w - (2 * CG * cell + gap)) / 2, y0 = (h - CG * cell - 76) / 2 + 26;
    rectRef.current = { x0, y0, cell, gap };
    const rx = x0 + CG * cell + gap;
    const mx = Math.max(...weights);
    const base = (r: number, c: number) => (isObj(r, c) ? `rgba(${palette.inkRgb},0.3)` : palette.track);
    let seen = 0;

    label(ctx, `${U.compare.cnn} · ${L}`, x0 + (CG * cell) / 2, y0 - 16, palette.normal, 12, "center");
    cells(ctx, x0, y0, cell, CG, CG, base);
    for (let r = 0; r < CG; r++) for (let c = 0; c < CG; c++) {
      if (Math.abs(r - q[0]) <= L && Math.abs(c - q[1]) <= L) {
        seen++;
        ctx.fillStyle = `rgba(${palette.normalRgb},0.6)`;
        ctx.fillRect(x0 + c * cell + 0.5, y0 + r * cell + 0.5, cell - 1, cell - 1);
      }
    }
    label(ctx, U.compare.attn, rx + (CG * cell) / 2, y0 - 16, palette.accent, 12, "center");
    cells(ctx, rx, y0, cell, CG, CG, base);
    for (let i = 0; i < CG * CG; i++) {
      ctx.fillStyle = `rgba(${palette.accentRgb},${0.04 + 0.86 * (weights[i] / mx)})`;
      ctx.fillRect(rx + (i % CG) * cell + 0.5, y0 + Math.floor(i / CG) * cell + 0.5, cell - 1, cell - 1);
    }
    for (const gx of [x0, rx]) frame(ctx, gx + q[1] * cell, y0 + q[0] * cell, cell, cell, palette.ink, 2.5);

    const ty = y0 + CG * cell + 18;
    label(ctx, `${U.compare.sees} ${seen} ${U.compare.of}`, x0 + (CG * cell) / 2, ty, palette.normal, 12, "center");
    label(ctx, `${U.compare.sees} 121 ${U.compare.of}`, rx + (CG * cell) / 2, ty, palette.accent, 12, "center");
    label(ctx, U.compare.hint, w / 2, ty + 26, palette.muted, 11, "center");
  });

  return (
    <div className="ad-scene">
      <canvas
        ref={ref}
        className="ad-canvas"
        aria-hidden="true"
        onPointerDown={(e) => {
          const p = at(e), r = rectRef.current;
          for (const gx of [r.x0, r.x0 + CG * r.cell + r.gap]) {
            const c = Math.floor((p.x - gx) / r.cell), rr = Math.floor((p.y - r.y0) / r.cell);
            if (c >= 0 && rr >= 0 && c < CG && rr < CG) setQ([rr, c]);
          }
        }}
      />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.compare.layers} <b>{L}</b></span>
          <input type="range" min={1} max={5} step={1} value={L} onChange={(e) => setL(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}
