"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { resnetCopy as t } from "./resnet50-copy";
import { resnet50Doubts } from "./resnet50-doubts";
import { BatchNormScene, BlockOrderScene, BottleneckScene, ConvBasicsScene, OneByOneScene, ShapeFlowScene, SkipScene } from "./resnet50-scenes";
import { ChainScene, OneLayerScene, TrainScene, TrunkScene } from "./resnet50-walk-scenes";

const scenes: Record<string, () => ReactNode> = {
  one: () => <OneLayerScene />,
  chain: () => <ChainScene />,
  train: () => <TrainScene />,
  basics: () => <ConvBasicsScene />,
  flow: () => <ShapeFlowScene />,
  bottleneck: () => <BottleneckScene />,
  onebyone: () => <OneByOneScene />,
  trunk: () => <TrunkScene />,
  skip: () => <SkipScene />,
  bn: () => <BatchNormScene />,
  block: () => <BlockOrderScene />,
};

export function ResNet50Page() {
  return (
    <ChapterPage
      slug="resnet50"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={resnet50Doubts}
      related={t.related}
      heroExtra={(
        <>
          <div className="st-rules" role="list">
            {t.rules.map((r, i) => (
              <div className="st-rule" role="listitem" key={r}><span>{i + 1}</span>{r}</div>
            ))}
          </div>
          <p className="st-depth">
            {t.depth.parts.map((p, i) => <b key={i}>{p}</b>)}
            <em>{t.depth.text}</em>
          </p>
        </>
      )}
    />
  );
}
