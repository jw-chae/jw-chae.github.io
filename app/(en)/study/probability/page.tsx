import type { Metadata } from "next";
import { ProbPage } from "@/components/study/prob-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "모델은 왜 확률을 내놓나: 분포, 베이즈, 최대우도",
  description: "Probability study notes with interactive figures on one picture of a Siamese cat cut into 256 cells: a distribution as shares of cells, softmax from scores to shares, joint and conditional probability on the same counts, Bayes' rule and base rates from the eye to rare factory defects, expectation, variance and the spread of a sample mean, the Gaussian and z-scores, likelihood and maximum likelihood, and entropy, cross-entropy and KL divergence.",
  alternates: { canonical: "/study/probability/" },
};

export default function ProbabilityStudyPage() {
  return <ProbPage />;
}
