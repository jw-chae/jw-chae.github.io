/** Registry of study chapters: drives the index page, the per-chapter kicker, and prev/next links. */

export type StudySection = {
  id: string;
  num: string;
  kicker: string;
  question: string;      // 이 절이 답하는 질문
  steps: string[];       // 답에 이르는 짧은 단락들
  formula: string;       // LaTeX, 줄바꿈은 \n
  takeaway: string;      // 한 줄 결론
  see: string;           // 그림에서 직접 확인할 것
};

export type Chapter = {
  slug: string;
  num: string;
  title: string;
  desc: string;
  href: string;
  tags: string[];
  figures: number;       // 직접 만져 볼 수 있는 그림 수 (0이면 표시하지 않음)
  external?: boolean;    // Study 밖의 페이지로 나가는 항목
};

export const chapters: Chapter[] = [
  {
    slug: "cnn", num: "01", title: "CNN은 어떻게 이미지를 보는가",
    desc: "작은 숫자표 하나를 사진 위에서 미끄러뜨리는 것이 전부다. 왜 모든 픽셀을 한꺼번에 연결하지 않는지, stride와 padding, 층을 쌓으면 넓게 보이는 이유, pooling이 버리는 것, 경계가 모서리가 되고 답이 되기까지.",
    href: "/study/cnn/", tags: ["convolution", "receptive field", "pooling"], figures: 7,
  },
  {
    slug: "resnet50", num: "02", title: "ResNet-50, 처음 보는 사람을 위해",
    desc: "CNN을 50층까지 쌓으려면 무엇이 필요했나. 왜 공간은 줄이고 채널은 늘리나, 왜 1×1 → 3×3 → 1×1인가, 점선 shortcut은 왜 있나, BatchNorm은 무엇을 맞추나.",
    href: "/study/resnet50/", tags: ["bottleneck", "skip connection", "BatchNorm"], figures: 7,
  },
  {
    slug: "transformer", num: "03", title: "Transformer는 어떻게 작동하는가",
    desc: "이미지를 조각 내 토큰으로 만들고, 토큰끼리 서로를 참고하게 한다. attention 한 번의 계산, head가 여러 개인 이유, 순서 정보가 따로 필요한 이유, 블록 하나의 흐름, CNN과 다른 점.",
    href: "/study/transformer/", tags: ["patch token", "self-attention", "ViT"], figures: 6,
  },
  {
    slug: "anomaly", num: "04", title: "Memory-bank anomaly detection",
    desc: "위에서 만든 토큰 위에서 정상 증거를 어떻게 모으고, 남기고, 믿는가. 연구 페이지로 이어진다.",
    href: "/anomaly/", tags: ["DINOv2", "memory bank"], figures: 0, external: true,
  },
];

export const chapterBySlug = (slug: string) => chapters.find((c) => c.slug === slug)!;

export function neighbors(slug: string): { prev?: Chapter; next?: Chapter } {
  const i = chapters.findIndex((c) => c.slug === slug);
  return { prev: i > 0 ? chapters[i - 1] : undefined, next: i < chapters.length - 1 ? chapters[i + 1] : undefined };
}

export const studyIndexCopy = {
  kicker: "Study",
  title: "기초부터 다시, 눈으로",
  sub: "논문을 쓰면서 당연하게 넘긴 것들을 하나씩 다시 세운다. 각 챕터는 처음 보는 사람 기준으로 \"왜?\"를 묻고, 그 답을 직접 만져 볼 수 있는 그림으로 되어 있다. 위에서부터 차례로 읽으면 이어진다.",
  figures: "그림",
  read: "읽기",
  out: "연구 페이지로",
};

export const chapterLabels = { see: "그림에서 볼 것", takeaway: "한 줄로", toc: "이 챕터의 질문", prev: "이전 챕터", next: "다음 챕터", index: "챕터 목록" };
