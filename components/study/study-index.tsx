import Link from "next/link";
import { studyIndexCopy as t } from "./resnet50-copy";

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
          {t.chapters.map((c) => (
            <li key={c.num} className={c.status === "soon" ? "soon" : ""}>
              <span className="st-ch-num">{c.num}</span>
              <div>
                <h2>{c.href ? <Link href={c.href}>{c.title}</Link> : c.title}</h2>
                <p>{c.desc}</p>
                {c.status === "soon" ? <span className="st-soon">{t.soon}</span> : null}
              </div>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
