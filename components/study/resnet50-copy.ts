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

export const resnetCopy = {
  kicker: "Study · 01",
  title: "ResNet-50, 처음 보는 사람을 위해",
  sub: "ResNet-50은 2015년에 나온 이미지 분류 신경망이다. 사진을 넣으면 \"고양이\", \"자동차\" 같은 1000개 답 중 하나를 고른다. 구조도를 처음 보면 상자가 50개 넘게 쌓여 있어 겁이 나지만, 실제로는 같은 부품 하나를 반복해서 쌓은 것이고 그 부품이 왜 그렇게 생겼는지는 아래 일곱 개 질문으로 다 설명된다.",
  rules: ["공간 크기는 줄이고", "channel은 늘리고", "같은 블록을 반복한다"],
  depth: { parts: ["3", "4", "6", "3"], text: "ResNet-50의 \"50\"은 층(layer) 수다. 블록마다 conv가 3개씩 들어 있고 블록이 3 + 4 + 6 + 3 = 16개라서 48층, 여기에 맨 앞 conv 하나와 맨 뒤 분류기 하나를 더해 50층. 이 숫자가 어디서 오는지는 02절에서 자연히 보인다." },
  sections: [
    {
      id: "basics", num: "00", kicker: "시작하기 전에",
      question: "이미지는 컴퓨터 안에서 어떤 모양이고, convolution은 무엇을 하나?",
      steps: [
        "컬러 사진 한 장은 숫자로 채운 상자다. 가로 224칸, 세로 224칸, 그리고 빨강·초록·파랑 3장이 겹쳐 있으니 224×224×3개의 숫자다. 이 \"3\"을 channel(채널)이라 부른다. 앞으로 나오는 H×W×C는 전부 이 상자의 세로×가로×채널 크기다.",
        "convolution(conv)은 작은 창을 사진 위에서 미끄러뜨리며 계산하는 연산이다. 3×3 conv라면 3×3 크기의 작은 숫자표(kernel, 커널)를 사진의 왼쪽 위에 대고, 겹치는 9개 픽셀과 커널 숫자를 짝지어 곱한 뒤 전부 더해 숫자 하나를 얻는다. 창을 한 칸 옮겨 또 하나, 또 한 칸 옮겨 또 하나. 끝까지 훑으면 새 숫자판 한 장이 나온다.",
        "그 새 숫자판이 feature map이다. 커널이 \"세로 선\"에 반응하는 숫자표라면 feature map은 사진에서 세로 선이 있는 곳마다 큰 값이 찍힌 지도가 된다. 커널의 숫자는 사람이 정하는 게 아니라 학습으로 정해진다.",
        "커널을 64개 쓰면 feature map도 64장 나온다. 그래서 출력 채널이 64가 된다. 즉 \"채널 수 = 이 층이 쓰는 커널의 개수 = 이 층이 뽑아내는 특징의 종류 수\"다. 입력 채널이 3이면 커널 하나는 사실 3×3×3 크기이고, 3장을 모두 보고 숫자 하나를 낸다.",
        "stride(보폭)는 창을 몇 칸씩 옮기느냐다. stride 2면 두 칸씩 건너뛰므로 출력 가로세로가 절반이 된다. 이것이 뒤에서 공간을 줄이는 방법이다.",
      ],
      formula: "\\text{out}(i,j) = \\sum_{c=1}^{C_{\\text{in}}}\\sum_{u=-1}^{1}\\sum_{v=-1}^{1} k[c,u,v]\\cdot \\text{in}[c,\\, i+u,\\, j+v] \\qquad (3\\times3\\ \\text{conv})",
      takeaway: "이미지 = H×W×C 숫자 상자. conv = 작은 커널을 미끄러뜨려 새 숫자판(feature map)을 만드는 것. 채널 수 = 커널 개수.",
      see: "3×3 창이 입력 위를 한 칸씩 움직이며 출력 한 칸을 채운다. \"stride 2\"를 누르면 두 칸씩 건너뛰어 출력이 절반 크기가 되는 것이 보인다.",
    },
    {
      id: "flow", num: "01", kicker: "전체 흐름",
      question: "ResNet-50에 224×224×3을 넣으면 크기가 어떻게 변해 가나?",
      steps: [
        "맨 앞에서 7×7 conv를 stride 2로 한 번 하면 112×112×64가 된다(가로세로 절반, 커널 64개라 채널 64). 이어서 pooling(작은 창 안의 최댓값만 남기는 축소)을 stride 2로 하면 56×56×64. 여기까지가 \"입구\"다.",
        "그 다음이 본체다. 같은 모양의 블록(02절에서 설명)을 여러 개 이어 붙인 묶음을 layer라 부르고, layer1부터 layer4까지 네 묶음이 있다. 묶음이 바뀔 때마다 규칙은 하나다. 가로세로는 절반, 채널은 두 배. 56×56×256 → 28×28×512 → 14×14×1024 → 7×7×2048.",
        "왜 이렇게 하나. 가로세로를 줄이면 출력 한 칸이 원래 사진의 더 넓은 영역을 대표한다. 처음엔 한 칸이 픽셀 몇 개, 나중엔 한 칸이 사진의 절반쯤. 넓은 영역을 설명하려면 \"세로 선\" 같은 단순 특징으로는 부족하고 \"눈\", \"바퀴\" 같은 복잡한 특징이 여러 종류 필요하다. 그래서 채널을 늘린다. 위치의 정밀함을 포기하는 대신 의미의 풍부함을 얻는 거래다.",
        "마지막 7×7×2048에서는 49칸을 평균 내서 2048개 숫자 한 줄로 만들고(global average pooling), 그것을 1000개 답으로 바꾸는 층(fully connected, FC)을 통과시킨다. \"고양이가 어디에 있나\"는 분류에 필요 없으니 위치를 버리는 것이다.",
      ],
      formula: "224^2\\!\\times 3 \\;\\to\\; 112^2\\!\\times 64 \\;\\to\\; 56^2\\!\\times 256 \\;\\to\\; 28^2\\!\\times 512 \\;\\to\\; 14^2\\!\\times 1024 \\;\\to\\; 7^2\\!\\times 2048 \\;\\to\\; 2048 \\;\\to\\; 1000",
      takeaway: "묶음이 바뀔 때마다 H, W는 절반, C는 두 배. 공간은 거칠어지고 한 칸이 담는 의미는 풍부해진다.",
      see: "상자 위에 마우스를 올리면 각 단계의 크기와 설명이 뜬다. 노란 상자 둘(28×28×512, 14×14×1024)이 이상 탐지 논문에서 PatchCore가 꺼내 쓰는 중간 출력이다. 외울 숫자가 아니라 이 규칙에서 저절로 나온다.",
    },
    {
      id: "bottleneck", num: "02", kicker: "블록 하나의 생김새",
      question: "본체를 이루는 블록은 왜 1×1 → 3×3 → 1×1 순서인가?",
      steps: [
        "블록은 conv 세 개를 이어 붙인 것이다. 왜 3×3 하나로 안 하고 세 개나 쓰나. 비용 때문이다.",
        "conv의 파라미터(학습해야 하는 숫자) 개수는 커널 크기 × 입력 채널 × 출력 채널이다. 입력이 256채널일 때 3×3 conv로 256 → 256을 하면 3·3·256·256 = 589,824개. 이런 블록이 16개면 수백만 개다.",
        "그래서 먼저 1×1 conv로 채널을 256 → 64로 줄인다(1·1·256·64 = 16,384개). 비싼 3×3은 이 64채널에서만 한다(3·3·64·64 = 36,864개). 마지막에 1×1로 64 → 256으로 되돌린다(16,384개). 합쳐서 69,632개, 아까의 8분의 1이다.",
        "채널이 256 → 64 → 64 → 256으로 가운데가 잘록하다고 해서 bottleneck(병목) 블록이라 부른다. 표현력은 거의 그대로인데 비용만 줄인 것이다. 1×1 conv가 어떻게 채널을 줄이는지는 다음 절에서 본다.",
        "이 블록이 layer1에 3개, layer2에 4개, layer3에 6개, layer4에 3개 들어간다. 블록당 conv 3개이니 16 × 3 = 48, 입구의 conv 하나와 출구의 FC 하나를 더해 50. 그래서 ResNet-50이다. 블록 개수를 바꾸면 ResNet-101, ResNet-152가 된다.",
      ],
      formula: "\\underbrace{C\\cdot\\tfrac{C}{4}}_{1\\times1} \\;+\\; \\underbrace{9\\,(\\tfrac{C}{4})^2}_{3\\times3} \\;+\\; \\underbrace{\\tfrac{C}{4}\\cdot C}_{1\\times1} \\;=\\; \\tfrac{17}{16}\\,C^2 \\qquad\\text{vs}\\qquad \\underbrace{9\\,C^2}_{3\\times3\\ \\text{하나}}",
      takeaway: "1×1로 채널을 줄이고 → 좁은 채널에서 3×3을 하고 → 1×1로 다시 늘린다. 비용은 8분의 1, 층 수는 3배.",
      see: "입력 채널 C와 축소비 r을 바꾸면 세 conv 각각의 파라미터 수와 절약 배수가 바로 바뀐다. C를 2048로 올려도 절약 배수는 8.5배 그대로다. 둘 다 C²에 비례하기 때문이다.",
    },
    {
      id: "onebyone", num: "03", kicker: "1×1 convolution",
      question: "1×1 conv는 한 칸만 보는데 어떻게 채널을 줄이나?",
      steps: [
        "1×1 커널은 가로세로 한 칸만 본다. 옆 픽셀을 전혀 보지 않으니 아무 일도 못 할 것 같다. 그런데 00절에서 봤듯 커널은 입력 채널을 전부 본다. 1×1 커널 하나의 실제 크기는 1×1×256, 즉 한 위치의 256개 채널 값을 보고 숫자 하나를 낸다.",
        "한 위치의 256개 값을 x라 하면 커널 하나는 y = w₁x₁ + w₂x₂ + … + w₂₅₆x₂₅₆, 그냥 가중합이다. 커널을 64개 쓰면 그런 가중합이 64개 나오니 그 위치는 256개 숫자에서 64개 숫자가 된다.",
        "이걸 모든 위치에서 똑같이 한다. 그러니까 1×1 conv는 \"위치마다 같은 행렬 W(64×256)를 곱하는 것\"이다. 가로세로는 손대지 않고 채널 방향으로만 섞고(mixing) 줄이는(projection) 연산이다.",
        "그래서 02절에서 채널을 256 → 64 → 256으로 마음대로 오갈 수 있었다. 공간 정보는 그대로 두고 채널 수만 바꾸는 값싼 도구다.",
      ],
      formula: "y(i,j) = W\\,x(i,j), \\qquad W \\in \\mathbb{R}^{64\\times 256}, \\quad x(i,j) \\in \\mathbb{R}^{256}, \\quad y(i,j) \\in \\mathbb{R}^{64}",
      takeaway: "1×1 conv = 모든 위치에 똑같이 적용되는 채널 방향 행렬 곱. 공간은 안 섞고 채널만 섞는다.",
      see: "격자에서 한 칸을 고르면 그 위치의 채널 벡터 x가 W의 한 행씩과 곱해져 출력 y가 한 개씩 만들어진다. 다른 칸은 아무 역할도 하지 않는다.",
    },
    {
      id: "skip", num: "04", kicker: "residual 연결",
      question: "왜 블록 옆으로 선이 하나 돌아가고, 그 선은 왜 실선일 때와 점선일 때가 있나?",
      steps: [
        "ResNet 이전에는 층을 더 쌓으면 오히려 성능이 나빠지는 일이 있었다. 20층보다 56층이 못했다. 층이 많을수록 앞쪽 층까지 학습 신호가 잘 안 닿기 때문이다. 이 문제를 푼 것이 옆으로 돌아가는 선, 즉 skip connection(shortcut)이다.",
        "일반 블록은 입력 x를 받아 F(x)를 내놓는다. ResNet 블록은 F(x)에 입력 x를 그대로 더해서 y = F(x) + x를 내놓는다. 이러면 블록은 \"x를 어떻게 고칠지\"(residual, 잔차)만 배우면 된다. 아무것도 안 고치는 것(F = 0)이 쉬워지므로, 층을 아무리 쌓아도 최소한 얕은 망만큼은 하게 된다. 학습 신호도 그 선을 타고 앞쪽 층까지 곧장 흐른다.",
        "실선 shortcut은 x를 그대로 더하는 경우다. F(x)와 x의 모양(H×W×C)이 같을 때만 가능하다.",
        "그런데 01절에서 layer가 바뀔 때 가로세로 절반, 채널 두 배가 된다고 했다. 그 첫 블록에서는 F(x)가 28×28×512인데 x는 아직 56×56×256이라 모양이 달라서 더할 수 없다. 두 상자의 칸 수가 다르면 칸끼리 더하는 것 자체가 불가능하다.",
        "그래서 shortcut 쪽에도 1×1 conv를 stride 2로 하나 넣어 x를 28×28×512로 만든다. stride 2가 가로세로를 절반으로, 커널 512개가 채널을 두 배로 만든다. 그 뒤에 더한다. 구조도에서 이 경우를 점선으로 그린다.",
      ],
      formula: "\\text{실선: } y = F(x) + x \\qquad\\qquad \\text{점선: } y = F(x) + W_s x,\\quad W_s = 1\\times1\\ \\text{conv},\\ \\text{stride } 2",
      takeaway: "실선 = 모양이 같아서 그냥 더함. 점선 = 모양이 달라서 1×1 conv로 맞춘 뒤 더함. 각 layer의 첫 블록만 점선이다.",
      see: "토글을 \"layer 전환\"으로 바꾸면 shortcut 경로에 1×1 conv 노드가 생기고, 두 경로의 크기 라벨이 28×28×512로 같아지는 것이 보인다.",
    },
    {
      id: "bn", num: "05", kicker: "Batch Normalization",
      question: "구조도에 잘 안 그리는 BatchNorm은 무엇이고 왜 필요한가?",
      steps: [
        "conv를 지난 숫자들은 크기가 제각각이다. 어떤 채널은 값이 100 근처에서 놀고 어떤 채널은 0.01 근처에서 논다. 학습 중에 이 분포가 계속 흔들리면 뒤 층은 매번 다른 크기의 입력을 받게 되고, 학습이 느려지거나 불안정해진다.",
        "BatchNorm(BN)은 conv 바로 뒤에서 값의 크기를 매번 맞춰 주는 장치다. 학습은 한 번에 여러 장(mini-batch, 예: 32장)을 같이 넣는데, 그 32장에서 나온 값들의 평균 μ와 분산 σ²을 구해 (x − μ)/√(σ² + ε)로 바꾼다. 그러면 어느 채널이든 대략 평균 0, 분산 1이 된다. ε은 0으로 나누는 것을 막는 아주 작은 수다.",
        "그런데 모든 값을 평균 0, 분산 1로 강제하면 표현력이 줄 수 있다. 어떤 채널은 정말로 큰 값이 필요할지 모른다. 그래서 학습되는 두 숫자 γ(스케일), β(이동)를 두어 y = γx̂ + β로 되돌릴 여지를 준다. 일단 안정시키고, 필요하면 망이 알아서 다시 벌린다.",
        "정확히 무엇끼리 모아서 평균을 내나. 출력이 B×C×H×W(배치 32, 채널 256, 28×28)라면 채널 하나마다 따로, 32×28×28개의 값을 모아 μ와 σ²을 구한다. 채널 17과 채널 18은 서로 섞지 않는다. 그래서 γ와 β도 채널마다 하나씩, 256채널이면 256쌍이다.",
        "결과적으로 BN은 값이 폭발하거나 사라지는 것을 막고, 더 큰 learning rate를 쓸 수 있게 하며, 깊은 망을 학습 가능하게 만든다. skip connection과 BN, 이 둘이 함께 있어야 50층이 학습된다.",
      ],
      formula: "\\mu_c = \\operatorname{mean}(x),\\quad \\sigma_c^2 = \\operatorname{var}(x)\\qquad\\text{채널 } c \\text{ 안의 } B\\times H\\times W \\text{개 값에 대해}\n\\hat{x} = \\frac{x-\\mu_c}{\\sqrt{\\sigma_c^2+\\epsilon}}, \\qquad y = \\gamma_c\\,\\hat{x} + \\beta_c",
      takeaway: "채널마다 따로, 배치와 공간을 모아 평균 0·분산 1로 맞춘 뒤, γ와 β로 필요한 만큼 되돌린다.",
      see: "채널을 c17 → c18로 바꾸면 원래 값의 크기가 만 배 차이인데도 정규화 후에는 같은 자리에 놓인다. γ를 키우면 분포가 벌어지고 β를 움직이면 통째로 이동한다.",
    },
    {
      id: "block", num: "06", kicker: "블록 하나를 정확히 쓰면",
      question: "conv, BN, ReLU, shortcut은 블록 안에서 어떤 순서로 놓이나?",
      steps: [
        "ReLU는 음수를 0으로 바꾸는 아주 단순한 함수다. conv는 곱하고 더하기만 하는 선형 연산이라 아무리 쌓아도 하나의 선형 연산과 같아진다. 그래서 conv 사이에 ReLU 같은 비선형을 끼워야 층을 쌓는 의미가 생긴다.",
        "블록 하나를 빠짐없이 쓰면 이렇다. 1×1 Conv → BN → ReLU, 3×3 Conv → BN → ReLU, 1×1 Conv → BN. 모든 conv 뒤에 BN이 붙고, 마지막 conv 뒤에는 ReLU가 없다.",
        "그 다음 shortcut으로 온 x를 더하고, 더한 결과에 ReLU를 한 번 건다. 마지막 BN 뒤에 바로 ReLU를 걸지 않는 이유가 있다. 더하기 전에 음수를 잘라 버리면 F(x)는 0 이상만 되어 x를 \"줄이는\" 방향으로는 고칠 수 없게 된다. 더한 뒤에 걸어야 F(x)가 양쪽으로 자유롭다.",
        "이 블록이 16개 쌓이고, 각 layer의 첫 블록만 점선 shortcut이다. 이제 구조도를 다시 보면 상자 50개가 아니라 \"입구 → 블록 (3, 4, 6, 3개) → 출구\"로 읽힌다.",
        "한 문장으로 정리하면, ResNet-50은 공간 해상도를 단계적으로 줄이며 채널을 늘리고, 병목 conv로 계산량을 억제하며, shortcut과 BN으로 깊은 망의 학습을 안정시킨 구조다.",
      ],
      formula: "y = \\operatorname{ReLU}\\Big(\\operatorname{BN}\\big(W_3\\,\\operatorname{ReLU}(\\operatorname{BN}(W_2\\,\\operatorname{ReLU}(\\operatorname{BN}(W_1 x))))\\big) + x\\Big)",
      takeaway: "Conv → BN → ReLU를 두 번, Conv → BN 한 번, x를 더하고, 마지막에 ReLU.",
      see: "위에서 아래로 불이 켜지는 순서가 실제 연산 순서다. 초록 선이 입력 x를 그대로 들고 내려와 마지막 더하기에 합류한다.",
    },
  ] as StudySection[],
  flow: {
    stages: [
      { id: "input", name: "input", H: 224, C: 3, desc: "RGB 사진. 224×224×3." },
      { id: "conv1", name: "7×7 conv, s2", H: 112, C: 64, desc: "7×7 커널 64개, stride 2. 가로세로 절반, 채널 3→64." },
      { id: "pool", name: "maxpool, s2", H: 56, C: 64, desc: "3×3 창의 최댓값만 남김, stride 2. 학습 파라미터 없음." },
      { id: "layer1", name: "layer1 · 블록 3개", H: 56, C: 256, desc: "병목 블록 ×3. 채널만 64→256, 가로세로 그대로." },
      { id: "layer2", name: "layer2 · 블록 4개", H: 28, C: 512, desc: "첫 블록이 stride 2. PatchCore가 꺼내 쓰는 512×28×28." },
      { id: "layer3", name: "layer3 · 블록 6개", H: 14, C: 1024, desc: "블록이 가장 많음. PatchCore가 꺼내 쓰는 1024×14×14." },
      { id: "layer4", name: "layer4 · 블록 3개", H: 7, C: 2048, desc: "가장 거친 공간, 가장 많은 채널." },
      { id: "gap", name: "global avg pool", H: 1, C: 2048, desc: "7×7 = 49칸을 평균해 2048개 숫자 한 줄." },
      { id: "fc", name: "FC", H: 1, C: 1000, desc: "2048 → 1000개 답(ImageNet class)." },
    ],
    patchcore: "PatchCore",
    shapeLabel: (H: number, C: number) => (H === 1 ? `${C}` : `${H}×${H}×${C}`),
  },
  conv: { stride: "stride", input: "입력 (한 채널)", output: "출력 feature map", kernel: "3×3 커널", play: "재생", pause: "멈춤" },
  bottleneck: { channels: "입력 채널 C", ratio: "축소비 r", naive: "3×3 하나로", bottle: "병목 블록 합", saving: "절약" },
  onebyone: { pick: "위치를 고르세요", channels: "입력 채널 (C)", filters: "출력 채널 (K)", noSpatial: "이웃 칸은 참여하지 않음" },
  skip: { same: "모양 같음 (실선)", diff: "layer 전환 (점선)", main: "블록 본체", shortcut: "shortcut", proj: "1×1 conv, stride 2" },
  bn: { channel: "채널", raw: "정규화 전", norm: "정규화 후 · y = γx̂ + β", gamma: "γ", beta: "β", mean: "μ", std: "σ" },
  labels: { see: "그림에서 볼 것", takeaway: "한 줄로" },
  related: { title: "이 챕터가 쓰이는 곳", text: "이상 탐지 논문(PatchCore, CleanCon)에서 \"WRN50 특징\"이라고 부르는 것은 정확히 위 layer2, layer3의 출력이다. 사진을 이 망에 통과시키고 중간에서 28×28×512, 14×14×1024를 꺼내 쓴다.", link: "/anomaly/", linkText: "Anomaly detection, visually →" },
};

