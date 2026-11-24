"use client";

import { useMemo, useState } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { line, rbox, type Ctx } from "./kit";
import { tfWalkUi as U } from "./tf-walk-copy";
import { CANDIDATES, HEAD_CANDIDATES, KEYS, Q_BLANK, fillBlank, trainBlank, twoHeads, values, type Animal, type Verb } from "./walk-math";

const PAD = 18;
const READ = palette.normal;        // everything about reading the source: blue
const WRITE = palette.accent;       // everything about choosing the next word: amber
const num = (v: number, d = 2) => { const s = v.toFixed(d).replace(/\.?0+$/, ""); return s === "-0" ? "0" : s.replace("-", "−"); };
const vec = (a: number[], d = 2) => `[${a.map((v) => num(v, d)).join(", ")}]`;
const pc = (v: number) => `${v < 0.01 && v > 0 ? (v * 100).toFixed(1) : Math.round(v * 100)}%`;

type Cols = { cx: (i: number) => number; bw: number; narrow: boolean };
function columns(w: number): Cols {
  const colW = (w - 2 * PAD) / 3;
  return { cx: (i) => PAD + colW * (i + 0.5), bw: Math.min(116, colW - 12), narrow: colW < 125 };
}

/** One row of three word boxes. `blank` marks the box still to be written. */
function wordRow(ctx: Ctx, c: Cols, y: number, words: (string | null)[], color: string, blank = -1) {
  words.forEach((word, i) => {
    if (word === null) return;
    const hot = i === blank;
    rbox(ctx, c.cx(i) - c.bw / 2, y, c.bw, 34, 8, hot ? `rgba(${palette.accentRgb},0.1)` : "#ffffff", hot ? WRITE : color, hot ? 2 : 1.5);
    label(ctx, word, c.cx(i), y + 17, hot && word === "____" ? palette.muted : palette.ink, 14, "center");
  });
}

/** Reading shares above the source words: a percentage and a bar per position. */
function shares(ctx: Ctx, c: Cols, y: number, ws: number[], color: string, fresh: boolean) {
  ws.forEach((wt, i) => {
    label(ctx, pc(wt), c.cx(i), y, color, fresh ? 15 : 13, "center");
    ctx.fillStyle = palette.track; ctx.fillRect(c.cx(i) - c.bw / 2, y + 11, c.bw, 6);
    ctx.fillStyle = color; ctx.fillRect(c.cx(i) - c.bw / 2, y + 11, Math.max(2, c.bw * wt), 6);
  });
}

/** Candidate words with their probabilities, one row each. */
function candidates(ctx: Ctx, w: number, y: number, names: string[], probs: number[], rh: number, mark = -1) {
  const x0 = PAD + 84, x1 = w - PAD - 52;
  names.forEach((name, k) => {
    const yy = y + k * rh;
    label(ctx, name, PAD, yy, k === mark ? palette.mint : palette.ink, 12);
    ctx.fillStyle = palette.track; ctx.fillRect(x0, yy - 6, x1 - x0, 12);
    ctx.fillStyle = WRITE; ctx.fillRect(x0, yy - 6, Math.max(2, (x1 - x0) * probs[k]), 12);
    label(ctx, pc(probs[k]), w - PAD, yy, palette.ink, 12, "right");
  });
}

/* ------------------------------------------------------------------ */
/* 01 · A person translating: the hand writes left to right, the eye roams */
/* ------------------------------------------------------------------ */

type Say = keyof typeof U.hand.say;

