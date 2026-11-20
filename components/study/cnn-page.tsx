"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { cnnCopy as t } from "./cnn-copy";
import { HierarchyScene, KernelScene, PipelineScene, PoolScene, ReceptiveFieldScene, StridePadScene, WhyConvScene } from "./cnn-scenes";

const scenes: Record<string, () => ReactNode> = {
  why: () => <WhyConvScene />,
  kernel: () => <KernelScene />,
  stride: () => <StridePadScene />,
  rf: () => <ReceptiveFieldScene />,
  pool: () => <PoolScene />,
  hierarchy: () => <HierarchyScene />,
  pipeline: () => <PipelineScene />,
};

export function CnnPage() {
  return <ChapterPage slug="cnn" title={t.title} sub={t.sub} prologue={t.prologue} sections={t.sections} scenes={scenes} />;
}
