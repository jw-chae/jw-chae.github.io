import type { Metadata } from "next";
import { RepPage } from "@/components/study/rep-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "학습할 때와 쓸 때 모양이 다른 모델: RepVGG에서 LSNet까지",
  description: "Structural re-parameterization study notes with interactive figures: a three-branch block computed by hand on a 5×5 image, merging 3×3, 1×1 and identity into one kernel, folding BatchNorm, RepVGG, why branches change training but not the function, RepViT on mobile, PBConv's off-centre small kernels, and LSNet's input-dependent kernels that cannot be merged.",
  alternates: { canonical: "/study/reparam/" },
};

export default function ReparamStudyPage() {
  return <RepPage />;
}
