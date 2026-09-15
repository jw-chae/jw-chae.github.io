"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useInView } from "@/components/anomaly/lib";
import { resnetCopy as t, type StudySection } from "./resnet50-copy";
import { BatchNormScene, BlockOrderScene, BottleneckScene, OneByOneScene, ShapeFlowScene, SkipScene } from "./resnet50-scenes";

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.18);
  return <div ref={ref} className={`ad-reveal ${inView ? "in" : ""} ${className}`}>{children}</div>;
}

function Section({ s, index, children }: { s: StudySection; index: number; children: ReactNode }) {
  return (
    <section className={`ad-stage ${index % 2 === 1 ? "flip" : ""}`} id={s.id} aria-labelledby={`${s.id}-title`}>
      <Reveal className="ad-stage-copy">
        <p className="ad-num"><span>{s.num}</span> {s.kicker}</p>
        <h2 id={`${s.id}-title`}>{s.title}</h2>
        <p className="ad-body">{s.body}</p>
        <pre className="ad-formula" aria-label="formula">{s.formula}</pre>
        <p className="ad-note">{s.note}</p>
      </Reveal>
      <Reveal className="ad-stage-visual">{children}</Reveal>
    </section>
  );
}

const scenes: Record<string, () => ReactNode> = {
  flow: () => <ShapeFlowScene />,
  bottleneck: () => <BottleneckScene />,
  onebyone: () => <OneByOneScene />,
  skip: () => <SkipScene />,
  bn: () => <BatchNormScene />,
  block: () => <BlockOrderScene />,
};

export function ResNet50Page() {
  return (
    <main id="main" className="ad-page st-page" lang="ko">
      <section className="st-hero" aria-labelledby="st-title">
        <div className="ad-hero-inner">
          <p className="ad-kicker"><Link href="/study/">Study</Link> · 01</p>
          <h1 id="st-title">{t.title}</h1>
          <p className="ad-sub">{t.sub}</p>
          <div className="st-rules" role="list">
            {t.rules.map((r, i) => (
              <div className="st-rule" role="listitem" key={r}><span>{i + 1}</span>{r}</div>
            ))}
          </div>
          <p className="st-depth">
            {t.depth.parts.map((p, i) => <b key={i}>{p}</b>)}
            <em>{t.depth.text}</em>
          </p>
        </div>
      </section>

      <div className="ad-stages">
        {t.sections.map((s, i) => (
          <Section s={s} index={i} key={s.id}>{scenes[s.id]?.()}</Section>
        ))}
      </div>

      <section className="ad-lineage-section" aria-labelledby="st-related">
        <Reveal>
          <h2 id="st-related">{t.related.title}</h2>
          <p className="ad-body ad-lead">{t.related.text}</p>
          <p className="ad-body"><Link href={t.related.link}>{t.related.linkText}</Link></p>
        </Reveal>
      </section>
    </main>
  );
}
