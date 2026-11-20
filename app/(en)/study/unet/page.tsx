import type { Metadata } from "next";
import { UnetPage } from "@/components/study/unet-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "U-Net은 왜 U자 모양인가",
  description: "U-Net study notes with interactive figures: the context versus precision dilemma of per-pixel patches, what downsampling loses, learnable upsampling, skip connections, the full U, and elastic deformation.",
  alternates: { canonical: "/study/unet/" },
};

export default function UnetStudyPage() {
  return <UnetPage />;
}
