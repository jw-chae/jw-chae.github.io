import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jw-chae.github.io"),
  title: { default: "Joongwon Chae | Research", template: "%s | Joongwon Chae" },
  description: "Research in training-free anomaly detection, memory-augmented inference, and medical AI.",
  alternates: {
    canonical: "/",
    languages: { en: "/", "zh-CN": "/zh/", "x-default": "/" },
  },
  openGraph: {
    title: "Joongwon Chae | Research",
    description: "Computer vision, anomaly detection, and multimodal learning.",
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
