import type { CompositionCopy, ConsensusCopy, MapCopy, MemoryCopy, ProjectionCopy, RoutingCopy } from "./scenes";
import type { LineageItem, ResultsCopy } from "./results";

export type Stage = {
  id: string;
  num: string;
  kicker: string;
  title: string;
  body: string;
  formula: string;
  note: string;
  paper: string;
};

export type ShowcaseCopy = {
  kicker: string;
  title: string;
  titleAccent: string;
  sub: string;
  scroll: string;
  heroLabels: [string, string, string, string, string];
  schematic: string;
  stages: Stage[];
  memory: MemoryCopy;
  projection: ProjectionCopy;
  consensus: ConsensusCopy;
  map: MapCopy;
  routing: RoutingCopy;
  composition: CompositionCopy;
  results: ResultsCopy;
  lineageTitle: string;
  lineageLead: string;
  lineage: LineageItem[];
  lineageLabels: { paper: string; code: string };
  credit: string;
};

const lineageEn: LineageItem[] = [
  { name: "ProCon", year: "2026", question: "Is a single nearby anchor enough evidence of normality?", answer: "No. Soft local projection turns memory retrieval into decoder-free reconstruction; the residual, stabilized by bank and depth consensus, is the anomaly evidence.", paper: "https://arxiv.org/abs/2607.04894", code: "https://github.com/jw-chae/Procon", tone: "#8ad3ff" },
  { name: "StructCore", year: "2026", question: "Is the largest patch response the right image-level decision?", answer: "Not alone. A three-number structural descriptor, standardized on train-good maps and read with a Chebyshev rule, adds evidence max pooling discards.", paper: "https://arxiv.org/abs/2602.17048", code: "https://github.com/jw-chae/structcore", tone: "#ffb547" },
  { name: "GCR", year: "2026", question: "How does a frozen detector pick the right head when categories keep arriving?", answer: "Route by mean nearest-prototype distance in the shared space, then score only inside the routed head. Routing instability, not forgetting, was the failure.", paper: "https://arxiv.org/abs/2601.01856", code: "https://github.com/jw-chae/GCR", tone: "#3ddc97" },
  { name: "CLEANCON", year: "2026", question: "Does coverage-driven memory selection amplify sparse contamination, and does purity fix it?", answer: "Global coverage over-represents contamination 16 to 40 times. An out-of-bag gate removes it and helps, yet the cleanest memory is not the best one.", paper: "https://arxiv.org/abs/2608.23295", code: "https://github.com/jw-chae/cleancon", tone: "#ff5470" },
  { name: "BoundarySupport", year: "2026", question: "Do clean images contain every normal patch a detector needs?", answer: "No. Normal patches beside real defects are missing from clean pools. Altering context around a clean image and keeping only pixel-preserved neighbors recovers them.", paper: "https://arxiv.org/abs/2608.23299", code: "https://github.com/jw-chae/boundary_support", tone: "#c06bff" },
];

const resultsEn: ResultsCopy = {
  kicker: "Results · ProCon",
  title: "The same pipeline on real defects",
  lead: "Every heat map below is a real ProCon output on MVTec AD, not a rendering. Columns follow the ablation ladder: hard nearest-neighbor memory, soft projection memory, and the full method with layer consensus.",
  cols: ["Input", "Ground truth", "NN memory", "Soft projection", "ProCon"],
  metrics: [
    { dataset: "MVTec AD", iauroc: 99.8, pap: 73.5, aupro: 95.9 },
    { dataset: "VisA", iauroc: 99.2, pap: 52.3, aupro: 97.0 },
    { dataset: "Real-IAD", iauroc: 93.2, pap: 49.4, aupro: 97.2 },
  ],
  metricNames: ["Image AUROC", "Pixel AP", "AUPRO"],
  source: "Anomaly maps: ProCon paper, Figure 5 (MVTec AD examples). Metrics: ProCon Table 1, single-category protocol, frozen DINOv2 ViT-B/14, no training.",
};

