"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { lossCopy as t } from "./loss-copy";
import { lossDoubts } from "./loss-doubts";
import { NameScene, PushScene, RobustScene, StepScene } from "./loss-scenes";
import { FocalScene, PairScene, SmoothScene, SumScene } from "./loss-scenes2";

const scenes: Record<string, () => ReactNode> = {
  step: () => <StepScene />,
  name: () => <NameScene />,
  push: () => <PushScene />,
  robust: () => <RobustScene />,
  focal: () => <FocalScene />,
  smooth: () => <SmoothScene />,
  pair: () => <PairScene />,
  sum: () => <SumScene />,
};

export function LossPage() {
  return (
    <ChapterPage
      slug="loss"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={lossDoubts}
      related={t.related}
    />
  );
}
