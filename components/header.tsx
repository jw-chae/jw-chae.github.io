import Link from "next/link";
import { LanguageSwitch } from "@/components/language-switch";

export type SiteLocale = "en" | "zh";

export function Header({ locale }: { locale: SiteLocale }) {
  const isZh = locale === "zh";
  const home = isZh ? "/zh" : "/";
  const research = isZh ? "/zh/#research" : "/#research";

  return (
    <header className="site-header">
      <div className="shell nav-wrap">
        <Link className="wordmark" href={home} aria-label={isZh ? "Joongwon Chae 中文主页" : "Joongwon Chae home"}>
          Joongwon Chae
        </Link>
        <nav aria-label={isZh ? "主导航" : "Primary navigation"}>
          <Link href={home}>{isZh ? "首页" : "Home"}</Link>
          <Link href={research}>{isZh ? "研究" : "Research"}</Link>
          <Link href={isZh ? "/zh/publications" : "/publications"}>{isZh ? "论文" : "Publications"}</Link>
          <Link href={isZh ? "/zh/cv" : "/cv"}>{isZh ? "简历" : "CV"}</Link>
          <LanguageSwitch locale={locale} />
        </nav>
      </div>
    </header>
  );
}
