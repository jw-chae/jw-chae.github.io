"use client";

import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { useInView } from "@/components/anomaly/lib";
import { projects, projectsCopy as t, type Project, type ProjectSection } from "./projects-copy";

function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.15);
  return <div ref={ref} className={`ad-reveal ${inView ? "in" : ""} ${className}`}>{children}</div>;
}

function Section({ s }: { s: ProjectSection }) {
  return (
    <section className="pj-section" id={s.id}>
      <Reveal>
        <p className="pj-label">{s.label}</p>
        <h3>{s.title}</h3>
        {s.paras.map((p, i) => <p className="ad-body" key={i}>{p}</p>)}
        {s.table ? (
          <div className="pj-table-wrap">
            <table className="pj-table">
              <thead><tr>{s.table.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
              <tbody>{s.table.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
            </table>
            {s.table.note ? <p className="pj-table-note">{s.table.note}</p> : null}
          </div>
        ) : null}
        {s.figure ? (
          <figure className="pj-figure">
            <Image src={s.figure.src} alt={s.figure.alt} width={s.figure.width} height={s.figure.height} sizes="(max-width: 760px) calc(100vw - 32px), 860px" />
            <figcaption>{s.figure.caption}</figcaption>
          </figure>
        ) : null}
      </Reveal>
    </section>
  );
}

function ProjectBlock({ p }: { p: Project }) {
  return (
    <article className="pj-project" id={p.id} style={{ "--tone": p.tone } as CSSProperties} aria-labelledby={`${p.id}-title`}>
      <Reveal className={`pj-head ${p.mascot?.wide ? "wide" : ""}`}>
        <div className="pj-head-text">
          <p className="ad-num"><span>{p.num}</span> {p.status}</p>
          <h2 id={`${p.id}-title`}>{p.title}</h2>
          <blockquote className="pj-hook"><span>{t.labels.hook}</span>{p.hook}</blockquote>
          <p className="ad-body pj-lead">{p.lead}</p>
        </div>
        {p.mascot ? (
          <div className={`pj-mascot ${p.mascot.wide ? "wide" : ""}`}>
            <Image src={p.mascot.src} alt={p.mascot.alt} width={p.mascot.wide ? 1200 : 640} height={p.mascot.wide ? 900 : 640} sizes={p.mascot.wide ? "(max-width: 760px) calc(100vw - 32px), 380px" : "(max-width: 760px) 40vw, 260px"} />
          </div>
        ) : null}
      </Reveal>

      <div className="pj-sections">
        {p.sections.map((s) => <Section s={s} key={s.id} />)}
      </div>

      <Reveal className="pj-closing">
        <div className="pj-honest">
          <p className="pj-label">{t.labels.honest}</p>
          <p>{p.honest}</p>
        </div>
        <div className="pj-next">
          <p className="pj-label">{t.labels.next}</p>
          <p>{p.next}</p>
        </div>
        <p className="pj-links"><span className="pj-label">{t.labels.links}</span>
          {p.links.map((l) => l.href === "#" ? <em key={l.label}>{l.label}</em> : <a key={l.label} href={l.href}>{l.label}</a>)}
        </p>
      </Reveal>
    </article>
  );
}

export function ProjectsPage() {
  return (
    <main id="main" className="ad-page st-page pj-page" lang="ko">
      <section className="st-hero" aria-labelledby="pj-title">
        <div className="ad-hero-inner">
          <p className="ad-kicker">{t.kicker}</p>
          <h1 id="pj-title">{t.title}</h1>
          <p className="ad-sub">{t.sub}</p>
          <nav className="pj-toc" aria-label="projects">
            {projects.map((p) => <a key={p.id} href={`#${p.id}`}><span>{p.num}</span>{p.title}</a>)}
          </nav>
        </div>
      </section>
      <div className="ad-stages pj-list">
        {projects.map((p) => <ProjectBlock p={p} key={p.id} />)}
      </div>
    </main>
  );
}
