import type { Metadata } from "next";
import { DiffusionPage } from "@/components/study/diff-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "Diffusion 모델은 어떻게 그림을 만드나",
  description: "Diffusion model study notes with interactive figures, starting from probability basics: distributions and samples, the Gaussian, Bayes' rule, the forward process, noise prediction, reverse sampling, and guidance.",
  alternates: { canonical: "/study/diffusion/" },
};

export default function DiffusionStudyPage() {
  return <DiffusionPage />;
}
