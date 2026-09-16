export type Project = {
  id: string;
  title: string;
  question: string;
  blurb?: string;
  image: { src: string; alt: string; width: number; height: number };
};

export type ProjectsCopy = {
  kicker: string;
  title: string;
  sub: string;
  projects: Project[];
};

export const projectsEn: ProjectsCopy = {
  kicker: "Projects",
  title: "Ongoing side projects",
  sub: "Things I tinker with for fun, outside the papers.",
  projects: [
    {
      id: "flymem",
      title: "Anomaly detection with a fruit-fly brain",
      question: "Could a fruit fly's brain do anomaly detection?",
      blurb: "A fruit fly has a tiny brain, yet it notices when a smell is new. It does not store every smell separately; each familiar smell just presses down a few synapses a little more. Industrial defect inspection does the opposite: it stores whole patches of normal images and compares against them. If we switched to the fly's way, memory would shrink by hundreds of times. Would defects still be found?",
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
  sub: "论文之外，纯粹因为有趣而在折腾的东西。",
  projects: [
    {
      id: "flymem",
      title: "基于果蝇大脑的异常检测",
      question: "能不能用果蝇的大脑来做异常检测？",
      blurb: "果蝇的大脑非常小，却能察觉一种气味是否陌生。它并不把每种气味分别存起来，而是每当熟悉的气味经过，就把几个突触再压低一点。工业缺陷检测恰恰相反：把正常图像的碎片整块存下来再逐一比对。如果改用果蝇的方式，记忆会缩小几百倍。那么缺陷还找得到吗？",
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
