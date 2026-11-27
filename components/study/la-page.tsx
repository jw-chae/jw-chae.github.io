"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { laCopy as t } from "./la-copy";
import { laDoubts } from "./la-doubts";
import { ComposeScene, DotScene, LayerScene, TableScene } from "./la-scenes";
import { NullScene, PcaScene, SvdScene } from "./la-scenes2";

const scenes: Record<string, () => ReactNode> = {
  table: () => <TableScene />,
  dot: () => <DotScene />,
  layer: () => <LayerScene />,
  compose: () => <ComposeScene />,
  rank: () => <NullScene />,
  svd: () => <SvdScene />,
  pca: () => <PcaScene />,
};

export function LinalgPage() {
  return (
    <ChapterPage
      slug="linalg"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={laDoubts}
      related={t.related}
    />
  );
}
