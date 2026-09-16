import type { Metadata } from "next";
import { ProjectsPage } from "@/components/projects/projects-page";
import "../../anomaly.css";
import "../../study.css";
import "../../projects.css";

export const metadata: Metadata = {
  title: "진행 중인 프로젝트",
  description: "Ongoing side projects: ResearchOS, a personal research agent built on one's own research trajectory, and fly-brain-inspired anomaly detection (mushroom-body sparse memory and the flyvis optic-lobe circuit).",
  alternates: { canonical: "/projects/" },
};

export default function Projects() {
  return <ProjectsPage />;
}
