import type { Metadata } from "next";
import { StudyIndex } from "@/components/study/study-index";
import "../../anomaly.css";
import "../../study.css";

export const metadata: Metadata = {
  title: "Study",
  description: "Visual study notes: ResNet-50, convolution, ViT patch tokens, and memory-based anomaly detection, each with interactive figures.",
  alternates: { canonical: "/study/" },
};

export default function StudyPage() {
  return <StudyIndex />;
}
