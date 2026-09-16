export type Project = {
  id: string;
  title: string;
  question: string;
  image: { src: string; alt: string; width: number; height: number };
};

export type ProjectsCopy = {
  kicker: string;
  title: string;
  projects: Project[];
};

export const projectsEn: ProjectsCopy = {
  kicker: "Projects",
  title: "Ongoing side projects",
  projects: [
    {
      id: "flymem",
      title: "Anomaly detection with a fruit-fly brain",
      question: "Could a fruit fly's brain do anomaly detection?",
      image: { src: "/projects/flymem-mascot.webp", alt: "A fruit fly wearing DINO goggles", width: 640, height: 640 },
    },
    {
      id: "researchos",
      title: "ResearchOS",
      question: "We forget what we study, and research inspiration often comes from another field. Could I build a research agent of my own on top of my own research trajectory?",
      image: { src: "/projects/researchos-art.webp", alt: "A small AI agent exploring a universe of graphs", width: 1200, height: 900 },
    },
  ],
};

export const projectsZh: ProjectsCopy = {
  kicker: "Projects",
  title: "进行中的项目",
  projects: [
    {
      id: "flymem",
      title: "基于果蝇大脑的异常检测",
      question: "能不能用果蝇的大脑来做异常检测？",
      image: { src: "/projects/flymem-mascot.webp", alt: "戴着 DINO 护目镜的果蝇", width: 640, height: 640 },
    },
    {
      id: "researchos",
      title: "ResearchOS",
      question: "学过的东西会忘，而研究的灵感往往来自别的领域。能不能以我自己的研究轨迹为基础，做一个属于我的研究智能体？",
      image: { src: "/projects/researchos-art.webp", alt: "在图的宇宙中探索的小型 AI 智能体", width: 1200, height: 900 },
    },
  ],
};