export function TranslateScene() {
  const [filled, setFilled] = useState(1);            // how many Korean boxes are written
  const [eye, setEye] = useState<number | null>(null);
  const [say, setSay] = useState<Say>("start");

  const press = (i: number) => {
    if (filled === 1) {
      if (i === 2) { setFilled(2); setEye(2); setSay("right1"); } else { setEye(i); setSay(i === 0 ? "done1" : "early"); }
    } else if (filled === 2) {
      if (i === 1) { setFilled(3); setEye(1); setSay("right2"); } else { setEye(i); setSay(i === 0 ? "done1" : "done2"); }
    }
  };
  const reset = () => { setFilled(1); setEye(null); setSay("start"); };

  return (
    <div className="ad-scene">
      <div className="st-dom">
        <div>
          <p className="st-dom-label">{U.hand.source}</p>
          <div className="st-dom-row">
            {U.hand.en.map((word, i) => (
              <button key={word} type="button" className={`st-word ${eye === i ? "eye" : ""}`} onClick={() => press(i)} aria-pressed={eye === i}>
                {eye === i ? <small>{U.hand.eye}</small> : null}{word}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="st-dom-label">{U.hand.target}</p>
          <div className="st-dom-row">
            {U.hand.ko.map((word, i) => (
              <span key={word} className={`st-word ${i < filled ? "done" : i === filled ? "hand" : "blank"}`}>
                {i === filled ? <small>{U.hand.hand}</small> : null}{i < filled ? word : "____"}
              </span>
            ))}
          </div>
        </div>
        <p className="st-dom-say" aria-live="polite">{U.hand.say[say]}</p>
      </div>
      <div className="ad-controls">
        <button type="button" className="ad-btn" onClick={reset}>{U.hand.reset}</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 02 · One blank: Q against three K, shares, mixed V, candidate scores  */
/* ------------------------------------------------------------------ */

const ANIMALS: Animal[] = ["cats", "dogs"];

export function QkvScene() {
  const [animal, setAnimal] = useState<Animal>("cats");
  const [step, setStep] = useState(0);
  const b = useMemo(() => fillBlank(animal), [animal]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const c = columns(w), d = c.narrow ? 1 : 2, g = Math.max(0, (h - 440) / 4), vs = values(animal);
    const tone = (at: number) => (step === at ? 1 : 0.78);
    const yShare = 34, yBox = 62, yK = yBox + 50, yV = yK + 36, yMix = yV + 62 + g, yKo = yMix + 48 + g, yCand = yKo + 78 + g;

    label(ctx, U.where.source, PAD, 14, palette.muted, 11);
    wordRow(ctx, c, yBox, ["I", "love", animal], READ);

    if (step >= 1) {
      ctx.save(); ctx.globalAlpha = tone(1);
      label(ctx, U.where.share, w - PAD, 14, READ, 11, "right");
      shares(ctx, c, yShare, b.weights, READ, step === 1);
      KEYS.forEach((k, i) => {
        label(ctx, `${U.where.k} ${vec(k, d)}`, c.cx(i), yK, palette.ink, 11, "center");
        label(ctx, `${U.where.score} ${num(b.scores[i])}`, c.cx(i), yK + 16, palette.ink, 11, "center");
      });
      ctx.restore();
    }
    if (step >= 2) {
      ctx.save(); ctx.globalAlpha = tone(2);
      vs.forEach((v, i) => {
        label(ctx, `${U.where.v} ${vec(v, d)}`, c.cx(i), yV, i === 2 ? palette.anomaly : palette.ink, 11, "center");
        label(ctx, `× ${num(b.weights[i])}`, c.cx(i), yV + 15, READ, 11, "center");
        label(ctx, `= ${vec(b.parts[i], d)}`, c.cx(i), yV + 30, palette.ink, 11, "center");
        line(ctx, c.cx(i), yV + 40, w / 2, yMix - 2, `rgba(${palette.normalRgb},${0.25 + 0.7 * b.weights[i]})`, 1 + 5 * b.weights[i]);
      });
      rbox(ctx, w / 2 - 120, yMix, 240, 30, 8, `rgba(${palette.normalRgb},0.1)`, READ, 1.5);
      label(ctx, `${U.where.mixed} ${vec(b.mixed)}`, w / 2, yMix + 15, palette.ink, 12, "center");
      ctx.restore();
    }

    label(ctx, U.where.target, PAD, yKo - 12, palette.muted, 11);
    wordRow(ctx, c, yKo, ["나는", step >= 4 ? CANDIDATES[b.pick] : "____", null], WRITE, 1);
    if (step >= 1) {
      label(ctx, `${U.where.q} ${vec(Q_BLANK)}  ·  ${U.where.same}`, w / 2, yKo + 46, step === 1 ? READ : palette.muted, 11, "center");
    }
    if (step >= 3) {
      ctx.save(); ctx.globalAlpha = tone(3) < 1 && step === 4 ? 0.8 : 1;
      label(ctx, U.where.prob, PAD, yCand - 18, WRITE, 11);
      candidates(ctx, w, yCand, CANDIDATES, b.probs, Math.min(22, (h - yCand - 4) / 4 + 4), step >= 4 ? b.pick : -1);
      ctx.restore();
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.where.step}>
          <span>{U.where.step}</span>
          {U.where.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.where.third}>
          <span>{U.where.third}</span>
          {ANIMALS.map((a) => <button key={a} type="button" className={animal === a ? "on" : ""} onClick={() => setAnimal(a)}>{a}</button>)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 03 · Two heads read the same source with different shares            */
/* ------------------------------------------------------------------ */

export function TwoHeadScene() {
  const [verb, setVerb] = useState<Verb>("love");
  const [both, setBoth] = useState(false);
  const t = useMemo(() => twoHeads(verb, both), [verb, both]);

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const c = columns(w), g = Math.max(0, (h - 440) / 4);
    const yA = 36, yBox = 64, yB = yBox + 60, yJoin = yB + 62 + g, yKo = yJoin + 50 + g, yCand = yKo + 68 + g;

    label(ctx, U.twohead.a, PAD, 14, READ, 11);
    shares(ctx, c, yA, t.wA, READ, false);
    wordRow(ctx, c, yBox, ["I", verb === "love" ? U.twohead.love : U.twohead.talk, "cats"], palette.frame);
    if (both) {
      shares(ctx, c, yB - 4, t.wB, palette.accent2, false);
      label(ctx, U.twohead.b, PAD, yB + 28, palette.accent2, 11);
    } else {
      label(ctx, U.twohead.off, PAD, yB + 4, palette.muted, 11);
    }

    // the two results side by side: nothing is averaged together
    const jw = Math.min(150, (w - 2 * PAD - 12) / 2), jx = w / 2 - jw - 6;
    label(ctx, U.twohead.joined, PAD, yJoin - 12, palette.muted, 11);
    rbox(ctx, jx, yJoin, jw, 30, 8, `rgba(${palette.normalRgb},0.1)`, READ, 1.5);
    label(ctx, vec(t.cA), jx + jw / 2, yJoin + 15, palette.ink, 12, "center");
    rbox(ctx, jx + jw + 12, yJoin, jw, 30, 8, both ? "rgba(124,58,237,0.1)" : "#ffffff", both ? palette.accent2 : palette.dotOff, 1.5);
    label(ctx, both ? vec(t.cB) : "—", jx + jw + 12 + jw / 2, yJoin + 15, both ? palette.ink : palette.muted, 12, "center");

    const tied = Math.abs(t.probs[0] - t.probs[1]) < 0.05;
    wordRow(ctx, c, yKo, ["나는", tied ? U.twohead.undecided : HEAD_CANDIDATES[t.pick], null], WRITE, 1);
    label(ctx, U.twohead.prob, PAD, yCand - 18, WRITE, 11);
    candidates(ctx, w, yCand, HEAD_CANDIDATES, t.probs, Math.min(22, (h - yCand - 6) / 4 + 5), tied ? -1 : t.pick);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.twohead.verb}>
          <span>{U.twohead.verb}</span>
          <button type="button" className={verb === "love" ? "on" : ""} onClick={() => setVerb("love")}>{U.twohead.love}</button>
          <button type="button" className={verb === "talk" ? "on" : ""} onClick={() => setVerb("talk")}>{U.twohead.talk}</button>
        </div>
        <div className="ad-ctl ad-seg" role="group" aria-label={U.twohead.heads}>
          <span>{U.twohead.heads}</span>
          <button type="button" className={!both ? "on" : ""} onClick={() => setBoth(false)}>{U.twohead.one}</button>
          <button type="button" className={both ? "on" : ""} onClick={() => setBoth(true)}>{U.twohead.two}</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 04 · The same blank while training, and when really translating      */
/* ------------------------------------------------------------------ */

const HISTORY = trainBlank();
const LAST = HISTORY.length - 1;

export function LearnScene() {
  const [training, setTraining] = useState(true);
  const [step, setStep] = useState(0);
  const snap = HISTORY[training ? step : LAST];

  const ref = useCanvas((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    drawGrid(ctx, w, h, 40);
    const c = columns(w), g = Math.max(0, (h - 440) / 3);
    const yShare = 36, yBox = 64, yKo = yBox + 86 + g, yCand = yKo + 82 + g, rh = Math.min(22, (h - yCand - 40) / 4 + 5);
    const pick = snap.probs.indexOf(Math.max(...snap.probs));

    label(ctx, U.learn.share, PAD, 14, READ, 11);
    if (training) label(ctx, U.learn.fixed, w - PAD, 14, palette.anomaly, 11, "right");
    shares(ctx, c, yShare, snap.weights, READ, false);
    wordRow(ctx, c, yBox, ["I", "love", "cats"], READ);
    label(ctx, U.learn.input, PAD, yBox + 52, palette.muted, 11);

    wordRow(ctx, c, yKo, ["나는", training ? "____" : CANDIDATES[pick], null], WRITE, 1);
    if (training) {
      // the answer sits apart from the inputs: it is opened only after the prediction
      rbox(ctx, c.cx(2) - c.bw / 2, yKo, c.bw, 34, 8, "rgba(15,157,106,0.1)", palette.mint, 1.5);
      label(ctx, CANDIDATES[0], c.cx(2), yKo + 17, palette.ink, 14, "center");
      label(ctx, U.learn.answer, w - PAD, yKo - 12, palette.mint, 10, "right");
    } else {
      label(ctx, U.learn.none, w - PAD, yKo - 12, palette.muted, 11, "right");
    }

    label(ctx, U.learn.prob, PAD, yCand - 18, WRITE, 11);
    if (training) label(ctx, U.learn.fixed, w - PAD, yCand - 18, palette.anomaly, 11, "right");
    candidates(ctx, w, yCand, CANDIDATES, snap.probs, rh, training ? 0 : pick);
    if (training) label(ctx, `${U.learn.error} ${num(snap.loss)}  ${U.learn.errorIs}`, PAD, yCand + 4 * rh + 6, palette.anomaly, 12);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.learn.mode}>
          <span>{U.learn.mode}</span>
          <button type="button" className={training ? "on" : ""} onClick={() => setTraining(true)}>{U.learn.train}</button>
          <button type="button" className={!training ? "on" : ""} onClick={() => setTraining(false)}>{U.learn.run}</button>
        </div>
        {training ? (
          <label className="ad-ctl">
            <span>{U.learn.step} <b>{step}</b></span>
            <input type="range" min={0} max={LAST} step={1} value={step} onChange={(e) => setStep(Number(e.target.value))} />
          </label>
        ) : null}
      </div>
    </div>
  );
}
