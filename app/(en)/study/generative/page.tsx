import type { Metadata } from "next";
import { GenPage } from "@/components/study/gen-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "Latent diffusion에서 Sora까지: 이미지·영상 생성 모델의 구조",
  description: "Study notes on modern image and video generators with interactive figures: latent diffusion, diffusion transformers, flow matching, text understanding, native image generation by language models, space-time tokens, and temporal consistency.",
  alternates: { canonical: "/study/generative/" },
};

export default function GenerativeStudyPage() {
  return <GenPage />;
}
