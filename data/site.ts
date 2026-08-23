export const profile = {
  name: "Joongwon Chae",
  role: "Master's Student Researcher",
  affiliation: "Tsinghua University, Shenzhen International Graduate School",
  identity: "Computer Vision / Anomaly Detection / Multimodal Learning",
  thesis:
    "I build training-free visual systems that decide which references matter, then use them without updating the model.",
  statement:
    "I study how frozen visual models choose and use reference evidence through memory, retrieval, prompting, routing, and calibration.",
  email: "cai-zy24@mails.tsinghua.edu.cn",
  github: "https://github.com/jw-chae",
  scholar: "https://scholar.google.com/citations?user=W7OpEP0AAAAJ&hl=en",
  location: "Shenzhen, China",
  photo: "/profile/joongwon-chae.jpg",
};

export type ResearchItem = {
  slug: string;
  title: string;
  finding: string;
  detail: string;
  status: string;
  arxiv?: string;
  code?: string;
  visual: "boundary" | "procon" | "gcr" | "memory-sam";
};

export const selectedResearch: ResearchItem[] = [
  {
    slug: "boundarysupport",
    title: "BoundarySupport",
    finding: "Cleaner memory is not always a better anomaly detector.",
    detail:
      "Adding useful normal support from defect images improved MVTec AD patch average precision by 3.616 points at a fixed memory size.",
    status: "Ongoing research",
    visual: "boundary",
  },
  {
    slug: "procon",
    title: "ProCon",
    finding: "Projection consistency selects useful anomaly references without training.",
    detail:
      "The public preprint reports image AUROC of 99.8%, 99.2%, and 93.2% on MVTec AD, VisA, and Real-IAD with a frozen backbone.",
    status: "arXiv preprint",
    arxiv: "2607.04894",
    code: "https://github.com/jw-chae/Procon",
    visual: "procon",
  },
  {
    slug: "gcr",
    title: "GCR",
    finding: "Geometry-consistent routing supports task-agnostic continual anomaly detection.",
    detail:
      "Experiments on MVTec AD and VisA report substantially improved routing stability and near-zero forgetting without end-to-end representation learning.",
    status: "arXiv preprint",
    arxiv: "2601.01856",
    code: "https://github.com/jw-chae/GCR",
    visual: "gcr",
  },
  {
    slug: "memory-sam",
    title: "Memory-SAM",
    finding: "Retrieval turns frozen correspondence into automatic SAM2 prompts.",
    detail:
      "The public v3 preprint reports 0.9863 mIoU on the mixed test split of a 600-image expert-annotated benchmark, without human clicks or fine-tuning.",
    status: "arXiv preprint",
    arxiv: "2510.15849",
    code: "https://github.com/jw-chae/memory-sam",
    visual: "memory-sam",
  },
];

export type Publication = {
  title: string;
  year: number;
  authors: string;
  authorNote?: string;
  venue: string;
  area: "Anomaly Detection" | "Medical AI" | "Multimodal Learning" | "Generative AI";
  contribution: string;
  arxiv?: string;
  doi?: string;
  code?: string;
};

