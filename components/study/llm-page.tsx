"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { llmCopy as t } from "./llm-copy";
import { llmDoubts } from "./llm-doubts";
import { BpeScene, GenerateScene, NextTokenScene, SamplingScene, ScaleScene, ShiftScene } from "./llm-scenes";
import { BlankScene, LearnScene, LoopScene } from "./llm-walk-scenes";

const scenes: Record<string, () => ReactNode> = {
  blank: () => <BlankScene />,
  next: () => <NextTokenScene />,
  bpe: () => <BpeScene />,
  shift: () => <ShiftScene />,
  learn: () => <LearnScene />,
  sample: () => <SamplingScene />,
  loop: () => <LoopScene />,
  generate: () => <GenerateScene />,
  scale: () => <ScaleScene />,
};

export function LlmPage() {
  return <ChapterPage slug="llm" title={t.title} sub={t.sub} prologue={t.prologue} sections={t.sections} scenes={scenes} doubts={llmDoubts} />;
}
