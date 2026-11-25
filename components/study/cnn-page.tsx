"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { cnnCopy as t } from "./cnn-copy";
import { cnnDoubts } from "./cnn-doubts";
import { HierarchyScene, PipelineScene, PoolScene, ReceptiveFieldScene, StridePadScene, WhyConvScene } from "./cnn-scenes";
import { CellScene, KernelLearnScene, KernelScene, ReachScene } from "./cnn-walk-scenes";

const scenes: Record<string, () => ReactNode> = {
  cell: () => <CellScene />,
  kernel: () => <KernelScene />,
  learn: () => <KernelLearnScene />,
  why: () => <WhyConvScene />,
  stride: () => <StridePadScene />,
  reach: () => <ReachScene />,
  rf: () => <ReceptiveFieldScene />,
  pool: () => <PoolScene />,
  hierarchy: () => <HierarchyScene />,
  pipeline: () => <PipelineScene />,
};

export function CnnPage() {
  return <ChapterPage slug="cnn" title={t.title} sub={t.sub} prologue={t.prologue} sections={t.sections} scenes={scenes} doubts={cnnDoubts} />;
}
