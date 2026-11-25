"use client";

import { useMemo, useState } from "react";
import { drawGrid, label, palette, smooth, useCanvas } from "@/components/anomaly/lib";
import { arrow, frame, gray } from "./kit";
import { genCopy } from "./gen-copy";
import { PAD, dot, isPortrait, ko, patchGrid, pct } from "./gen-draw";
import { BLOBS, IMG, NP, PATCHES, PS, TRACK, VIDEO_SIZES, aimWith, clipHistory, codeDistances, looksOf, quantize, sampleClip, videoTokens, type P2 } from "./gen-math";

const U = genCopy.ui;

/* ------------------------------------------------------------------ */
/* 05 · A picture written as code numbers, one after another            */
/* ------------------------------------------------------------------ */

const BOOKS = [4, 16, 64];

export function NativeScene() {
  const [bi, setBi] = useState(1);
  const [n, setN] = useState(TRACK + 1);
  const K = BOOKS[bi];
  const q = useMemo(() => quantize(K), [K]);
  const ranked = useMemo(() => (n > 0 ? codeDistances(PATCHES[n - 1], q.book) : []), [q, n]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const portrait = isPortrait(w, h), cols = Math.sqrt(K);
    const S = portrait ? Math.min(w - 2 * PAD, 232) : Math.min(260, h - 130), px = S / IMG, cell = px * PS;
    const x0 = portrait ? (w - S) / 2 : PAD + 4, y0 = 36;
    label(ctx, U.native.picture, x0, y0 - 14, palette.muted, 11);
    ctx.fillStyle = palette.track; ctx.fillRect(x0, y0, S, S);
    for (let t = 0; t < n; t++) {
      const code = q.book[q.ids[t]], cx = x0 + (t % NP) * cell, cy = y0 + Math.floor(t / NP) * cell;
      for (let j = 0; j < PS; j++) for (let i = 0; i < PS; i++) { ctx.fillStyle = gray(code[j * PS + i]); ctx.fillRect(cx + i * px, cy + j * px, px + 0.5, px + 0.5); }
    }
    frame(ctx, x0, y0, S, S, palette.frame, 1);
    if (n > 0) frame(ctx, x0 + ((n - 1) % NP) * cell, y0 + Math.floor((n - 1) / NP) * cell, cell, cell, palette.accent, 2);

    // the codebook: K typical patches, with the one just written marked
    const bx = portrait ? PAD : x0 + S + 26, by = portrait ? y0 + S + 34 : y0;
    const availW = portrait ? 168 : w - PAD - bx, availH = portrait ? h - by - 70 : 152;
    const tile = Math.min(40, availW / cols, availH / cols), tp = (tile - 3) / PS, cur = n > 0 ? q.ids[n - 1] : -1;
    label(ctx, `${U.native.codebook} ${K}`, bx, by - 14, palette.muted, 11);
    q.book.forEach((code, kk) => {
      const tx = bx + (kk % cols) * tile, ty = by + Math.floor(kk / cols) * tile;
      for (let j = 0; j < PS; j++) for (let i = 0; i < PS; i++) { ctx.fillStyle = gray(code[j * PS + i]); ctx.fillRect(tx + i * tp, ty + j * tp, tp + 0.4, tp + 0.4); }
      if (kk === cur) frame(ctx, tx - 1, ty - 1, tile - 1, tile - 1, palette.accent, 2.5);
    });

    // the patch just written next to the code it was replaced by: 16 numbers against 16 numbers, one distance
    if (cur >= 0) {
      const zx = portrait ? PAD + 184 : bx, zy = portrait ? by : by + Math.max(80, cols * tile) + 26, zc = 11;
      label(ctx, U.native.was, zx, zy - 14, palette.muted, 11);
      label(ctx, `${U.native.code} ${cur}`, zx + 58, zy - 14, palette.accent, 11);
      patchGrid(ctx, PATCHES[n - 1], zx, zy, zc);
      patchGrid(ctx, q.book[cur], zx + 58, zy, zc);
      frame(ctx, zx + 58, zy, 4 * zc, 4 * zc, palette.accent, 2);
      label(ctx, `${U.native.dist} ${ranked[0][1].toFixed(2)}`, zx, zy + 4 * zc + 15, palette.ink, 12);
      if (ranked.length > 1) label(ctx, `${U.native.second} ${ranked[1][0]}: ${ranked[1][1].toFixed(2)}`, zx, zy + 4 * zc + 33, palette.muted, 11);
    }

    const ty = portrait ? h - 44 : y0 + S + 28;
    const tail = q.ids.slice(Math.max(0, n - 7), n).join("  ");
    label(ctx, `${U.native.seq}  ${n > 7 ? "…  " : ""}${tail}`, PAD, ty, palette.ink, 12);
    label(ctx, `${U.native.lost} ${pct(q.lost)}`, w - PAD, ty + 26, q.lost < 0.06 ? palette.mint : palette.anomaly, 13, "right");
    if (cur >= 0) label(ctx, `${n}${U.native.nth} ${cur}`, PAD, ty + 26, palette.accent, 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.native.book}>
          <span>{U.native.book}</span>
          {BOOKS.map((v, i) => <button key={v} type="button" className={bi === i ? "on" : ""} onClick={() => setBi(i)}>{v}</button>)}
        </div>
        <label className="ad-ctl">
          <span>{U.native.written} <b>{n}</b></span>
          <input type="range" min={0} max={NP * NP} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 06 · A video as a block of space-time tokens                         */
/* ------------------------------------------------------------------ */

const FS = 8, GROUP = 2;

export function VideoScene() {
  const [vi, setVi] = useState(1);
  const [sec, setSec] = useState(5);
  const [packed, setPacked] = useState(true);
  const size = VIDEO_SIZES[vi], ft = packed ? 4 : 1;
  const v = videoTokens(size.w, size.h, sec, FS, ft, GROUP);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    // frames stacked back to front; one coloured box is the piece of space and time that a single token covers
    const shown = Math.min(16, 4 + sec), dx = Math.min(13, (w - 2 * PAD - 150) / shown), dy = 5.5, fw = 132, fh = 74;
    const sx = (w - fw - dx * (shown - 1)) / 2, sy = 30 + dy * (shown - 1);
    for (let i = shown - 1; i >= 0; i--) {
      const x = sx + i * dx, y = sy - i * dy;
      ctx.fillStyle = i < ft ? "#ffffff" : "#f4f5f8"; ctx.fillRect(x, y, fw, fh);
      frame(ctx, x, y, fw, fh, i < ft ? palette.normal : palette.frame, i < ft ? 1.5 : 1);
    }
    const bx = sx + 22, byy = sy + 20, bs = 18, deep = ft - 1;
    ctx.save(); ctx.fillStyle = `rgba(${palette.accentRgb},0.85)`; ctx.strokeStyle = palette.accent; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(bx, byy); ctx.lineTo(bx + deep * dx, byy - deep * dy); ctx.lineTo(bx + deep * dx + bs, byy - deep * dy); ctx.lineTo(bx + deep * dx + bs, byy - deep * dy + bs); ctx.lineTo(bx + bs, byy + bs); ctx.lineTo(bx, byy + bs); ctx.closePath();
    ctx.fill(); ctx.stroke(); ctx.strokeRect(bx, byy, bs, bs); ctx.restore();
    label(ctx, `${U.video.time} →`, sx + fw + dx * (shown - 1) - 4, sy + fh - dy * (shown - 1) + 14, palette.muted, 11, "right");
    label(ctx, U.video.patch, sx, sy + fh + 16, palette.accent, 11);

    const rows: [string, string, string][] = [
      [U.video.frames, v.frames.toLocaleString("en-US"), palette.ink],
      [U.video.numbers, ko(v.numbers), palette.ink],
      [U.video.covers, `${FS * GROUP} × ${FS * GROUP} ${U.video.px} × ${ft} ${U.video.frame}`, palette.accent],
      [U.video.grid, v.grid.join(" × "), palette.ink],
      [U.video.tokens, v.tokens.toLocaleString("en-US"), palette.accent],
      [U.video.vsImage, `${(v.tokens / 4096).toFixed(v.tokens / 4096 < 10 ? 1 : 0)}${U.video.times}`, palette.anomaly],
    ];
    const ty = sy + fh + 46, rh = Math.min(28, (h - ty - 6) / rows.length);
    rows.forEach(([name, value, color], i) => {
      label(ctx, name, PAD, ty + i * rh, palette.muted, 12);
      label(ctx, value, w - PAD, ty + i * rh, color, 14, "right");
    });
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.video.size}>
          <span>{U.video.size}</span>
          {VIDEO_SIZES.map((s, i) => <button key={s.name} type="button" className={vi === i ? "on" : ""} onClick={() => setVi(i)}>{s.name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.video.pack}>
          <span>{U.video.pack}</span>
          <button type="button" className={packed ? "on" : ""} onClick={() => setPacked(true)}>{U.video.packOn}</button>
          <button type="button" className={!packed ? "on" : ""} onClick={() => setPacked(false)}>{U.video.packOff}</button>
        </div>
        <label className="ad-ctl">
          <span>{U.video.seconds} <b>{sec}{U.video.sec}</b></span>
          <input type="range" min={1} max={20} step={1} value={sec} onChange={(e) => setSec(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · Eight frames: each on its own evidence, or all on the pooled one */
/* ------------------------------------------------------------------ */

const LOOK_RGB = [palette.normalRgb, palette.anomalyRgb, palette.accentRgb, "15,157,106", "124,58,237"];
const LOOKS = LOOK_RGB.map((c) => `rgb(${c})`);
const LETTERS = ["A", "B", "C", "D", "E"];
const FRAMES = 8, WALK = 40;
const meanSteady = (joint: boolean) => { let s = 0; for (let seed = 1; seed <= 300; seed++) s += sampleClip(joint, FRAMES, seed, WALK).steady; return s / 300; };
const clampTo = (v: number, m: number) => Math.max(-m, Math.min(m, v));

export function ClipScene() {
  const [joint, setJoint] = useState(false);
  const [seed, setSeed] = useState(1);
  const [step, setStep] = useState(WALK);
  const hist = useMemo(() => clipHistory(joint, FRAMES, seed, WALK), [joint, seed]);
  const average = useMemo(() => meanSteady(joint), [joint]);
  const cur = hist[step];
  const now = useMemo(() => looksOf(cur.pts), [cur]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    // a wide canvas puts the table beside the plane; otherwise it goes underneath
    const side = w >= 560 && !isPortrait(w, h), top = 20;
    const S = side ? Math.min(w * 0.46, h - 170) : Math.min(w - 2 * PAD, h - 236), cx = side ? PAD + S / 2 : w / 2, cy = top + S / 2, sc = S / 2 / 2.5;
    const X = (p: P2) => cx + clampTo(p[0], 2.42) * sc, Y = (p: P2) => cy - clampTo(p[1], 2.42) * sc;
    BLOBS.mu.forEach((m, k) => {
      ctx.save(); ctx.fillStyle = `rgba(${LOOK_RGB[k]},0.16)`; ctx.strokeStyle = LOOKS[k]; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(X(m), Y(m), 0.42 * sc, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
      label(ctx, LETTERS[k], X([m[0] * 1.5, m[1] * 1.5]), Y([m[0] * 1.5, m[1] * 1.5]), LOOKS[k], 14, "center");
    });
    // frames that end on the same look pile up, so near the end they are fanned out a little
    const fan = 13 * smooth(0.55, 1, step / WALK);
    const at = (i: number): P2 => [X(cur.pts[i]) + fan * Math.cos((2 * Math.PI * i) / FRAMES), Y(cur.pts[i]) + fan * Math.sin((2 * Math.PI * i) / FRAMES)];
    // where frame 1 aims: with its own five shares, or with the pooled ones
    if (step < WALK) {
      const aim = aimWith(cur.pts[0], 1 - step / WALK, joint ? cur.pooled : cur.own[0]), from = at(0);
      if (Math.hypot(X(aim) - from[0], Y(aim) - from[1]) > 14) arrow(ctx, from[0], from[1], X(aim), Y(aim), palette.ink, 2);
    }
    for (let i = FRAMES - 1; i >= 0; i--) {
      const [x, y] = at(i);
      dot(ctx, x, y, 8.5, LOOKS[now.look[i]], i === 0 ? palette.ink : "#ffffff", i === 0 ? 2.5 : 1);
      label(ctx, String(i + 1), x, y + 0.5, "#ffffff", 11, "center");
    }

    // the table: one column per frame (its own five shares), and one more column for the pooled shares
    const tx0 = side ? PAD + S + 18 : PAD, ty0 = side ? top + 30 : top + S + 18, labW = 20, sumGap = side ? 8 : 10, rh = side ? 28 : 17, headH = side ? 30 : 24;
    const cw = (w - PAD - tx0 - labW - sumGap) / (FRAMES + 1);
    const colX = (f: number) => tx0 + labW + f * cw + (f === FRAMES ? sumGap : 0);
    for (let f = 0; f < FRAMES; f++) {
      dot(ctx, colX(f) + cw / 2, ty0 + 10, 8.5, LOOKS[now.look[f]], f === 0 ? palette.ink : undefined, 2.5);
      label(ctx, String(f + 1), colX(f) + cw / 2, ty0 + 10.5, "#ffffff", 11, "center");
    }
    label(ctx, U.clip.pooled, colX(FRAMES) + cw / 2, ty0 + 10, joint ? palette.ink : palette.muted, 11, "center");
    for (let k = 0; k < 5; k++) {
      const y = ty0 + headH + k * rh;
      label(ctx, LETTERS[k], tx0 + 8, y + rh / 2, LOOKS[k], 12, "center");
      for (let f = 0; f <= FRAMES; f++) {
        const x = colX(f);
        if (f === FRAMES && !joint) { ctx.fillStyle = palette.track; ctx.fillRect(x + 1, y + 1, cw - 2, rh - 2); continue; }
        const v = f === FRAMES ? cur.pooled[k] : cur.own[f][k];
        ctx.fillStyle = `rgba(${LOOK_RGB[k]},${0.06 + 0.74 * v})`; ctx.fillRect(x + 1, y + 1, cw - 2, rh - 2);
        label(ctx, String(Math.round(v * 100)), x + cw / 2, y + rh / 2 + 0.5, v > 0.55 ? "#ffffff" : palette.ink, 11, "center");
      }
    }
    // the column frame 1 actually uses
    frame(ctx, colX(joint ? FRAMES : 0), ty0 + headH, cw, 5 * rh, palette.ink, 2);
    if (joint) frame(ctx, colX(0), ty0 + headH, cw, 5 * rh, palette.ink, 1, [3, 3]);
    const capY = side ? top + S + 22 : ty0 + headH + 5 * rh + 14;
    label(ctx, joint ? U.clip.capJoint : U.clip.capApart, PAD, capY, palette.ink, 11);

    label(ctx, U.clip.steady, PAD, capY + 24, palette.muted, 11);
    label(ctx, pct(now.steady), PAD, capY + 48, now.steady > 0.9 ? palette.mint : palette.anomaly, 18);
    label(ctx, U.clip.average, w - PAD, capY + 24, palette.muted, 11, "right");
    label(ctx, pct(average), w - PAD, capY + 48, palette.muted, 14, "right");
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.clip.mode}>
          <span>{U.clip.mode}</span>
          <button type="button" className={!joint ? "on" : ""} onClick={() => setJoint(false)}>{U.clip.apart}</button>
          <button type="button" className={joint ? "on" : ""} onClick={() => setJoint(true)}>{U.clip.together}</button>
        </div>
        <label className="ad-ctl">
          <span>{U.clip.step} <b>{step}</b> / {WALK}</span>
          <input type="range" min={0} max={WALK} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} />
        </label>
        <button type="button" className="ad-btn" onClick={() => setSeed((s) => s + 1)}>{U.clip.again}</button>
      </div>
    </div>
  );
}
