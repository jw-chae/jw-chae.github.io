"use client";

import type { ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { repCopy as t } from "./rep-copy";
import { repDoubts } from "./rep-doubts";
import { BnScene, BranchScene, MergeScene } from "./rep-scenes";
import { LsScene, PbScene, RepvggScene, RepvitScene, WhyScene } from "./rep-scenes2";

const scenes: Record<string, () => ReactNode> = {
  branches: () => <BranchScene />,
  merge: () => <MergeScene />,
  bn: () => <BnScene />,
  repvgg: () => <RepvggScene />,
  why: () => <WhyScene />,
  repvit: () => <RepvitScene />,
  pbconv: () => <PbScene />,
  lsnet: () => <LsScene />,
};

export function RepPage() {
  return (
    <ChapterPage
      slug="reparam"
      title={t.title}
      sub={t.sub}
      prologue={t.prologue}
      sections={t.sections}
      scenes={scenes}
      doubts={repDoubts}
    />
  );
}
