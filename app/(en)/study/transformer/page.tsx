import type { Metadata } from "next";
import { TransformerPage } from "@/components/study/transformer-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "Transformer는 어떻게 작동하는가",
  description: "Transformer and ViT study notes with interactive figures: patch tokens, one attention step, multiple heads, positional information, one block, and how it differs from a CNN.",
  alternates: { canonical: "/study/transformer/" },
};

export default function TransformerStudyPage() {
  return <TransformerPage />;
}
