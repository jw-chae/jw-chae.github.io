import type { Metadata } from "next";
import { StudyIndex } from "@/components/study/study-index";
import "../../anomaly.css";
import "../../study.css";

export const metadata: Metadata = {
  title: "Study",
  description: "Korean visual study notes with interactive figures: how a CNN sees an image, ResNet-50, U-Net, and how a Transformer works, each told from the problem it solved.",
  alternates: { canonical: "/study/" },
};

export default function StudyPage() {
  return <StudyIndex />;
}
