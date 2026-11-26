import type { Metadata } from "next";
import { OpenVocabPage } from "@/components/study/ov-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "이름을 미리 정하지 않고 찾기: 열린 어휘 검출",
  description: "Open-vocabulary detection study notes with interactive figures on one picture of a Siamese cat and a cup: why a closed class head cannot name what it was not trained on, CLIP's contrastive loss computed on a batch of three pairs, zero-shot classification with name vectors, per-cell object embeddings compared with text, the text-image fusion of YOLO-World and Grounding DINO, and YOLOE's RepRTA fold, visual prompts and prompt-free retrieval.",
  alternates: { canonical: "/study/openvocab/" },
};

export default function OpenVocabStudyPage() {
  return <OpenVocabPage />;
}
