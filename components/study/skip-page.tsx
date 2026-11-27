"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { skipCopy as t } from "./skip-copy";
import { skipDoubts } from "./skip-doubts";
import { BalanceScene, CountScene, MaskScene, RouteScene } from "./skip-scenes";
import { CacheScene, PostScene } from "./skip-scenes2";

// CartesianMoE, DSMoE and RA-CFGCache are folded into the doubts of 04 and 06; their scenes (CartScene, DenseScene, CfgScene) are no longer shown.
const scenes: Record<string, () => ReactNode> = {
  route: () => <RouteScene />,
  count: () => <CountScene />,
  balance: () => <BalanceScene />,
  mask: () => <MaskScene />,
  cache: () => <CacheScene />,
  postcache: () => <PostScene />,
};

export function SkipPage() {
  return (
    <ChapterPage
      slug="skip"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={skipDoubts}
      related={t.related}
    />
  );
}
