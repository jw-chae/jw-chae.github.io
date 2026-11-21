"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { diffCopy as t } from "./diff-copy";
import { diffDoubts } from "./diff-doubts";
import { BayesScene, DenoiseScene, GuideScene, NoiseImageScene, ReverseScene, SampleScene, WalkScene } from "./diff-scenes";

const scenes: Record<string, () => ReactNode> = {
  dist: () => <SampleScene />,
  gauss: () => <WalkScene />,
  bayes: () => <BayesScene />,
  forward: () => <NoiseImageScene />,
  denoise: () => <DenoiseScene />,
  sample: () => <ReverseScene />,
  guide: () => <GuideScene />,
};

export function DiffusionPage() {
  return <ChapterPage slug="diffusion" title={t.title} sub={t.sub} prologue={t.prologue} sections={t.sections} scenes={scenes} doubts={diffDoubts} related={t.related} />;
}
