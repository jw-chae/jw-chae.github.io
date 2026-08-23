import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CV",
  description: "Curriculum vitae of Joongwon Chae.",
};

export default function CvPage() {
  return (
    <main id="main" className="page-main shell cv-page">
      <header className="page-heading cv-heading">
        <div>
          <h1>Curriculum Vitae</h1>
          <p>The current two-page research C.V., updated August 23, 2026.</p>
        </div>
        <div className="cv-actions">
          <a href="/JoongwonChae_CV.pdf" download>download PDF</a>
          <a href="/JoongwonChae_CV.pdf">open directly</a>
        </div>
      </header>
      <section className="cv-document" aria-label="CV document preview">
        <iframe className="pdf-frame" src="/JoongwonChae_CV.pdf#view=FitH" title="Joongwon Chae curriculum vitae PDF" />
      </section>
      <p className="pdf-fallback">If the preview does not load, <a href="/JoongwonChae_CV.pdf">open the PDF directly</a>.</p>
    </main>
  );
}
