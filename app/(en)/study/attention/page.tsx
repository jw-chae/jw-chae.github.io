import type { Metadata } from "next";
import { AttentionPage } from "@/components/study/attn-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "Attention은 왜 N²이고, 어떻게 줄이나",
  description: "Study notes on the time and memory cost of attention, with interactive figures on one Siamese cat drawing at growing resolution: the N × N score table and what training keeps, softmax computed block by block, FlashAttention's bytes moved and recomputation, Swin and Longformer windows, Sparse Transformer and BigBird patterns, Linformer's low rank, linear attention and the order of multiplication, and the KV cache with MQA, GQA and Mistral's sliding window.",
  alternates: { canonical: "/study/attention/" },
};

export default function AttentionStudyPage() {
  return <AttentionPage />;
}
