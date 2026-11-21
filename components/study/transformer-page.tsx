"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { tfCopy as t } from "./tf-copy";
import { tfDoubts } from "./tf-doubts";
import { AttentionScene, BlockScene, HeadsScene, OrderScene } from "./tf-scenes";
import { EmbedScene, EncDecScene, MaskScene, OutputScene, PositionScene, RnnFadeScene } from "./tf-scenes2";

const scenes: Record<string, () => ReactNode> = {
  rnn: () => <RnnFadeScene />,
  embed: () => <EmbedScene />,
  attention: () => <AttentionScene />,
  heads: () => <HeadsScene />,
  order: () => <OrderScene />,
  posenc: () => <PositionScene />,
  block: () => <BlockScene />,
  mask: () => <MaskScene />,
  encdec: () => <EncDecScene />,
  output: () => <OutputScene />,
};

export function TransformerPage() {
  return <ChapterPage slug="transformer" title={t.title} sub={t.sub} prologue={t.prologue} sections={t.sections} scenes={scenes} doubts={tfDoubts} />;
}
