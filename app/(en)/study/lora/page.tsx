import type { Metadata } from "next";
import { LoraPage } from "@/components/study/lora-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "LoRA는 거대 모델을 어떻게 싸게 고쳐 쓰나",
  description: "LoRA study notes with interactive figures: the cost of full fine-tuning, what a weight matrix does, rank and low-rank layers, the frozen path and the trainable side path, rank and alpha, merging adapters, where to attach them, and QLoRA.",
  alternates: { canonical: "/study/lora/" },
};

export default function LoraStudyPage() {
  return <LoraPage />;
}
