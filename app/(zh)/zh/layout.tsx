import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import "../../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jw-chae.github.io"),
  title: { default: "Joongwon Chae | 研究主页", template: "%s | Joongwon Chae" },
  description: "免训练异常检测、记忆增强推理与医疗人工智能研究。",
  alternates: {
    canonical: "/zh/",
    languages: { en: "/", "zh-CN": "/zh/", "x-default": "/" },
  },
  openGraph: {
    title: "Joongwon Chae | 研究主页",
    description: "计算机视觉、异常检测与多模态学习。",
    url: "/zh/",
    locale: "zh_CN",
    type: "website",
  },
};

export default function ChineseLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">跳到主要内容</a>
        <Header locale="zh" />
        {children}
        <Footer locale="zh" />
      </body>
    </html>
  );
}
