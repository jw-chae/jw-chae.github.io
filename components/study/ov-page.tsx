"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { ovCopy as t } from "./ov-copy";
import { ovDoubts } from "./ov-doubts";
import { ClosedScene, ContrastScene, RegionScene, ZeroShotScene } from "./ov-scenes";
import { FoldScene, FusionScene, PromptScene } from "./ov-scenes2";

const scenes: Record<string, () => ReactNode> = {
  closed: () => <ClosedScene />,
  clip: () => <ContrastScene />,
  zeroshot: () => <ZeroShotScene />,
  region: () => <RegionScene />,
  fusion: () => <FusionScene />,
  fold: () => <FoldScene />,
  prompts: () => <PromptScene />,
};

export function OpenVocabPage() {
  return (
    <ChapterPage
      slug="openvocab"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={ovDoubts}
      related={t.related}
    />
  );
}
