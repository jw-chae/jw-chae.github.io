"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Formula } from "@/components/anomaly/formula";
import { useInView } from "@/components/anomaly/lib";
import { chapterBySlug, chapterLabels as L, neighbors, type StudySection } from "./chapters";

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.18);
  return <div ref={ref} className={`ad-reveal ${inView ? "in" : ""} ${className}`}>{children}</div>;
}

function Section({ s, index, children }: { s: StudySection; index: number; children: ReactNode }) {
  return (
    <section className={`ad-stage st-section ${index % 2 === 1 ? "flip" : ""}`} id={s.id} aria-labelledby={`${s.id}-title`}>
      <Reveal className="ad-stage-copy">
        <p className="ad-num"><span>{s.num}</span> {s.kicker}</p>
        <h2 id={`${s.id}-title`}>{s.question}</h2>
        {s.steps.map((p, i) => <p className="ad-body" key={i}>{p}</p>)}
        <Formula tex={s.formula} />
        <p className="st-takeaway"><span>{L.takeaway}</span>{s.takeaway}</p>
        <p className="ad-note"><b>{L.see}.</b> {s.see}</p>
      </Reveal>
      <Reveal className="ad-stage-visual st-sticky">{children}</Reveal>
    </section>
  );
}

export type Related = { title: string; text: string; link: string; linkText: string };

/** Shared chapter layout: hero with a question list, question → figure sections, related note, prev/next. */
export function ChapterPage({ slug, title, sub, sections, scenes, heroExtra, related }: {
  slug: string;
  title: string;
  sub: string;
  sections: StudySection[];
  scenes: Record<string, () => ReactNode>;
  heroExtra?: ReactNode;
  related?: Related;
}) {
  const chapter = chapterBySlug(slug);
  const { prev, next } = neighbors(slug);
  return (
    <main id="main" className="ad-page st-page" lang="ko">
      <section className="st-hero" aria-labelledby="st-title">
        <div className="ad-hero-inner">
          <p className="ad-kicker"><Link href="/study/">Study</Link> · {chapter.num}</p>
          <h1 id="st-title">{title}</h1>
          <p className="ad-sub">{sub}</p>
          {heroExtra}
          <nav className="st-toc" aria-label={L.toc}>
            <p>{L.toc}</p>
            <ol>
              {sections.map((s) => (
                <li key={s.id}><a href={`#${s.id}`}><span>{s.num}</span>{s.question}</a></li>
              ))}
            </ol>
          </nav>
        </div>
      </section>

      <div className="ad-stages">
        {sections.map((s, i) => (
          <Section s={s} index={i} key={s.id}>{scenes[s.id]?.()}</Section>
        ))}
      </div>

      {related ? (
        <section className="ad-lineage-section" aria-labelledby="st-related">
          <Reveal>
            <h2 id="st-related">{related.title}</h2>
            <p className="ad-body ad-lead">{related.text}</p>
            <p className="ad-body"><Link href={related.link}>{related.linkText}</Link></p>
          </Reveal>
        </section>
      ) : null}

      <nav className="st-pager" aria-label="chapters">
        {prev ? (
          <Link className="st-pager-prev" href={prev.href}><span>← {L.prev} · {prev.num}</span>{prev.title}</Link>
        ) : <Link className="st-pager-prev" href="/study/"><span>←</span>{L.index}</Link>}
        {next ? (
          <Link className="st-pager-next" href={next.href}><span>{L.next} · {next.num} →</span>{next.title}</Link>
        ) : <Link className="st-pager-next" href="/study/"><span>→</span>{L.index}</Link>}
      </nav>
    </main>
  );
}
