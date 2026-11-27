"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { probCopy as t } from "./prob-copy";
import { probDoubts } from "./prob-doubts";
import { BayesScene, CondScene, DistScene, SoftmaxScene } from "./prob-scenes";
import { EntropyScene, GaussScene, MeanScene, MleScene } from "./prob-scenes2";

const scenes: Record<string, () => ReactNode> = {
  dist: () => <DistScene />,
  softmax: () => <SoftmaxScene />,
  cond: () => <CondScene />,
  bayes: () => <BayesScene />,
  expect: () => <MeanScene />,
  gauss: () => <GaussScene />,
  mle: () => <MleScene />,
  entropy: () => <EntropyScene />,
};

export function ProbPage() {
  return (
    <ChapterPage
      slug="probability"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={probDoubts}
      related={t.related}
    />
  );
}
