"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { tfCopy as t } from "./tf-copy";
import { tfDoubts } from "./tf-doubts";
import { tfWalkDoubts } from "./tf-walk-copy";
import { LearnScene, QkvScene, TranslateScene, TwoHeadScene } from "./tf-walk-scenes";
import { MatrixScene, SelfReadScene, WordOrderScene } from "./tf-rest-scenes";
import { BlockScene } from "./tf-scenes";
import { EmbedScene, EncDecScene, MaskScene, OutputScene, PositionScene, RnnFadeScene } from "./tf-scenes2";

const scenes: Record<string, () => ReactNode> = {
  hand: () => <TranslateScene />,
  where: () => <QkvScene />,
  twohead: () => <TwoHeadScene />,
  learn: () => <LearnScene />,
  rnn: () => <RnnFadeScene />,
  embed: () => <EmbedScene />,
  attention: () => <SelfReadScene />,
  heads: () => <MatrixScene />,
  order: () => <WordOrderScene />,
  posenc: () => <PositionScene />,
  block: () => <BlockScene />,
  mask: () => <MaskScene />,
  encdec: () => <EncDecScene />,
  output: () => <OutputScene />,
};

export function TransformerPage() {
  return <ChapterPage slug="transformer" title={t.title} sub={t.sub} prologue={t.prologue} sections={t.sections} scenes={scenes} doubts={{ ...tfWalkDoubts, ...tfDoubts }} />;
}
