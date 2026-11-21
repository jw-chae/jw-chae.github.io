"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { genCopy as t } from "./gen-copy";
import { genDoubts } from "./gen-doubts";
import { ClipScene, DitScene, FlowScene, LatentScene, NativeScene, TextScene, VideoScene } from "./gen-scenes";

const scenes: Record<string, () => ReactNode> = {
  latent: () => <LatentScene />,
  dit: () => <DitScene />,
  flow: () => <FlowScene />,
  text: () => <TextScene />,
  native: () => <NativeScene />,
  video: () => <VideoScene />,
  clip: () => <ClipScene />,
};

export function GenPage() {
  return (
    <ChapterPage
      slug="generative"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={genDoubts}
      related={t.related}
    />
  );
}
