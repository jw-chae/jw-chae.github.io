"use client";

import { useEffect, useState, type ReactNode } from "react";
import { copyEn, copyZh, type Stage } from "./copy";
import { useInView } from "./lib";
import { Lineage, ResultsStrip } from "./results";
import {
  CompositionScene, ConsensusScene, HeroScene, MapToScoreScene, MemoryScene, ProjectionScene, RoutingScene,
} from "./scenes";

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.18);
  return <div ref={ref} className={`ad-reveal ${inView ? "in" : ""} ${className}`}>{children}</div>;
}

function StageBlock({ s, children, index }: { s: Stage; children: ReactNode; index: number }) {
  return (
    <section className={`ad-stage ${index % 2 === 1 ? "flip" : ""}`} id={s.id} aria-labelledby={`${s.id}-title`}>
      <Reveal className="ad-stage-copy">
        <p className="ad-num"><span>{s.num}</span> {s.kicker} <em>· {s.paper}</em></p>
        <h2 id={`${s.id}-title`}>{s.title}</h2>
        <p className="ad-body">{s.body}</p>
        <pre className="ad-formula" aria-label="formula">{s.formula}</pre>
        <p className="ad-note">{s.note}</p>
      </Reveal>
      <Reveal className="ad-stage-visual">{children}</Reveal>
    </section>
  );
}

export function AnomalyShowcase({ locale }: { locale: "en" | "zh" }) {
  const t = locale === "zh" ? copyZh : copyEn;
  const [mask, setMask] = useState<string[]>([]);
  useEffect(() => {
    fetch("/anomaly/mask28.json").then((r) => r.json()).then((j: Record<string, string[]>) => setMask(j.hazelnut ?? [])).catch(() => setMask([]));
  }, []);

  const scene = (id: string) => {
    switch (id) {
      case "tokens": return <HeroScene src="/anomaly/hazelnut-defect.webp" mask28={mask} labels={t.heroLabels} />;
      case "memory": return <MemoryScene t={t.memory} />;
      case "projection": return <ProjectionScene t={t.projection} />;
      case "consensus": return <ConsensusScene t={t.consensus} />;
      case "map": return <MapToScoreScene t={t.map} />;
      case "routing": return <RoutingScene t={t.routing} />;
      case "composition": return <CompositionScene t={t.composition} />;
      default: return null;
    }
  };

  return (
    <main id="main" className="ad-page" lang={locale === "zh" ? "zh-CN" : "en"}>
      <section className="ad-hero" aria-labelledby="ad-hero-title">
        <div className="ad-hero-glow" aria-hidden="true" />
        <div className="ad-hero-inner">
          <p className="ad-kicker">{t.kicker}</p>
          <h1 id="ad-hero-title">{t.title} <span className="ad-accent">{t.titleAccent}</span></h1>
          <p className="ad-sub">{t.sub}</p>
          <p className="ad-scroll" aria-hidden="true">{t.scroll} <span>↓</span></p>
        </div>
        <div className="ad-hero-canvas">
          <HeroScene src="/anomaly/hazelnut-defect.webp" mask28={mask} labels={t.heroLabels} />
        </div>
        <p className="ad-schematic">{t.schematic}</p>
      </section>

      <div className="ad-stages">
        {t.stages.map((s, i) => (
          <StageBlock s={s} index={i} key={s.id}>
            {s.id === "tokens" ? <TokenGrid /> : scene(s.id)}
          </StageBlock>
        ))}
      </div>

      <section className="ad-results-section" aria-labelledby="ad-results-title">
        <Reveal>
          <p className="ad-num"><span>08</span> {t.results.kicker}</p>
          <h2 id="ad-results-title">{t.results.title}</h2>
          <p className="ad-body ad-lead">{t.results.lead}</p>
        </Reveal>
        <ResultsStrip t={t.results} />
      </section>

      <section className="ad-lineage-section" aria-labelledby="ad-lineage-title">
        <Reveal>
          <h2 id="ad-lineage-title">{t.lineageTitle}</h2>
          <p className="ad-body ad-lead">{t.lineageLead}</p>
        </Reveal>
        <Lineage items={t.lineage} labels={t.lineageLabels} />
        <p className="ad-credit">{t.credit}</p>
      </section>
    </main>
  );
}

/** Stage 01 visual: the real image beside its 28 × 28 token grid with defect cells lit. */
function TokenGrid() {
  const [mask, setMask] = useState<string[]>([]);
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  useEffect(() => {
    fetch("/anomaly/mask28.json").then((r) => r.json()).then((j: Record<string, string[]>) => setMask(j.leather ?? [])).catch(() => setMask([]));
  }, []);
  const cells: ReactNode[] = [];
  for (let r = 0; r < 28; r++) for (let c = 0; c < 28; c++) {
    const hot = mask[r]?.[c] === "1";
    cells.push(<i key={`${r}-${c}`} className={hot ? "hot" : ""} style={{ transitionDelay: `${(r * 28 + c) * 1.2}ms` }} />);
  }
  return (
    <div ref={ref} className={`ad-tokengrid ${inView ? "in" : ""}`}>
      <div className="ad-tokengrid-img" style={{ backgroundImage: "url(/anomaly/leather-defect.webp)" }} role="img" aria-label="MVTec AD leather test image with a cut defect" />
      <div className="ad-tokengrid-cells" aria-hidden="true">{cells}</div>
      <p className="ad-tokengrid-cap">784 tokens · {mask.reduce((a, row) => a + [...row].filter((v) => v === "1").length, 0)} overlap the annotated cut</p>
    </div>
  );
}
