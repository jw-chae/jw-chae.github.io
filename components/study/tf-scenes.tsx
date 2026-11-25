"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { arrow, cells, frame, line, rbox, signed } from "./kit";
import { tfCopy } from "./tf-copy";
import { BLOCK_WORDS, dot, randMat, seeded, softmax, traceBlock, D } from "./tf-math";

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
/* 11 · One pre-norm block, traced on the cats slot of I love cats      */
/* ------------------------------------------------------------------ */

export function BlockScene() {
  const [step, setStep] = useState<number | null>(0);
  const rows = useMemo(() => {
    const t = traceBlock(BLOCK_WORDS, 2);
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
    label(ctx, U.block.track, vx, Math.max(12, Y(0) - 34), palette.muted, 11);
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
