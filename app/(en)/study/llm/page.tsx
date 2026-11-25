import type { Metadata } from "next";
import { LlmPage } from "@/components/study/llm-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "LLM은 어떻게 글을 쓰나",
  description: "Large language model study notes with interactive figures: one blank followed from input to probabilities, next-token prediction, byte-pair encoding, shifted-target training, how the scores are learned, temperature and top-k sampling, the generation loop, and scale.",
  alternates: { canonical: "/study/llm/" },
};

export default function LlmStudyPage() {
  return <LlmPage />;
}
