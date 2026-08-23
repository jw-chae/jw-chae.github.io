import { profile } from "@/data/site";
import type { SiteLocale } from "@/components/header";

export function Footer({ locale }: { locale: SiteLocale }) {
  const isZh = locale === "zh";

  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p>Joongwon Chae</p>
          <span>{isZh ? "清华大学深圳国际研究生院 · 硕士研究生" : "Tsinghua University SIGS · Master's Student Researcher"}</span>
        </div>
        <div className="footer-links">
          <a href={profile.scholar}>Google Scholar</a>
          <a href={profile.github}>GitHub</a>
          <a href={`mailto:${profile.email}`}>{isZh ? "邮箱" : "Email"}</a>
        </div>
      </div>
    </footer>
  );
}
