import type { Metadata } from "next";
import { YoloPage } from "@/components/study/yolo-page";
import "../../../anomaly.css";
import "../../../study.css";

export const metadata: Metadata = {
  title: "실시간 검출은 어떻게 빨라졌나: YOLO에서 YOLOv10까지",
  description: "Real-time object detection study notes with interactive figures on one picture of a Siamese cat and a cup: what a grid cell outputs, IoU and NMS by hand, one-to-many versus one-to-one label assignment, YOLOv10's consistent dual assignments that remove NMS, and its efficiency-driven design of the head, downsampling and blocks.",
  alternates: { canonical: "/study/yolo/" },
};

export default function YoloStudyPage() {
  return <YoloPage />;
}
