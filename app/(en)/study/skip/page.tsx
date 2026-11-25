import type { Metadata } from "next";
import { SkipPage } from "@/components/study/skip-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "매번 다 계산하지 않기: MoE와 diffusion 캐싱",
  description: "Study notes with interactive figures on skipping computation: one token through a mixture-of-experts layer, stored versus used parameters, load balancing, MaskMoE, CartesianMoE, DSMoE and Finedeep, then feature reuse across diffusion sampling steps, PoSTCache and RA-CFGCache.",
  alternates: { canonical: "/study/skip/" },
};

export default function SkipStudyPage() {
  return <SkipPage />;
}
