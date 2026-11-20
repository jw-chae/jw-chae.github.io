/** Registry of study chapters: drives the index page, the per-chapter kicker, and prev/next links. */

/** One section tells a three-part story, then points at the figure and hands over to the next question. */
export type StudySection = {
  id: string;
  num: string;
  kicker: string;
  question: string;      // 이 절이 답하는 질문
  story: {
    origin: string[];    // 왜 나왔나: 그 전에는 어떻게 했고 무엇이 막혔나
    need: string[];      // 왜 필요한가: 무엇이 있어야 풀리나
    how: string[];       // 무엇을 어떻게 했나
  };
  analogy: string;       // 일상의 비유 한 단락
  formula: string;       // LaTeX, 줄바꿈은 \n
  takeaway: string;      // 한 줄 결론
  see: string;           // 그림에서 직접 확인할 것
  bridge: string;        // 다음 절로 넘어가는 질문
};

export type Prologue = {
  title: string;
  paragraphs: string[];
  timeline: { year: string; text: string }[];
};

export type Chapter = {
  slug: string;
  num: string;
  era: string;           // 개념이 등장한 해
  title: string;
  desc: string;
  href: string;
  tags: string[];
  figures: number;       // 직접 만져 볼 수 있는 그림 수 (0이면 표시하지 않음)
  external?: boolean;    // Study 밖의 페이지로 나가는 항목
};

export const chapters: Chapter[] = [
  {
    slug: "cnn", num: "01", era: "1989 · 2012", title: "CNN은 어떻게 이미지를 보는가",
    desc: "컴퓨터에게 사진은 숫자 15만 개일 뿐이다. 고양이가 한 뼘만 옮겨 가도 숫자가 전부 바뀐다. 뇌의 시각 세포에서 실마리를 얻어, 작은 돋보기 하나로 사진 전체를 훑는 구조가 나오기까지.",
    href: "/study/cnn/", tags: ["convolution", "receptive field", "pooling"], figures: 7,
  },
  {
    slug: "resnet50", num: "02", era: "2015", title: "ResNet-50은 어떻게 50층을 쌓았나",
    desc: "깊게 쌓을수록 좋다고 믿었는데, 56층이 20층보다 못했다. \"아무것도 하지 않기\"를 기본값으로 만든 선 하나가 그것을 풀었다. 그 설계도를 처음부터 읽는다.",
    href: "/study/resnet50/", tags: ["bottleneck", "skip connection", "BatchNorm"], figures: 7,
  },
  {
    slug: "unet", num: "03", era: "2015", title: "U-Net은 왜 U자 모양인가",
    desc: "답이 한 단어가 아니라 그림이어야 할 때. 넓게 보면 경계가 뭉개지고 좁게 보면 잡음에 속는다. 줄였다가 키우고, 그 사이에 다리를 놓아 둘 다 얻는다.",
    href: "/study/unet/", tags: ["segmentation", "encoder-decoder", "skip connection"], figures: 6,
  },
  {
    slug: "transformer", num: "04", era: "2017 · 2020", title: "Transformer는 어떻게 작동하는가",
    desc: "한 단어씩 차례로 읽던 기계는 앞 내용을 잊었고 느렸다. 차례를 버리고 모든 토큰이 서로를 한 번에 보게 한 구조가, 사진을 조각 내면서 이미지까지 넘어왔다.",
    href: "/study/transformer/", tags: ["patch token", "self-attention", "ViT"], figures: 6,
  },
  {
    slug: "anomaly", num: "05", era: "지금", title: "Memory-bank anomaly detection",
    desc: "위에서 만든 토큰 위에서 정상 증거를 어떻게 모으고, 남기고, 믿는가. 내 연구 페이지로 이어진다.",
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
  sub: "논문을 쓰면서 당연하게 넘긴 것들을 하나씩 다시 세운다. 챕터는 개념이 세상에 나온 순서대로 놓았다. 각 챕터는 \"그 전에는 무엇이 안 됐나\"에서 시작해, 왜 필요했고 무엇을 어떻게 했는지를 차례로 따라간다. 설명마다 직접 만져 볼 수 있는 그림이 붙어 있다.",
  figures: "그림",
  read: "읽기",
  out: "연구 페이지로",
};

export const chapterLabels = {
  see: "그림에서 볼 것", takeaway: "한 줄로", toc: "이 챕터의 질문", prev: "이전 챕터", next: "다음 챕터", index: "챕터 목록",
  origin: "왜 나왔나", need: "왜 필요한가", how: "무엇을 어떻게 했나", analogy: "비유", bridge: "다음 질문",
};
