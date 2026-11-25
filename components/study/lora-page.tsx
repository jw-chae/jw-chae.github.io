"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { loraCopy as t } from "./lora-copy";
import { loraDoubts } from "./lora-doubts";
import { DirectionScene, LoraScene, MergeScene, QloraScene, RankScene, TrainScene, WallScene, WhereScene } from "./lora-scenes";
import { MatVecScene, SideScene, SimpleScene } from "./lora-walk-scenes";

const scenes: Record<string, () => ReactNode> = {
  wall: () => <WallScene />,
  matrix: () => <MatVecScene />,
  simple: () => <SimpleScene />,
  direction: () => <DirectionScene />,
  rank: () => <RankScene />,
  lora: () => <LoraScene />,
  learn: () => <SideScene />,
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
