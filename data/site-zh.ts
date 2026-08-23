import { profile, publications, type Publication, type ResearchItem } from "@/data/site";

export const profileZh = {
  ...profile,
  role: "硕士研究生",
  affiliation: "清华大学深圳国际研究生院",
  identity: "计算机视觉 / 异常检测 / 多模态学习",
  thesis: "我致力于构建免训练视觉系统，使模型在不更新参数的情况下判断并利用最有价值的参考信息。",
  statement: "我的研究聚焦于冻结视觉模型如何通过记忆、检索、提示、路由与校准机制选择并使用参考证据。",
  location: "中国深圳",
};

export const selectedResearchZh: ResearchItem[] = [
  {
    slug: "boundarysupport",
    title: "BoundarySupport",
    finding: "更干净的记忆库并不一定带来更好的异常检测效果。",
    detail: "在记忆库大小固定的条件下，从缺陷图像中补充有用的正常支持，使 MVTec AD 的像素级 AP 提升了 3.616 个百分点。",
    status: "在研项目",
    visual: "boundary",
  },
  {
    slug: "procon",
    title: "ProCon",
    finding: "投影一致性可以在免训练条件下筛选有效的异常检测参考。",
    detail: "公开预印本报告：在冻结骨干网络条件下，MVTec AD、VisA 和 Real-IAD 的图像级 AUROC 分别为 99.8%、99.2% 和 93.2%。",
    status: "arXiv 预印本",
    arxiv: "2607.04894",
    code: "https://github.com/jw-chae/Procon",
    visual: "procon",
  },
  {
    slug: "gcr",
    title: "GCR",
    finding: "几何一致路由支持任务无关的持续异常检测。",
    detail: "在 MVTec AD 与 VisA 上的实验表明，该方法无需端到端表征学习即可显著提升路由稳定性，并实现接近零遗忘。",
    status: "arXiv 预印本",
    arxiv: "2601.01856",
    code: "https://github.com/jw-chae/GCR",
    visual: "gcr",
  },
  {
    slug: "memory-sam",
    title: "Memory-SAM",
    finding: "检索机制可将冻结的视觉对应关系转化为自动 SAM2 提示。",
    detail: "公开 v3 预印本在 600 张专家标注图像的混合测试集上报告 0.9863 mIoU，全程无需人工点击或模型微调。",
    status: "arXiv 预印本",
    arxiv: "2510.15849",
    code: "https://github.com/jw-chae/memory-sam",
    visual: "memory-sam",
  },
];

const publicationTranslations: Array<Pick<Publication, "venue" | "contribution"> & { authorNote?: string }> = [
  {
    venue: "arXiv:2607.04894 [cs.CV]",
    contribution: "面向冻结异常检测器的投影一致性记忆筛选。",
  },
  {
    venue: "arXiv:2601.01856 [cs.CV]",
    contribution: "无需重训练的持续异常检测跨头路由。",
  },
  {
    venue: "arXiv:2602.17048 [cs.CV]",
    contribution: "从异常图到图像级分数的结构感知校准。",
  },
  {
    venue: "arXiv:2607.01814 [cs.AI]",
    contribution: "用于多模态临床决策支持的记忆增强检索。",
  },
  {
    venue: "未公开稿件",
    contribution: "利用 GRPO 进行动态图像编辑的视频生成方法。",
    authorNote: "仅列出两位共同第一作者；完整作者名单尚未公开。",
  },
  {
    venue: "arXiv:2510.15849 [cs.CV]",
    contribution: "用于自动 SAM2 分割的检索到提示推理。",
  },
  {
    venue: "arXiv:2511.23276 [cs.LG, cs.MA]",
    contribution: "面向可审计、情境感知 HFMD 预测的结构化大语言模型智能体。",
  },
  {
    venue: "2025 IEEE 生物信息学与生物医学国际会议（BIBM），第 3894-3899 页",
    contribution: "面向中医临床决策支持的多模态 RAG 与评估框架。",
    authorNote: "* 共同第一作者。",
  },
  {
    venue: "Frontiers in Oncology，第 15 卷，文章 1613462",
    contribution: "基于 232 名患者数据及 bootstrap 置信区间的临床评估。",
  },
  {
    venue: "arXiv:2411.18270 [cs.CV]",
    contribution: "通过网格增强提升多模态智能体的空间理解能力。",
  },
];

export const publicationsZh: Publication[] = publications.map((publication, index) => ({
  ...publication,
  ...publicationTranslations[index],
}));

export const educationZh = [
  {
    institution: "清华大学深圳国际研究生院",
    period: "2024-2027（预计）",
    detail: "电子信息硕士（生物医学工程方向），生物医药与健康工程研究院。导师：秦培武教授。",
  },
  {
    institution: "上海交通大学自动化系",
    period: "2018-2024",
    detail: "自动化专业学士。",
  },
];

export const experienceZh = [
  {
    role: "硕士研究生",
    place: "清华大学深圳国际研究生院",
    period: "2024年至今",
  },
  {
    role: "研究实习生",
    place: "Ratel Soft",
    period: "2025年7月至今",
  },
];

export const honorsZh = [
  "清华大学国际学生优秀学生奖学金一等奖，2024",
  "清华大学生物医药与健康工程研究院英才一等奖学金，2025",
  "清华大学国际研究生学费奖学金，2025-2026",
  "深圳大运留学基金会奖学金，2026",
];
