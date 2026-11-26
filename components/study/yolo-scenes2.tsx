"use client";

import { useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { bar } from "./kit";
import { yoloCopy } from "./yolo-copy";
import { V10_ROAD_M, V10_ROAD_S } from "./yolo-math";
import { BAD, GT, OUT, PAD, fitLabel, num } from "./yolo-draw";

const U = yoloCopy.ui;

/* ------------------------------------------------------------------ */
/* 05 · YOLOv10's roadmap: params, FLOPs, latency, AP                   */
/* ------------------------------------------------------------------ */

export function DesignScene() {
  const [step, setStep] = useState(1);
  const [model, setModel] = useState(0);
  const T = U.design;
  const road = model === 0 ? V10_ROAD_S : V10_ROAD_M;

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const port = h > w * 1.15;
    const cur = road[step], prev = road[Math.max(0, step - 1)], base = road[0];
    const sName = (i: number) => (model === 1 && i === road.length - 1 ? T.lastM : T.steps[i]);
    label(ctx, `YOLOv8-${T.models[model]}${T.from} YOLOv10-${T.models[model]}${T.to}`, PAD, 18, palette.muted, 11);
    fitLabel(ctx, `${step + 1}. ${sName(step)}`, PAD, 42, w - 2 * PAD, OUT, 15);

    const keys: ("params" | "flops" | "lat" | "ap")[] = ["params", "flops", "lat", "ap"];
    const nameW = port ? 66 : 80, valW = port ? 118 : 150, bw = w - 2 * PAD - nameW - valW;
    let y = 82;
    keys.forEach((k, i) => {
      const v = cur[k], pv = prev[k], b0 = base[k];
      label(ctx, T.rows[i], PAD, y, palette.ink, 12);
      if (k !== "ap") {
        const share = v / b0, pshare = pv / b0, x0 = PAD + nameW;
        bar(ctx, x0, y - 7, bw, 14, share, `rgba(${palette.normalRgb},0.55)`);
        if (step > 0 && Math.abs(pv - v) > 1e-9) {
          const lo = Math.min(share, pshare), hi = Math.max(share, pshare);
          ctx.fillStyle = v < pv ? `rgba(15,157,106,0.55)` : `rgba(${palette.anomalyRgb},0.55)`;
          ctx.fillRect(x0 + bw * lo, y - 7, bw * (hi - lo), 14);
        }
        label(ctx, `${Math.round(share * 100)}%`, x0 + bw * share + 4, y + 16, palette.muted, 11);
      }
      const unit = T.units[i];
      label(ctx, `${num(v, 2)}${unit}`, w - PAD, y - 5, palette.ink, 13, "right");
      if (step > 0) {
        const d = v - pv, good = k === "ap" ? d > 0 : d < 0;
        const s = Math.abs(d) < 1e-9 ? "±0" : `${d > 0 ? "+" : "−"}${num(Math.abs(d), 2)}${unit}`;
        label(ctx, `${T.vsPrev} ${s}`, w - PAD, y + 12, Math.abs(d) < 1e-9 ? palette.muted : good ? GT : BAD, 11, "right");
      }
      y += port ? 50 : 54;
    });

    y += 4;
    road.forEach((_, i) => {
      const color = i === step ? OUT : i < step ? palette.ink : palette.muted;
      fitLabel(ctx, `${i + 1}. ${sName(i)}`, PAD, y, w - 2 * PAD, color, i === step ? 12.5 : 11.5);
      y += port ? 21 : 19;
    });
    fitLabel(ctx, T.source, PAD, h - 14, w - 2 * PAD, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{T.step} <b>{step + 1}</b> · {model === 1 && step === road.length - 1 ? T.lastM : T.steps[step]}</span>
          <input type="range" min={0} max={road.length - 1} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} />
        </label>
        <div className="ad-ctl ad-seg" role="group" aria-label={T.model}>
          <span>{T.model}</span>
          {T.models.map((n, i) => <button key={n} type="button" className={model === i ? "on" : ""} onClick={() => setModel(i)}>{n}</button>)}
        </div>
      </div>
    </div>
  );
}
