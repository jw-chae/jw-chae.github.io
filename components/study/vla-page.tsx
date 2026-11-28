"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { vlaCopy as t } from "./vla-copy";
import { vlaDoubts } from "./vla-doubts";
import { ChunkScene, ForkScene, PolicyScene, TokenScene } from "./vla-scenes";
import { ChooseScene, FastScene, FlowScene } from "./vla-scenes2";

const scenes: Record<string, () => ReactNode> = {
  policy: () => <PolicyScene />,
  fork: () => <ForkScene />,
  tokens: () => <TokenScene />,
  chunk: () => <ChunkScene />,
  flow: () => <FlowScene />,
  fast: () => <FastScene />,
  choose: () => <ChooseScene />,
};

export function VlaPage() {
  return (
    <ChapterPage
      slug="vla"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={vlaDoubts}
      related={t.related}
    />
  );
}
