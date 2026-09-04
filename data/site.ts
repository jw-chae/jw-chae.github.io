export const profile = {
  name: "Joongwon Chae",
  role: "Master's Student Researcher",
  affiliation: "Tsinghua University, Shenzhen International Graduate School",
  identity: "Computer Vision / Anomaly Detection / Multimodal Learning",
  thesis:
    "I build training-free visual systems around a central question: which reference evidence should a frozen model retain, route, and trust?",
  statement:
    "My work spans memory composition, projection-consistent selection, continual routing, and retrieval-to-prompt segmentation.",
  email: "cai-zy24@mails.tsinghua.edu.cn",
  github: "https://github.com/jw-chae",
  scholar: "https://scholar.google.com/citations?user=W7OpEP0AAAAJ&hl=en",
  location: "Shenzhen, China",
  photo: "/profile/joongwon-chae.jpg",
};

export type ResearchItem = {
  slug: string;
  title: string;
  subtitle: string;
  topic: string;
  method: string;
  algorithm: string;
  result: string;
  status: string;
  paper?: string;
  code?: string;
  dataset?: string;
  visual: "boundarysupport" | "cleancon" | "procon" | "gcr" | "memory-sam";
};

export const selectedResearch: ResearchItem[] = [
  {
    slug: "boundarysupport",
    title: "What Remains Normal?",
    subtitle: "BoundarySupport: Clean Images Miss Useful Near-Defect Normal Patches",
    topic:
      "I test whether clean training images contain all normal evidence needed to localize defects, especially for normal patches beside real defects.",
    method:
      "I introduce BoundarySupport: controlled synthetic context changes expose new features at pixel-preserved neighboring patches, which become fixed-budget memory references or reconstruction targets.",
    algorithm:
      "I exclude every token intersecting the nominal insertion or any detected RGB change, keep the pixel-preserved two-token ring, and use its altered-context features as normal evidence.",
    result:
      "At a fixed memory size, near-defect normal patches raise MVTec P-AP from 73.34 to 76.95, and a two-cell band recovers 94.70% of the gain. Across three paired seeds, BoundarySupport improves P-AP in all six memory and reconstruction settings.",
    status: "Under review at ICLR",
    paper: "https://arxiv.org/abs/2608.23299",
    code: "https://github.com/jw-chae/boundary_support",
    visual: "boundarysupport",
  },
  {
    slug: "cleancon",
    title: "What Memory Composition Does Not Tell Us",
    subtitle: "CLEANCON: Memory Purity and Memory Utility Are Different",
    topic:
      "I examine how coverage-driven memory selection can turn sparse contamination into deployed normal references, and whether a cleaner memory is actually better.",
    method:
      "I introduce CLEANCON, an out-of-bag cross-image support gate that changes candidate eligibility while keeping the encoder, absolute memory budget, builder, and inference rule fixed.",
    algorithm:
      "I score each image by the top 0.5% of patch-wise soft-projection residuals from 20 out-of-bag support banks, take bank medians and a cross-depth mean, and pass the lower-risk half to the unchanged memory builder.",
    result:
      "At a 1% memory budget, Global FF amplifies sparse contamination by 16.04 to 40.61 times. CLEANCON drives final-memory contamination to approximately zero and improves category-macro P-AP in all 12 matched comparisons, while the cleanest memory is not the highest-performing one.",
    status: "Under review at ICLR",
    paper: "https://arxiv.org/abs/2608.23295",
    code: "https://github.com/jw-chae/cleancon",
    visual: "cleancon",
  },
  {
    slug: "procon",
    title: "ProCon",
    subtitle: "Projection-Consistency Memory for Training-Free Anomaly Detection",
    topic:
      "I ask how a frozen anomaly detector can select useful reference memory by internal consistency rather than raw nearest-neighbor coverage.",
    method:
      "I introduce ProCon, a training-free, decoder-free reconstruction framework that replaces hard nearest-neighbor lookup with soft projection onto normal memory.",
    algorithm:
      "I soft-project each test patch onto a local normal neighborhood, take the median residual across seed-perturbed memory banks, and average the residual maps across feature depths.",
    result:
      "With a frozen backbone, we achieve image AUROC of 99.8% on MVTec AD, 99.2% on VisA, and 93.2% on Real-IAD.",
    status: "Under review",
    paper: "https://arxiv.org/abs/2607.04894",
    code: "https://github.com/jw-chae/Procon",
    visual: "procon",
  },
  {
    slug: "gcr",
    title: "GCR",
    subtitle: "Geometry-Consistent Routing for Task-Agnostic Continual Anomaly Detection",
    topic:
      "I study how a task-agnostic continual detector can route each test image to the correct frozen head without being told its task identity.",
    method:
      "I introduce geometry-consistent routing, separating cross-head prototype geometry from within-head anomaly scoring so new tasks can be added without retraining old heads.",
    algorithm:
      "I route each image by the mean nearest-prototype distance over 32 sampled patches in shared frozen space, then compute LogSumExp anomaly energy only within the selected head.",
    result:
      "On MVTec AD and VisA, we show that GCR substantially stabilizes routing and keeps forgetting near zero without end-to-end representation learning.",
    status: "Under review",
    paper: "https://arxiv.org/abs/2601.01856",
    code: "https://github.com/jw-chae/GCR",
    visual: "gcr",
  },
  {
    slug: "memory-sam",
    title: "Memory-SAM",
    subtitle: "Human-Prompt-Free Tongue Segmentation via Retrieval-to-Prompt",
    topic:
      "I study how a small labeled memory can generate reliable SAM2 prompts across controlled and unconstrained tongue images without manual prompting or parameter updates.",
    method:
      "I retrieve candidate exemplars with frozen DINOv3, partition their features with expert masks, and rerank them by foreground-background separability on the query.",
    algorithm:
      "I subtract background from foreground DINOv3 similarity, S(i) = s_fg(i) - s_bg(i), select the top three foreground contrast points, and use them as SAM2 prompts.",
    result:
      "We achieve 0.984 mIoU on HIT-Tongue and 0.973 on the 2,155-image SM-Tongue smartphone benchmark, and release 2,155 de-identified 512 x 512 image-mask pairs. Earlier versions received average reviewer scores of 24/28 at ICASSP 2026 and 4.0/5.0 at MICCAI 2026.",
    status: "Under review at AAAI 2027",
    paper: "https://arxiv.org/abs/2510.15849",
    code: "https://github.com/jw-chae/memory-sam",
    dataset: "https://huggingface.co/datasets/Mark-CHAE/SM-Tongue-Public-Original512",
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
  paper?: string;
  arxiv?: string;
  doi?: string;
  code?: string;
  dataset?: string;
};

export const publications: Publication[] = [
  {
    title: "What Remains Normal? Clean Images Miss Useful Near-Defect Normal Patches for Anomaly Detection",
    year: 2026,
    authors: "Joongwon Chae; Runming Wang; Peiwu Qin",
    venue: "Under review at ICLR",
    area: "Anomaly Detection",
    contribution:
      "BoundarySupport exposes missing near-defect normal evidence under fixed memory and reconstruction settings.",
    arxiv: "2608.23299",
    code: "https://github.com/jw-chae/boundary_support",
  },
  {
    title: "What Memory Composition Does Not Tell Us About Anomaly Detection",
    year: 2026,
    authors: "Joongwon Chae; Runming Wang; Peiwu Qin",
    venue: "Under review at ICLR",
    area: "Anomaly Detection",
    contribution:
      "CLEANCON separates memory purity from memory utility through controlled candidate-image eligibility.",
    arxiv: "2608.23295",
    code: "https://github.com/jw-chae/cleancon",
  },
  {
    title: "ProCon: Projection-Consistency Memory for Training-Free Anomaly Detection",
    year: 2026,
    authors: "Joongwon Chae; Lihui Luo; Yang Liu; Dongmei Yu; Peiwu Qin; Runming Wang; Ilmoon Chae",
    venue: "Under review",
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
    venue: "Under review",
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
    venue: "Under review at WACV",
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
    venue: "Major revision at IEEE JBHI",
    area: "Medical AI",
    contribution: "Memory-integrated retrieval for multimodal clinical decision support.",
    arxiv: "2607.01814",
  },
  {
    title: "ViGen: Video-based Generation with GRPO for Dynamic Image Editing",
    year: 2026,
    authors: "Lihui Luo*; Joongwon Chae*",
    authorNote: "Co-first author.",
    venue: "Under review at AAAI",
    area: "Generative AI",
    contribution: "Video-based generation with GRPO for dynamic image editing.",
  },
  {
    title: "Memory-SAM: Human-Prompt-Free Tongue Segmentation via Retrieval-to-Prompt",
    year: 2025,
    authors:
      "Joongwon Chae; Lihui Luo; Yang Liu; Xi Yuan; Dongmei Yu; Zhenglin Chen; Runming Wang; Ilmoon Chae; Lian Zhang; Peiwu Qin",
    venue: "Under review at AAAI 2027",
    area: "Medical AI",
    contribution:
      "Foreground-minus-background DINOv3 contrast generates automatic SAM2 prompts; SM-Tongue releases 2,155 image-mask pairs. Earlier versions averaged 24/28 at ICASSP 2026 and 4.0/5.0 at MICCAI 2026.",
    arxiv: "2510.15849",
    code: "https://github.com/jw-chae/memory-sam",
    dataset: "https://huggingface.co/datasets/Mark-CHAE/SM-Tongue-Public-Original512",
  },
  {
    title: "Auditable Context-Aware HFMD Forecasting with Structured LLM Agents",
    year: 2025,
    authors: "Joongwon Chae; Runming Wang; Chen Xiong; Gong Yunhan; Lian Zhang; Ji Jiansong; Dongmei Yu; Peiwu Qin",
    venue: "Under review at IEEE BIBM",
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
      "M.S. in Electronic Information (Biomedical Engineering), Institute of Biopharmaceutical and Health Engineering. Advisors: Peiwu Qin and Runming Wang.",
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

export const languages = "Korean (native); English (IELTS 6.5); Chinese (HSK 6); Japanese (JLPT N2).";
