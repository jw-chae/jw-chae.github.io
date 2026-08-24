import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "中文简历",
  description: "Joongwon Chae 的中文简历。",
  alternates: {
    canonical: "/zh/cv/",
    languages: { en: "/cv/", "zh-CN": "/zh/cv/", "x-default": "/cv/" },
  },
  openGraph: { url: "/zh/cv/", locale: "zh_CN" },
};

export default function ChineseCvPage() {
  return (
    <main id="main" className="page-main shell cv-page">
      <header className="page-heading cv-heading">
        <div>
          <h1>中文简历</h1>
        </div>
        <div className="cv-actions">
          <a href="/JoongwonChae_CV_ZH.pdf" download>下载 PDF</a>
          <a href="/JoongwonChae_CV_ZH.pdf">直接打开</a>
          <a href="/cv">English</a>
        </div>
      </header>
      <section className="cv-document" aria-label="中文简历预览">
        <iframe className="pdf-frame" src="/JoongwonChae_CV_ZH.pdf#view=FitH" title="Joongwon Chae 中文简历 PDF" />
      </section>
      <p className="pdf-fallback">如果预览无法加载，请<a href="/JoongwonChae_CV_ZH.pdf">直接打开 PDF</a>。</p>
    </main>
  );
}
