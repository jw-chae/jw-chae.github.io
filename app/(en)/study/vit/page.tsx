import type { Metadata } from "next";
import { VitPage } from "@/components/study/vit-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "ViT는 사진을 어떻게 읽나",
  description: "Vision Transformer study notes with interactive figures: patch tokens, the CLS token, position on a plane, CNN versus attention, label-free training with DINO, and finding defects with a memory of normal patches.",
  alternates: { canonical: "/study/vit/" },
};

export default function VitStudyPage() {
  return <VitPage />;
}
