"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { CompareScene, PatchScene } from "./tf-scenes";
import { vitCopy as t } from "./vit-copy";
import { vitDoubts } from "./vit-doubts";
import { ClsScene, DinoScene, MemoryScene, Pos2DScene } from "./vit-scenes";

const scenes: Record<string, () => ReactNode> = {
  patch: () => <PatchScene />,
  cls: () => <ClsScene />,
  pos2d: () => <Pos2DScene />,
  compare: () => <CompareScene />,
  dino: () => <DinoScene />,
  memory: () => <MemoryScene />,
};

export function VitPage() {
  return <ChapterPage slug="vit" title={t.title} sub={t.sub} prologue={t.prologue} sections={t.sections} scenes={scenes} doubts={vitDoubts} related={t.related} />;
}
