import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jw-chae.github.io"),
  title: { default: "Joongwon Chae | Research", template: "%s | Joongwon Chae" },
  description: "Joongwon Chae's five signature systems for memory, routing, prompting, and training-free visual inference.",
  alternates: {
    canonical: "/",
    languages: { en: "/", "zh-CN": "/zh/", "x-default": "/" },
  },
  openGraph: {
    title: "Joongwon Chae | Research",
    description: "Five first-author systems for memory, routing, prompting, and training-free visual inference.",
    url: "/",
    locale: "en_US",
    type: "website",
  },
};

export default function EnglishLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <Header locale="en" />
        {children}
        <Footer locale="en" />
      </body>
    </html>
  );
}
