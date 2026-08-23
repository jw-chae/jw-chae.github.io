import type { Metadata } from "next";
import { PublicationRow } from "@/components/publication-row";
import { profile } from "@/data/site";
import { publicationsZh } from "@/data/site-zh";

export const metadata: Metadata = {
  title: "论文",
  description: "Joongwon Chae 的论文、预印本与研究稿件。",
  alternates: {
    canonical: "/zh/publications/",
    languages: { en: "/publications/", "zh-CN": "/zh/publications/", "x-default": "/publications/" },
  },
  openGraph: { url: "/zh/publications/", locale: "zh_CN" },
};

export default function ChinesePublicationsPage() {
  const years = Array.from(new Set(publicationsZh.map((publication) => publication.year))).sort((a, b) => b - a);

  return (
    <main id="main" className="page-main shell">
      <header className="page-heading">
        <h1>论文</h1>
        <p>
          完整作者名单均依据当前 arXiv、DOI 与出版社记录录入。尚未公开的 ViGen 稿件仅列出已确认的两位共同第一作者。 <a href={profile.scholar}>Google Scholar</a>
        </p>
      </header>
      <div className="publication-groups">
        {years.map((year) => (
          <section className="publication-year" key={year} aria-labelledby={`zh-year-${year}`}>
            <h2 id={`zh-year-${year}`}>{year}</h2>
            <div className="publication-list full">
              {publicationsZh.filter((publication) => publication.year === year).map((publication) => (
                <PublicationRow key={publication.title} publication={publication} showYear={false} locale="zh" />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
