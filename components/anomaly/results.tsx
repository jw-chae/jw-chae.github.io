"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { useInView } from "./lib";

const CATS = ["bottle", "cable", "capsule", "carpet", "grid"] as const;
const COLS = ["input", "gt", "nn", "spm", "procon"] as const;

/* ------------------------------------------------------------------ */
/* Five interventions → five observed consequences                     */
/* ------------------------------------------------------------------ */

export type DownstreamItem = {
  paper: string;
  stages: string;
  tone: string;
  intervention: string;
  consequence: string;
  label: string;
  before: number;
  after: number;
  unit: string;
};

export type DownstreamCopy = { title: string; lead: string; before: string; after: string; items: DownstreamItem[] };

function fmt(v: number, unit: string) {
  const s = v < 1 && v > 0 ? v.toFixed(3) : v === 0 ? "0.0" : v.toFixed(1);
  return `${s}${unit}`;
}

export function Downstream({ t }: { t: DownstreamCopy }) {
  const { ref, inView } = useInView<HTMLOListElement>(0.15);
  return (
    <ol className={`ad-downstream ${inView ? "in" : ""}`} ref={ref}>
      {t.items.map((it, i) => {
        const hi = Math.max(it.before, it.after, 1e-9);
        const wB = Math.max(0.06, it.before / hi);
        const wA = Math.max(0.06, it.after / hi);
        return (
          <li key={it.paper} style={{ animationDelay: `${i * 0.12}s`, "--tone": it.tone } as CSSProperties}>
            <p className="ad-ds-head"><span className="ad-ds-paper">{it.paper}</span><span className="ad-ds-stage">{it.stages}</span></p>
            <p className="ad-ds-int">{it.intervention}</p>
            <div className="ad-ds-bars" aria-label={`${it.label}: ${t.before} ${fmt(it.before, it.unit)}, ${t.after} ${fmt(it.after, it.unit)}`}>
              <span className="ad-ds-label">{it.label}</span>
              <div className="ad-ds-row"><i>{t.before}</i><b className="before" style={{ width: `${wB * 100}%` }} /><em>{fmt(it.before, it.unit)}</em></div>
              <div className="ad-ds-row"><i>{t.after}</i><b style={{ width: `${wA * 100}%` }} /><em>{fmt(it.after, it.unit)}</em></div>
            </div>
            <p className="ad-ds-con">{it.consequence}</p>
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ */
/* Real ProCon example strip                                            */
/* ------------------------------------------------------------------ */

export type ResultsCopy = {
  kicker: string;
  title: string;
  lead: string;
  cols: [string, string, string, string, string];
  source: string;
};

export function ResultsStrip({ t }: { t: ResultsCopy }) {
  const [cat, setCat] = useState<(typeof CATS)[number]>("bottle");
  const [tick, setTick] = useState(0);
  const { ref, inView } = useInView<HTMLDivElement>(0.2);

  return (
    <div className="ad-results" ref={ref}>
      <div className="ad-tabs" role="tablist" aria-label="MVTec AD category">
        {CATS.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={cat === c} className={cat === c ? "on" : ""} onClick={() => { setCat(c); setTick((v) => v + 1); }}>{c}</button>
        ))}
      </div>
      <div className={`ad-strip ${inView ? "in" : ""}`} key={`${cat}-${tick}`}>
        {COLS.map((col, i) => (
          <figure className="ad-strip-cell" style={{ animationDelay: `${i * 0.18}s` }} key={col}>
            <Image src={`/anomaly/${cat}-${col}.webp`} alt={`${cat}: ${t.cols[i]}`} width={320} height={320} sizes="(max-width: 700px) 45vw, 200px" />
            <figcaption>{t.cols[i]}</figcaption>
            {i > 1 ? <span className="ad-strip-arrow" aria-hidden="true">→</span> : null}
          </figure>
        ))}
      </div>
      <p className="ad-source">{t.source}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lineage                                                              */
/* ------------------------------------------------------------------ */

export type LineageItem = { name: string; year: string; question: string; answer: string; paper: string; code?: string; tone: string };

export function Lineage({ items, labels }: { items: LineageItem[]; labels: { paper: string; code: string } }) {
  const { ref, inView } = useInView<HTMLOListElement>(0.15);
  return (
    <ol className={`ad-lineage ${inView ? "in" : ""}`} ref={ref}>
      {items.map((it, i) => (
        <li key={it.name} style={{ animationDelay: `${i * 0.12}s`, "--tone": it.tone } as CSSProperties}>
          <span className="ad-lineage-year">{it.year}</span>
          <h4>{it.name}</h4>
          <p className="ad-lineage-q">{it.question}</p>
          <p className="ad-lineage-a">{it.answer}</p>
          <div className="ad-lineage-links">
            <a href={it.paper}>{labels.paper}</a>
            {it.code ? <a href={it.code}>{labels.code}</a> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
