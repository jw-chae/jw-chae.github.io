export const profile = {
  name: "Joongwon Chae",
  affiliation: "Tsinghua University, Shenzhen International Graduate School",
  identity: "Training-Free Anomaly Detection / Memory-Augmented Inference / Medical AI",
  thesis:
    "I build training-free visual systems that decide which references matter, then use them without updating the model.",
  statement:
    "I study how frozen visual models choose and use reference evidence through memory, retrieval, prompting, routing, and calibration.",
  email: "joongwon00@gmail.com",
  github: "https://github.com/jw-chae",
  scholar: "https://scholar.google.com/citations?user=W7OpEP0AAAAJ&hl=en",
};

export type ResearchItem = {
  slug: string;
  title: string;
  finding: string;
  detail: string;
  status: string;
  verification?: string;
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
    verification: "Public title and status require confirmation before deployment.",
    visual: "boundary",
  },
  {
    slug: "procon",
    title: "ProCon",
    finding: "Projection consistency selects useful anomaly references without training.",
    detail:
      "A frozen backbone reached 99.8%, 99.2%, and 93.2% image AUROC on MVTec AD, VisA, and Real-IAD.",
    status: "Preprint, under review",
    arxiv: "2607.04894",
    code: "https://github.com/jw-chae/Procon",
    visual: "procon",
  },
  {
    slug: "gcr",
    title: "GCR",
    finding: "Geometry-consistent routing supports task-agnostic continual anomaly detection.",
    detail:
      "The recorded setup used 196 prototypes and reached complete routing at M=32, with 0.978 macro image AUROC.",
    status: "Preprint, under review",
    arxiv: "2601.01856",
    code: "https://github.com/jw-chae/GCR",
    visual: "gcr",
  },
  {
    slug: "memory-sam",
    title: "Memory-SAM",
    finding: "Retrieval turns frozen correspondence into automatic SAM2 prompts.",
    detail:
      "Human-prompt-free segmentation reached 0.984 mIoU on HIT-Tongue and 0.973 mIoU on a 2,155-image smartphone benchmark.",
    status: "Preprint, under review",
    arxiv: "2510.15849",
    code: "https://github.com/jw-chae/memory-sam",
    visual: "memory-sam",
  },
];

export type Publication = {
  title: string;
  year: number;
  authors: string;
  venue: string;
  area: "Anomaly Detection" | "Medical AI" | "Multimodal Learning" | "Generative AI";
  contribution: string;
  verification?: string;
  arxiv?: string;
  doi?: string;
  code?: string;
};

export const publications: Publication[] = [
  {
    title: "ProCon: Projection-Consistency Memory for Training-Free Anomaly Detection",
    year: 2026,
    authors: "Joongwon Chae et al.",
    venue: "Preprint, under review",
    area: "Anomaly Detection",
    contribution: "Projection-consistency memory selection for frozen anomaly detectors.",
    arxiv: "2607.04894",
    code: "https://github.com/jw-chae/Procon",
  },
  {
    title: "GCR: Geometry-Consistent Routing for Task-Agnostic Continual Anomaly Detection",
    year: 2026,
    authors: "Joongwon Chae, Le Luo, Yuxin Liu, et al.",
    venue: "Preprint, under review",
    area: "Anomaly Detection",
    contribution: "Cross-head routing for continual anomaly detection without retraining.",
    arxiv: "2601.01856",
    code: "https://github.com/jw-chae/GCR",
  },
  {
    title: "StructCore: Structure-Aware Image-Level Scoring for Training-Free Unsupervised Anomaly Detection",
    year: 2026,
    authors: "Joongwon Chae et al.",
    venue: "Preprint, under review",
    area: "Anomaly Detection",
    contribution: "Structure-aware calibration from anomaly maps to image scores.",
    arxiv: "2602.17048",
  },
  {
    title: "MMIR-TCM: Memory-Integrated Multimodal Inference and Retrieval for TCM Clinical Decision Support",
    year: 2026,
    authors: "Le Luo, Joongwon Chae, et al.",
    venue: "Preprint, under review",
    area: "Medical AI",
    contribution: "Memory-integrated retrieval for multimodal clinical decision support.",
    arxiv: "2607.01814",
  },
  {
    title: "ViGen: Video-based Generation with GRPO for Dynamic Image Editing",
    year: 2026,
    authors: "Le Luo, Joongwon Chae, et al.",
    venue: "Manuscript under review",
    area: "Generative AI",
    contribution: "Video-based generation with GRPO for dynamic image editing.",
  },
  {
    title: "Memory-SAM: Human-Prompt-Free Tongue Segmentation via Retrieval-to-Prompt",
    year: 2025,
    authors: "Joongwon Chae, Le Luo, X. Yuan, et al.",
    venue: "Preprint, under review",
    area: "Medical AI",
    contribution: "Retrieval-to-prompt inference for automatic SAM2 segmentation.",
    arxiv: "2510.15849",
    code: "https://github.com/jw-chae/memory-sam",
  },
  {
    title: "Auditable Context-Aware HFMD Forecasting with Structured LLM Agents",
    year: 2025,
    authors: "Joongwon Chae, R. Wang, et al.",
    venue: "arXiv preprint",
    area: "Medical AI",
    contribution: "Structured LLM agents for auditable, context-aware HFMD forecasting.",
    verification: "The public arXiv title differs from the supplied CV and requires review.",
    arxiv: "2511.23276",
  },
  {
    title: "ViTCM-LLM: A Multimodal RAG Framework for Advanced TCM Clinical Decision Support",
    year: 2025,
    authors: "Le Luo, Joongwon Chae, Y. Liu, et al.",
    venue: "IEEE BIBM 2025",
    area: "Medical AI",
    contribution: "Multimodal RAG and evaluation for TCM clinical decision support.",
    code: "https://github.com/jw-chae/ViTCM_LLM",
  },
  {
    title: "Pre-operative T-stage discrimination in gallbladder cancer using machine learning and DeepSeek-R1",
    year: 2025,
    authors: "Joongwon Chae, Z. Wang, D. Wu, et al.",
    venue: "Frontiers in Oncology 15, 1613462",
    area: "Medical AI",
    contribution: "Clinical evaluation across 232 patients with bootstrap confidence intervals.",
    doi: "10.3389/fonc.2025.1613462",
  },
  {
    title: "Grid-augmented vision: A simple yet effective approach for enhanced spatial understanding in multi-modal agents",
    year: 2024,
    authors: "Joongwon Chae et al.",
    venue: "arXiv preprint",
    area: "Multimodal Learning",
    contribution: "Grid augmentation for spatial understanding in multimodal agents.",
    arxiv: "2411.18270",
  },
];

export const education = [
  {
    institution: "Tsinghua University, Shenzhen International Graduate School",
    period: "2024-2027 expected",
    detail: "M.S., Institute of Biopharmaceutical & Health Engineering. Advisor: Prof. Peiwu Qin.",
  },
  {
    institution: "Shanghai Jiao Tong University, School of Automation",
    period: "2018-2024",
    detail: "B.S. in Automation.",
  },
];

export const experience = [
  {
    role: "Graduate Researcher",
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
