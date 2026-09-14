import type { Metadata } from "next";
import { AnomalyShowcase } from "@/components/anomaly/showcase";
import "../../anomaly.css";

export const metadata: Metadata = {
  title: "Anomaly Detection, Visually",
  description:
    "An animated walkthrough of training-free, memory-based anomaly detection: patch tokens, coreset memory, soft projection, consensus, map-to-score calibration, routing, and memory composition.",
  alternates: { canonical: "/anomaly/", languages: { en: "/anomaly/", "zh-CN": "/zh/anomaly/", "x-default": "/anomaly/" } },
  openGraph: { title: "Anomaly Detection, Visually | Joongwon Chae", url: "/anomaly/", type: "article" },
};

export default function AnomalyPage() {
  return <AnomalyShowcase locale="en" />;
}
