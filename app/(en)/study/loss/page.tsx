import type { Metadata } from "next";
import { LossPage } from "@/components/study/loss-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "손실 함수는 왜 그 모양인가: 교차 엔트로피에서 focal loss까지",
  description: "Loss function study notes with interactive figures on one picture of a Siamese cat and a cup: one weight and one gradient step on the cat's box width, cross-entropy as the negative log-likelihood of the cat's name, why squared error on softmax probabilities stalls on confidently wrong answers, squared, absolute and Huber losses against one mistyped label, RetinaNet's anchors with weighted cross-entropy and focal loss, label smoothing and the score gap, triplet and InfoNCE losses, and DETR's class, L1 and GIoU sum.",
  alternates: { canonical: "/study/loss/" },
};

export default function LossStudyPage() {
  return <LossPage />;
}