export const copyEn: ShowcaseCopy = {
  kicker: "Anomaly detection, visually",
  title: "Which reference evidence should a frozen model",
  titleAccent: "retain, route, and trust?",
  sub: "One frozen encoder, no training, and a memory of normal patches. Every paper in this line changes one decision in that pipeline. Scroll to watch each decision happen.",
  scroll: "Scroll",
  heroLabels: ["test image (MVTec AD, hazelnut)", "28 × 28 patch tokens", "feature space (schematic)", "normal manifold", "anomalous tokens"],
  schematic: "Interactive scenes are 2-D schematics of the 768-dimensional computation; numbers update live from the rule shown.",
  stages: [
    {
      id: "tokens", num: "01", kicker: "Representation", title: "An image becomes 784 tokens",
      body: "A frozen DINOv2 ViT-B/14 turns a 392 × 392 image into a 28 × 28 grid of 768-dimensional patch tokens at several depths. Nothing is trained; everything downstream is a decision about how to compare these tokens with tokens from normal images.",
      formula: "F_ℓ(x) = f_ℓ(x) ∈ ℝ^{P×C},   P = 28·28,   C = 768,   ℓ ∈ {−3, −6, −8, −9}",
      note: "The hero animation above is this step: pixels → patch grid → tokens in feature space. Red tokens are the cells overlapping the ground-truth crack.", paper: "ProCon",
    },
    {
      id: "memory", num: "02", kicker: "Memory", title: "Keep a few normal tokens as references",
      body: "Storing every normal token is too slow, so PatchCore-style pipelines keep a coreset: greedy farthest-first selection that covers feature space with K centers. Coverage loves rare points. If a few anomalous images slipped into the training pool, their rare tokens are exactly what the selector reaches for first.",
      formula: "μ_t = argmax_q  min_{s<t} ‖q − μ_s‖²        A_K = p_mem / p_pool",
      note: "Move the budget and switch the selector. Random selection keeps contamination at its pool rate (A_K ≈ 1); global farthest-first pulls it into memory many times over, as measured in CLEANCON (16 to 40× at a 1% budget).", paper: "CLEANCON",
    },
    {
      id: "projection", num: "03", kicker: "Scoring", title: "One near anchor is not enough",
      body: "Nearest-neighbor scoring asks whether some normal anchor is close. A defective patch can accidentally land beside one stray anchor and score as normal: a false-normal match. ProCon instead asks whether the patch can be reconstructed from its local normal neighborhood, weighting k anchors by distance and scoring the projection residual.",
      formula: "w_j ∝ exp(−‖z − m_j‖² / τ),   ẑ = Σ_j w_j m_j,   r = ‖z − ẑ‖\n(k = 1 ⇒ r = s_NN)",
      note: "Hover to move the test token. Press the preset to park it next to the stray anchor: the dashed hard-NN distance stays small while the residual jumps. Set k = 1 and the two rules coincide.", paper: "ProCon",
    },
    {
      id: "consensus", num: "04", kicker: "Consensus", title: "Agree across memories before trusting a peak",
      body: "A single coreset is a random draw of anchors, and an unlucky draw creates spurious peaks. ProCon builds B seed-perturbed banks per depth and takes the median residual across them, then averages aligned residual maps across depths. Fusion happens after every bank and layer has produced the same quantity.",
      formula: "S_ℓ(p) = median_b R_{ℓ,b}(p),        S_map(p) = (1/|L|) Σ_ℓ S_ℓ(p)",
      note: "Bank 2 carries a false peak. Min keeps it out but also erodes the true defect; mean lets it leak; median removes it while the shared defect survives.", paper: "ProCon",
    },
    {
      id: "map", num: "05", kicker: "Map → score", title: "The maximum throws information away",
      body: "The image-level decision is usually the largest map value. Two maps with the same maximum can have completely different structure: an isolated spurious peak on a normal image versus distributed, tail-heavy evidence on a defect. StructCore describes each map with three numbers, standardizes them on train-good maps, and reports the strongest calibrated violation.",
      formula: "φ(S) = [σ_S, TopMean_r(S), TV(S)],   z = (φ − μ)/σ\nD_struct = ‖z‖_∞,   S_hyb = S_base + λ D_struct",
      note: "Both maps are scaled to the same maximum, so max pooling cannot separate them. Grow the defect extent and watch the structural score diverge while the maximum stays fixed.", paper: "StructCore",
    },
    {
      id: "routing", num: "06", kicker: "Routing", title: "Pick the head by geometry, not by anomaly score",
      body: "When categories arrive one after another and test images carry no label, the detector must choose a category head first. Comparing anomaly scores across heads is unstable: scales differ and a defect can flip the choice. GCR routes with the mean nearest-prototype distance of a few sampled patches, then scores only inside that head.",
      formula: "r_c(x) = (1/M_r) Σ_{p∈P_r} min_k ‖q_p − μ_{c,k}‖²\nĉ = argmin_c r_c(x)",
      note: "Thirty-two patches are sampled from a head-2 image with four defect patches. The mean criterion routes correctly; a peak-sensitive top-q criterion is dragged toward the broad neighboring head.", paper: "GCR",
    },
    {
      id: "composition", num: "07", kicker: "Composition", title: "What belongs in memory at all",
      body: "Two papers change the candidate pool instead of the score. CLEANCON scores every training image by how well other training images explain it (out-of-bag soft-projection residuals) and passes only the lower half to the unchanged builder. BoundarySupport shows that clean images lack the normal patches that sit beside real defects, and exposes them by altering context around a clean image while learning only from pixel-preserved neighbors.",
      formula: "a_i = TopMean_{0.5%}( median_b r_{i,p,b} ),   T = {i : a_i ≤ median}\nC = P(A) ∪ P(D),   R = Dilate(P(A), 2) \\ C",
      note: "Left: three contaminated images sort to the top and the median gate drops them; raise retention and they re-enter, yet in the paper P-AP kept rising past the cleanest point. Right: insertion A, blended pixels D, excluded tokens C, and the preserved ring R that becomes new normal evidence.", paper: "CLEANCON · BoundarySupport",
    },
  ],
  memory: { budget: "Memory budget", selector: "Selector", global: "Global farthest-first", random: "Random", replay: "Replay", stats: ["selected", "contaminated in memory", "p_mem vs p_pool", "amplification A_K"] },
  projection: { k: "Neighbors", preset: "False-normal match", free: "Free", hard: "Hard NN (PatchCore)", soft: "Soft residual (ProCon)", ratio: "residual ÷ hard NN", stray: "stray anchor" },
  consensus: { rule: "Bank rule", min: "min", mean: "mean", median: "median", bank: "bank", score: "top-mean" },
  map: { extent: "Defect extent", normal: "normal image", anomalous: "defect image", max: "max", dims: ["σ_S  global dispersion", "TopMean_r  tail concentration", "TV  spatial roughness"], struct: "D_struct = max|z_d|" },
  routing: { heads: ["head 1", "head 2", "head 3", "head 4"], mean: "mean NN-prototype distance (GCR)", topq: "top-q anomaly score", routed: "routed", wrong: "wrong head", patches: "sampled patches" },
  composition: { gate: "CLEANCON · out-of-bag support score per training image", retain: "Retention", kept: "kept", dropped: "dropped", badKept: "contaminated kept", steps: ["clean image tokens", "A: nominal insertion", "D: pixels changed by blending", "C = P(A) ∪ P(D): excluded", "R: pixel-preserved ring → normal evidence"] },
  results: resultsEn,
  lineageTitle: "One pipeline, five decisions",
  lineageLead: "Each paper isolates one decision in the frozen memory-bank pipeline and tests it under matched controls.",
  lineage: lineageEn,
  lineageLabels: { paper: "paper", code: "code" },
  credit: "Images: MVTec AD (Bergmann et al., CVPR 2019; CC BY-NC-SA 4.0) and figures from the author's ProCon repository. Interactive scenes are schematic and use synthetic 2-D data.",
};

