import type { Metadata } from "next";
import { StudyIndex } from "@/components/study/study-index";
import "../../anomaly.css";
import "../../study.css";

export const metadata: Metadata = {
  title: "Study",
  description: "Korean visual study notes with interactive figures: CNN, ResNet-50, U-Net, the Transformer, ViT, LLMs, diffusion models, modern image and video generators, LoRA, and efficient models (latency, re-parameterization, real-time detection, token reduction, distillation, quantization, MoE and caching), each told from the problem it solved.",
  alternates: { canonical: "/study/" },
};

export default function StudyPage() {
  return <StudyIndex />;
}
