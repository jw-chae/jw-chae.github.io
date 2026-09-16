import type { Metadata } from "next";
import { ProjectsPage } from "@/components/projects/projects-page";
import "../../anomaly.css";
import "../../projects.css";

export const metadata: Metadata = {
  title: "Projects",
  description: "Ongoing side projects: anomaly detection with a fruit-fly brain, and ResearchOS, a personal research agent built on one's own research trajectory.",
  alternates: { canonical: "/projects/", languages: { en: "/projects/", "zh-CN": "/zh/projects/", "x-default": "/projects/" } },
};

export default function Projects() {
  return <ProjectsPage locale="en" />;
}
