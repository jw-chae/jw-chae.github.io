"use client";

import { useState, type ReactNode } from "react";
import { ChapterPage } from "./chapter-page";
import { repCopy as t } from "./rep-copy";
import { repDoubts } from "./rep-doubts";
import { BnScene, BranchScene, MergeScene } from "./rep-scenes";
import { LsScene, PbScene, RepvggScene, RepvitScene, WhyScene } from "./rep-scenes2";

/** Section 06 covers RepViT and PBConv: one tab row above the scene picks which paper's figure is shown. */
function ReachScene() {
  const [k, setK] = useState(0);
  const T = t.ui.reach;
  return (
    <div>
      <div className="ad-tabs" role="tablist" aria-label={T.paper} style={{ margin: "0 0 0.7rem" }}>
        {T.tabs.map((name, i) => (
          <button key={name} type="button" role="tab" aria-selected={k === i} className={k === i ? "on" : ""} onClick={() => setK(i)}>{name}</button>
        ))}
      </div>
      {k === 0 ? <RepvitScene /> : <PbScene />}
    </div>
  );
}

const scenes: Record<string, () => ReactNode> = {
  branches: () => <BranchScene />,
  merge: () => <MergeScene />,
  bn: () => <BnScene />,
  repvgg: () => <RepvggScene />,
  why: () => <WhyScene />,
  repvit: () => <ReachScene />,
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
