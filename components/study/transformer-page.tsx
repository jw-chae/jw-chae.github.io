"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { tfCopy as t } from "./tf-copy";
import { AttentionScene, BlockScene, CompareScene, HeadsScene, OrderScene, PatchScene } from "./tf-scenes";

const scenes: Record<string, () => ReactNode> = {
  patch: () => <PatchScene />,
  attention: () => <AttentionScene />,
  heads: () => <HeadsScene />,
  order: () => <OrderScene />,
  block: () => <BlockScene />,
  compare: () => <CompareScene />,
};

export function TransformerPage() {
  return <ChapterPage slug="transformer" title={t.title} sub={t.sub} sections={t.sections} scenes={scenes} related={t.related} />;
}
