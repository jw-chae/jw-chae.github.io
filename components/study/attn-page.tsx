"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { attnCopy as t } from "./attn-copy";
import { attnDoubts } from "./attn-doubts";
import { FlashScene, OnlineScene, WallScene, WindowScene } from "./attn-scenes";
import { ChooseScene, DecodeScene, LinearScene } from "./attn-scenes2";

const scenes: Record<string, () => ReactNode> = {
  wall: () => <WallScene />,
  online: () => <OnlineScene />,
  flash: () => <FlashScene />,
  window: () => <WindowScene />,
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
