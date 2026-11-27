import type { Metadata } from "next";
import { PrunePage } from "@/components/study/prune-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "가중치를 0으로: 가지치기, 그리고 증류·양자화와 무엇이 다른가",
  description: "Pruning study notes with interactive figures on a tiny network actually trained on the 256 cells of a Siamese cat head drawing: magnitude pruning and its effect on one eye cell, Optimal Brain Damage saliency, prune and retrain (Han et al.), the lottery ticket hypothesis, why unstructured zeros do not speed up a GPU and 2:4 sparsity on NVIDIA Ampere, filter pruning by L1 norm, Centripetal SGD and ResRep, SparseGPT and Wanda for LLMs without retraining, and pruning, quantization and distillation side by side.",
  alternates: { canonical: "/study/pruning/" },
};

export default function PruningStudyPage() {
  return <PrunePage />;
}
