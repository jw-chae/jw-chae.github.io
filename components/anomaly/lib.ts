"use client";

import { useEffect, useRef, useState } from "react";

/** Deterministic PRNG (mulberry32) so every scene replays identically. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(r: () => number) {
  const u = Math.max(r(), 1e-9);
  const v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const smooth = (a: number, b: number, t: number) => easeInOut(clamp((t - a) / (b - a), 0, 1));

export type Pt = { x: number; y: number };
export const dist2 = (a: Pt, b: Pt) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Inferno-like ramp used for anomaly heat: 0 = deep purple, 1 = pale yellow. */
export function heat(t: number): string {
  const c = clamp(t, 0, 1);
  const stops: [number, number, number][] = [
    [12, 8, 40], [64, 12, 100], [140, 30, 110], [205, 70, 70], [245, 140, 30], [252, 210, 90], [252, 250, 200],
  ];
  const p = c * (stops.length - 1);
  const i = Math.min(Math.floor(p), stops.length - 2);
  const f = p - i;
  const [r1, g1, b1] = stops[i];
  const [r2, g2, b2] = stops[i + 1];
  return `rgb(${Math.round(lerp(r1, r2, f))},${Math.round(lerp(g1, g2, f))},${Math.round(lerp(b1, b2, f))})`;
}

/** Canvas palette for the white page. Scenes read these fields at draw time. */
export type Palette = {
  normal: string; normalRgb: string; normalSoft: string;
  memory: string; memoryRgb: string; memorySoft: string;
  anomaly: string; anomalyRgb: string; anomalySoft: string;
  accent: string; accentRgb: string; accent2: string; stray: string; mint: string;
  ink: string; inkRgb: string; muted: string;
  grid: string; track: string; track2: string; frame: string; cell: string; dotOff: string; xmark: string; excluded: string;
};

export const palette: Palette = {
  normal: "#2a6fd6", normalRgb: "42,111,214", normalSoft: "rgba(42,111,214,0.35)",
  memory: "#0e7fc7", memoryRgb: "14,127,199", memorySoft: "rgba(14,127,199,0.3)",
  anomaly: "#e0314f", anomalyRgb: "224,49,79", anomalySoft: "rgba(224,49,79,0.35)",
  accent: "#c27300", accentRgb: "194,115,0", accent2: "#7c3aed", stray: "rgba(124,58,237,0.9)", mint: "#0f9d6a",
  ink: "#141821", inkRgb: "20,24,33", muted: "#5b6474",
  grid: "rgba(15,23,42,0.06)", track: "rgba(15,23,42,0.08)", track2: "rgba(15,23,42,0.09)", frame: "rgba(15,23,42,0.18)",
  cell: "rgba(15,23,42,0.05)", dotOff: "rgba(15,23,42,0.2)", xmark: "rgba(15,23,42,0.45)", excluded: "rgba(120,120,140,0.5)",
};

/** Canvas sized to its CSS box with DPR scaling; returns ctx via callback each frame. */
export function useCanvas(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void,
  opts?: { running?: boolean; fps?: number; still?: number },
) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef(draw);
  const running = opts?.running ?? true;
  const still = opts?.still ?? 0;
  useEffect(() => {
    drawRef.current = draw;
  });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let start = performance.now();
    let w = 0;
    let h = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (!running) drawRef.current(ctx, w, h, (performance.now() - start) / 1000);
    });
    ro.observe(canvas);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = -1e9;
    const frame = (now: number) => {
      if (reduce) {
        // Reduced motion: hold one representative instant, but keep repainting slowly so controls still respond.
        if (now - last > 200) { last = now; drawRef.current(ctx, w, h, still); }
      } else {
        drawRef.current(ctx, w, h, (now - start) / 1000);
      }
      if (running) raf = requestAnimationFrame(frame);
    };
    start = performance.now();
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [running, still]);

  return ref;
}

/** True once the element has entered the viewport (sticky). */
export function useInView<T extends Element>(threshold = 0.25) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setInView(true);
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/** Scroll progress 0..1 of a tall section through the viewport. */
export function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const update = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      const total = r.height - vh;
      const prog = total > 0 ? clamp(-r.top / total, 0, 1) : clamp(1 - r.top / vh, 0, 1);
      setP(prog);
    };
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return { ref, progress: p };
}

/** Counts a number up when it becomes visible. */
export function useCountUp(target: number, active: boolean, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = clamp((now - t0) / ms, 0, 1);
      setV(target * easeOut(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, ms]);
  return v;
}

export function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, step = 40) {
  ctx.save();
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = (w % step) / 2; x < w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = (h % step) / 2; y < h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
  ctx.restore();
}

export function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, glow = 3) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = r * glow;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = palette.muted, size = 11, align: CanvasTextAlign = "left") {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
  ctx.restore();
}
