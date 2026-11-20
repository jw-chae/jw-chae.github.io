import type { Metadata } from "next";
import { CnnPage } from "@/components/study/cnn-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "CNN은 어떻게 이미지를 보는가",
  description: "CNN study notes with interactive figures: weight sharing, what a kernel computes, stride and padding, receptive field, pooling, feature hierarchy, and the path from feature maps to a class.",
  alternates: { canonical: "/study/cnn/" },
};

export default function CnnStudyPage() {
  return <CnnPage />;
}
