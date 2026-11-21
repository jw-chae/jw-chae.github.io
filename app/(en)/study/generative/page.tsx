import type { Metadata } from "next";
import { GenPage } from "@/components/study/gen-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "요즘 모델은 어떻게 그런 그림과 영상을 뽑나",
  description: "Study notes on modern image and video generators with interactive figures: latent diffusion, diffusion transformers, flow matching, text understanding, native image generation by language models, space-time tokens, and temporal consistency.",
  alternates: { canonical: "/study/generative/" },
};

export default function GenerativeStudyPage() {
  return <GenPage />;
}