export const studyIndexCopy = {
  kicker: "Study",
  title: "기초부터 다시, 눈으로",
  sub: "논문을 쓰면서 당연하게 넘긴 것들을 하나씩 다시 세운다. 각 챕터는 처음 보는 사람 기준으로 \"왜?\"를 묻고, 그 답을 직접 만져 볼 수 있는 그림으로 되어 있다.",
  chapters: [
    { num: "01", title: "ResNet-50, 처음 보는 사람을 위해", desc: "이미지는 숫자 상자, conv는 미끄러지는 커널. 왜 공간은 줄이고 채널은 늘리나, 왜 1×1 → 3×3 → 1×1인가, 점선 shortcut은 왜 있나, BatchNorm은 무엇을 맞추나.", href: "/study/resnet50/", status: "live" },
    { num: "02", title: "Convolution 더 깊이", desc: "padding, receptive field, dilation. 3×3이 왜 표준이 됐나.", href: "", status: "soon" },
    { num: "03", title: "ViT와 DINOv2 patch token", desc: "patch embedding, attention이 만드는 문맥, 레지스터 토큰.", href: "", status: "soon" },
    { num: "04", title: "Memory-bank anomaly detection", desc: "위 표현 위에서 정상 증거를 어떻게 모으고 남기고 믿는가. 연구 페이지로 이어진다.", href: "/anomaly/", status: "live" },
  ],
  soon: "준비 중",
};
