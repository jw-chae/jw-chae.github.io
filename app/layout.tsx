import type { Metadata } from "next";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://jw-chae.github.io"),
  title: { default: "Joongwon Chae | Research", template: "%s | Joongwon Chae" },
  description: "Research in training-free anomaly detection, memory-augmented inference, and medical AI.",
  openGraph: {
    title: "Joongwon Chae | Research",
    description: "Computer vision, anomaly detection, and multimodal learning.",
    type: "website",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
