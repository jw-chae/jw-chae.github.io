import type { Metadata } from "next";
import { DetrPage } from "@/components/study/detr-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "NMS 없이 물체를 세는 법: DETR",
  description: "DETR study notes with interactive figures on one picture of a Siamese cat and a cup: a fixed set of slots with a no-object class, image tokens with position vectors, one object query reading the tokens, Hungarian matching with the class, L1 and GIoU cost, decoder self-attention against duplicates, slow training and small objects, Deformable DETR, DINO, RT-DETR, and source-free adaptation with FRANCK.",
  alternates: { canonical: "/study/detr/" },
};

export default function DetrStudyPage() {
  return <DetrPage />;
}
