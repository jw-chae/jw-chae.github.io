"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { cmpCopy as t } from "./cmp-copy";
import { cmpDoubts } from "./cmp-doubts";
import { FeatureScene, LabelScene, LossScene, TempScene } from "./cmp-scenes";
import { CaitScene, ChannelScene, PcbScene, QatScene, QuantScene } from "./cmp-scenes2";

const scenes: Record<string, () => ReactNode> = {
  label: () => <LabelScene />,
  temp: () => <TempScene />,
  loss: () => <LossScene />,
  feature: () => <FeatureScene />,
  dinopcb: () => <PcbScene />,
  cait: () => <CaitScene />,
  quant: () => <QuantScene />,
  channel: () => <ChannelScene />,
  qat: () => <QatScene />,
};

export function CmpPage() {
  return (
    <ChapterPage
      slug="compress"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={cmpDoubts}
      related={t.related}
    />
  );
}
