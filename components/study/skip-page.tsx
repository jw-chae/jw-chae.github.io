"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { skipCopy as t } from "./skip-copy";
import { skipDoubts } from "./skip-doubts";
import { BalanceScene, CartScene, CountScene, DenseScene, MaskScene, RouteScene } from "./skip-scenes";
import { CacheScene, CfgScene, PostScene } from "./skip-scenes2";

const scenes: Record<string, () => ReactNode> = {
  route: () => <RouteScene />,
  count: () => <CountScene />,
  balance: () => <BalanceScene />,
  mask: () => <MaskScene />,
  cartesian: () => <CartScene />,
  dense: () => <DenseScene />,
  cache: () => <CacheScene />,
  postcache: () => <PostScene />,
  cfgcache: () => <CfgScene />,
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
