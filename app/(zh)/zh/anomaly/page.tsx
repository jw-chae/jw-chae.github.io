import type { Metadata } from "next";
import { AnomalyShowcase } from "@/components/anomaly/showcase";
import "../../../anomaly.css";

export const metadata: Metadata = {
  title: "可视化的异常检测",
  description: "免训练记忆式异常检测的动画讲解：补丁 token、核心集记忆、软投影、共识、图到分数校准、路由与记忆构成。",
  alternates: { canonical: "/zh/anomaly/", languages: { en: "/anomaly/", "zh-CN": "/zh/anomaly/", "x-default": "/anomaly/" } },
  openGraph: { title: "可视化的异常检测 | Joongwon Chae", url: "/zh/anomaly/", type: "article" },
};

export default function AnomalyPageZh() {
  return <AnomalyShowcase locale="zh" />;
}
