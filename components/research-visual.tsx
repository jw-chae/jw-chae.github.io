import Image from "next/image";
import type { ResearchItem } from "@/data/site";

const visualAssets = {
  boundarysupport: {
    src: "/research/boundarysupport-framework.png",
    width: 1135,
    height: 762,
    alt: "BoundarySupport framework showing altered context, pixel-preserved neighboring patches, fixed-budget memory, and reconstruction targets",
    caption: "BoundarySupport changes context while learning only from pixel-preserved neighboring patches.",
    altZh: "BoundarySupport 框架图，展示改变后的上下文、像素保持不变的邻近补丁、固定预算记忆与重建目标",
    captionZh: "BoundarySupport 改变周边语境，但只学习像素保持不变的邻近补丁。",
  },
  cleancon: {
    src: "/research/cleancon-principle.png",
    width: 1035,
    height: 520,
    alt: "CLEANCON principle separating candidate-image eligibility from a fixed global memory builder",
    caption:
      "CLEANCON separates candidate eligibility from the fixed memory builder to test why the cleanest memory is not always best.",
    altZh: "CLEANCON 原理图，将候选图像资格与固定的全局记忆构建器分离",
    captionZh: "CLEANCON 将候选资格与固定记忆构建器分离，以检验为何最干净的记忆并不总是最佳。",
  },
  procon: {
    src: "/research/procon-concept.webp",
    width: 1800,
    height: 1013,
    alt: "ProCon comparison between hard nearest-neighbor retrieval and soft local projection",
    caption: "ProCon replaces a single nearest anchor with local projection.",
    altZh: "ProCon 方法图，对比硬最近邻检索与软局部投影",
    captionZh: "ProCon 以局部投影取代单一最近邻锚点。",
  },
  gcr: {
    src: "/research/gcr-overview.webp",
    width: 1045,
    height: 560,
    alt: "GCR pipeline with frozen OpenCLIP features, category prototype banks, geometry-consistent routing, and anomaly scoring",
    caption: "GCR separates cross-head routing from within-head anomaly scoring.",
    altZh: "GCR 流程图，包含冻结的 OpenCLIP 特征、类别原型库、几何一致路由与异常评分",
    captionZh: "GCR 将跨检测头路由与头内异常评分分离。",
  },
  "memory-sam": {
    src: "/research/memory-sam-architecture.webp",
    width: 1800,
    height: 1004,
    alt: "Memory-SAM architecture for exemplar retrieval, contrastive point selection, and SAM2 tongue segmentation",
    caption: "Memory-SAM converts retrieved visual correspondence into automatic SAM2 prompts.",
    altZh: "Memory-SAM 架构图，展示样例检索、对比点选择与 SAM2 舌体分割",
    captionZh: "Memory-SAM 将检索得到的视觉对应关系转化为自动 SAM2 提示。",
  },
} as const;

export function ResearchVisual({ kind, locale = "en" }: { kind: ResearchItem["visual"]; locale?: "en" | "zh" }) {
  const asset = visualAssets[kind];

  return (
    <figure className={`research-figure research-figure-${kind}`}>
      <div className="research-image-frame">
        <Image
          src={asset.src}
          alt={locale === "zh" ? asset.altZh : asset.alt}
          width={asset.width}
          height={asset.height}
          sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1120px) 56vw, 720px"
        />
      </div>
      <figcaption>{locale === "zh" ? asset.captionZh : asset.caption}</figcaption>
    </figure>
  );
}
