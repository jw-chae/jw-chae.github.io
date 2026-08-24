import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CV",
  description: "Curriculum vitae of Joongwon Chae, including research highlights, verified publications, and IELTS 6.5.",
  alternates: {
    canonical: "/cv/",
    languages: { en: "/cv/", "zh-CN": "/zh/cv/", "x-default": "/cv/" },
  },
  openGraph: { url: "/cv/", locale: "en_US" },
};

export default function CvPage() {
  return (
    <main id="main" className="page-main shell cv-page">
      <header className="page-heading cv-heading">
        <div>
          <h1>Curriculum Vitae</h1>
          <p>English CV with research highlights, verified author lists, and IELTS 6.5.</p>
        </div>
        <div className="cv-actions">
          <a href="/JoongwonChae_CV_EN.pdf" download>download PDF</a>
          <a href="/JoongwonChae_CV_EN.pdf">open directly</a>
          <a href="/zh/cv">中文版</a>
        </div>
      </header>
      <section className="cv-document" aria-label="English CV document preview">
        <iframe className="pdf-frame" src="/JoongwonChae_CV_EN.pdf#view=FitH" title="Joongwon Chae English curriculum vitae PDF" />
      </section>
      <p className="pdf-fallback">If the preview does not load, <a href="/JoongwonChae_CV_EN.pdf">open the PDF directly</a>.</p>
    </main>
  );
}
