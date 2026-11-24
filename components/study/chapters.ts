/** Registry of study chapters: drives the index page, the per-chapter kicker, and prev/next links. */

/** One section tells a three-part story, then points at the figure and hands over to the next question. */
export type StudySection = {
  id: string;
  num: string;
  kicker: string;
  question: string;
  story?: {
    origin: string[];
    need: string[];
    how: string[];
  };
  lead?: string[];                          // walk form: where the reader stands before the first step
  walk?: { q: string; a: string[] }[];      // walk form: each answer raises the next question
  analogy?: string;
  formula?: string;      // LaTeX, newline = 

  symbols?: string[];    // each symbol of the formula tied back to the scene
  takeaway: string;
  see: string;
  bridge: string;
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
    slug: "transformer", num: "04", era: "2017", title: "Transformer는 어떻게 작동하는가",
    desc: "한 단어씩 차례로 읽던 기계는 앞 내용을 잊었고 느렸다. 차례를 버리고 모든 토큰이 서로를 한 번에 보게 한 구조를, 단어를 숫자로 바꾸는 데서부터 마지막에 단어가 나오는 곳까지 부품 하나씩 조립한다.",
    href: "/study/transformer/", tags: ["self-attention", "positional encoding", "encoder-decoder"], figures: 14,
  },
  {
    slug: "vit", num: "05", era: "2020 · 2023", title: "ViT는 사진을 어떻게 읽나",
    desc: "문장을 위해 만든 구조에 사진을 잘라 넣었다. 조각 토큰, 요약 토큰, 평면에서의 자리, 라벨 없이 학습하는 DINO, 그리고 그 토큰으로 결함을 찾는 원리까지.",
    href: "/study/vit/", tags: ["patch token", "DINOv2", "memory bank"], figures: 8,
  },
  {
    slug: "llm", num: "06", era: "2018 · 2022", title: "LLM은 어떻게 글을 쓰나",
    desc: "다음에 올 토큰의 확률을 맞히는 놀이가 전부다. 토큰을 쪼개는 법, 번역기의 절반만 떼어 낸 구조, 확률에서 고르는 법, 그럴듯한 거짓말이 나오는 이유, 그리고 왜 거대해야 하는지.",
    href: "/study/llm/", tags: ["next token", "BPE", "sampling"], figures: 6,
  },
  {
    slug: "diffusion", num: "07", era: "2015 · 2020", title: "Diffusion 모델은 어떻게 그림을 만드나",
    desc: "그림을 망가뜨리기는 쉽고 되살리기는 어렵다. 잡음을 조금씩 섞는 길을 정해 두고 그 길을 한 걸음씩 거꾸로 걷는 법을 배운다. 분포, 가우시안, 베이즈 규칙 같은 확률 기초부터 시작한다.",
    href: "/study/diffusion/", tags: ["확률 기초", "DDPM", "guidance"], figures: 7,
  },
  {
    slug: "generative", num: "08", era: "2021 · 2026", title: "요즘 모델은 어떻게 그런 그림과 영상을 뽑나",
    desc: "2020년의 diffusion에서 나노바나나, GPT Image 2, Sora까지는 부품을 다섯 번쯤 갈아 끼운 거리다. 압축된 공간, Transformer, 직선 길, 글을 읽는 눈, 그리고 LLM이 직접 그리는 것. 영상은 거기에 시간 축을 더한다.",
    href: "/study/generative/", tags: ["latent", "DiT", "video"], figures: 7,
  },
  {
    slug: "lora", num: "09", era: "2021 · 2023", title: "LoRA는 거대 모델을 어떻게 싸게 고쳐 쓰나",
    desc: "모델이 너무 커져서 내 일에 맞게 고쳐 쓸 수가 없게 됐다. 모델은 한 글자도 고치지 않고, 바뀌어야 할 양만 작은 표 두 장으로 적어 덧붙인다. 행렬과 랭크의 기초부터 시작해 합치기와 QLoRA까지.",
    href: "/study/lora/", tags: ["행렬 기초", "low-rank", "QLoRA"], figures: 8,
  },
  {
    slug: "anomaly", num: "10", era: "지금", title: "Memory-bank anomaly detection",
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
  origin: "왜 나왔나", need: "왜 필요한가", how: "무엇을 어떻게 했나", analogy: "비유", bridge: "다음 질문", doubts: "여기서 드는 의문",
};
