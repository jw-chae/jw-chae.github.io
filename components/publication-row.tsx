import type { Publication } from "@/data/site";

export function PublicationRow({
  publication,
  compact = false,
  showYear = true,
}: {
  publication: Publication;
  compact?: boolean;
  showYear?: boolean;
}) {
  const primaryHref = publication.arxiv
    ? `https://arxiv.org/abs/${publication.arxiv}`
    : publication.doi
      ? `https://doi.org/${publication.doi}`
      : undefined;

  return (
    <article className={"publication-row" + (compact ? " compact" : "")}>
      {showYear ? <div className="pub-year">{publication.year}</div> : null}
      <div className="publication-body">
        <h3>{primaryHref ? <a href={primaryHref}>{publication.title}</a> : publication.title}</h3>
        <p className="authors">{publication.authors}</p>
        <p className="publication-venue"><em>{publication.venue}</em>, {publication.year}.</p>
        {compact ? null : <p className="contribution">{publication.contribution}</p>}
        <div className="resource-links" aria-label={publication.title + " resources"}>
          {publication.arxiv ? <a href={`https://arxiv.org/abs/${publication.arxiv}`}>paper</a> : null}
          {publication.doi ? <a href={`https://doi.org/${publication.doi}`}>doi</a> : null}
          {publication.code ? <a href={publication.code}>code</a> : null}
        </div>
      </div>
    </article>
  );
}