export const publications: Publication[] = [
  {
    title: "ProCon: Projection-Consistency Memory for Training-Free Anomaly Detection",
    year: 2026,
    authors: "Joongwon Chae; Lihui Luo; Yang Liu; Dongmei Yu; Peiwu Qin; Runming Wang; Ilmoon Chae",
    venue: "arXiv:2607.04894 [cs.CV]",
    area: "Anomaly Detection",
    contribution: "Projection-consistency memory selection for frozen anomaly detectors.",
    arxiv: "2607.04894",
    code: "https://github.com/jw-chae/Procon",
  },
  {
    title: "GCR: Geometry-Consistent Routing for Task-Agnostic Continual Anomaly Detection",
    year: 2026,
    authors:
      "Joongwon Chae; Lihui Luo; Yang Liu; Runming Wang; Dongmei Yu; Zeming Liang; Xi Yuan; Dayan Zhang; Zhenglin Chen; Peiwu Qin; Ilmoon Chae",
    venue: "arXiv:2601.01856 [cs.CV]",
    area: "Anomaly Detection",
    contribution: "Cross-head routing for continual anomaly detection without retraining.",
    arxiv: "2601.01856",
    code: "https://github.com/jw-chae/GCR",
  },
  {
    title: "StructCore: Structure-Aware Image-Level Scoring for Training-Free Unsupervised Anomaly Detection",
    year: 2026,
    authors:
      "Joongwon Chae; Lihui Luo; Yang Liu; Runming Wang; Dongmei Yu; Zeming Liang; Xi Yuan; Dayan Zhang; Zhenglin Chen; Peiwu Qin; Ilmoon Chae",
    venue: "arXiv:2602.17048 [cs.CV]",
    area: "Anomaly Detection",
    contribution: "Structure-aware calibration from anomaly maps to image scores.",
    arxiv: "2602.17048",
    code: "https://github.com/jw-chae/structcore",
  },
  {
    title: "MMIR-TCM: Memory-Integrated Multimodal Inference and Retrieval for TCM Clinical Decision Support",
    year: 2026,
    authors:
      "Lihui Luo; Joongwon Chae; Ziyan Chen; Yang Liu; Siyi Cheng; Weihan Gao; Zelin Zeng; Xiaoming Yin; Samaneh Beheshti Kashi; Dongmei Yu; Lian Zhang; Jing Sui; Zeming Liang; Jiansong Ji; Peter E. Lobie; Peiwu Qin",
    venue: "arXiv:2607.01814 [cs.AI]",
    area: "Medical AI",
    contribution: "Memory-integrated retrieval for multimodal clinical decision support.",
    arxiv: "2607.01814",
  },
  {
    title: "ViGen: Video-based Generation with GRPO for Dynamic Image Editing",
    year: 2026,
    authors: "Lihui Luo*; Joongwon Chae*",
    authorNote: "Co-first authors shown; the full author list is not yet public.",
    venue: "Manuscript",
    area: "Generative AI",
    contribution: "Video-based generation with GRPO for dynamic image editing.",
  },
  {
    title: "Memory-SAM: Human-Prompt-Free Tongue Segmentation via Retrieval-to-Prompt",
    year: 2025,
    authors: "Joongwon Chae; Lihui Luo; Xi Yuan; Dongmei Yu; Zhenglin Chen; Lian Zhang; Peiwu Qin",
    venue: "arXiv:2510.15849 [cs.CV]",
    area: "Medical AI",
    contribution: "Retrieval-to-prompt inference for automatic SAM2 segmentation.",
    arxiv: "2510.15849",
    code: "https://github.com/jw-chae/memory-sam",
  },
  {
    title: "Auditable Context-Aware HFMD Forecasting with Structured LLM Agents",
    year: 2025,
    authors: "Joongwon Chae; Runming Wang; Chen Xiong; Gong Yunhan; Lian Zhang; Ji Jiansong; Dongmei Yu; Peiwu Qin",
    venue: "arXiv:2511.23276 [cs.LG, cs.MA]",
    area: "Medical AI",
    contribution: "Structured LLM agents for auditable, context-aware HFMD forecasting.",
    arxiv: "2511.23276",
  },
  {
    title: "ViTCM-LLM: A Multimodal RAG Framework for Advanced TCM Clinical Decision Support",
    year: 2025,
    authors:
      "Lihui Luo*; Joongwon Chae*; Yang Liu; Igor Pantic; Vladan Devedzic; Zhumei Sun; Zelin Zeng; Sanatbek Matlatipov; Xiaoming Yin; Peiwu Qin",
    authorNote: "* Equal contribution.",
    venue: "2025 IEEE International Conference on Bioinformatics and Biomedicine (BIBM), pp. 3894-3899",
    area: "Medical AI",
    contribution: "Multimodal RAG and evaluation for TCM clinical decision support.",
    doi: "10.1109/BIBM66473.2025.11357113",
    code: "https://github.com/jw-chae/ViTCM_LLM",
  },
  {
    title: "Pre-operative T-stage discrimination in gallbladder cancer using machine learning and DeepSeek-R1",
    year: 2025,
    authors:
      "Joongwon Chae; Zhenyu Wang; Duanpo Wu; Lian Zhang; Alexander Tuzikov; Magrupov Talat Madiyevich; Min Xu; Dongmei Yu; Peiwu Qin",
    venue: "Frontiers in Oncology, 15, Article 1613462",
    area: "Medical AI",
    contribution: "Clinical evaluation across 232 patients with bootstrap confidence intervals.",
    doi: "10.3389/fonc.2025.1613462",
  },
  {
    title: "Grid-augmented vision: A simple yet effective approach for enhanced spatial understanding in multi-modal agents",
    year: 2024,
    authors: "Joongwon Chae; Zhenyu Wang; Lian Zhang; Dongmei Yu; Peiwu Qin",
    venue: "arXiv:2411.18270 [cs.CV]",
    area: "Multimodal Learning",
    contribution: "Grid augmentation for spatial understanding in multimodal agents.",
    arxiv: "2411.18270",
  },
];

export const education = [
  {
    institution: "Tsinghua University, Shenzhen International Graduate School",
    period: "2024-2027 expected",
    detail:
      "M.S. in Electronic Information (Biomedical Engineering), Institute of Biopharmaceutical and Health Engineering. Advisor: Prof. Peiwu Qin.",
  },
  {
    institution: "Shanghai Jiao Tong University, Department of Automation",
    period: "2018-2024",
    detail: "B.S. in Automation.",
  },
];

export const experience = [
  {
    role: "Master's Student Researcher",
    place: "Tsinghua University, SIGS",
    period: "2024-present",
  },
  {
    role: "Research Intern",
    place: "Ratel Soft",
    period: "Jul 2025-present",
  },
];

export const honors = [
  "Excellent Student Scholarship, First Class, Tsinghua University, 2024",
  "Yingcai First-Class Scholarship, Tsinghua University, 2025",
  "Tsinghua University International Graduate Tuition Scholarship, 2025-2026",
  "Shenzhen Universiade International Scholarship Foundation Scholarship, 2026",
];
