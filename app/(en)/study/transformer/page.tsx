import type { Metadata } from "next";
import { TransformerPage } from "@/components/study/transformer-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "Transformer는 어떻게 작동하는가",
  description: "Transformer study notes with interactive figures: why RNNs fell short, embeddings, one attention step, multiple heads, positional encoding, one block, the causal mask, encoder and decoder, and the output layer.",
  alternates: { canonical: "/study/transformer/" },
};

export default function TransformerStudyPage() {
  return <TransformerPage />;
}
