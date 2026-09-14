"use client";

import Image from "next/image";
import { useState, type CSSProperties } from "react";
import { useCountUp, useInView } from "./lib";

const CATS = ["bottle", "cable", "capsule", "carpet", "grid"] as const;
const COLS = ["input", "gt", "nn", "spm", "procon"] as const;

export type ResultsCopy = {
  kicker: string;
  title: string;
  lead: string;
  cols: [string, string, string, string, string];
  metrics: { dataset: string; iauroc: number; pap: number; aupro: number }[];
  metricNames: [string, string, string];
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
      <div className="ad-metrics">
        {t.metrics.map((m) => <MetricCard key={m.dataset} m={m} names={t.metricNames} active={inView} />)}
      </div>
    </div>
  );
}

function MetricCard({ m, names, active }: { m: ResultsCopy["metrics"][number]; names: [string, string, string]; active: boolean }) {
  const a = useCountUp(m.iauroc, active, 1600);
  const b = useCountUp(m.pap, active, 1900);
  const c = useCountUp(m.aupro, active, 2200);
  return (
    <div className="ad-metric">
      <h4>{m.dataset}</h4>
      <div><span>{names[0]}</span><b>{a.toFixed(1)}</b></div>
      <div><span>{names[1]}</span><b>{b.toFixed(1)}</b></div>
      <div><span>{names[2]}</span><b>{c.toFixed(1)}</b></div>
    </div>
  );
}

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
