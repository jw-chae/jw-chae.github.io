import Image from "next/image";
import type { ResearchItem } from "@/data/site";

const visualAssets = {
  procon: {
    src: "/research/procon-concept.webp",
    width: 1800,
    height: 1013,
    alt: "ProCon comparison between hard nearest-neighbor retrieval and soft local projection",
    caption: "Projection consistency replaces a single nearest anchor with local reconstruction.",
    source: "Source: official repository.",
    altZh: "ProCon 方法图，对比硬最近邻检索与软局部投影",
    captionZh: "投影一致性以局部重构取代单一最近邻锚点。来源：官方代码仓库。",
  },
  gcr: {
    src: "/research/gcr-overview.webp",
    width: 1045,
    height: 560,
    alt: "GCR pipeline with frozen OpenCLIP features, category prototype banks, geometry-consistent routing, and anomaly scoring",
    caption: "GCR separates cross-head routing from within-head anomaly scoring.",
    source: "Source: arXiv 2601.01856.",
    altZh: "GCR 流程图，包含冻结的 OpenCLIP 特征、类别原型库、几何一致路由与异常评分",
    captionZh: "GCR 将跨头路由与头内异常评分分离。来源：arXiv 2601.01856。",
  },
  "memory-sam": {
    src: "/research/memory-sam-architecture.webp",
    width: 1800,
    height: 1004,
    alt: "Memory-SAM architecture for exemplar retrieval, contrastive point selection, and SAM2 tongue segmentation",
    caption: "Memory-SAM retrieves an exemplar and converts correspondence into SAM2 prompts.",
    source: "Source: official repository.",
    altZh: "Memory-SAM 架构图，展示样例检索、对比点选择与 SAM2 舌体分割",
    captionZh: "Memory-SAM 检索样例，并将视觉对应关系转化为 SAM2 提示。来源：官方代码仓库。",
  },
} as const;

function BoundaryEvidence({ locale }: { locale: "en" | "zh" }) {
  const isZh = locale === "zh";

  return (
    <figure className="boundary-evidence" aria-label={isZh ? "BoundarySupport 在 MVTec AD 上的像素级平均精度对比" : "BoundarySupport MVTec AD patch average precision comparison"}>
      <figcaption>{isZh ? "MVTec AD / 固定记忆库大小 / 像素级 AP" : "MVTec AD / fixed memory size / patch AP"}</figcaption>
      <div className="boundary-values">
        <div>
          <span>{isZh ? "纯正常支持" : "Clean support"}</span>
          <strong>73.336</strong>
        </div>
        <span className="boundary-arrow" aria-hidden="true">→</span>
        <div>
          <span>{isZh ? "有效支持" : "Useful support"}</span>
          <strong>76.952</strong>
        </div>
      </div>
      <p><strong>+3.616</strong> {isZh ? "个百分点（相同记忆库大小）" : "points at the same memory size"}</p>
    </figure>
  );
}

export function ResearchVisual({ kind, locale = "en" }: { kind: ResearchItem["visual"]; locale?: "en" | "zh" }) {
  if (kind === "boundary") {
    return <BoundaryEvidence locale={locale} />;
  }

  const asset = visualAssets[kind];

  return (
    <figure className={"research-figure research-figure-" + kind}>
      <div className="research-image-frame">
        <Image
          src={asset.src}
          alt={locale === "zh" ? asset.altZh : asset.alt}
          width={asset.width}
          height={asset.height}
          sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1120px) 56vw, 720px"
        />
      </div>
      <figcaption>{locale === "zh" ? asset.captionZh : `${asset.caption} ${asset.source}`}</figcaption>
    </figure>
  );
}
