"use client";

import { useState, type CSSProperties } from "react";
import { drawGrid, label, palette, useCanvas } from "@/components/anomaly/lib";
import { bar, line, rbox } from "./kit";
import { llmCopy } from "./llm-copy";
import { CtxPicker, PAD, READ, WRITE, chips, pct } from "./llm-scenes";
import { CORPUS, MODELS, TRAIN_STEPS, VOCAB, nextDist, pick, problemsAfter, trainRow, vocabDist } from "./lm-math";

const U = llmCopy.ui;
const MINT_SOFT = "rgba(15,157,106,0.12)";

/* ------------------------------------------------------------------ */
/* 01 · One blank: what goes in, what comes out, how one token is fixed  */
/* ------------------------------------------------------------------ */

const HISTORY = ["고양이", "는", "소파", "에서"];
const ANSWER = "잔다";                                   // what the sentence really has next
const OUT = vocabDist(MODELS[1], HISTORY);               // one probability per vocabulary entry
const RANKED = nextDist(MODELS[1], HISTORY);             // the non-zero ones, most likely first: the dice strip
const ANSWER_P = OUT[VOCAB.indexOf(ANSWER)];

export function BlankScene() {
  const [step, setStep] = useState(0);
  const [roll, setRoll] = useState(87);                  // the first draw is fixed so the text can point at it
  const drawn = pick(RANKED, roll / 100);

  const ref = useCanvas((c, w, h) => {
    c.clearRect(0, 0, w, h);
    drawGrid(c, w, h, 40);
    const portrait = h > w * 1.15, on = step >= 1;

    // the input row: four tokens and the blank
    label(c, U.blank.input, PAD, 18, palette.muted, 11);
    const end = chips(c, [...HISTORY, step === 2 ? drawn : "▢"], PAD, 30, w - PAD, {
      tone: (i) => (i === 4 ? WRITE : on && i === 3 ? READ : palette.ink),
      ink: (i) => (i === 4 && step !== 2 ? WRITE : palette.ink),
      fill: (i) => (i === 4 ? `rgba(${palette.accentRgb},${step === 2 ? 0.22 : 0.12})` : on && i === 3 ? `rgba(${palette.normalRgb},0.08)` : "#ffffff"),
      lw: (i) => (on && i === 3 ? 2.5 : 1.5),
    });
    if (step === 3) {
      // the answer sits apart from the input: it is opened only after the probabilities are out
      label(c, U.blank.book, w - PAD, 18, palette.mint, 11, "right");
      chips(c, [ANSWER], end.x + 12, 30, w, { tone: () => palette.mint, ink: () => palette.ink, fill: () => MINT_SOFT, lw: () => 2.5 });
    }
    if (on) label(c, U.blank.reads, PAD, 71, READ, 11);

    // the whole vocabulary, always in the same place
    label(c, on ? U.blank.output : U.blank.vocab, PAD, 93, step === 1 ? WRITE : palette.muted, 11);
    const cols = portrait ? 4 : 7, rows = Math.ceil(VOCAB.length / cols), cw = (w - 2 * PAD) / cols, ch = portrait ? 40 : 46, gy = 104;
    VOCAB.forEach((tok, k) => {
      const x = PAD + (k % cols) * cw, y = gy + Math.floor(k / cols) * ch, p = OUT[k];
      rbox(c, x + 2, y + 2, cw - 4, ch - 4, 6, on && p > 0 ? `rgba(${palette.accentRgb},${0.1 + 0.5 * p})` : "#ffffff", palette.frame, 1);
      label(c, tok, x + cw / 2, on ? y + ch * 0.35 : y + ch / 2, on && p === 0 ? palette.muted : palette.ink, 11, "center");
      if (on) label(c, `${Math.round(p * 100)}%`, x + cw / 2, y + ch * 0.7, p > 0 ? palette.ink : palette.xmark, 11, "center");
      if (step === 2 && tok === drawn) rbox(c, x + 2, y + 2, cw - 4, ch - 4, 6, null, WRITE, 3);
      if (step === 3 && tok === ANSWER) rbox(c, x + 2, y + 2, cw - 4, ch - 4, 6, null, palette.mint, 3);
    });

    const by = gy + rows * ch + 18;
    if (step === 0) {
      label(c, U.blank.given, PAD, by, palette.ink, 12);
      label(c, U.blank.unknown, PAD, by + 22, WRITE, 12);
    } else if (step === 1) {
      label(c, U.blank.done, PAD, by, palette.ink, 12);
      label(c, U.blank.notWord, PAD, by + 22, palette.muted, 12);
    } else if (step === 2) {
      // the dice: a strip from 0 to 100 cut in proportion to the probabilities
      label(c, `${U.blank.roll}: ${Math.floor(roll)}`, PAD, by, palette.ink, 12);
      const sy = by + 14, sh = 26, sw = w - 2 * PAD;
      let acc = 0;
      label(c, "0", PAD, sy + sh + 11, palette.muted, 11, "center");
      RANKED.forEach((e) => {
        const x = PAD + sw * acc, wd = sw * e.p, hit = e.token === drawn;
        rbox(c, x + 1, sy, wd - 2, sh, 5, hit ? `rgba(${palette.accentRgb},0.3)` : palette.track, hit ? WRITE : palette.frame, hit ? 2 : 1);
        label(c, e.token, x + wd / 2, sy + sh / 2, palette.ink, 11, "center");
        acc += e.p;
        label(c, String(Math.round(acc * 100)), PAD + sw * acc, sy + sh + 11, palette.muted, 11, "center");
      });
      const mx = PAD + sw * roll / 100;
      line(c, mx, sy - 5, mx, sy + sh + 3, palette.ink, 2);
      c.fillStyle = palette.ink; c.beginPath(); c.arc(mx, sy - 5, 3.5, 0, Math.PI * 2); c.fill();
      label(c, `${U.blank.picked}: ${drawn} · ${U.blank.gave} ${Math.round(RANKED.find((e) => e.token === drawn)!.p * 100)}%`, PAD, sy + sh + 34, WRITE, 12);
      label(c, U.blank.same, PAD, sy + sh + 54, palette.muted, 11);
    } else {
      label(c, `${U.blank.book}: ${ANSWER}`, PAD, by, palette.mint, 12);
      label(c, `${U.blank.answerP} ${Math.round(ANSWER_P * 100)}%`, PAD, by + 22, palette.ink, 12);
      label(c, `${U.blank.loss} = −ln ${ANSWER_P.toFixed(2)} = ${(-Math.log(ANSWER_P)).toFixed(2)}`, PAD, by + 44, palette.anomaly, 13);
      label(c, U.blank.noDice, PAD, by + 68, palette.muted, 11);
    }
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <div className="ad-ctl ad-seg" role="group" aria-label={U.blank.step}>
          <span>{U.blank.step}</span>
          {U.blank.steps.map((name, i) => <button key={name} type="button" className={step === i ? "on" : ""} onClick={() => setStep(i)}>{i + 1}. {name}</button>)}
        </div>
        {step === 2 ? <button type="button" className="ad-btn" onClick={() => setRoll(Math.random() * 100)}>{U.blank.again}</button> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 05 · The same numbers reached by gradient descent on one row of scores */
/* ------------------------------------------------------------------ */

const LEARN_PREV = "에서";
const SNAPSHOTS = trainRow(LEARN_PREV);
const PROBLEMS = problemsAfter(LEARN_PREV);
const SHARES = nextDist(MODELS[1], [LEARN_PREV]);                                   // the share of problems each token answers: 0.4, 0.2, 0.2, 0.2
const HEAD_AT = SHARES.map((e) => VOCAB.indexOf(e.token));
const LOSS_FLOOR = SHARES.reduce((s, e) => s - e.p * Math.log(e.p), 0);
const LOSS_MAX = Math.log(VOCAB.length);

export function LearnScene() {
  const [si, setSi] = useState(0);
  const snap = SNAPSHOTS[si];

  const ref = useCanvas((c, w, h) => {
    c.clearRect(0, 0, w, h);
    drawGrid(c, w, h, 40);
    const g = Math.max(0, (h - 440) / 12);

    // the five problems: the same visible token, different answers
    label(c, U.learn.problems, PAD, 18, palette.muted, 11);
    const rg = 24 + g, xr = PAD + 108, xa = xr + 58;
    PROBLEMS.forEach((q, j) => {
      const y = 42 + j * rg, sent = CORPUS[q.sentence], at = sent.indexOf(LEARN_PREV);
      label(c, sent.slice(0, at).join(" "), PAD, y, palette.muted, 12);
      rbox(c, xr, y - 10, 44, 20, 5, `rgba(${palette.normalRgb},0.1)`, READ, 1.5);
      label(c, LEARN_PREV, xr + 22, y, palette.ink, 12, "center");
      rbox(c, xa, y - 10, 66, 20, 5, MINT_SOFT, palette.mint, 1.5);
      label(c, q.answer, xa + 33, y, palette.ink, 12, "center");
    });

    // what the model gives: four tokens on their own, the other 24 entries added up
    const py = 42 + PROBLEMS.length * rg + 10;
    label(c, U.learn.probs, PAD, py, WRITE, 11);
    label(c, U.learn.tick, w - PAD, py, palette.muted, 11, "right");
    const head = HEAD_AT.map((k) => snap.probs[k]), rest = 1 - head.reduce((a, b) => a + b, 0);
    const rows = [...SHARES.map((e, i) => ({ name: e.token, p: head[i], share: e.p })), { name: U.learn.rest, p: rest, share: 0 }];
    const rb = 27 + g, bx = PAD + 84, bwid = w - PAD - bx - 50;
    rows.forEach((r, i) => {
      const y = py + 26 + i * rb, tail = i === rows.length - 1;
      label(c, r.name, PAD, y, tail ? palette.anomaly : palette.ink, 12);
      bar(c, bx, y - 7, bwid, 14, r.p, tail ? palette.anomaly : WRITE);
      line(c, bx + bwid * r.share, y - 12, bx + bwid * r.share, y + 12, palette.mint, 2.5);
      label(c, pct(r.p), w - PAD, y, palette.ink, 12, "right");
    });

    const ly = py + 26 + rows.length * rb + 8;
    label(c, `${U.learn.loss} ${snap.loss.toFixed(2)}`, PAD, ly, palette.anomaly, 12);
    const lw = w - 2 * PAD, fx = PAD + lw * LOSS_FLOOR / LOSS_MAX;
    bar(c, PAD, ly + 13, lw, 6, snap.loss / LOSS_MAX, palette.anomaly);
    line(c, fx, ly + 8, fx, ly + 24, palette.ink, 2);
    label(c, U.learn.floor, fx + 6, ly + 34, palette.muted, 11);
  });

  return (
    <div className="ad-scene">
      <canvas ref={ref} className="ad-canvas" aria-hidden="true" />
      <div className="ad-controls">
        <label className="ad-ctl">
          <span>{U.learn.step} <b>{TRAIN_STEPS[si]}</b></span>
          <input type="range" min={0} max={SNAPSHOTS.length - 1} step={1} value={si} onChange={(e) => setSi(Number(e.target.value))} />
        </label>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 07 · The loop: the reader plays the dice, every pick becomes input   */
/* ------------------------------------------------------------------ */

const GIVEN = ["고양이", "는"];
const LOOP_MAX = 11;                                     // stop a rambling one-token model here
const GRID4: CSSProperties = { gridTemplateColumns: "repeat(4, minmax(0, 1fr))", alignContent: "start" };
const CELL: CSSProperties = { display: "grid", alignContent: "center", justifyItems: "center", minHeight: 46, padding: "0.3rem 0.15rem", fontSize: "clamp(0.78rem, 3.3vw, 0.95rem)" };
const SUB: CSSProperties = { display: "block", marginTop: 2, color: "var(--muted)", fontSize: "0.72rem", fontWeight: 500 };

export function LoopScene() {
  const [ctx, setCtx] = useState(1);
  const [picks, setPicks] = useState<{ token: string; p: number }[]>([]);
  const tokens = [...GIVEN, ...picks.map((x) => x.token)];
  const ended = tokens[tokens.length - 1] === ".", full = !ended && tokens.length >= LOOP_MAX;
  const cands = ended || full ? [] : nextDist(MODELS[ctx], tokens);
  const readFrom = tokens.length - ctx;                  // the model reads the tokens from this index on
  const seen = CORPUS.some((s) => s.join(" ") === tokens.join(" "));
  const S = U.loop.say;
  const lastP = picks.length ? Math.round(picks[picks.length - 1].p * 100) : 0;
  const say = ended ? (seen ? S.endSeen : S.endNew)
    : full ? S.full
    : picks.length === 0 ? S.start
    : `${S.added[0]}${lastP}${S.added[1]} ${cands.length === 1 ? S.one : `${S.many[0]}${cands.length}${S.many[1]}`}`;

  return (
    <div className="ad-scene">
      <div className="st-dom">
        <div>
          <p className="st-dom-label">{U.loop.line}</p>
          <div className="st-dom-row" style={{ ...GRID4, minHeight: 102 }}>
            {tokens.map((tok, i) => {
              const reading = !ended && !full && i >= readFrom;
              return (
                <span key={i} className={`st-word ${i >= GIVEN.length ? "done" : ""} ${reading ? "eye" : ""}`} style={CELL}>
                  {reading ? <small>{U.loop.read}</small> : null}{tok}
                </span>
              );
            })}
            {ended || full ? null : <span className="st-word hand" style={CELL}><small>{U.loop.blank}</small>____</span>}
          </div>
        </div>
        <div>
          <p className="st-dom-label">{U.loop.cands}</p>
          <div className="st-dom-row" style={{ ...GRID4, minHeight: 158 }}>
            {cands.map((e) => (
              <button key={e.token} type="button" className="st-word" style={CELL} onClick={() => setPicks((prev) => [...prev, { token: e.token, p: e.p }])}>
                {e.token}<span style={SUB}>{Math.round(e.p * 100)}%</span>
              </button>
            ))}
            {cands.length === 0 ? <span className="st-word blank" style={CELL}>{U.loop.none}</span> : null}
          </div>
        </div>
        <p className="st-dom-say" aria-live="polite">{say}</p>
      </div>
      <div className="ad-controls">
        <button type="button" className="ad-btn" onClick={() => setPicks([])}>{U.loop.reset}</button>
        <CtxPicker ctx={ctx} set={(n) => { setCtx(n); setPicks([]); }} />
      </div>
    </div>
  );
}
