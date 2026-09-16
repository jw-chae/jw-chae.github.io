import type { Metadata } from "next";
import { ProjectsPage } from "@/components/projects/projects-page";
import "../../../anomaly.css";
import "../../../study.css";
import "../../../projects.css";

export const metadata: Metadata = {
  title: "进行中的项目",
  description: "进行中的业余项目：基于果蝇大脑的异常检测，以及以个人研究轨迹为基础的研究智能体 ResearchOS。",
  alternates: { canonical: "/zh/projects/", languages: { en: "/projects/", "zh-CN": "/zh/projects/", "x-default": "/projects/" } },
};

export default function ProjectsZh() {
  return <ProjectsPage locale="zh" />;
}
