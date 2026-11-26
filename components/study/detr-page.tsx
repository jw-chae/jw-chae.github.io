"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { detrCopy as t } from "./detr-copy";
import { detrDoubts } from "./detr-doubts";
import { DedupScene, MatchScene, QueryScene, SetScene, TokenScene } from "./detr-scenes";
import { CostScene, DeformScene, LaterScene, SfodScene } from "./detr-scenes2";

const scenes: Record<string, () => ReactNode> = {
  set: () => <SetScene />,
  tokens: () => <TokenScene />,
  query: () => <QueryScene />,
  match: () => <MatchScene />,
  dedup: () => <DedupScene />,
  cost: () => <CostScene />,
  deform: () => <DeformScene />,
  later: () => <LaterScene />,
  sfod: () => <SfodScene />,
};

export function DetrPage() {
  return (
    <ChapterPage
      slug="detr"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={detrDoubts}
      related={t.related}
    />
  );
}
