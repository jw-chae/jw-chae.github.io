"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { pruneCopy as t } from "./prune-copy";
import { pruneDoubts } from "./prune-doubts";
import { MagScene, RetrainScene, SparseScene } from "./prune-scenes";
import { CompareScene, DingScene, LlmScene, StructScene } from "./prune-scenes2";

// OBD and the lottery ticket are folded into 01 and the doubts of 02; their scenes (ObdScene, TicketScene) are no longer shown.
const scenes: Record<string, () => ReactNode> = {
  magnitude: () => <MagScene />,
  retrain: () => <RetrainScene />,
  sparse: () => <SparseScene />,
  structured: () => <StructScene />,
  ding: () => <DingScene />,
  llm: () => <LlmScene />,
  compare: () => <CompareScene />,
};

export function PrunePage() {
  return (
    <ChapterPage
      slug="pruning"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={pruneDoubts}
      related={t.related}
    />
  );
}
