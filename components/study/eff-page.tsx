"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { effCopy as t } from "./eff-copy";
import { effDoubts } from "./eff-doubts";
import { BytesScene, CountScene, SeparableScene, TwinScene } from "./eff-scenes";
import { BatchScene, BranchScene, RepvitScene, YoloScene } from "./eff-scenes2";

const scenes: Record<string, () => ReactNode> = {
  count: () => <CountScene />,
  bytes: () => <BytesScene />,
  separable: () => <SeparableScene />,
  twin: () => <TwinScene />,
  batch: () => <BatchScene />,
  repvit: () => <RepvitScene />,
  yolov10: () => <YoloScene />,
  branch: () => <BranchScene />,
};

export function EfficiencyPage() {
  return (
    <ChapterPage
      slug="efficiency"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={effDoubts}
      related={t.related}
    />
  );
}
