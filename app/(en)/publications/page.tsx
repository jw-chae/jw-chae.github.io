import type { Metadata } from "next";
import { PublicationRow } from "@/components/publication-row";
import { profile, publications } from "@/data/site";

export const metadata: Metadata = {
  title: "Publications",
  description: "Publications and preprints by Joongwon Chae.",
  alternates: {
    canonical: "/publications/",
    languages: { en: "/publications/", "zh-CN": "/zh/publications/", "x-default": "/publications/" },
  },
  openGraph: { url: "/publications/", locale: "en_US" },
};

export default function PublicationsPage() {
  const years = Array.from(new Set(publications.map((publication) => publication.year))).sort((a, b) => b - a);

  return (
    <main id="main" className="page-main shell">
      <header className="page-heading">
        <h1>Publications</h1>
        <p>
          Full author lists are transcribed from current arXiv, DOI, and publisher records. The unpublished ViGen manuscript is limited to the two publicly identified co-first authors. <a href={profile.scholar}>Google Scholar</a>
        </p>
      </header>
      <div className="publication-groups">
        {years.map((year) => (
          <section className="publication-year" key={year} aria-labelledby={`year-${year}`}>
            <h2 id={`year-${year}`}>{year}</h2>
            <div className="publication-list full">
              {publications.filter((publication) => publication.year === year).map((publication) => (
                <PublicationRow key={publication.title} publication={publication} showYear={false} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
