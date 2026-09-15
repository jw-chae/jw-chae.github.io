import type { Metadata } from "next";
import { ResNet50Page } from "@/components/study/resnet50-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "ResNet-50, 세 가지 규칙의 반복",
  description: "ResNet-50 study notes with interactive figures: tensor shape flow, bottleneck parameter count, 1x1 channel mixing, identity vs projection shortcuts, and BatchNorm.",
  alternates: { canonical: "/study/resnet50/" },
};

export default function ResNetStudyPage() {
  return <ResNet50Page />;
}
