import { Fragment } from "react";
import type { Publication } from "@/data/site";

export function PublicationRow({
  publication,
  compact = false,
  showYear = true,
  locale = "en",
}: {
  publication: Publication;
  compact?: boolean;
  showYear?: boolean;
  locale?: "en" | "zh";
}) {
  const primaryHref = publication.arxiv
    ? `https://arxiv.org/abs/${publication.arxiv}`
    : publication.doi
      ? `https://doi.org/${publication.doi}`
      : undefined;

  const authorParts = publication.authors.split("Joongwon Chae");
  const isZh = locale === "zh";

  return (
    <article className={"publication-row" + (compact ? " compact" : "")}>
      {showYear ? <div className="pub-year">{publication.year}</div> : null}
      <div className="publication-body">
        <h3 lang="en">{primaryHref ? <a href={primaryHref}>{publication.title}</a> : publication.title}</h3>
        <p className="authors" lang="en">
          {authorParts.map((part, index) => (
            <Fragment key={`${part}-${index}`}>
              {index > 0 ? <strong>Joongwon Chae</strong> : null}
              {part}
            </Fragment>
          ))}
        </p>
        {publication.authorNote ? <p className="author-note">{publication.authorNote}</p> : null}
        <p className="publication-venue"><em>{publication.venue}</em>, {publication.year}.</p>
        {compact ? null : <p className="contribution">{publication.contribution}</p>}
        <div className="resource-links" aria-label={publication.title + (isZh ? " 相关链接" : " resources")}>
          {publication.arxiv ? <a href={`https://arxiv.org/abs/${publication.arxiv}`}>{isZh ? "论文" : "paper"}</a> : null}
          {publication.doi ? <a href={`https://doi.org/${publication.doi}`}>doi</a> : null}
          {publication.code ? <a href={publication.code}>{isZh ? "代码" : "code"}</a> : null}
        </div>
      </div>
    </article>
  );
}
