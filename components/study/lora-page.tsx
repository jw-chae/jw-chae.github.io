"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { loraCopy as t } from "./lora-copy";
import { loraDoubts } from "./lora-doubts";
import { LoraScene, MatrixScene, MergeScene, QloraScene, RankScene, TrainScene, WallScene, WhereScene } from "./lora-scenes";

const scenes: Record<string, () => ReactNode> = {
  wall: () => <WallScene />,
  matrix: () => <MatrixScene />,
  rank: () => <RankScene />,
  lora: () => <LoraScene />,
  train: () => <TrainScene />,
  merge: () => <MergeScene />,
  where: () => <WhereScene />,
  qlora: () => <QloraScene />,
};

export function LoraPage() {
  return (
    <ChapterPage
      slug="lora"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={loraDoubts}
      related={t.related}
    />
  );
}
