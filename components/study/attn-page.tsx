"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { attnCopy as t } from "./attn-copy";
import { attnDoubts } from "./attn-doubts";
import { FlashScene, OnlineScene, SparseScene, WallScene, WindowScene } from "./attn-scenes";
import { ChooseScene, DecodeScene, LinearScene, LowRankScene } from "./attn-scenes2";

const scenes: Record<string, () => ReactNode> = {
  wall: () => <WallScene />,
  online: () => <OnlineScene />,
  flash: () => <FlashScene />,
  window: () => <WindowScene />,
  sparse: () => <SparseScene />,
  lowrank: () => <LowRankScene />,
  linear: () => <LinearScene />,
  decode: () => <DecodeScene />,
  choose: () => <ChooseScene />,
};

export function AttentionPage() {
  return (
    <ChapterPage
      slug="attention"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={attnDoubts}
      related={t.related}
    />
  );
}
