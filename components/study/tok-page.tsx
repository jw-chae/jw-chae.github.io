"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { tokCopy as t } from "./tok-copy";
import { tokDoubts } from "./tok-doubts";
import { CostScene, MergeScene, PruneScene, VtcScene } from "./tok-scenes";
import { FastVidScene, KvScene, PrefixScene } from "./tok-scenes2";

const scenes: Record<string, () => ReactNode> = {
  cost: () => <CostScene />,
  prune: () => <PruneScene />,
  merge: () => <MergeScene />,
  vtc: () => <VtcScene />,
  fastvid: () => <FastVidScene />,
  kv: () => <KvScene />,
  prefixkv: () => <PrefixScene />,
};

export function TokensPage() {
  return (
    <ChapterPage
      slug="tokens"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={tokDoubts}
      related={t.related}
    />
  );
}
