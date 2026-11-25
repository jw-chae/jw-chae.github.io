import type { Metadata } from "next";
import { CmpPage } from "@/components/study/cmp-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "큰 모델을 작게: 증류와 양자화",
  description: "Distillation and quantization study notes with interactive figures: hard labels versus a teacher's soft probabilities, temperature, what the student's loss pushes, matching middle vectors, DINO-PCB, CAIT channel pruning with hard distillation, int8 and 4-bit weights with scale and zero-point, per-tensor versus per-channel scales, PTQ versus QAT, and Quantized Prompt.",
  alternates: { canonical: "/study/compress/" },
};

export default function CompressStudyPage() {
  return <CmpPage />;
}
