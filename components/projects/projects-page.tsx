import Image from "next/image";
import { projectsEn, projectsZh } from "./projects-copy";

export function ProjectsPage({ locale }: { locale: "en" | "zh" }) {
  const t = locale === "zh" ? projectsZh : projectsEn;
  return (
    <main id="main" className="ad-page pj-page">
      <section className="st-hero" aria-labelledby="pj-title">
        <div className="ad-hero-inner">
          <p className="ad-kicker">{t.kicker}</p>
          <h1 id="pj-title">{t.title}</h1>
          <p className="ad-sub">{t.sub}</p>
        </div>
      </section>
      <div className="ad-stages pj-list">
        {t.projects.map((p) => (
          <article className="pj-card" id={p.id} key={p.id} aria-labelledby={`${p.id}-title`}>
            <div className="pj-card-text">
              <h2 id={`${p.id}-title`}>{p.title}</h2>
              <p className="pj-question">{p.question}</p>
              {p.blurb ? <p className="ad-body pj-blurb">{p.blurb}</p> : null}
            </div>
            <div className="pj-card-image">
              <Image src={p.image.src} alt={p.image.alt} width={p.image.width} height={p.image.height} sizes="(max-width: 760px) calc(100vw - 32px), 420px" />
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
