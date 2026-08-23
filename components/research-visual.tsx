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
  },
  gcr: {
    src: "/research/gcr-overview.webp",
    width: 1045,
    height: 560,
    alt: "GCR pipeline with frozen OpenCLIP features, category prototype banks, geometry-consistent routing, and anomaly scoring",
    caption: "GCR separates cross-head routing from within-head anomaly scoring.",
    source: "Source: arXiv 2601.01856.",
  },
  "memory-sam": {
    src: "/research/memory-sam-architecture.webp",
    width: 1800,
    height: 1004,
    alt: "Memory-SAM architecture for exemplar retrieval, contrastive point selection, and SAM2 tongue segmentation",
    caption: "Memory-SAM retrieves an exemplar and converts correspondence into SAM2 prompts.",
    source: "Source: official repository.",
  },
} as const;

function BoundaryEvidence() {
  return (
    <figure className="boundary-evidence" aria-label="BoundarySupport MVTec AD patch average precision comparison">
      <figcaption>MVTec AD / fixed memory size / patch AP</figcaption>
      <div className="boundary-values">
        <div>
          <span>Clean support</span>
          <strong>73.336</strong>
        </div>
        <span className="boundary-arrow" aria-hidden="true">→</span>
        <div>
          <span>Useful support</span>
          <strong>76.952</strong>
        </div>
      </div>
      <p><strong>+3.616</strong> points at the same memory size</p>
    </figure>
  );
}

export function ResearchVisual({ kind }: { kind: ResearchItem["visual"] }) {
  if (kind === "boundary") {
    return <BoundaryEvidence />;
  }

  const asset = visualAssets[kind];

  return (
    <figure className={"research-figure research-figure-" + kind}>
      <div className="research-image-frame">
        <Image
          src={asset.src}
          alt={asset.alt}
          width={asset.width}
          height={asset.height}
          sizes="(max-width: 760px) calc(100vw - 32px), (max-width: 1120px) 56vw, 720px"
        />
      </div>
      <figcaption>{asset.caption} {asset.source}</figcaption>
    </figure>
  );
}
