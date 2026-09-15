export type StudySection = {
  id: string;
  num: string;
  kicker: string;
  title: string;
  body: string;
  formula: string;
  note: string;
};

export const resnetCopy = {
  kicker: "Study · 01",
  title: "ResNet-50, 세 가지 규칙의 반복",
  sub: "처음 보면 왜 이렇게 복잡하게 쌓았나 싶지만, 원리를 알면 공간은 줄이고 채널은 늘리고 residual block을 반복하는 구조다. BatchNorm은 그 반복을 안정적으로 학습시키는 장치다.",
  rules: ["공간 크기는 줄이고", "channel은 늘리고", "residual block을 반복한다"],
  depth: { parts: ["3", "4", "6", "3"], text: "(3 + 4 + 6 + 3) × 3 = 48개의 conv, 맨 앞 7×7 conv 하나와 마지막 FC 하나를 더해 50층" },
  sections: [
    {
      id: "flow", num: "01", kicker: "전체 흐름", title: "224 → 112 → 56 → 28 → 14 → 7, 채널은 3 → 2048",
      body: "입력 224×224×3이 7×7 stride-2 conv와 pooling을 지나 56×56×64가 되고, 그 뒤 네 개의 residual stage를 지날 때마다 H, W는 절반이 되고 C는 두 배가 된다. 공간은 점점 거칠어지지만 각 위치가 담는 feature의 종류는 점점 많아진다. 마지막에 7×7×2048을 global average pooling으로 2048 벡터로 눌러 classifier에 넣는다.",
      formula: "H, W ↓        C ↑        stage마다  H → H/2,   C → 2C",
      note: "상자 위에 마우스를 올리면 각 단계의 모양이 보인다. PatchCore가 가져오는 layer2 = 512×28×28, layer3 = 1024×14×14는 외울 숫자가 아니라 이 규칙에서 자연히 나오는 값이다.",
    },
    {
      id: "bottleneck", num: "02", kicker: "병목 블록", title: "1×1 → 3×3 → 1×1, 가운데가 좁다",
      body: "입력이 256채널일 때 바로 3×3 conv 256→256을 하면 파라미터가 3·3·256·256 = 589,824개다. ResNet은 먼저 1×1로 채널을 64로 줄이고, 그 64채널에서만 진짜 공간 convolution을 한 뒤, 다시 1×1로 256으로 늘린다. 256 → 64 → 64 → 256. 가운데가 좁아서 bottleneck이다.",
      formula: "1×1: C·(C/r)   +   3×3: 9·(C/r)²   +   1×1: (C/r)·C        vs        3×3 naive: 9·C²",
      note: "입력 채널 C와 축소비 r을 바꿔 보면 파라미터 절약이 얼마나 되는지 막대가 바로 바뀐다. ResNet-50의 기본은 r = 4이고, 256채널에서 약 8.5배 절약된다.",
    },
    {
      id: "onebyone", num: "03", kicker: "1×1 convolution", title: "공간은 안 섞고 채널만 섞는다",
      body: "1×1 kernel은 공간적으로 한 칸만 본다. 하지만 그 한 칸의 모든 입력 채널을 본다. 한 위치의 입력 x ∈ ℝ²⁵⁶에 대해 1×1 filter 하나는 y = Σ_c w_c x_c를 계산하고, filter가 64개면 ℝ²⁵⁶ → ℝ⁶⁴이다. 즉 1×1 conv는 위치마다 같은 행렬 W를 곱하는 채널 projection이다.",
      formula: "y(i, j) = W · x(i, j),        W ∈ ℝ^{K×C},   x(i, j) ∈ ℝ^C",
      note: "격자의 한 칸을 고르면 그 위치의 채널 벡터가 W와 곱해져 K개의 출력이 되는 과정을 한 행씩 보여 준다. 이웃 칸은 전혀 참여하지 않는다.",
    },
    {
      id: "skip", num: "04", kicker: "residual 연결", title: "실선은 그대로 더하고, 점선은 모양을 맞춰서 더한다",
      body: "일반 블록은 x → F(x)이고 ResNet은 y = F(x) + x다. 모양이 같으면 x를 그대로 더한다(실선, identity). 그런데 stage가 바뀌면 main branch는 56×56×256을 28×28×512로 바꾸므로 x와 더할 수 없다. 그래서 shortcut에도 1×1 conv, stride 2를 넣어 모양을 맞춘다(점선, projection).",
      formula: "실선:  y = F(x) + x                점선:  y = F(x) + W_s x,    W_s = 1×1 conv, stride 2",
      note: "토글로 두 경우를 오가면 shortcut 경로에 projection 노드가 생기고 텐서 모양 라벨이 맞춰지는 것이 보인다.",
    },
    {
      id: "bn", num: "05", kicker: "Batch Normalization", title: "채널마다 따로, 배치와 공간을 모아서 정규화한다",
      body: "어떤 채널의 activation은 100 근처에서 놀고 다른 채널은 0.01 근처에서 논다면 학습 중 분포가 계속 움직여 optimization이 까다롭다. BatchNorm2d는 feature map X ∈ ℝ^{B×C×H×W}에서 채널 c마다 B×H×W개의 값을 모아 평균과 분산을 구하고 정규화한 뒤, 학습 가능한 γ_c, β_c로 필요한 scale과 offset을 되돌린다. 채널 17과 18을 섞어서 평균 내지 않는다.",
      formula: "μ_c = mean(x),   σ_c² = var(x)  over B×H×W\nx̂ = (x − μ_c) / √(σ_c² + ε),        y = γ_c x̂ + β_c",
      note: "채널을 바꾸면 원 분포의 scale이 완전히 다른데도 정규화 후에는 같은 자리에 놓인다. γ, β를 움직여 network가 표현력을 되찾는 방향을 확인한다.",
    },
    {
      id: "block", num: "06", kicker: "블록 하나의 실제 순서", title: "Conv → BN → ReLU를 세 번, 더한 뒤 ReLU",
      body: "그림에서는 BN이 생략되지만 실제 bottleneck block은 1×1 Conv → BN → ReLU, 3×3 Conv → BN → ReLU, 1×1 Conv → BN 순서이고, 여기에 shortcut x를 더한 뒤 마지막 ReLU를 지난다. skip connection과 BatchNorm이 함께 있어야 50층, 101층, 152층이 학습된다.",
      formula: "y = ReLU( BN(W₃ · ReLU(BN(W₂ · ReLU(BN(W₁ x))))) + x )",
      note: "이 블록이 layer1에 3개, layer2에 4개, layer3에 6개, layer4에 3개 쌓인다. 각 layer의 첫 블록만 점선 shortcut이고 나머지는 실선이다.",
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
  related: { title: "이 챕터가 쓰이는 곳", text: "PatchCore·CleanCon의 WRN50 표현은 정확히 이 layer2, layer3 출력이다. 이상 탐지 페이지의 01 단계에서 이어진다.", link: "/anomaly/", linkText: "Anomaly detection, visually →" },
};

export const studyIndexCopy = {
  kicker: "Study",
  title: "기초부터 다시, 눈으로",
  sub: "논문을 쓰면서 당연하게 넘긴 것들을 하나씩 다시 세운다. 각 챕터는 짧은 설명과 직접 만질 수 있는 그림으로 되어 있다.",
  chapters: [
    { num: "01", title: "ResNet-50, 세 가지 규칙의 반복", desc: "모양 흐름, 병목 블록, 1×1 채널 혼합, residual, BatchNorm.", href: "/study/resnet50/", status: "live" },
    { num: "02", title: "Convolution 기초", desc: "kernel, stride, padding, receptive field. 3×3이 왜 표준인가.", href: "", status: "soon" },
    { num: "03", title: "ViT와 DINOv2 patch token", desc: "patch embedding, attention이 만드는 문맥, 레지스터 토큰.", href: "", status: "soon" },
    { num: "04", title: "Memory-bank anomaly detection", desc: "위 표현 위에서 정상 증거를 어떻게 모으고 남기고 믿는가. 연구 페이지로 이어진다.", href: "/anomaly/", status: "live" },
  ],
  soon: "준비 중",
};
