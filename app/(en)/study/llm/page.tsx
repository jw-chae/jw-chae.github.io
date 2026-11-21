import type { Metadata } from "next";
import { LlmPage } from "@/components/study/llm-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "LLM은 어떻게 글을 쓰나",
  description: "Large language model study notes with interactive figures: next-token prediction, byte-pair encoding, decoder-only training, temperature and top-k sampling, autoregressive generation, and scale.",
  alternates: { canonical: "/study/llm/" },
};

export default function LlmStudyPage() {
  return <LlmPage />;
}
