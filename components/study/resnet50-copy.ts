export type StudySection = {
  id: string;
  num: string;
  kicker: string;
  question: string;      // 이 절이 답하는 질문
  steps: string[];       // 답에 이르는 짧은 단락들 (계산 순서대로)
  formula: string;       // LaTeX, 줄바꿈은 \n
  takeaway: string;      // 한 줄 결론
  see: string;           // 그림에서 직접 확인할 것
};

export const resnetCopy = {
  kicker: "Study · 01",
  title: "ResNet-50, 세 가지 규칙의 반복",
  sub: "처음 보면 \"왜 이렇게 복잡하게 쌓았지?\" 싶은 그림이다. 원리를 알면 세 가지 규칙만 반복하는 구조이고, BatchNorm은 그 반복을 안정적으로 학습시키는 장치다. 아래 여섯 절은 각각 하나의 \"왜?\"에 답한다.",
  rules: ["공간 크기는 줄이고", "channel은 늘리고", "residual block을 반복한다"],
  depth: { parts: ["3", "4", "6", "3"], text: "block마다 conv가 3개씩 → (3 + 4 + 6 + 3) × 3 = 48개, 맨 앞 7×7 conv 하나와 마지막 FC 하나를 더해 50층. 그래서 ResNet-50이다." },
  sections: [
    {
      id: "flow", num: "01", kicker: "전체 흐름",
      question: "왜 공간은 줄이고 채널은 늘리나?",
      steps: [
        "입력 224×224×3이 7×7 stride-2 conv를 지나면 112×112×64, pooling을 지나면 56×56×64가 된다. 여기까지는 그냥 \"초기에 해상도를 줄이는\" 단계다.",
        "그 다음 residual stage 네 개를 지날 때마다 같은 일이 반복된다. H, W는 절반이 되고 C는 두 배가 된다. 56×56×256 → 28×28×512 → 14×14×1024 → 7×7×2048.",
        "왜 이렇게 하나. 공간을 줄이면 한 칸이 원본 이미지의 더 넓은 영역을 대표하게 된다(수용 영역이 커진다). 대신 그 넓은 영역을 설명하려면 더 많은 종류의 feature가 필요하니 채널을 늘린다. 즉 \"어디에\"의 정밀도를 \"무엇이\"의 풍부함과 맞바꾸는 것이다.",
        "마지막 7×7×2048은 위치를 아예 평균 내서 2048 벡터로 만들고(global average pooling) classifier에 넣는다. 분류에는 \"어디\"가 필요 없기 때문이다.",
      ],
      formula: "H,\\,W \\downarrow \\qquad C \\uparrow \\qquad\\qquad \\text{stage마다}\\ \\ H \\to \\tfrac{H}{2},\\quad C \\to 2C",
      takeaway: "공간은 점점 거칠어지고, 각 위치가 담는 feature의 종류는 점점 많아진다.",
      see: "상자 위에 마우스를 올리면 각 단계의 모양이 뜬다. PatchCore가 가져오는 layer2 = 512×28×28, layer3 = 1024×14×14는 외울 숫자가 아니라 이 규칙에서 자동으로 나오는 값이다.",
    },
    {
      id: "bottleneck", num: "02", kicker: "병목 블록",
      question: "왜 블록 안이 1×1 → 3×3 → 1×1 꼴인가?",
      steps: [
        "입력이 256채널이라고 하자. 그냥 3×3 conv로 256 → 256을 하면 파라미터가 3·3·256·256 = 589,824개다. 비싸다.",
        "그래서 먼저 1×1 conv로 채널을 256 → 64로 줄인다(16,384개). 진짜 공간 convolution인 3×3은 그 64채널에서만 한다(3·3·64·64 = 36,864개). 마지막에 1×1로 64 → 256으로 되돌린다(16,384개).",
        "합이 69,632개. naive 3×3의 8분의 1 수준이다. 256 → 64 → 64 → 256, 가운데가 좁아서 bottleneck이라 부른다.",
        "요점은 \"비싼 3×3은 좁은 채널에서만 하고, 싼 1×1로 앞뒤에서 채널을 줄였다 늘린다\"는 것이다. 표현력은 유지하면서 계산량을 통제한다.",
      ],
      formula: "\\underbrace{C\\cdot\\tfrac{C}{r}}_{1\\times1} \\;+\\; \\underbrace{9\\,(\\tfrac{C}{r})^2}_{3\\times3} \\;+\\; \\underbrace{\\tfrac{C}{r}\\cdot C}_{1\\times1} \\qquad\\text{vs}\\qquad \\underbrace{9\\,C^2}_{3\\times3\\ \\text{naive}}",
      takeaway: "1×1로 채널 압축 → 싼 3×3 공간 처리 → 다시 확장.",
      see: "입력 채널 C와 축소비 r을 바꾸면 세 conv의 파라미터와 절약 배수가 바로 바뀐다. ResNet-50의 기본은 r = 4이고, 256채널에서 약 8.5배 절약된다. C를 2048까지 올려도 배수는 그대로다. 절약이 C²에 비례하기 때문이다.",
    },
    {
      id: "onebyone", num: "03", kicker: "1×1 convolution",
      question: "왜 1×1 conv로 채널을 줄일 수 있나?",
      steps: [
        "1×1 kernel은 공간적으로 한 칸만 본다. 그러면 아무것도 못 볼 것 같지만, 그 한 칸의 모든 입력 채널을 본다.",
        "한 위치의 입력이 x ∈ ℝ²⁵⁶이면 1×1 filter 하나는 y = Σ_c w_c x_c, 즉 256개 채널의 가중합 하나를 만든다. filter가 64개면 ℝ²⁵⁶ → ℝ⁶⁴이다.",
        "그러니까 1×1 conv는 위치마다 같은 행렬 W ∈ ℝ^{64×256}을 곱하는 것이다. 공간을 섞는 게 아니라 채널을 섞고(mixing) 낮은 차원으로 보내는(projection) 연산이다.",
        "이웃 칸이 전혀 참여하지 않으므로 공간 정보는 그대로이고, 채널 수만 바뀐다. 그래서 02절에서 채널을 마음대로 줄였다 늘릴 수 있었다.",
      ],
      formula: "y(i,j) = W\\,x(i,j), \\qquad W \\in \\mathbb{R}^{K\\times C}, \\quad x(i,j) \\in \\mathbb{R}^{C}",
      takeaway: "1×1 conv = 위치마다 똑같이 적용되는 채널 방향 선형 변환.",
      see: "격자의 한 칸을 고르면 그 위치의 채널 벡터 x가 W의 한 행씩과 곱해져 출력 y_k가 만들어진다. 다른 칸은 아무 역할도 하지 않는다.",
    },
    {
      id: "skip", num: "04", kicker: "residual 연결",
      question: "왜 실선 shortcut과 점선 shortcut이 따로 있나?",
      steps: [
        "일반 블록은 x → F(x)를 배운다. ResNet은 y = F(x) + x를 배운다. 블록은 \"x에서 무엇을 고칠지\"만 배우면 되므로 아무것도 안 고치는 것(F = 0)이 쉬워지고, 층을 아무리 쌓아도 최소한 얕은 네트워크만큼은 한다.",
        "실선 shortcut은 x를 그대로 더한다. F(x)와 x의 모양이 같을 때만 가능하다.",
        "그런데 stage가 바뀌는 첫 블록에서는 main branch가 56×56×256을 28×28×512로 바꾼다. x는 아직 56×56×256이라 더할 수 없다. 모양이 다른 두 텐서는 더해지지 않는다.",
        "그래서 shortcut 쪽에도 1×1 conv stride 2를 하나 넣어 x를 28×28×512로 맞춘다. stride 2가 공간을 절반으로, 출력 채널 512가 채널을 두 배로 만든다. 그 뒤 F(x) + W_s x를 한다. 이것이 점선이다.",
      ],
      formula: "\\text{실선: } y = F(x) + x \\qquad\\qquad \\text{점선: } y = F(x) + W_s x,\\quad W_s = 1\\times1\\ \\text{conv},\\ \\text{stride } 2",
      takeaway: "실선 = 모양 같음 → identity. 점선 = 모양 다름 → projection으로 맞춤.",
      see: "토글을 \"stage 전환\"으로 바꾸면 shortcut 경로에 projection 노드가 생기고, 두 경로의 텐서 모양 라벨이 28×28×512로 일치하는 것이 보인다.",
    },
    {
      id: "bn", num: "05", kicker: "Batch Normalization",
      question: "왜 BatchNorm이 필요하고, 정확히 무엇을 정규화하나?",
      steps: [
        "어떤 채널의 activation은 [100, 120, 80, …]처럼 크고 다른 채널은 [0.01, 0.02, −0.01, …]처럼 작다고 하자. 학습이 진행되면서 이런 분포가 계속 움직이면 뒤 층은 매번 다른 scale의 입력을 받게 되어 optimization이 까다로워진다.",
        "BatchNorm은 mini-batch 안에서 평균 μ와 분산 σ²을 구해 (x − μ)/√(σ² + ε)로 정규화한다. 그러면 어느 채널이든 대략 평균 0, 분산 1이 된다.",
        "그런데 모든 feature를 무조건 평균 0, 분산 1로 묶으면 표현력이 제한된다. 그래서 학습 가능한 γ, β를 두어 y = γx̂ + β로 필요한 scale과 offset을 되돌릴 수 있게 한다. 일단 안정화하고, 필요하면 네트워크가 다시 벌린다.",
        "어디를 모아서 평균 내나. feature map X ∈ ℝ^{B×C×H×W}에서 채널 c마다 따로, batch와 공간 위치를 합친 B×H×W개의 값으로 μ_c, σ_c²을 구한다. 채널 17과 18을 섞어서 평균 내지 않는다. γ_c, β_c도 채널마다 하나씩이다.",
        "실용적으로 BN은 activation scale을 안정시켜 gradient가 폭발하거나 사라지는 것을 완화하고, 큰 learning rate를 허용하며, 깊은 네트워크 학습을 안정화한다.",
      ],
      formula: "\\mu_c = \\operatorname{mean}(x),\\quad \\sigma_c^2 = \\operatorname{var}(x)\\quad\\text{over } B\\times H\\times W\n\\hat{x} = \\frac{x-\\mu_c}{\\sqrt{\\sigma_c^2+\\epsilon}}, \\qquad y = \\gamma_c\\,\\hat{x} + \\beta_c",
      takeaway: "채널마다 따로, 배치와 공간을 모아서 정규화한 뒤 γ, β로 되돌린다.",
      see: "채널을 c17 → c18로 바꾸면 원 분포의 scale이 만 배 차이인데도 정규화 후에는 같은 자리에 놓인다. γ를 키우면 분포가 벌어지고 β를 움직이면 통째로 이동한다. 그것이 표현력을 되찾는 방향이다.",
    },
    {
      id: "block", num: "06", kicker: "블록 하나의 실제 순서",
      question: "그림에서 생략된 BN은 실제로 어디에 있나?",
      steps: [
        "원래 ResNet-50 bottleneck block을 정확히 쓰면 1×1 Conv → BN → ReLU, 3×3 Conv → BN → ReLU, 1×1 Conv → BN 이다. 모든 conv 뒤에 BN이 붙고, 마지막 conv 뒤에는 ReLU가 없다.",
        "그 다음 shortcut x를 더하고, 더한 결과에 ReLU를 한 번 건다. 마지막 BN 뒤에 바로 ReLU를 걸지 않는 이유는, 더하기 전에 음수를 잘라 버리면 residual F(x)가 x를 \"줄이는\" 방향으로는 작동하지 못하기 때문이다.",
        "이 블록이 layer1에 3개, layer2에 4개, layer3에 6개, layer4에 3개 쌓인다. 각 layer의 첫 블록만 점선 shortcut이고 나머지는 실선이다.",
        "정리하면, ResNet-50은 spatial resolution을 단계적으로 줄이며 channel capacity를 늘리고, bottleneck convolution으로 계산량을 제어하며, residual connection과 normalization으로 매우 깊은 네트워크의 optimization을 안정화한다.",
      ],
      formula: "y = \\operatorname{ReLU}\\Big(\\operatorname{BN}\\big(W_3\\,\\operatorname{ReLU}(\\operatorname{BN}(W_2\\,\\operatorname{ReLU}(\\operatorname{BN}(W_1 x))))\\big) + x\\Big)",
      takeaway: "skip connection + BatchNorm, 이 둘이 있어야 50층, 101층, 152층이 학습된다.",
      see: "위에서 아래로 불이 켜지는 순서가 실제 연산 순서다. 초록 선이 x를 그대로 들고 내려와 마지막 더하기에 합류한다.",
    },
  ] as StudySection[],
  flow: {
    stages: [
      { id: "input", name: "input", H: 224, C: 3, desc: "RGB 이미지. 224×224×3." },
      { id: "conv1", name: "7×7 conv, s2", H: 112, C: 64, desc: "7×7 kernel 64개, stride 2. 공간 절반, 채널 3→64." },
      { id: "pool", name: "maxpool, s2", H: 56, C: 64, desc: "3×3 max pooling stride 2. 파라미터 없음." },
      { id: "layer1", name: "layer1 · 3 blocks", H: 56, C: 256, desc: "bottleneck ×3. 64→256으로 채널만 늘고 공간은 그대로." },
      { id: "layer2", name: "layer2 · 4 blocks", H: 28, C: 512, desc: "첫 블록 stride 2. PatchCore가 가져오는 512×28×28." },
      { id: "layer3", name: "layer3 · 6 blocks", H: 14, C: 1024, desc: "가장 많은 블록. PatchCore가 가져오는 1024×14×14." },
      { id: "layer4", name: "layer4 · 3 blocks", H: 7, C: 2048, desc: "가장 거친 공간, 가장 많은 채널." },
      { id: "gap", name: "global avg pool", H: 1, C: 2048, desc: "7×7을 평균해 2048 벡터." },
      { id: "fc", name: "FC", H: 1, C: 1000, desc: "ImageNet 1000 classes." },
    ],
    patchcore: "PatchCore",
    shapeLabel: (H: number, C: number) => (H === 1 ? `${C}` : `${H}×${H}×${C}`),
  },
  bottleneck: { channels: "입력 채널 C", ratio: "축소비 r", naive: "3×3 naive", bottle: "bottleneck 합", saving: "절약" },
  onebyone: { pick: "위치를 고르세요", channels: "입력 채널 (C)", filters: "출력 채널 (K)", noSpatial: "이웃 칸은 참여하지 않음" },
  skip: { same: "모양 같음 (실선)", diff: "stage 전환 (점선)", main: "main branch", shortcut: "shortcut", proj: "1×1 conv, stride 2" },
  bn: { channel: "채널", raw: "정규화 전", norm: "정규화 후 · y = γx̂ + β", gamma: "γ", beta: "β", mean: "μ", std: "σ" },
  labels: { see: "그림에서 볼 것", takeaway: "한 줄로" },
  related: { title: "이 챕터가 쓰이는 곳", text: "PatchCore·CleanCon의 WRN50 표현은 정확히 이 layer2, layer3 출력이다. 이상 탐지 페이지의 01 단계에서 이어진다.", link: "/anomaly/", linkText: "Anomaly detection, visually →" },
};

