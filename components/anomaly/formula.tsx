"use client";

import katex from "katex";
import "katex/dist/katex.min.css";

/** Renders one or more display-mode LaTeX lines (separated by "\n"). No box: math sits on the page like in a paper. */
export function Formula({ tex, className = "" }: { tex: string; className?: string }) {
  const lines = tex.split("\n").filter((l) => l.trim().length > 0);
  return (
    <div className={`ad-formula ${className}`} aria-label="formula">
      {lines.map((line, i) => (
        <div
          key={i}
          className="ad-formula-line"
          dangerouslySetInnerHTML={{ __html: katex.renderToString(line, { displayMode: true, throwOnError: false, strict: "ignore", output: "html" }) }}
        />
      ))}
    </div>
  );
}
