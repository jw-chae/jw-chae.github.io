import type { Metadata } from "next";
import { EfficiencyPage } from "@/components/study/eff-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "빠른 모델은 무엇으로 재나",
  description: "Efficiency study notes with interactive figures: one ResNet-50 3×3 conv counted as parameters, multiply-adds, bytes moved and time on a hand-set device; depthwise separable convolution and the roofline; equal FLOPs with different speed; batch size, latency and throughput; and how RepViT and YOLOv10 measure speed.",
  alternates: { canonical: "/study/efficiency/" },
};

export default function EfficiencyStudyPage() {
  return <EfficiencyPage />;
}
