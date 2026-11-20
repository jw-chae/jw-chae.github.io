import Link from "next/link";
import { chapters, studyIndexCopy as t } from "./chapters";

export function StudyIndex() {
  return (
    <main id="main" className="ad-page st-page" lang="ko">
      <section className="st-hero" aria-labelledby="study-title">
        <div className="ad-hero-inner">
          <p className="ad-kicker">{t.kicker}</p>
          <h1 id="study-title">{t.title}</h1>
          <p className="ad-sub">{t.sub}</p>
        </div>
      </section>
      <section className="ad-stages st-index" aria-label="chapters">
        <ol className="st-chapters">
          {chapters.map((c) => (
            <li key={c.slug}>
              <span className="st-ch-num">{c.num}<span className="st-era">{c.era}</span></span>
              <div>
                <h2><Link href={c.href}>{c.title}</Link></h2>
                <p>{c.desc}</p>
                <p className="st-meta">
                  {c.tags.map((tag) => <span className="st-tag" key={tag}>{tag}</span>)}
                  {c.figures > 0 ? <span className="st-figs">{t.figures} {c.figures}</span> : null}
                  <Link className="st-read" href={c.href}>{c.external ? t.out : t.read} →</Link>
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
