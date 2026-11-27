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
    slug: "linalg", num: "01", era: "기초", title: "신경망은 왜 행렬 곱인가: 벡터, 내적, 랭크, SVD",
    desc: "고양이 머리 그림을 숫자 표로 놓고 파란 눈 한 칸을 벡터로 따라간다. 두 칸을 비교하는 내적과 코사인, 층 하나인 행렬 곱, 층이 보지 못하는 방향인 랭크, 그림을 얇은 장 몇 개로 다시 쌓는 SVD와 가장 크게 퍼진 방향을 찾는 PCA까지.",
    href: "/study/linalg/", tags: ["vector", "matrix", "SVD"], figures: 7,
  },
  {
    slug: "probability", num: "02", era: "기초", title: "모델은 왜 확률을 내놓나: 분포, 베이즈, 최대우도",
    desc: "고양이 그림을 256칸으로 나누고 어두운 칸 하나를 집는다. 어둡다는 것만 알 때 귀일 몫은 얼마인지에서 출발해 softmax, 조건부 확률과 베이즈, 평균과 분산, 가우시안과 최대우도, 교차 엔트로피와 KL까지 같은 칸들 위에서 센다.",
    href: "/study/probability/", tags: ["probability", "Bayes", "likelihood"], figures: 8,
  },
  {
    slug: "loss", num: "03", era: "기초", title: "손실 함수는 왜 그 모양인가: 교차 엔트로피에서 focal loss까지",
    desc: "고양이와 컵 그림 한 장에서 고양이의 이름과 상자가 손실에 보태는 숫자와 그 기울기를 따라간다. 교차 엔트로피가 왜 음의 로그 우도이고 틀린 답을 세게 미는지, 잘못 친 정답 앞의 Huber, 배경 후보 12만 개 앞의 focal loss, label smoothing, 짝으로 배우는 손실, 여러 손실 더하기까지.",
    href: "/study/loss/", tags: ["cross-entropy", "MSE", "focal loss"], figures: 8,
  },
  {
    slug: "cnn", num: "04", era: "1989 · 2012", title: "CNN은 어떻게 이미지를 보는가",
    desc: "컴퓨터에게 사진은 숫자 15만 개일 뿐이다. 고양이가 한 뼘만 옮겨 가도 숫자가 전부 바뀐다. 뇌의 시각 세포에서 실마리를 얻어, 작은 돋보기 하나로 사진 전체를 훑는 구조가 나오기까지.",
    href: "/study/cnn/", tags: ["convolution", "receptive field", "pooling"], figures: 10,
  },
  {
    slug: "resnet50", num: "05", era: "2015", title: "ResNet-50은 어떻게 50층을 쌓았나",
    desc: "깊게 쌓을수록 좋다고 믿었는데, 56층이 20층보다 못했다. \"아무것도 하지 않기\"를 기본값으로 만든 선 하나가 그것을 풀었다. 그 설계도를 처음부터 읽는다.",
    href: "/study/resnet50/", tags: ["bottleneck", "skip connection", "BatchNorm"], figures: 11,
  },
  {
    slug: "unet", num: "06", era: "2015", title: "U-Net은 왜 U자 모양인가",
    desc: "답이 한 단어가 아니라 그림이어야 할 때. 넓게 보면 경계가 뭉개지고 좁게 보면 잡음에 속는다. 줄였다가 키우고, 그 사이에 다리를 놓아 둘 다 얻는다.",
    href: "/study/unet/", tags: ["segmentation", "encoder-decoder", "skip connection"], figures: 10,
  },
  {
    slug: "transformer", num: "07", era: "2017", title: "Transformer는 어떻게 작동하는가",
    desc: "한 단어씩 차례로 읽던 기계는 앞 내용을 잊었고 느렸다. 차례를 버리고 모든 토큰이 서로를 한 번에 보게 한 구조를, 단어를 숫자로 바꾸는 데서부터 마지막에 단어가 나오는 곳까지 부품 하나씩 조립한다.",
    href: "/study/transformer/", tags: ["self-attention", "positional encoding", "encoder-decoder"], figures: 14,
  },
  {
    slug: "vit", num: "08", era: "2020 · 2023", title: "ViT는 사진을 어떻게 읽나",
    desc: "문장을 위해 만든 구조에 사진을 잘라 넣었다. 조각 토큰, 요약 토큰, 평면에서의 자리, 라벨 없이 학습하는 DINO, 그리고 그 토큰으로 결함을 찾는 원리까지.",
    href: "/study/vit/", tags: ["patch token", "DINOv2", "memory bank"], figures: 9,
  },
  {
    slug: "llm", num: "09", era: "2018 · 2022", title: "LLM은 어떻게 글을 쓰나",
    desc: "다음에 올 토큰의 확률을 맞히는 놀이가 전부다. 토큰을 쪼개는 법, 번역기의 절반만 떼어 낸 구조, 확률에서 고르는 법, 그럴듯한 거짓말이 나오는 이유, 그리고 왜 거대해야 하는지.",
    href: "/study/llm/", tags: ["next token", "BPE", "sampling"], figures: 9,
  },
  {
    slug: "diffusion", num: "10", era: "2015 · 2020", title: "Diffusion 모델은 어떻게 그림을 만드나",
    desc: "그림을 망가뜨리기는 쉽고 되살리기는 어렵다. 잡음을 조금씩 섞는 길을 정해 두고 그 길을 한 걸음씩 거꾸로 걷는 법을 배운다. 분포, 가우시안, 베이즈 규칙 같은 확률 기초부터 시작한다.",
    href: "/study/diffusion/", tags: ["확률 기초", "DDPM", "guidance"], figures: 7,
  },
  {
    slug: "generative", num: "11", era: "2021 · 2026", title: "Latent diffusion에서 Sora까지: 이미지·영상 생성 모델의 구조",
    desc: "2020년의 diffusion에서 나노바나나, GPT Image 2, Sora까지는 부품을 다섯 번쯤 갈아 끼운 거리다. 압축된 공간, Transformer, 직선 길, 글을 읽는 눈, 그리고 LLM이 직접 그리는 것. 영상은 거기에 시간 축을 더한다.",
    href: "/study/generative/", tags: ["latent", "DiT", "video"], figures: 7,
  },
  {
    slug: "lora", num: "12", era: "2021 · 2023", title: "LoRA는 거대 모델을 어떻게 싸게 고쳐 쓰나",
    desc: "모델이 너무 커져서 내 일에 맞게 고쳐 쓸 수가 없게 됐다. 모델은 한 글자도 고치지 않고, 바뀌어야 할 양만 작은 표 두 장으로 적어 덧붙인다. 행렬과 랭크의 기초부터 시작해 합치기와 QLoRA까지.",
    href: "/study/lora/", tags: ["행렬 기초", "low-rank", "QLoRA"], figures: 11,
  },
  {
    slug: "efficiency", num: "13", era: "기초", title: "빠른 모델은 무엇으로 재나",
    desc: "파라미터 수, 곱셈-덧셈 수, 옮기는 바이트, 지연 시간, 처리량은 서로 다른 숫자이고 자주 어긋난다. ResNet-50의 3×3 conv 하나를 직접 세고 손으로 정한 장치에서 시간을 계산한 뒤, 곱셈이 적은데 느린 경우가 왜 생기는지 따라간다. 그 말로 RepViT와 YOLOv10의 표를 읽는다.",
    href: "/study/efficiency/", tags: ["FLOPs", "latency", "roofline"], figures: 8,
  },
  {
    slug: "reparam", num: "14", era: "2021 · 2025", title: "학습할 때와 쓸 때 모양이 다른 모델: RepVGG에서 LSNet까지",
    desc: "학습할 때는 갈래가 셋인 블록이 배우고, 쓸 때는 그것을 3×3 conv 하나로 바꿔 돌린다. 5×5 사진 한 장에서 세 갈래와 BatchNorm을 커널 하나로 접는 계산을 손으로 한 뒤 RepVGG, RepViT, PBConv를 읽고, 자리마다 커널이 달라지는 LSNet에서 합치기가 멈추는 곳까지 간다.",
    href: "/study/reparam/", tags: ["re-parameterization", "RepViT", "LSNet"], figures: 8,
  },
  {
    slug: "yolo", num: "15", era: "2016 · 2025", title: "실시간 검출은 어떻게 빨라졌나: YOLO에서 YOLOv10까지",
    desc: "사진 한 장에서 물체 여럿의 상자와 이름을 한 번에 낸다. 고양이와 컵이 있는 사진 한 장으로 칸이 적는 숫자, IoU와 NMS를 손으로 계산하고, YOLOv10이 정답을 나눠 주는 규칙을 바꿔 NMS를 없앤 방법과 지연 시간을 줄인 설계를 따라간다.",
    href: "/study/yolo/", tags: ["detection", "NMS", "YOLOv10"], figures: 5,
  },
  {
    slug: "detr", num: "16", era: "2020 · 2025", title: "NMS 없이 물체를 세는 법: DETR",
    desc: "정해진 개수의 슬롯에 답을 집합으로 쓰고, 물체가 없는 슬롯은 \"없음\"을 적는다. 고양이와 컵 사진 한 장으로 슬롯 하나가 토큰 25개를 읽는 계산, 헝가리안 매칭의 비용 표, 슬롯끼리 읽어 중복을 줄이는 과정을 손으로 따라가고, 느린 학습과 작은 물체를 Deformable DETR, DINO, RT-DETR이 어떻게 줄였는지, FRANCK가 정답 없는 새 환경에서 같은 짝짓기를 어떻게 쓰는지 본다.",
    href: "/study/detr/", tags: ["DETR", "set prediction", "Hungarian matching"], figures: 9,
  },
  {
    slug: "openvocab", num: "17", era: "2021 · 2025", title: "이름을 미리 정하지 않고 찾기: 열린 어휘 검출",
    desc: "학습 때 정한 이름만 찾던 검출기가 쓸 때 처음 받은 이름도 찾게 됐다. 사진과 설명글의 짝으로 두 인코더를 맞추는 CLIP의 loss를 짝 세 개로 손으로 계산하고, 그 비교를 칸마다 하는 머리, 이름을 사진과 섞는 YOLO-World와 Grounding DINO, 쓸 때는 비용을 합성곱 하나로 접어 넣는 YOLOE까지 같은 고양이 그림으로 따라간다.",
    href: "/study/openvocab/", tags: ["open vocabulary", "CLIP", "YOLOE"], figures: 7,
  },
  {
    slug: "tokens", num: "18", era: "2022 · 2025", title: "토큰을 덜 쓰면 얼마나 빨라지나: 가지치기와 합치기",
    desc: "토큰 수를 반으로 줄이면 계산은 대개 반쯤 준다. 무엇을 버리고 무엇을 합칠지가 남는다. [CLS]가 보는 곳으로 고르는 법, 비슷한 토큰을 평균 내는 법, 영상을 장면 단위로 끊는 법, KV 캐시를 층마다 다르게 줄이는 법.",
    href: "/study/tokens/", tags: ["token pruning", "token merging", "KV cache"], figures: 8,
  },
  {
    slug: "attention", num: "19", era: "2019 · 2024", title: "Attention은 왜 N²이고, 어떻게 줄이나",
    desc: "고양이 그림을 2048픽셀까지 키우면 점수 표가 계산과 메모리를 다 먹는다. 눈 조각 하나의 점수 한 줄을 따라가며 FlashAttention, 창과 드문 패턴, Linformer, linear attention, GQA가 각각 무엇을 아끼고 무엇을 잃는지 센다.",
    href: "/study/attention/", tags: ["attention", "FlashAttention", "linear attention"], figures: 9,
  },
  {
    slug: "compress", num: "20", era: "2015 · 2026", title: "큰 모델을 작게: 증류와 양자화",
    desc: "큰 모델의 답을 작은 모델에게 베끼게 하는 증류, 숫자를 적는 비트를 줄이는 양자화. 고양이 사진 한 장의 세 확률에서 학생이 라벨에 없는 무엇을 베끼는지, 가중치 하나가 float 값, 저장된 정수, 되돌린 값으로 어떻게 갈라지는지 계산하고 DINO-PCB, CAIT, Quantized Prompt로 간다.",
    href: "/study/compress/", tags: ["distillation", "quantization"], figures: 9,
  },
  {
    slug: "pruning", num: "21", era: "1989 · 2023", title: "가중치를 0으로: 가지치기, 그리고 증류·양자화와 무엇이 다른가",
    desc: "고양이 머리 그림의 색으로 부위를 맞히는 작은 망을 실제로 학습시키고, 가중치를 0으로 적을 때 눈 칸 하나의 답이 어떻게 바뀌는지 따라간다. 흩어진 0이 GPU에서 빨라지지 않는 이유, 필터째 지우기, LLM 가지치기, 그리고 양자화·증류와 나란히 놓고 고르는 법까지.",
    href: "/study/pruning/", tags: ["pruning", "sparsity", "lottery ticket"], figures: 9,
  },
  {
    slug: "skip", num: "22", era: "2017 · 2026", title: "매번 다 계산하지 않기: MoE와 diffusion 캐싱",
    desc: "토큰마다 전문가 몇만 계산하는 MoE, 이웃한 걸음의 계산을 다시 쓰는 diffusion 캐싱. 토큰 하나와 점 하나를 손으로 따라가며 건너뛰어도 답이 거의 그대로인 때와 오차가 쌓이는 때를 본다. MaskMoE, CartesianMoE, DSMoE, PoSTCache, RA-CFGCache까지.",
    href: "/study/skip/", tags: ["mixture of experts", "diffusion cache"], figures: 9,
  },
  {
    slug: "anomaly", num: "23", era: "지금", title: "Memory-bank anomaly detection",
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
  sub: "논문을 쓰면서 당연하게 넘긴 것들을 하나씩 다시 세운다. 앞의 세 챕터는 모든 챕터가 기대는 선형대수, 확률, 손실 함수이고, 그 뒤의 챕터는 개념이 세상에 나온 순서대로 놓았다. 각 챕터는 \"그 전에는 무엇이 안 됐나\"에서 시작해, 왜 필요했고 무엇을 어떻게 했는지를 차례로 따라간다. 설명마다 직접 만져 볼 수 있는 그림이 붙어 있다.",
  figures: "그림",
  read: "읽기",
  out: "연구 페이지로",
};

export const chapterLabels = {
  see: "그림에서 볼 것", takeaway: "한 줄로", toc: "이 챕터의 질문", prev: "이전 챕터", next: "다음 챕터", index: "챕터 목록",
  origin: "왜 나왔나", need: "왜 필요한가", how: "무엇을 어떻게 했나", analogy: "비유", bridge: "다음 질문", doubts: "여기서 드는 의문",
};