const lineageZh: LineageItem[] = [
  { name: "ProCon", year: "2026", question: "一个邻近的正常锚点足以证明正常吗？", answer: "不够。软局部投影把记忆检索变成无解码器重建；经记忆库与深度共识稳定后的投影残差才是异常证据。", paper: "https://arxiv.org/abs/2607.04894", code: "https://github.com/jw-chae/Procon", tone: "#8ad3ff" },
  { name: "StructCore", year: "2026", question: "最大的补丁响应就是正确的图像级判断吗？", answer: "并非单独如此。用三维结构描述子在正常图上标准化，再以切比雪夫规则读取，可补回最大池化丢弃的证据。", paper: "https://arxiv.org/abs/2602.17048", code: "https://github.com/jw-chae/structcore", tone: "#ffb547" },
  { name: "GCR", year: "2026", question: "类别持续到来时，冻结检测器如何选对检测头？", answer: "在共享空间中按平均最近原型距离路由，再只在该头内评分。失败根源是路由不稳定，而不是遗忘。", paper: "https://arxiv.org/abs/2601.01856", code: "https://github.com/jw-chae/GCR", tone: "#3ddc97" },
  { name: "CLEANCON", year: "2026", question: "覆盖驱动的记忆选择会放大稀疏污染吗？纯度能解决问题吗？", answer: "全局覆盖把污染放大 16 至 40 倍。袋外门控能清除污染并带来提升，但最干净的记忆并不是最好的记忆。", paper: "https://arxiv.org/abs/2608.23295", code: "https://github.com/jw-chae/cleancon", tone: "#ff5470" },
  { name: "BoundarySupport", year: "2026", question: "干净图像包含检测器需要的全部正常补丁吗？", answer: "不包含。真实缺陷旁的正常补丁在干净图像池中缺失。改变干净图像的周边语境、只保留像素不变的邻域即可补回它们。", paper: "https://arxiv.org/abs/2608.23299", code: "https://github.com/jw-chae/boundary_support", tone: "#c06bff" },
];

