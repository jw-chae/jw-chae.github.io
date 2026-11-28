import type { Metadata } from "next";
import { VlaPage } from "@/components/study/vla-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "VLA는 어떻게 말을 로봇의 움직임으로 바꾸나",
  description: "Vision-language-action study notes with interactive figures on one tabletop seen from above: a policy that maps a camera picture and an instruction to the next small move, why behavior cloning with squared error averages two demonstrations into the vase, RT-2 and OpenVLA action tokens with 256 bins, ACT action chunking and its reaction delay, pi0 flow matching that turns noise into one whole chunk, FAST DCT-compressed action tokens, and a side-by-side comparison with two-speed systems.",
  alternates: { canonical: "/study/vla/" },
};

export default function VlaStudyPage() {
  return <VlaPage />;
}
