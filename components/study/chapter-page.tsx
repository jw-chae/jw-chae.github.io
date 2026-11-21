"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Formula } from "@/components/anomaly/formula";
import { useInView } from "@/components/anomaly/lib";
import { chapterBySlug, chapterLabels as L, neighbors, type Prologue, type StudySection } from "./chapters";
import type { Doubt, Doubts } from "./doubts";

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.12);
  return <div ref={ref} className={`ad-reveal ${inView ? "in" : ""} ${className}`}>{children}</div>;
}

function StoryPart({ n, name, paragraphs }: { n: number; name: string; paragraphs: string[] }) {
  return (
    <div className="st-part">
      <h3><span>{n}</span>{name}</h3>
      {paragraphs.map((p, i) => <p className="ad-body" key={i}>{p}</p>)}
    </div>
  );
}

function Section({ s, index, doubts, children }: { s: StudySection; index: number; doubts: Doubt[]; children: ReactNode }) {
  return (
    <section className={`ad-stage st-section ${index % 2 === 1 ? "flip" : ""}`} id={s.id} aria-labelledby={`${s.id}-title`}>
      <Reveal className="ad-stage-copy">
        <p className="ad-num"><span>{s.num}</span> {s.kicker}</p>
        <h2 id={`${s.id}-title`}>{s.question}</h2>
        <StoryPart n={1} name={L.origin} paragraphs={s.story.origin} />
        <StoryPart n={2} name={L.need} paragraphs={s.story.need} />
        <p className="st-analogy"><span>{L.analogy}</span>{s.analogy}</p>
        <StoryPart n={3} name={L.how} paragraphs={s.story.how} />
        <Formula tex={s.formula} />
        <p className="st-takeaway"><span>{L.takeaway}</span>{s.takeaway}</p>
        <p className="ad-note"><b>{L.see}.</b> {s.see}</p>
        {doubts.length > 0 ? (
          <div className="st-doubts">
            <h3>{L.doubts}</h3>
            {doubts.map((d) => (
              <div className="st-doubt" key={d.q}>
                <p className="st-doubt-q"><span>Q</span>{d.q}</p>
                {d.a.map((p, i) => <p className="st-doubt-a" key={i}>{p}</p>)}
              </div>
            ))}
          </div>
        ) : null}
        <p className="st-bridge"><span>{L.bridge}</span>{s.bridge}</p>
      </Reveal>
      <Reveal className="ad-stage-visual st-sticky">{children}</Reveal>
    </section>
  );
}

export type Related = { title: string; text: string; link: string; linkText: string };

/** Shared chapter layout: hero, the story so far, a question list, story sections with figures, prev/next. */
export function ChapterPage({ slug, title, sub, prologue, sections, scenes, doubts, heroExtra, related }: {
  slug: string;
  title: string;
  sub: string;
  prologue: Prologue;
  sections: StudySection[];
  scenes: Record<string, () => ReactNode>;
  doubts: Doubts;
  heroExtra?: ReactNode;
  related?: Related;
}) {
  const chapter = chapterBySlug(slug);
  const { prev, next } = neighbors(slug);
  return (
    <main id="main" className="ad-page st-page" lang="ko">
      <section className="st-hero" aria-labelledby="st-title">
        <div className="ad-hero-inner">
          <p className="ad-kicker"><Link href="/study/">Study</Link> · {chapter.num} · {chapter.era}</p>
          <h1 id="st-title">{title}</h1>
          <p className="ad-sub">{sub}</p>
          {heroExtra}
        </div>
      </section>

      <section className="st-prologue" aria-labelledby="st-prologue-title">
        <div className="st-prologue-text">
          <h2 id="st-prologue-title">{prologue.title}</h2>
          {prologue.paragraphs.map((p, i) => <p className="ad-body" key={i}>{p}</p>)}
        </div>
        <div className="st-prologue-side">
          <ol className="st-timeline">
            {prologue.timeline.map((t) => (
              <li key={t.year + t.text}><b>{t.year}</b><span>{t.text}</span></li>
            ))}
          </ol>
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
          <Section s={s} index={i} doubts={doubts[s.id] ?? []} key={s.id}>{scenes[s.id]?.()}</Section>
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