const resultsZh: ResultsCopy = {
  kicker: "结果 · ProCon",
  title: "同一流程在真实缺陷上的表现",
  lead: "下方每张热力图都是 ProCon 在 MVTec AD 上的真实输出，而非示意渲染。各列对应消融阶梯：硬最近邻记忆、软投影记忆，以及带层共识的完整方法。",
  cols: ["输入", "真值", "最近邻记忆", "软投影", "ProCon"],
  metrics: [
    { dataset: "MVTec AD", iauroc: 99.8, pap: 73.5, aupro: 95.9 },
    { dataset: "VisA", iauroc: 99.2, pap: 52.3, aupro: 97.0 },
    { dataset: "Real-IAD", iauroc: 93.2, pap: 49.4, aupro: 97.2 },
  ],
  metricNames: ["图像 AUROC", "像素 AP", "AUPRO"],
  source: "异常图来自 ProCon 论文图 5（MVTec AD 示例）。指标来自 ProCon 表 1：单类别协议，冻结 DINOv2 ViT-B/14，无训练。",
};

export const copyZh: ShowcaseCopy = {
  kicker: "可视化的异常检测",
  title: "冻结模型应当",
  titleAccent: "保留、路由并信任哪些参考证据？",
  sub: "一个冻结编码器、零训练、一组正常补丁记忆。这一系列论文各自改变了流程中的一个决策。向下滚动，逐一观看这些决策如何发生。",
  scroll: "滚动",
  heroLabels: ["测试图像（MVTec AD，榛子）", "28 × 28 补丁 token", "特征空间（示意）", "正常流形", "异常 token"],
  schematic: "交互场景是 768 维计算的二维示意；数值按所示规则实时更新。",
  stages: [
    { id: "tokens", num: "01", kicker: "表征", title: "一张图像变成 784 个 token", body: "冻结的 DINOv2 ViT-B/14 把 392 × 392 图像编码为 28 × 28 的 768 维补丁 token，并取多个深度。没有任何训练；下游所有工作都是在决定如何把这些 token 与正常图像的 token 进行比较。", formula: "F_ℓ(x) = f_ℓ(x) ∈ ℝ^{P×C},   P = 28·28,   C = 768,   ℓ ∈ {−3, −6, −8, −9}", note: "上方的开场动画即此步骤：像素 → 补丁网格 → 特征空间中的 token。红色 token 是与真值裂纹重叠的单元。", paper: "ProCon" },
    { id: "memory", num: "02", kicker: "记忆", title: "只保留少量正常 token 作为参照", body: "存储全部正常 token 太慢，PatchCore 类流程保留一个核心集：贪心最远优先选择，用 K 个中心覆盖特征空间。覆盖偏爱稀有点。若少量异常图像混入训练池，其稀有 token 恰恰是选择器最先抓取的对象。", formula: "μ_t = argmax_q  min_{s<t} ‖q − μ_s‖²        A_K = p_mem / p_pool", note: "调节预算并切换选择器。随机选择使污染保持在池内比例（A_K ≈ 1）；全局最远优先则把污染成倍拉入记忆，正如 CLEANCON 在 1% 预算下测得的 16 至 40 倍。", paper: "CLEANCON" },
    { id: "projection", num: "03", kicker: "评分", title: "一个邻近锚点并不足够", body: "最近邻评分只问是否存在一个邻近的正常锚点。有缺陷的补丁可能恰好落在某个孤立锚点旁而被判为正常，即假正常匹配。ProCon 改为询问补丁能否由其局部正常邻域重建：按距离加权 k 个锚点，并对投影残差评分。", formula: "w_j ∝ exp(−‖z − m_j‖² / τ),   ẑ = Σ_j w_j m_j,   r = ‖z − ẑ‖\n(k = 1 ⇒ r = s_NN)", note: "移动鼠标即可移动测试 token。按下预设按钮把它停在孤立锚点旁：虚线的硬最近邻距离仍然很小，而残差骤增。把 k 设为 1，两条规则重合。", paper: "ProCon" },
    { id: "consensus", num: "04", kicker: "共识", title: "信任峰值之前先跨记忆达成一致", body: "单个核心集只是锚点的一次随机抽样，不走运的抽样会制造虚假峰值。ProCon 为每个深度构建 B 个随机种子扰动的记忆库，对残差取中位数，再对各深度对齐后的残差图取均值。融合发生在每个库与每一层都产出同一量之后。", formula: "S_ℓ(p) = median_b R_{ℓ,b}(p),        S_map(p) = (1/|L|) Σ_ℓ S_ℓ(p)", note: "库 2 含有一个假峰。min 能去掉它却也削弱真实缺陷；mean 让它泄漏；median 去掉它的同时保留了共同的缺陷。", paper: "ProCon" },
    { id: "map", num: "05", kicker: "图 → 分数", title: "取最大值会丢掉信息", body: "图像级判断通常取异常图的最大值。最大值相同的两张图可以结构完全不同：正常图像上孤立的虚假峰值，与缺陷图像上分散、重尾的证据。StructCore 用三个数描述每张图，在正常图上标准化，并报告最强的校准偏差。", formula: "φ(S) = [σ_S, TopMean_r(S), TV(S)],   z = (φ − μ)/σ\nD_struct = ‖z‖_∞,   S_hyb = S_base + λ D_struct", note: "两张图被缩放到相同最大值，因此最大池化无法区分。增大缺陷范围，观察结构分数在最大值不变的情况下拉开差距。", paper: "StructCore" },
    { id: "routing", num: "06", kicker: "路由", title: "按几何选择检测头，而不是按异常分数", body: "类别依次到来且测试图像无标签时，检测器必须先选择类别头。跨头比较异常分数并不稳定：尺度不同，缺陷也可能翻转选择。GCR 用少量采样补丁的平均最近原型距离路由，然后只在该头内评分。", formula: "r_c(x) = (1/M_r) Σ_{p∈P_r} min_k ‖q_p − μ_{c,k}‖²\nĉ = argmin_c r_c(x)", note: "从一张属于头 2 且含四个缺陷补丁的图像中采样 32 个补丁。均值准则路由正确；对峰值敏感的 top-q 准则被拖向相邻的宽泛检测头。", paper: "GCR" },
    { id: "composition", num: "07", kicker: "构成", title: "什么才应当进入记忆", body: "两篇论文改变的是候选池而不是分数。CLEANCON 用其他训练图像解释某图像的程度（袋外软投影残差）为每张训练图像评分，只把较低的一半交给不变的构建器。BoundarySupport 表明干净图像缺少真实缺陷旁的正常补丁，并通过改变干净图像的周边语境、只从像素不变的邻域学习来补回它们。", formula: "a_i = TopMean_{0.5%}( median_b r_{i,p,b} ),   T = {i : a_i ≤ median}\nC = P(A) ∪ P(D),   R = Dilate(P(A), 2) \\ C", note: "左：三张污染图像排到最前，中位数门控将其剔除；提高保留率它们会重新进入，但论文中 P-AP 在最干净点之后仍持续上升。右：插入区 A、混合像素 D、排除 token C，以及成为新正常证据的像素保持环 R。", paper: "CLEANCON · BoundarySupport" },
  ],
  memory: { budget: "记忆预算", selector: "选择器", global: "全局最远优先", random: "随机", replay: "重放", stats: ["已选择", "记忆中的污染", "p_mem 对比 p_pool", "放大倍数 A_K"] },
  projection: { k: "邻居数", preset: "假正常匹配", free: "自由", hard: "硬最近邻（PatchCore）", soft: "软残差（ProCon）", ratio: "残差 ÷ 硬最近邻", stray: "孤立锚点" },
  consensus: { rule: "库规则", min: "min", mean: "mean", median: "median", bank: "库", score: "top-mean" },
  map: { extent: "缺陷范围", normal: "正常图像", anomalous: "缺陷图像", max: "最大值", dims: ["σ_S  全局离散度", "TopMean_r  尾部集中度", "TV  空间粗糙度"], struct: "D_struct = max|z_d|" },
  routing: { heads: ["头 1", "头 2", "头 3", "头 4"], mean: "平均最近原型距离（GCR）", topq: "top-q 异常分数", routed: "路由至此", wrong: "错误检测头", patches: "采样补丁" },
  composition: { gate: "CLEANCON · 每张训练图像的袋外支持分数", retain: "保留率", kept: "保留", dropped: "剔除", badKept: "保留的污染", steps: ["干净图像 token", "A：名义插入区", "D：混合改变的像素", "C = P(A) ∪ P(D)：排除", "R：像素保持环 → 正常证据"] },
  results: resultsZh,
  lineageTitle: "一条流程，五个决策",
  lineageLead: "每篇论文在冻结记忆库流程中分离出一个决策，并在匹配对照下加以检验。",
  lineage: lineageZh,
  lineageLabels: { paper: "论文", code: "代码" },
  credit: "图像：MVTec AD（Bergmann 等，CVPR 2019；CC BY-NC-SA 4.0）及作者 ProCon 仓库中的图表。交互场景为示意，使用合成的二维数据。",
};
