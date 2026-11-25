"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { vitCopy as t } from "./vit-copy";
import { vitDoubts } from "./vit-doubts";
import { vitWalkDoubts } from "./vit-walk-copy";
import { PatchLookScene, PatchSwapScene } from "./vit-walk-scenes";
import { ClsReadScene, PlaceScene } from "./vit-walk-scenes2";
import { DinoScene, MemoryScene, Pos2DScene, ReachScene, TokenScene } from "./vit-scenes";

const scenes: Record<string, () => ReactNode> = {
  patch: () => <TokenScene />,
  look: () => <PatchLookScene />,
  swap: () => <PatchSwapScene />,
  cls: () => <ClsReadScene />,
  shuffle: () => <PlaceScene />,
  pos2d: () => <Pos2DScene />,
  compare: () => <ReachScene />,
  dino: () => <DinoScene />,
  memory: () => <MemoryScene />,
};

export function VitPage() {
  return <ChapterPage slug="vit" title={t.title} sub={t.sub} prologue={t.prologue} sections={t.sections} scenes={scenes} doubts={{ ...vitWalkDoubts, ...vitDoubts }} related={t.related} />;
}
