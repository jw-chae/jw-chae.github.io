"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { unetDoubts } from "./doubts";
import { unetCopy as t } from "./unet-copy";
import { DeformScene, DownUpScene, SkipFuseScene, UShapeScene, UpsampleScene, WindowScene } from "./unet-scenes";

const scenes: Record<string, () => ReactNode> = {
  window: () => <WindowScene />,
  down: () => <DownUpScene />,
  up: () => <UpsampleScene />,
  skip: () => <SkipFuseScene />,
  ushape: () => <UShapeScene />,
  augment: () => <DeformScene />,
};

export function UnetPage() {
  return <ChapterPage slug="unet" title={t.title} sub={t.sub} prologue={t.prologue} sections={t.sections} scenes={scenes} doubts={unetDoubts} />;
}
