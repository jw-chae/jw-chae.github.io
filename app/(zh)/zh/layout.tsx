import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import "../../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jw-chae.github.io"),
  title: { default: "Joongwon Chae | 研究主页", template: "%s | Joongwon Chae" },
  description: "Joongwon Chae 关于记忆、路由、提示与免训练视觉推理的五项核心第一作者系统。",
  alternates: {
    canonical: "/zh/",
    languages: { en: "/", "zh-CN": "/zh/", "x-default": "/" },
  },
  openGraph: {
    title: "Joongwon Chae | 研究主页",
    description: "关于记忆、路由、提示与免训练视觉推理的五项第一作者系统。",
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
