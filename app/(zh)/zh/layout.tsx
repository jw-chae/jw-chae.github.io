import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import "../../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jw-chae.github.io"),
  title: { default: "Joongwon Chae | 研究主页", template: "%s | Joongwon Chae" },
  description: "Joongwon Chae 关于记忆构成、路由、视觉提示与免训练推理的研究。",
  alternates: {
    canonical: "/zh/",
    languages: { en: "/", "zh-CN": "/zh/", "x-default": "/" },
  },
  openGraph: {
    title: "Joongwon Chae | 研究主页",
    description: "关于记忆构成、路由、视觉提示与免训练推理的研究。",
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
