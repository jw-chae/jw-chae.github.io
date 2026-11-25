import type { Metadata } from "next";
import { TokensPage } from "@/components/study/tok-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "토큰을 덜 쓰면 얼마나 빨라지나: 가지치기와 합치기",
  description: "Token reduction study notes with interactive figures: the cost of a layer as tokens are removed, pruning by [CLS] attention, merging similar tokens with ToMe, VTC-CLS for MLLMs, FastVID and TempMe for video, the KV cache, and PrefixKV's per-layer cache budget.",
  alternates: { canonical: "/study/tokens/" },
};

export default function TokensStudyPage() {
  return <TokensPage />;
}