export const studyIndexCopy = {
  kicker: "Study",
  title: "기초부터 다시, 눈으로",
  sub: "논문을 쓰면서 당연하게 넘긴 것들을 하나씩 다시 세운다. 각 챕터는 \"왜?\"라는 질문과 그 답을 직접 만져 볼 수 있는 그림으로 되어 있다.",
  chapters: [
    { num: "01", title: "ResNet-50, 세 가지 규칙의 반복", desc: "왜 공간은 줄이고 채널은 늘리나, 왜 1×1 → 3×3 → 1×1인가, 점선 shortcut은 왜 있나, BatchNorm은 무엇을 정규화하나.", href: "/study/resnet50/", status: "live" },
    { num: "02", title: "Convolution 기초", desc: "kernel, stride, padding, receptive field. 3×3이 왜 표준인가.", href: "", status: "soon" },
    { num: "03", title: "ViT와 DINOv2 patch token", desc: "patch embedding, attention이 만드는 문맥, 레지스터 토큰.", href: "", status: "soon" },
    { num: "04", title: "Memory-bank anomaly detection", desc: "위 표현 위에서 정상 증거를 어떻게 모으고 남기고 믿는가. 연구 페이지로 이어진다.", href: "/anomaly/", status: "live" },
  ],
  soon: "준비 중",
};
