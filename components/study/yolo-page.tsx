"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { yoloCopy as t } from "./yolo-copy";
import { yoloDoubts } from "./yolo-doubts";
import { AssignScene, CellScene, DualScene, NmsScene } from "./yolo-scenes";
import { DesignScene, FoldScene, PromptScene, VocabScene } from "./yolo-scenes2";

const scenes: Record<string, () => ReactNode> = {
  cell: () => <CellScene />,
  nms: () => <NmsScene />,
  assign: () => <AssignScene />,
  dual: () => <DualScene />,
  design: () => <DesignScene />,
  vocab: () => <VocabScene />,
  fold: () => <FoldScene />,
  prompts: () => <PromptScene />,
};

export function YoloPage() {
  return (
    <ChapterPage
      slug="yolo"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={yoloDoubts}
      related={t.related}
    />
  );
}
