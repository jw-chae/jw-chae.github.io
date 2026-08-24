import { profile, publications, type Publication, type ResearchItem } from "@/data/site";

export const profileZh = {
  ...profile,
  role: "硕士研究生",
  affiliation: "清华大学深圳国际研究生院",
  identity: "计算机视觉 / 异常检测 / 多模态学习",
  thesis: "我围绕一个核心问题构建免训练视觉系统：冻结模型应保留、路由并信任哪些参考证据？",
  statement: "我的研究涵盖记忆构成、投影一致性筛选、持续学习路由与检索到提示分割。",
  location: "中国深圳",
};

export const selectedResearchZh: ResearchItem[] = [
  {
    slug: "boundarysupport",
    title: "What Remains Normal?",
    subtitle: "BoundarySupport：干净图像遗漏了有用的缺陷邻近正常补丁",
    topic: "我检验仅由无缺陷图像构建的正常证据是否完整，重点关注真实缺陷附近仍保持像素正常但上下文发生变化的区域。",
    method: "我提出 BoundarySupport：通过可控合成缺陷改变周边语境，排除实际发生像素变化的 token，仅将像素保持不变的邻域特征用作固定预算记忆参照或重建目标。",
    result: "固定记忆容量下，缺陷邻近正常补丁将 MVTec P-AP 从 73.34 提升至 76.95。BoundarySupport 随后在全部六种设置中提升 1.76 至 5.01 个百分点。",
    status: "预印本，2026",
    paper: "/papers/what-remains-normal.pdf",
    code: "https://github.com/jw-chae/boundary_support",
    visual: "boundarysupport",
  },
  {
    slug: "cleancon",
    title: "What Memory Composition Does Not Tell Us",
    subtitle: "CLEANCON：记忆纯度与记忆效用并不相同",
    topic: "我研究覆盖驱动的记忆选择如何将稀疏污染直接放大为推理阶段的正常参照，并检验更干净的记忆是否真的更好。",
    method: "我提出 CLEANCON，一种袋外跨图像支持门控方法。它只改变候选图像资格，同时保持编码器、绝对记忆容量、构建器与推理规则不变。",
    result: "全局覆盖将稀疏污染放大了 16.04 至 40.61 倍。CLEANCON 在全部 12 个匹配比较中提升宏平均 P-AP，但最干净的记忆并不是性能最好的记忆。",
    status: "预印本，2026",
    paper: "/papers/what-memory-composition-does-not-tell-us.pdf",
    code: "https://github.com/jw-chae/cleancon",
    visual: "cleancon",
  },
  {
    slug: "procon",
    title: "ProCon",
    subtitle: "面向免训练异常检测的投影一致性记忆",
    topic: "我研究冻结异常检测器如何依据内部一致性而非单纯最近邻覆盖来筛选有用的参考记忆。",
    method: "我提出 ProCon，以软局部投影替代单一硬锚点，并通过投影一致性对候选参照进行排序，全程无需训练骨干网络。",
    result: "公开预印本在冻结骨干网络条件下，于 MVTec AD、VisA 和 Real-IAD 上分别报告 99.8%、99.2% 和 93.2% 的图像级 AUROC。",
    status: "arXiv 预印本，2026",
    paper: "https://arxiv.org/abs/2607.04894",
    code: "https://github.com/jw-chae/Procon",
    visual: "procon",
  },
  {
    slug: "gcr",
    title: "GCR",
    subtitle: "面向任务无关持续异常检测的几何一致路由",
    topic: "我研究在未知任务身份的情况下，任务无关持续检测器如何将每个测试图像路由到正确的冻结检测头。",
    method: "我提出几何一致路由，将跨检测头的原型几何与头内异常评分分离，使新任务能够在不重训练旧检测头的情况下加入。",
    result: "MVTec AD 与 VisA 上的实验表明，该方法无需端到端表征学习即可显著提高路由稳定性，并实现接近零遗忘。",
    status: "arXiv 预印本，2026",
    paper: "https://arxiv.org/abs/2601.01856",
    code: "https://github.com/jw-chae/GCR",
    visual: "gcr",
  },
  {
    slug: "memory-sam",
    title: "Memory-SAM",
    subtitle: "通过检索到提示实现无需人工提示的舌体分割",
    topic: "我研究如何在保留实例特定视觉引导的同时，去除基于 SAM2 的舌体分割所需的人工点击。",
    method: "我提出检索到提示推理：先检索样例，将冻结 DINOv3 的视觉对应关系转化为对比点，再无需微调地交给 SAM2。",
    result: "公开 v3 预印本在由 600 张专家标注图像构成的混合测试划分上报告 0.9863 mIoU，全程无需人工点击或模型微调。",
    status: "arXiv 预印本，2025",
    paper: "https://arxiv.org/abs/2510.15849",
    code: "https://github.com/jw-chae/memory-sam",
    visual: "memory-sam",
  },
];

const publicationTranslations: Array<Pick<Publication, "venue" | "contribution"> & { authorNote?: string }> = [
  {
    venue: "预印本",
    contribution: "BoundarySupport 在固定记忆与重建设置下揭示被遗漏的缺陷邻近正常证据。",
  },
  {
    venue: "预印本",
    contribution: "CLEANCON 通过受控候选图像资格实验区分记忆纯度与记忆效用。",
  },
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
    detail: "电子信息硕士（生物医学工程方向），生物医药与健康工程研究院。导师：Peiwu Qin、Runming Wang。",
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

export const languagesZh = "韩语（母语）；英语（IELTS 6.5）；中文（HSK 6）；日语（JLPT N2）。";
