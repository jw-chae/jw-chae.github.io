import type { Metadata } from "next";
import { PublicationRow } from "@/components/publication-row";
import { profile, publications } from "@/data/site";

export const metadata: Metadata = {
  title: "Publications",
  description: "Publications and preprints by Joongwon Chae.",
};

export default function PublicationsPage() {
  const years = Array.from(new Set(publications.map((publication) => publication.year))).sort((a, b) => b - a);

  return (
    <main id="main" className="page-main shell">
      <header className="page-heading">
        <h1>Publications</h1>
        <p>
          Peer-reviewed work, preprints, and manuscripts across anomaly detection, multimodal learning,
          and medical AI. <a href={profile.scholar}>Google Scholar</a>
        </p>
      </header>
      <div className="publication-groups">
        {years.map((year) => (
          <section className="publication-year" key={year} aria-labelledby={"year-" + year}>
            <h2 id={"year-" + year}>{year}</h2>
            <div className="publication-list full">
              {publications
                .filter((publication) => publication.year === year)
                .map((publication) => (
                  <PublicationRow key={publication.title} publication={publication} showYear={false} />
                ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
