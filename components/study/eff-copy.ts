import type { Prologue, StudySection } from "./chapters";

const prologue: Prologue = {
  title: "이야기의 시작: \"빠르다\"를 숫자 하나로 적고 싶었다",
  paragraphs: [
    "LoRA는 거대 모델을 고칠 때 학습할 숫자를 줄였다. 하지만 다 고친 모델을 쓸 때는 원래 모델만큼 무겁다. 휴대폰이나 공장 카메라 옆의 작은 기계에서 돌리려면 쓸 때의 계산 자체를 줄여야 한다. 그러려면 먼저 \"빠르다\"를 무엇으로 잴지부터 정해야 한다.",
    "가장 손쉬운 잣대는 모델을 돌려 보지 않고도 셀 수 있는 숫자다. 가중치가 몇 개인지(파라미터 수), 곱셈과 덧셈을 몇 번 하는지(FLOPs). 종이 위에서 셀 수 있고 장치가 없어도 된다. 2017년 Howard 등의 MobileNet은 보통의 conv를 두 단계로 쪼개 계산을 8분의 1에서 9분의 1로 줄였다. 같은 논문은 계산이 적은 것만으로는 부족하고, 그 연산이 장치에서 효율적으로 돌아가야 한다고 덧붙였다.",
    "2018년 Ma 등의 ShuffleNet V2는 이것을 정면으로 다뤘다. FLOPs는 속도를 간접적으로 잴 뿐이고, 실제 속도는 메모리에 접근하는 비용(memory access cost)과 장치의 성격에도 달려 있다고 썼다. 계산이 같아도 데이터를 메모리에서 가져오는 시간이 다르면 속도가 다르다. 컴퓨터 구조 쪽에서는 이 관계를 2009년 Williams, Waterman, Patterson의 roofline 모델이 그림 한 장으로 정리해 두었다.",
    "Guiguang Ding 교수 연구실의 경량 모델 논문들은 그래서 장치에서 잰 시간을 표에 적는다. 2023년의 RepViT는 iPhone 12에서 잰 latency로, 2024년의 YOLOv10은 T4 GPU에서 후처리까지 넣어 잰 latency로 모델을 비교한다.",
    "이 챕터는 층 하나를 끝까지 들고 간다. ResNet-50의 병목 블록 가운데에 있는 3×3 conv다. 이 층의 파라미터, MACs, memory traffic을 손으로 세고, 설명을 위해 손으로 정한 장치에서 시간을 계산한다. 그다음 한 번에 하나씩 바꾼다. 층의 종류를 바꾸고, MACs가 같은 다른 층과 나란히 놓고, 한 번에 넣는 사진 수(batch)를 바꾼다. 그렇게 만든 말로 두 논문의 표를 읽는다.",
    "다 읽고 나면 세 가지를 스스로 따질 수 있다. 곱셈을 줄였는데 왜 그만큼 빨라지지 않는가, 같은 모델이 왜 장치마다 다른 속도를 내는가, latency와 throughput 가운데 무엇을 봐야 하는가. 뒤의 챕터들이 쓰는 memory-bound, arithmetic intensity, ridge point라는 말도 여기서 정한다.",
  ],
  timeline: [
    { year: "2009", text: "roofline 모델. 계산 속도의 지붕과 메모리 대역폭의 비탈을 그림 한 장에" },
    { year: "2017", text: "MobileNet. depthwise와 pointwise로 쪼개 MACs를 8에서 9분의 1로" },
    { year: "2018", text: "ShuffleNet V2. FLOPs는 간접 잣대이니 장치에서 속도를 직접 재자" },
    { year: "2023", text: "RepViT. iPhone 12에서 batch 1로 잰 latency로 경량 모델을 비교" },
    { year: "2024", text: "YOLOv10. NMS 후처리까지 넣은 latency와 forward만의 latency를 나란히" },
  ],
};

const sections: StudySection[] = [
  {
    id: "count", num: "01", kicker: "두 가지 개수",
    question: "파라미터가 적으면 빠른가?",
    gist: [
      "파라미터 수는 모델에 저장된 가중치의 개수다. MACs는 그 가중치가 계산에 쓰인 횟수다. MAC(multiply-accumulate)은 곱셈 한 번과 덧셈 한 번을 묶은 단위다. 둘은 다른 것을 센다. conv에서는 같은 가중치가 feature map의 모든 위치에서 다시 쓰이기 때문이다.",
      "도장에 빗대 보자. conv의 커널(kernel)이 도장이다. 갖고 있는 도장의 수와 크기가 파라미터이고, 종이의 모든 자리에 한 번씩 찍는 횟수가 MACs를 정한다. 종이가 커지면, 곧 해상도가 오르면 도장은 그대로인데 찍는 횟수만 는다.",
      "흔히 파라미터가 적으면 계산도 적다고 생각한다. 그런데 같은 모델에 더 큰 사진을 넣으면 파라미터는 하나도 늘지 않고 계산만 는다. 계산이 시간을 정하는지는 다음 절에서 따로 따진다.",
    ],
    lead: [
      "LoRA 챕터는 이 질문으로 끝났다. 답하려면 먼저 \"적다\"가 무엇의 개수인지부터 정해야 한다. 그래서 층 하나를 손에 들고 직접 센다.",
      "따라갈 층은 ResNet-50 첫 단계(layer1)의 병목(bottleneck) 블록 한가운데에 있는 3×3 conv다. 병목 블록은 채널을 줄이는 conv, 이 conv, 채널을 다시 늘리는 conv를 차례로 쌓은 블록이다. 이 conv는 가로세로 56칸짜리 feature map(특징 지도)을 채널 수만큼, 곧 64장 받아 같은 모양을 낸다. 창을 한 칸씩 옮기고(stride 1) 가장자리를 0으로 채워(padding) 크기가 그대로 남는다. 이 챕터는 끝까지 이 층 하나를 들고 간다.",
    ],
    walk: [
      {
        q: "이 층에 저장된 가중치는 몇 개인가?",
        a: [
          "커널 하나는 3×3 창을 입력 채널 64개에 한 장씩 대므로 숫자가 576개다. 출력 채널마다 커널이 하나씩이니 커널은 64개이고, 합치면 36,864개다.",
          "이것이 이 층의 파라미터 수다. 학습이 정한 숫자의 개수이고, 모델 파일에 적혀 있다가 계산할 때마다 메모리에서 읽혀 오는 숫자의 개수다. 어떤 사진을 넣든 이 수는 같다.",
        ],
      },
      {
        q: "출력 숫자 하나를 만드는 데 MAC이 몇 번 드나?",
        a: [
          "창 안의 입력 576개와 커널의 576개를 같은 자리끼리 곱해 누적 합에 더한다. 곱하고 더하기 한 쌍이 MAC 한 번이니, 출력 숫자 하나에 576번이다.",
          "출력 숫자는 위치 3,136곳에 채널 64개라 200,704개다. 전부 합치면 약 1억 1560만 MACs다.",
          "논문에 따라 곱셈과 덧셈을 따로 세어 FLOPs(floating-point operations, 부동소수점 연산 횟수)로 적는다. 그러면 MAC 한 번이 FLOP 2개이고 이 층은 231,211,008 FLOPs다. 같은 층인데 단위에 따라 숫자가 두 배 차이 난다. 표를 비교할 때 무엇을 셌는지부터 확인해야 하는 이유다.",
        ],
      },
      {
        q: "가중치는 36,864개인데 MACs는 왜 3천 배가 넘나?",
        a: [
          "같은 가중치를 여러 번 쓰기 때문이다. 도장 하나를 종이의 모든 자리에 찍듯, 커널의 숫자 하나는 3,136곳에서 한 번씩 곱해진다. 파라미터 수에 위치 수를 곱하면 그대로 MACs다.",
          "그래서 두 수는 다른 것을 센다. 파라미터는 저장된 숫자의 개수이고 MACs는 그 숫자들이 쓰인 횟수다. 둘을 잇는 것은 커널이 쓰이는 위치의 수다.",
        ],
      },
      {
        q: "하나만 바꾸면 무엇이 그대로이고 무엇이 달라지나?",
        a: [
          "읽기 전에 어림해 보라. 사진을 가로세로 절반으로 줄이면 feature map도 절반이 되는데, 커널은 그대로라 파라미터도 그대로다. 커널이 쓰이는 위치만 4분의 1이 되어 MACs가 4분의 1이 된다.",
          "채널을 두 배로 늘리면 커널 하나가 두 배로 커지고 커널 수도 두 배가 되어 파라미터가 4배다. 위치 수는 그대로이므로 MACs도 4배다. 창을 1×1로 줄이면 둘 다 9분의 1이다.",
          "해상도만 바꾸면 파라미터는 그대로인데 MACs가 바뀐다. 그러니 파라미터 수는 계산량을 대신하지 못한다.",
        ],
      },
    ],
    formula: "\\text{params} = k^2\\, C_{\\text{in}}\\, C_{\\text{out}}, \\qquad \\text{MACs} = k^2\\, C_{\\text{in}}\\, C_{\\text{out}} \\times H\\, W, \\qquad \\text{FLOPs} = 2 \\times \\text{MACs}\n3^2 \\cdot 64 \\cdot 64 = 36{,}864, \\qquad 36{,}864 \\times 56 \\cdot 56 = 115{,}605{,}504",
    symbols: [
      "k: 창의 한 변. 그림의 3",
      "C_in, C_out: 입력 채널과 출력 채널의 수. 둘 다 64",
      "H, W: 출력 feature map의 세로와 가로. 둘 다 56. H × W가 커널이 쓰이는 위치의 수다",
      "params: 저장된 가중치의 개수. 식에 H와 W가 없다",
      "MACs: 곱셈-덧셈 쌍의 횟수. params에 위치 수를 곱한 것이다",
    ],
    takeaway: "파라미터는 저장된 가중치의 개수이고 MACs는 그 가중치가 쓰인 횟수다. 해상도는 앞의 것을 그대로 두고 뒤의 것만 바꾼다.",
    see: "단계를 차례로 눌러 보라. 첫 단계는 커널을 세어 파라미터를 낸다. 둘째 단계는 출력의 주황 칸 하나에 들어가는 MAC을 센다. 입력 위의 주황 기둥이 그 칸이 읽는 창이다. 셋째 단계는 출력 숫자 전체를 곱한다. 아래 두 막대가 파라미터와 MACs이고, 원래 층을 기준으로 한 배수를 가로축 한 칸마다 두 배로 그린다. \"바꿔 보기\"에서 해상도 절반을 누르면 feature map이 작아지고 위 막대는 그대로, 아래 막대만 4분의 1이 된다. 채널 두 배에서는 둘 다 4배, 1×1 커널에서는 둘 다 9분의 1이다.",
    bridge: "MACs를 셌다. 장치가 초당 계산을 몇 번 하는지 알면 나눗셈 한 번으로 시간이 나올 것 같다. 그런데 곱하려면 숫자가 먼저 계산하는 곳까지 와 있어야 한다.",
  },
  {
    id: "bytes", num: "02", kicker: "계산과 메모리",
    question: "MACs를 알면 걸리는 시간을 알 수 있나?",
    gist: [
      "그것만으로는 모른다. 층 하나의 시간은 두 시간 가운데 긴 쪽이다. 계산 시간은 FLOPs를 장치의 계산 속도(FLOP/s)로 나눈 것이다. 메모리 I/O 시간은 메모리와 칩 사이를 오가는 바이트, 곧 memory traffic을 메모리 대역폭(bandwidth)으로 나눈 것이다. 계산이 길면 그 층은 compute-bound, 메모리가 길면 memory-bound다.",
      "작업대와 창고에 빗대 보자. 칩 안의 계산 장치와 작은 메모리(SRAM)가 작업대이고, 칩 밖의 큰 메모리(DRAM, GPU에서는 HBM)가 창고다. 손이 일하는 속도가 계산 속도이고, 창고에서 수레로 재료가 오는 속도가 대역폭이다. 재료가 작업대에 와 있어야 손이 일한다.",
      "그래서 재료 한 바이트로 계산을 몇 번 하느냐가 갈림길이고, 이 값을 arithmetic intensity(연산 강도)라 한다. 많이 하면 손이 바쁘고, 조금만 하면 손이 수레를 기다린다.",
    ],
    lead: [
      "시간을 재려면 장치가 있어야 한다. 이 챕터는 설명을 위해 장치 하나를 손으로 정한다. 계산 속도는 4 TFLOP/s, 곧 초당 FLOP 4조 개다. 메모리 대역폭은 40GB/s, 곧 창고에서 작업대로 초당 400억 바이트가 온다. 어느 실제 장치의 값도 아니다. 두 속도가 따로 있다는 것을 보이려고 고른 숫자다.",
      "숫자 하나는 2바이트(FP16)로 적는다. 장치와 층은 그대로 두고, 이 절에서는 대역폭 하나만 바꿔 본다.",
    ],
    walk: [
      {
        q: "계산만 보면 이 층은 얼마나 걸리나?",
        a: [
          "앞 절의 FLOPs를 초당 4조 개로 나누면 57.8µs(마이크로초)다.",
          "이것은 손이 한순간도 쉬지 않을 때의 시간이다. 쉬지 않으려면 곱할 숫자가 늘 제때 작업대에 와 있어야 한다.",
        ],
      },
      {
        q: "창고에서 작업대로 옮겨야 하는 바이트는 얼마인가?",
        a: [
          "세 가지다. 가중치, 입력 feature map, 출력 feature map이다. 출력은 계산이 끝나면 창고에 다시 써야 한다. 합치면 약 0.88MB다.",
          "여기에는 가정이 하나 있다. 모든 숫자를 창고에서 딱 한 번 읽거나 쓴다는 것이다. 실제 장치에서는 작업대가 좁아 같은 숫자를 여러 번 가져오기도 하므로, 이 수는 memory traffic의 가장 적은 경우다.",
          "비율을 보라. 92%가 입력과 출력 feature map이고 가중치는 8%다. 이 층에서는 파라미터보다 feature map이 훨씬 무겁다.",
        ],
      },
      {
        q: "메모리 I/O는 얼마나 걸리고, 둘 중 무엇이 시간을 정하나?",
        a: [
          "0.88MB를 40GB/s로 옮기면 21.9µs다. 계산의 57.8µs보다 짧다.",
          "장치는 옮기면서 동시에 계산한다. 수레가 다음 재료를 가져오는 동안 손은 이미 와 있는 재료로 일한다. 두 일이 겹치면 걸리는 시간은 긴 쪽이다. 이 층은 57.8µs이고, 계산이 끝날 때 운반은 이미 끝나 있다. 이 층은 compute-bound다.",
        ],
      },
      {
        q: "대역폭만 바꾸면 시간이 어떻게 되나?",
        a: [
          "그림에서 대역폭을 낮춰 보라. 한동안은 메모리 I/O만 길어지고 여전히 계산보다 짧아서 시간은 그대로다. 10GB/s까지 내리면 메모리 I/O가 계산을 넘어 시간이 87.7µs가 된다. 그동안 손은 꽤 오래 수레를 기다린다. 층이 memory-bound가 됐다.",
          "둘이 같아지는 대역폭은 15.2GB/s다. 그보다 빠른 장치에서 이 층의 시간은 계산이 정하고, 느린 장치에서는 메모리가 정한다.",
        ],
      },
      {
        q: "층마다 어느 쪽이 될지 미리 알 수 있나?",
        a: [
          "FLOPs를 memory traffic으로 나누면 된다. 바이트 하나를 가져와서 계산을 몇 번 하느냐다. 이 층은 263.8 FLOP/byte이고, 이것이 이 층의 arithmetic intensity다.",
          "장치 쪽에도 같은 단위의 숫자가 있다. 계산 속도 P를 대역폭 B로 나눈 P/B다. 손을 쉬지 않게 하려면 바이트 하나로 계산을 몇 번 해야 하는지를 뜻하고, 이 장치에서는 100이다. 이 값을 ridge point라 한다. 층의 arithmetic intensity가 ridge point보다 크면 compute-bound, 작으면 memory-bound다.",
          "대역폭을 10GB/s로 내리면 ridge point가 올라가 이 층의 arithmetic intensity를 넘고, 이 층이 memory-bound 쪽으로 넘어간다. 이 비교를 그림 한 장에 그린 것이 roofline이고 다음 절에서 쓴다.",
        ],
      },
    ],
    formula: "t \\approx \\max\\!\\Big(\\frac{\\text{FLOPs}}{P},\\; \\frac{\\text{bytes}}{B}\\Big), \\qquad I = \\frac{\\text{FLOPs}}{\\text{bytes}} \\;\\;\\text{vs}\\;\\; \\frac{P}{B}\n\\max\\!\\Big(\\frac{231.2\\,\\text{M}}{4\\,\\text{T/s}},\\; \\frac{0.877\\,\\text{MB}}{40\\,\\text{GB/s}}\\Big) = \\max(57.8,\\ 21.9)\\ \\mu\\text{s}",
    symbols: [
      "P: 장치의 최대 계산 속도(FLOP/s). 손으로 정한 4조",
      "B: 메모리 대역폭(bytes/s). 손으로 정한 40GB이고 그림의 손잡이다",
      "bytes: memory traffic. 가중치, 입력 feature map, 출력 feature map의 바이트를 더한 것",
      "I: 층의 arithmetic intensity. 이 층은 263.8",
      "P/B: 장치의 ridge point. 두 제한이 만나는 arithmetic intensity이고 40GB/s에서 100",
    ],
    takeaway: "층 하나의 시간은 계산 시간과 메모리 I/O 시간 가운데 긴 쪽이다. 어느 쪽이 긴지는 층의 arithmetic intensity와 장치의 ridge point(P/B)를 비교하면 안다.",
    see: "위 막대가 memory traffic을 가중치, 입력, 출력으로 나눈 것이다. 가운데 두 막대가 계산 시간과 메모리 I/O 시간이고, 진한 테두리가 붙은 쪽이 실제로 걸리는 시간이다. 대역폭을 40GB/s에서 낮춰 보라. 20GB/s까지는 걸리는 시간이 바뀌지 않는다. 15GB/s에서 메모리가 계산을 넘고, 그 아래로는 시간이 메모리를 따라 늘어난다. memory-bound일 때는 계산이 기다리는 몫이 오른쪽에 적힌다. 맨 아래 줄은 층의 arithmetic intensity와 장치의 ridge point를 한 눈금 위에 찍는다. 장치의 값은 모두 손으로 정했다. 실제 장치에는 이 그림에 없는 시간이 더 있다. 장치에 일을 시킬 때마다 드는 고정 시간, 작업대가 모자라 다시 읽는 시간 같은 것이다.",
    bridge: "이 층은 compute-bound다. 그렇다면 곱셈을 줄이면 시간이 그만큼 줄 것이다. 2017년 MobileNet의 방법은 이 층의 MACs를 8분의 1 가까이로 줄인다. 시간도 8분의 1이 되나?",
  },
  {
    id: "separable", num: "03", kicker: "MACs를 줄이면",
    question: "MACs를 8분의 1로 줄이면 8배 빨라지나?",
    gist: [
      "아니다. MobileNet의 depthwise separable convolution은 conv 하나를 두 층으로 쪼개 MACs를 8분의 1 가까이로 줄인다. 그런데 memory traffic은 거의 그대로다. 이 층의 바이트는 대부분 입력과 출력 feature map인데, 쪼개도 feature map의 모양은 같기 때문이다. 층이 memory-bound로 넘어가고, 시간은 3분의 1 남짓으로만 준다.",
      "작업대로 말하면 손이 할 일은 크게 줄었는데 수레가 실어 올 재료는 그대로인 셈이다. 손이 수레보다 빨라지는 순간부터는 손을 더 빠르게 해도 소용없다.",
      "이 꺾이는 모양을 그린 것이 roofline이다. 층이 낼 수 있는 계산 속도는 arithmetic intensity를 따라 비탈(대역폭)로 오르다가, ridge point에서 평평한 지붕(최대 계산 속도)을 만난다.",
    ],
    lead: [
      "3×3 conv는 한 번에 두 가지 일을 한다. 이웃 위치를 모으는 일과 채널을 섞는 일이다. 2017년 Howard 등의 MobileNet은 이 둘을 두 층으로 떼어 냈다. 같은 자리에 두 층을 넣고 앞 절의 장치에서 다시 센다. 입력과 출력의 모양은 원래 층과 같다.",
    ],
    walk: [
      {
        q: "두 층으로 쪼개면 무엇을 어떻게 계산하나?",
        a: [
          "첫 층은 depthwise 3×3이다. 커널 하나가 채널 하나만 맡아서, 출력 숫자 하나에 MAC이 9번이다. 이웃 위치는 모으지만 채널은 섞지 않는다.",
          "둘째 층은 pointwise, 곧 1×1 conv다. 병목 블록에서 채널 수를 바꾸던 바로 그 conv다. 한 위치의 채널 값 64개를 받아 가중합을 내므로 출력 숫자 하나에 MAC이 64번이다. 채널은 섞지만 이웃 위치는 보지 않는다.",
          "둘을 이은 것이 depthwise separable convolution이다. 원래 층과 같은 모양을 받아 같은 모양을 낸다. 같은 계산은 아니다. 가중치가 훨씬 적어서 낼 수 있는 출력의 종류가 좁다.",
        ],
      },
      {
        q: "MACs와 파라미터는 얼마로 주나?",
        a: [
          "MACs는 두 층을 합쳐 원래의 7.89분의 1이다. 파라미터도 36,864개에서 4,672개로 같은 비율로 준다.",
          "MobileNet 논문은 이 비율을 아래의 식 하나로 적었다. 출력 채널이 많을수록 9분의 1에 가까워지고, 그래서 논문은 계산이 8에서 9분의 1로 준다고 적었다.",
          "남은 MACs의 88%는 pointwise에 있다. MobileNet 논문의 표에서도 망 전체 MACs의 94.86%가 1×1 conv였다.",
        ],
      },
      {
        q: "memory traffic은 얼마나 주나?",
        a: [
          "거의 줄지 않는다. 가중치의 바이트는 크게 줄었지만, 앞 절에서 본 대로 이 층의 바이트는 92%가 입력과 출력 feature map이다. feature map의 모양은 그대로이므로 합은 7%만 준다.",
          "이것은 두 층을 한 단계로 묶어 돌려서(fusion) 가운데 feature map이 작업대를 떠나지 않을 때다. 두 층을 따로 돌리면 depthwise가 낸 feature map을 창고에 썼다가 pointwise가 다시 가져온다. 그만큼 늘어 memory traffic이 원래 층의 1.84배가 된다. MACs는 8분의 1 가까이 됐는데 memory traffic은 두 배 가까이 됐다.",
        ],
      },
      {
        q: "그래서 시간은 얼마인가?",
        a: [
          "fusion으로 돌리면 메모리 I/O가 20.3µs로 계산보다 길어서 시간이 20.3µs다. MACs는 7.89분의 1이 됐는데 시간은 2.85분의 1로만 줄었다.",
          "시간을 정하는 쪽이 바뀌었기 때문이다. 원래 층은 compute-bound라서 곱셈을 줄이면 시간이 줄었다. 줄이다 보니 계산 시간이 메모리 I/O 시간 아래로 내려갔고, 거기서부터는 곱셈을 더 줄여도 시간이 줄지 않는다. arithmetic intensity로 보면 263.8에서 36.1로 떨어져 ridge point 100보다 작아졌다.",
          "따로 돌리면 메모리 I/O를 두 단계가 따로 치러서, 원래보다 1.43배 빠를 뿐이다.",
        ],
      },
      {
        q: "장치가 바뀌면 이 비교도 바뀌나?",
        a: [
          "그림에서 대역폭을 80GB/s로 올려 보라. 원래 층은 compute-bound라 그대로이고, 쪼갠 층은 메모리 I/O가 절반이 되어 빨라진 배수가 5.69배로 커진다.",
          "20GB/s로 내리면 반대다. fusion으로 돌린 쪽도 1.42배 빠를 뿐이고, 따로 돌린 쪽은 원래 층보다 느려진다. MACs가 8분의 1 가까이인 층이 더 느리다.",
          "MobileNet 논문은 MACs가 적은 것만으로는 부족하고 그 연산을 효율적으로 구현할 수 있어야 한다고 썼다. 그래서 MACs의 거의 전부를 pointwise conv에 몰았다. pointwise conv는 메모리에서 순서를 다시 늘어놓지 않고 바로 행렬 곱(GEMM)으로 돌릴 수 있기 때문이다.",
        ],
      },
    ],
    formula: "\\frac{D_K^2\\, M\\, D_F^2 + M\\, N\\, D_F^2}{D_K^2\\, M\\, N\\, D_F^2} = \\frac{1}{N} + \\frac{1}{D_K^2} = \\frac{1}{64} + \\frac{1}{9} \\approx \\frac{1}{7.89}\n\\text{attainable FLOP/s} = \\min(P,\\; B \\times I)",
    symbols: [
      "D_K: 창의 한 변. 3",
      "M, N: 입력 채널과 출력 채널. 둘 다 64",
      "D_F: feature map의 한 변. 56. 분자와 분모에 다 있어서 비율에서는 사라진다",
      "min(P, B × I): roofline. arithmetic intensity가 I인 층이 낼 수 있는 가장 높은 계산 속도다. 그림 아래의 꺾인 선",
    ],
    takeaway: "MACs를 줄이면 compute-bound인 동안만 시간이 준다. memory traffic이 그대로이면 어느 지점부터는 MACs를 줄여도 시간이 줄지 않는다.",
    see: "층을 바꿔 보라. 위의 세 막대가 원래 층을 1로 놓고 MACs, memory I/O 바이트, 시간을 비교한다. 40GB/s에서 fusion으로 돌린 쪽은 MACs 막대가 0.13으로 줄지만 memory I/O 막대는 0.93에 머물고 시간은 0.35다. 따로 돌리면 memory I/O가 두 배 가까이로 늘고 시간은 0.70이다. 아래 그림이 roofline이다. 가로축이 arithmetic intensity, 세로축이 낼 수 있는 계산 속도이고 둘 다 한 칸마다 열 배다. 평평한 지붕이 최대 계산 속도이고 비탈이 대역폭이다. 원래 층의 점은 지붕 위에, 쪼갠 층의 점은 비탈 위에 있다. 따로 돌리면 점이 단계마다 하나씩 둘이다. 대역폭을 바꾸면 비탈과 꺾이는 점이 옮겨 간다. 장치의 값은 손으로 정했다.",
    bridge: "MACs가 같으면 시간도 같은가? 이 챕터의 층과 MACs가 정확히 같은 층이 ResNet-50 안에 하나 더 있다.",
  },
  {
    id: "twin", num: "04", kicker: "같은 MACs, 다른 층",
    question: "MACs가 똑같은 두 층은 같은 시간이 걸리나?",
    gist: [
      "아니다. ResNet-50의 앞쪽 단계와 뒤쪽 단계에 있는 두 3×3 conv는 MACs가 정확히 같다. 그런데 뒤쪽 층은 가중치가 훨씬 많고, 그 가중치를 쓰는 위치는 훨씬 적다. 가중치 하나를 창고에서 가져와 몇 번밖에 못 쓰니 arithmetic intensity가 낮고, 이 장치에서 memory-bound가 되어 두 배 넘게 느리다.",
      "도장으로 말하면 앞쪽 층은 작은 도장 한 벌을 큰 종이 곳곳에 수천 번씩 찍는다. 뒤쪽 층은 커다란 도장을 잔뜩 실어 와서 작은 종이에 몇십 번씩만 찍는다. 찍는 횟수의 합은 같지만, 뒤쪽은 도장을 창고에서 실어 오는 데 시간을 다 쓴다.",
      "그래서 한 모델 안에서도 앞쪽 층은 activation이 무겁고 뒤쪽 층은 가중치가 무겁다.",
    ],
    lead: [
      "ResNet-50은 단계(stage)가 넷이고, 마지막 단계(layer4)의 병목 블록 가운데에도 3×3 conv가 있다. feature map은 7×7로 작고 채널은 512개다. 이것을 뒤쪽 층이라 하고, 챕터가 들고 온 layer1의 층을 앞쪽 층이라 하자. 둘을 나란히 놓고 네 가지를 하나씩 센다. 장치는 앞 절과 같다.",
    ],
    walk: [
      {
        q: "MACs는 몇 번인가?",
        a: [
          "출력 숫자 하나에 MAC이 4,608번이고 출력 숫자는 25,088개다. 곱하면 앞쪽 층과 똑같은 1억 1560만 번이다.",
          "우연이 아니다. ResNet은 단계가 바뀔 때마다 feature map의 한 변을 절반으로, 채널을 두 배로 바꾼다. MACs는 채널의 제곱과 위치 수의 곱에 비례하므로, 채널의 제곱이 4배가 되고 위치 수가 4분의 1이 되어 서로 지운다.",
        ],
      },
      {
        q: "파라미터는?",
        a: [
          "2,359,296개로 앞쪽 층의 64배다. 채널이 8배라 제곱으로 64배가 됐고, 파라미터에는 feature map 크기가 들어가지 않으므로 줄어드는 몫이 없다.",
          "MACs는 같은데 파라미터는 64배다. 01절에서는 해상도를 바꿔도 파라미터가 그대로여서, 파라미터가 MACs를 대신하지 못했다. 이번에는 MACs가 파라미터를 대신하지 못한다.",
        ],
      },
      {
        q: "실행하는 동안 생겨나는 숫자는?",
        a: [
          "입력 feature map은 25,088개로 앞쪽 층의 8분의 1이다. 출력도 같다. 이렇게 계산 도중에 생겨 다음 층으로 넘어가는 값을 activation(활성값)이라 한다. 파라미터는 모델 파일에 적혀 있지만 activation은 사진을 넣어야 생긴다.",
          "그래서 두 층의 무게가 반대 방향이다. 앞쪽 층은 activation이 가중치보다 훨씬 무겁고, 뒤쪽 층은 가중치가 activation보다 훨씬 무겁다. 파라미터가 64분의 1인 앞쪽 층이 activation은 8배를 쓴다. 그림의 셋째 단계에서 activation 바이트를 비교해 보라.",
        ],
      },
      {
        q: "그러면 시간은?",
        a: [
          "계산 시간은 둘 다 57.8µs다. FLOPs가 같기 때문이다. memory traffic은 뒤쪽 층이 5.5배이고 메모리 I/O 시간이 120.5µs로 계산보다 길다. 뒤쪽 층은 memory-bound이고 시간은 120.5µs, 앞쪽 층의 2.08배다.",
          "arithmetic intensity로 보면 앞쪽 층이 263.8, 뒤쪽 층이 48.0이다. 가중치 하나가 앞쪽 층에서는 3,136곳에서 쓰이고 뒤쪽 층에서는 49곳에서만 쓰인다. 한 번 가져와서 적게 쓰니 바이트당 계산이 적다.",
          "MACs가 같은 두 층이 이 장치에서 두 배 넘게 차이 난다. 파라미터가 많은 쪽이 느렸지만, 파라미터가 많아서라기보다 가져온 숫자를 몇 번 다시 쓰느냐가 달라서다. 다음 절에서 그 횟수를 바꿔 본다.",
        ],
      },
    ],
    formula: "\\text{MACs} = k^2\\, C^2\\, H^2: \\qquad 9 \\cdot 64^2 \\cdot 56^2 = 9 \\cdot 512^2 \\cdot 7^2 = 115{,}605{,}504\n\\text{uses per weight} = H\\, W: \\qquad 3{,}136 \\;\\;\\text{vs}\\;\\; 49",
    symbols: [
      "C: 입력 채널이자 출력 채널. 앞쪽 층은 64, 뒤쪽 층은 512",
      "H: feature map의 한 변. 56과 7",
      "H W: 가중치 하나가 쓰이는 위치의 수. 한 번 가져온 숫자를 몇 번 쓰는지다",
    ],
    takeaway: "MACs가 같아도 파라미터, activation, memory traffic은 따로 움직인다. 가져온 숫자 하나를 몇 번 쓰는지가 시간을 가른다.",
    see: "단계를 하나씩 눌러 보라. 왼쪽이 앞쪽 층(layer1), 오른쪽이 뒤쪽 층(layer4)이다. 상자의 앞면이 feature map의 가로세로이고 깊이가 채널 수다. 단계마다 줄이 하나씩 늘고, 두 값이 같으면 초록, 다르면 빨강으로 몇 배인지 적힌다. MACs만 초록이다. 마지막 단계의 시간 막대에서 파랑이 계산, 주황이 메모리 I/O다. 앞쪽 층은 파랑이 길고 뒤쪽 층은 주황이 길다.",
    bridge: "뒤쪽 층은 가중치 4.7MB를 창고에서 가져와 사진 한 장에만 쓴다. 사진 여러 장을 한꺼번에 넣으면 같은 가중치를 한 번 가져와 여러 장에 쓸 수 있다. 그러면 빨라지나? 빨라진다면 무엇이 빨라지나?",
  },
  {
    id: "batch", num: "05", kicker: "한 장과 여러 장",
    question: "사진 여러 장을 한꺼번에 넣으면 무엇이 빨라지나?",
    gist: [
      "\"빠르다\"는 두 가지다. latency(지연 시간)는 입력 하나를 넣고 그 결과가 나오기까지의 시간이고, throughput(처리량)은 초당 끝내는 입력의 수다. 사진 여러 장을 한 번에 넣는 batch는 가중치를 한 번 가져와 여러 장에 쓰게 해서 memory-bound 층의 throughput을 올린다. latency는 줄지 않고 오히려 는다.",
      "식당 주방과 같다. 같은 요리 네 접시를 한꺼번에 하면 창고에서 재료(가중치)를 한 번 꺼내 와 네 접시에 나눠 쓰니 시간당 내는 접시 수가 는다. 하지만 내 접시가 먼저 나오지는 않는다. 네 접시가 다 될 때 함께 나온다.",
      "흔히 throughput이 두 배면 사진 한 장도 두 배 빨리 나온다고 생각한다. 그렇지 않다. 그리고 손이 쉬지 않고 돌기 시작하면(compute-bound) batch를 더 키워도 throughput이 오르지 않는다.",
    ],
    lead: [
      "한 번에 넣는 사진의 수를 batch 크기라 한다. 지금까지는 1이었다. 두 층과 장치는 그대로 두고 batch 크기만 바꾼다. 가중치는 batch 전체에 한 번만 가져오고 feature map은 사진마다 따로 오간다.",
    ],
    walk: [
      {
        q: "뒤쪽 층에 사진 두 장을 한꺼번에 넣으면 얼마나 걸리나?",
        a: [
          "계산은 두 배인 115.6µs다. memory traffic은 가중치 한 벌에 feature map 두 장 몫을 더한 것이라 메모리 I/O가 123.0µs다. 사진 한 장일 때의 120.5µs와 거의 같다. memory traffic의 대부분이 가중치였는데 그것을 두 장이 나눠 쓰기 때문이다.",
          "걸리는 시간은 긴 쪽인 123.0µs다. 두 장이 123.0µs에 끝나니 초당 16,262장을 처리한다. 한 장씩 넣을 때의 8,301장의 두 배 가까이다.",
        ],
      },
      {
        q: "그러면 사진 한 장이 끝나는 시간도 줄었나?",
        a: [
          "줄지 않았다. 늘었다. 한 장만 넣으면 120.5µs 뒤에 결과가 나온다. 두 장을 함께 넣으면 두 장 모두 123.0µs 뒤에 나온다. 사진 한 장의 입장에서는 조금 더 기다렸다.",
          "앞의 것이 latency이고 초당 장 수가 throughput이다. batch를 키우면 throughput은 오를 수 있고 latency는 오른다.",
        ],
      },
      {
        q: "batch를 계속 키우면 throughput이 계속 오르나?",
        a: [
          "batch를 4로 올려 보라. 이번에는 계산이 메모리 I/O보다 길다. 층이 compute-bound가 되고 throughput은 초당 17,300장이다. 더 올려도 17,300장에서 멈춘다. 손이 쉬지 않고 돌고 있어서 더 넣어도 더 빨리 끝낼 수 없다. latency만 batch에 비례해 는다.",
          "앞쪽 층으로 바꿔 보라. 처음부터 compute-bound이니 batch 1에서도 17,300장이고 batch를 키워도 그대로다. 가중치가 memory traffic의 8%뿐이라 나눠 쓸 것이 거의 없다. 이 층에서 batch를 키우면 latency만 는다.",
        ],
      },
      {
        q: "batch를 키우면 메모리는 얼마나 더 드나?",
        a: [
          "가중치는 batch가 몇이든 한 벌이고 feature map은 사진마다 한 벌씩이다. batch 8에서 합하면 앞쪽 층이 6.50MB, 뒤쪽 층이 5.52MB다. batch 7부터는 파라미터가 64분의 1인 앞쪽 층이 메모리를 더 쓴다.",
          "그러니 파라미터 수는 실행 중 메모리도 대신하지 못한다. 실행 중 메모리에는 사진 크기와 batch 크기를 따라 느는 activation이 들어 있고, 앞쪽 층에서는 그 몫이 파라미터보다 크다.",
        ],
      },
    ],
    formula: "t(n) = \\max\\!\\Big(\\frac{n\\,F}{P},\\; \\frac{W + n\\,A}{B}\\Big), \\qquad \\text{latency} = t(n), \\qquad \\text{throughput} = \\frac{n}{t(n)}",
    symbols: [
      "n: batch 크기. 그림의 손잡이",
      "F: 사진 한 장의 FLOPs. 두 층이 같다",
      "W: 가중치의 바이트. batch 전체에 한 번 가져온다",
      "A: 사진 한 장의 입력과 출력 feature map 바이트",
      "latency: 한 batch가 끝나기까지의 시간. 그 batch에 든 사진 하나가 기다리는 시간이다",
      "throughput: 초당 끝내는 사진 수",
    ],
    takeaway: "latency는 입력 하나가 기다리는 시간이고 throughput은 초당 끝내는 입력의 수다. batch는 throughput을 올릴 수 있지만 latency를 줄이지는 않는다.",
    see: "batch 크기를 올려 보라. 위 그래프가 batch마다의 throughput이고 가운데 그래프가 latency다. 선 둘이 두 층이고 고른 층이 진하다. 점의 색은 그 batch에서 시간을 정하는 쪽이다. 파랑이 compute-bound, 주황이 memory-bound다. 뒤쪽 층은 batch 1에서 2로 갈 때 throughput이 두 배 가까이 되고 4부터 17,300장에서 평평해진다. 앞쪽 층은 처음부터 평평하다. latency는 두 층 모두 batch를 키우면 늘어난다. 맨 아래 막대는 지금 고른 층과 batch에서 메모리에 들고 있어야 하는 바이트를 가중치와 feature map으로 나눈 것이다. 장치는 앞 절들과 같고 손으로 정한 값이다.",
    bridge: "\"빠르다\"를 말하려면 장치와 batch 크기를 함께 말해야 한다. 휴대폰에서 사진 한 장을 바로 처리해야 한다면 batch 1의 latency가 중요하다. RepViT 논문은 그 조건을 표에 정확히 적었다. 그 표를 이 챕터의 말로 읽어 보자.",
  },
  {
    id: "repvit", num: "06", kicker: "RepViT의 잣대",
    question: "RepViT는 왜 FLOPs가 아니라 iPhone 12에서 잰 latency를 적었나?",
    gist: [
      "휴대폰에서 사진을 한 장씩 처리하는 쓰임이라면, 그 쓰임을 그대로 재는 것이 가장 믿을 만한 잣대이기 때문이다. 실제로 RepViT 논문의 표에서 MACs가 같은 모델끼리 latency가 크게 갈리고, 장치를 GPU로 바꾸면 빠른 순서가 뒤집히기도 한다.",
      "지도 위의 거리와 출근길에 걸리는 시간의 차이와 같다. 거리(MACs)가 같은 두 길도 신호와 차선(장치의 대역폭, 변환 도구가 묶어 주는 연산)에 따라 걸리는 시간이 다르다. 내 출근 시간이 궁금하면 출근 시간대에 그 길을 직접 달려 봐야 한다. RepViT에게 그 길은 iPhone 12와 batch 1이었다.",
    ],
    lead: [
      "2023년 Ao Wang, Hui Chen, Zijia Lin, Jungong Han, Guiguang Ding은 휴대폰용 경량 모델을 설계하고 있었다. 비교할 상대는 두 갈래였다. MobileNet처럼 conv로 만든 경량 CNN과, 사진을 patch로 잘라 Transformer에 넣는 ViT를 가볍게 줄인 경량 ViT다. 이 논문은 CVPR 2024에 실렸다.",
    ],
    walk: [
      {
        q: "논문은 무엇을 어떻게 쟀나?",
        a: [
          "RepViT 논문은 FLOPs나 모델 크기가 휴대폰에서의 실제 latency와 잘 맞지 않는다고 적고, 장치에서 직접 재기로 했다. 장치는 iOS 16의 iPhone 12이고, 모델은 Core ML Tools로 변환해 batch 1로 돌린다. 이 챕터의 말로 하면 한 장치에서 사진 한 장씩 latency를 쟀다.",
          "설계도 이 잣대로 했다. MobileNetV3-L에서 출발해 구조를 한 단계씩 바꾸고, 바꿀 때마다 iPhone의 latency와 ImageNet 정확도를 다시 쟀다. 같은 학습 설정으로 맞춘 출발점이 1.01ms에 71.5%였고 마지막 단계가 0.87ms에 77.4%였다. 논문이 보고한 값이다.",
        ],
      },
      {
        q: "MACs가 같은 모델들은 latency도 같았나?",
        a: [
          "논문의 표에는 MACs가 1.3 GMACs(MAC 10억 번 단위)로 같은 모델이 셋 있다. 그런데 latency는 1.1ms에서 1.6ms까지 갈려, 가장 느린 EfficientFormerV2-S2가 가장 빠른 RepViT-M1.1의 1.45배다.",
          "파라미터도 latency를 대신하지 못한다. 이 가운데 EfficientFormer 두 모델은 파라미터도 1230만 개와 1260만 개로 거의 같은데 latency가 갈린다. 파라미터가 더 적은데 더 느린 모델도 표에 있다.",
        ],
      },
      {
        q: "MACs가 절반인 모델은 더 빨랐나?",
        a: [
          "EfficientFormerV2-S0과 RepViT-M0.9를 보자. 앞의 것이 MACs가 절반이고 파라미터도 더 적다. 그런데 iPhone의 latency는 둘 다 0.9ms이고, ImageNet 정확도는 뒤의 것이 78.7%로 75.7%보다 높다.",
          "MACs를 절반으로 줄인 것이 이 장치에서는 시간으로 돌아오지 않았다. 03절의 쪼갠 층에서 MACs는 크게 줄었는데 memory traffic이 그대로여서 시간이 그만큼 줄지 않았던 것처럼, MACs 말고도 시간을 정하는 것이 있다는 뜻이다. 다만 표는 그것이 무엇인지까지 나눠 보여 주지는 않는다.",
        ],
      },
      {
        q: "장치를 바꾸고 batch를 키워 재면 순서가 같을까?",
        a: [
          "같은 표에 throughput이 함께 있다. RTX 3090 GPU에서, 메모리에 들어가는 가장 큰 2의 거듭제곱 batch로 잰 값이다. 05절의 말로 하면 장치를 바꾸고 batch를 키워 throughput을 쟀다.",
          "iPhone에서 똑같이 0.9ms였던 두 모델이 GPU에서는 크게 갈린다. throughput이 RepViT 쪽은 초당 4,817장, EfficientFormerV2 쪽은 1,274장으로 3.8배다. 순서가 뒤집히는 쌍도 있다. iPhone에서 더 빠른 EfficientFormerV2-S1이 GPU에서는 EfficientFormer-L1보다 세 배 가까이 적게 처리한다.",
          "어느 모델이 빠른지는 장치와 batch를 말해야 정해진다. 휴대폰에서 사진 한 장을 처리하는 쓰임이라면 iPhone의 batch 1 latency가 그 쓰임에 맞는 잣대다. RepViT는 그 잣대를 앞세우고 GPU throughput을 옆에 함께 적었다.",
        ],
      },
      {
        q: "이 표가 보여 주지 않는 것은 무엇인가?",
        a: [
          "latency는 iPhone 12와 Core ML Tools의 조합에서 잰 값이다. 다른 휴대폰이나 다른 변환 도구에서는 순서가 달라질 수 있다. 같은 표의 GPU throughput이 이미 다른 순서를 보여 준다.",
          "시간이 왜 그렇게 나왔는지도 표에는 없다. 어느 층이 memory-bound였는지는 장치 안을 따로 들여다봐야 안다. 그리고 latency가 0.1ms 단위로 적혀 있어서, 0.9ms인 두 모델이 정확히 같은 시간이라는 뜻은 아니다.",
        ],
      },
    ],
    takeaway: "RepViT는 휴대폰에서 사진 한 장을 처리하는 쓰임에 맞춰 iPhone의 batch 1 latency로 모델을 비교했다. 같은 표에서 MACs가 같은 모델의 latency가 1.45배까지 갈리고, GPU throughput으로 재면 순서가 뒤집히기도 한다.",
    see: "점 하나가 RepViT 논문 표의 모델 하나다. 가로축이 GMACs, 세로축이 iPhone의 latency이고 둘 다 한 칸마다 두 배다. 주황이 RepViT, 파랑이 EfficientFormerV2, 회색이 나머지다. \"같은 1.3 GMACs\"를 누르면 세로 한 줄에 선 세 점에 이름이 붙고, \"0.9ms의 두 모델\"을 누르면 가로로 나란한 두 점에 이름이 붙는다. \"뒤집히는 두 모델\"은 장치를 바꾸면 순서가 바뀌는 쌍이다. 세로축을 GPU throughput으로 바꾸면 같은 점들이 다시 늘어선다. 이때는 위로 갈수록 많이 처리한다. 숫자는 모두 논문이 보고한 값이다.",
    bridge: "RepViT는 분류 모델이라 망이 낸 숫자에서 바로 답을 고른다. 검출 모델은 그렇지 않다. 망이 bounding box를 잔뜩 내놓은 뒤 겹친 것을 지우는 단계가 더 있다. 그 단계는 파라미터에도 FLOPs에도 잡히지 않는다. 시간에는 잡히나?",
  },
  {
    id: "yolov10", num: "07", kicker: "YOLOv10의 잣대",
    question: "YOLOv10은 왜 후처리까지 넣은 latency를 쟀나?",
    gist: [
      "검출 모델은 망의 forward가 끝난 뒤에 겹친 bounding box를 지우는 후처리, NMS(non-maximum suppression)를 돌린다. NMS에는 파라미터도 FLOPs도 없지만 장치에서는 시간이 든다. 망만 재면 사용자가 실제로 기다리는 시간을 놓친다. 그래서 YOLOv10은 후처리까지 넣은 end-to-end latency와 forward만의 latency를 나란히 적었다.",
      "택배에 빗대면 forward는 공장에서 물건을 만드는 시간이고 NMS는 물류센터에서 분류하고 포장하는 시간이다. 공장 기계의 성능표(FLOPs)에는 분류 시간이 없지만, 받는 사람은 둘을 합친 만큼 기다린다. 작은 물건일수록 분류 시간의 몫이 크다.",
    ],
    lead: [
      "검출 모델은 사진 한 장에서 bounding box와 클래스 이름을 여럿 내놓는다. YOLO 계열은 학습할 때 물체 하나에 예측 여러 개를 정답으로 짝지어 왔다. YOLOv10 논문은 이것을 one-to-many 학습이라 부른다. 그래서 쓸 때는 겹친 상자를 하나만 남기고 지우는 NMS가 붙었다.",
      "2024년 Ao Wang 등은 이 후처리를 없앤 YOLOv10을 냈다. NeurIPS 2024에 실렸다. NMS가 왜 필요했고 어떻게 없앴는지는 YOLO 챕터에서 다룬다. 이 절은 시간을 어떻게 쟀는지만 본다.",
    ],
    walk: [
      {
        q: "NMS는 파라미터와 FLOPs에 들어가나?",
        a: [
          "들어가지 않는다. NMS에는 학습된 숫자가 없다. 상자들의 점수와 겹친 정도(IoU)를 보고 지울 상자를 고르는 규칙이다. MACs로 세는 층이 아니어서 망의 FLOPs에도 잡히지 않는다. 그런데 장치에서는 시간이 든다.",
          "게다가 그 시간은 입력에 따라 다르다. YOLOv10 논문은 NMS의 실행 시간이 입력의 영향을 받는다고 적고, COCO 검증 사진 전체에서 재서 평균을 냈다.",
        ],
      },
      {
        q: "논문은 무엇을 어떻게 쟀나?",
        a: [
          "장치는 T4 GPU이고 TensorRT의 FP16으로 돌린다. batch는 1이다. 망 뒤에 TensorRT의 NMS 플러그인을 붙여 후처리까지 한 번에 재고, 입출력에 드는 시간은 뺐다. NMS 설정은 각 검출기가 검증할 때 쓰던 값을 그대로 썼다. 이렇게 잰 것이 표의 Latency다.",
          "표에는 열이 하나 더 있다. Latency^f는 후처리 없이 forward만 잰 시간이다. 두 열을 나란히 둔 덕에 후처리가 시간의 얼마를 차지하는지 읽을 수 있다.",
        ],
      },
      {
        q: "YOLOv9-C와 YOLOv10-B를 네 잣대로 비교하면?",
        a: [
          "둘의 COCO AP는 52.5로 같다. YOLOv10-B가 파라미터는 24.5%, FLOPs는 9.9% 적고, forward latency는 7.5% 짧다. end-to-end latency는 45.7% 짧다. 논문은 이것을 latency 46% 감소로 요약했다.",
          "네 잣대가 7.5%에서 46%까지 벌어진다. 차이의 대부분은 망 안이 아니라 망 뒤에서 나왔다. YOLOv9-C의 두 열을 빼면 4.44ms이고, 이것이 후처리 몫으로 end-to-end의 42%다. YOLOv10-B는 두 열의 차이가 0.07ms다. 이 뺄셈은 이 챕터가 논문의 두 열로 계산한 것이다.",
        ],
      },
      {
        q: "작은 모델에서는 어떻게 되나?",
        a: [
          "그림에서 YOLOv8-N과 YOLOv10-N으로 바꿔 보라. forward latency는 거의 같고 YOLOv10 쪽이 오히려 조금 느리다. end-to-end는 6.16ms와 1.84ms다. 이전 모델은 end-to-end의 71%가 후처리다.",
          "망이 작아지면 forward는 짧아지지만, 이 표에서 후처리 시간은 따라 줄지 않았다. 세 쌍의 YOLOv10 이전 모델에서 후처리 몫은 4.39ms에서 4.74ms 사이였다. 그래서 작은 모델일수록 망만 재면 실제로 기다리는 시간을 크게 놓친다.",
        ],
      },
      {
        q: "이 비교가 보여 주지 않는 것은 무엇인가?",
        a: [
          "두 열의 차이를 후처리 몫으로 읽었지만 논문이 따로 적은 값은 아니다. 표의 시간은 COCO 검증 사진의 평균이라, 물체가 많은 사진에서 NMS가 얼마나 걸리는지는 알 수 없다. 장치도 T4와 TensorRT의 조합 하나다.",
          "후처리를 없애려면 학습 방식을 바꿔야 했다. 논문은 그 방법을 consistent dual assignments라 불렀고 그 내용은 YOLO 챕터의 몫이다. 이 절에서 가져갈 것은 잣대다. 망만의 시간과 사용자가 기다리는 시간은 다를 수 있고, 둘을 나란히 적어야 무엇이 줄었는지 보인다.",
        ],
      },
    ],
    formula: "\\underbrace{10.57}_{\\text{Latency}} = \\underbrace{6.13}_{\\text{Latency}^f} + \\underbrace{4.44}_{\\text{post}}\\ \\text{ms} \\quad \\text{YOLOv9-C}\n5.74 = 5.67 + 0.07\\ \\text{ms} \\quad \\text{YOLOv10-B}",
    symbols: [
      "Latency: T4 GPU, TensorRT FP16, batch 1에서 후처리까지 넣어 잰 end-to-end latency. 논문이 보고한 값",
      "Latency^f: 같은 조건에서 forward만 잰 시간. 논문이 보고한 값",
      "post: 두 값의 차이. 이 챕터가 뺄셈으로 얻은 값이다",
    ],
    takeaway: "YOLOv10은 end-to-end latency와 forward latency를 나란히 적었다. FLOPs는 10% 줄었는데 end-to-end latency가 46% 줄었고, 그 차이의 대부분이 망 밖에 있었다.",
    see: "모델 쌍을 고르고 단계를 하나씩 눌러 보라. 줄마다 이전 모델의 값을 1로 놓고 YOLOv10의 값을 막대로 그린다. 파라미터, FLOPs, forward latency, end-to-end latency의 순서로 한 줄씩 늘어난다. 마지막 단계에서는 아래에 두 모델의 시간을 forward와 후처리로 나눠 쌓는다. 파랑이 forward이고 빨강이 후처리다. 숫자는 논문 표의 값이고, 후처리 몫만 두 열의 차이로 계산했다.",
    bridge: "두 논문 모두 무엇을 재는지를 바꿔서 숫자에 잡히지 않던 비용을 드러냈다. 이 챕터의 층으로 돌아가면 아직 세지 않은 것이 하나 있다. ResNet의 bottleneck 블록에는 conv 옆으로 입력을 그대로 출력에 더하는 shortcut이 붙어 있었다. 그 갈래(branch)는 쓸 때 얼마를 내나?",
  },
  {
    id: "branch", num: "08", kicker: "갈래 하나의 값",
    question: "conv 옆에 shortcut 갈래가 있으면 쓸 때 얼마를 더 내나?",
    gist: [
      "FLOPs로는 거의 공짜지만 시간으로는 비싸다. shortcut의 덧셈은 출력 숫자마다 한 번뿐이다. 그런데 그 한 번을 하려고 feature map 두 장을 창고에서 가져오고 한 장을 다시 써야 한다. arithmetic intensity가 아주 낮은, 전형적인 memory-bound 연산이다.",
      "작업대로 말하면 재료 상자 두 개를 실어 와서 숫자를 한 번씩 더하고 결과 상자를 돌려보내는 일이다. 손은 거의 놀고 수레만 바쁘다. 이 장치에서는 shortcut 하나가 층의 시간을 절반 넘게 늘린다.",
      "그런데 학습할 때는 이 갈래가 있어야 깊은 망이 학습된다. 학습에 필요한 구조와 쓸 때 빠른 구조가 다르다는 것이 다음 챕터의 출발점이다.",
    ],
    lead: [
      "ResNet 챕터에서 shortcut은 깊은 망을 학습할 수 있게 해 준 선이었다. 블록의 출력은 conv의 결과에 입력을 그대로 더한 것이다. 챕터의 층에 shortcut을 붙이고 같은 장치에서 센다. 더하기는 conv가 끝난 뒤 따로 한 단계로 돈다고 하자.",
    ],
    walk: [
      {
        q: "더하기는 FLOPs를 얼마나 늘리나?",
        a: [
          "출력 숫자 하나에 덧셈이 한 번이니 200,704번이다. conv의 FLOPs에 비하면 0.09%다. 파라미터는 하나도 늘지 않는다. 파라미터와 FLOPs로 보면 shortcut은 거의 공짜다.",
        ],
      },
      {
        q: "memory traffic은?",
        a: [
          "더하기 단계는 conv가 낸 feature map과 입력 feature map을 읽고, 더한 feature map을 쓴다. feature map 세 장 몫이라 conv 단계 전체의 memory traffic보다 많다. 덧셈 한 번에 6바이트를 옮기니 arithmetic intensity가 0.17이다. ridge point 100보다 한참 아래다.",
          "입력 feature map은 conv가 끝나도 지울 수 없다. 더할 때까지 들고 있어야 한다.",
        ],
      },
      {
        q: "그래서 시간은?",
        a: [
          "더하기 단계는 계산이 거의 없고 메모리 I/O가 30.1µs라 memory-bound다. conv의 57.8µs에 더하면 87.9µs가 된다. FLOPs는 0.09% 늘었는데 시간은 52% 늘었다.",
          "그림에서 층을 쪼갠 층으로 바꿔 보라. 03절에서 fusion으로 돌린 depthwise와 pointwise는 20.3µs였다. 같은 더하기를 붙이면 50.4µs가 되어 2.48배다. 원래 시간이 짧은 층일수록 메모리만 쓰는 갈래의 몫이 크다.",
        ],
      },
      {
        q: "그렇다면 shortcut을 떼면 되지 않나?",
        a: [
          "쓸 때만 보면 그렇다. 하지만 ResNet 챕터에서 본 대로 이 선이 없으면 깊은 망이 얕은 망보다도 학습이 안 됐다. 학습할 때 필요한 갈래가 쓸 때는 값을 치르게 한다.",
          "RepViT 논문에는 이 값을 겨냥한 문장이 있다. 구조를 다시 매개변수화(re-parameterization)하면 쓸 때 skip connection에 드는 계산과 메모리 비용을 없앨 수 있다는 것이다. 학습할 때의 갈래를 쓸 때 어떻게 없애는지가 다음 챕터의 내용이다.",
        ],
      },
    ],
    formula: "y = \\mathrm{conv}(x) + x\nt = \\underbrace{\\max(57.80,\\ 21.91)}_{\\text{conv}} + \\underbrace{\\max(0.05,\\ 30.11)}_{\\text{add}} = 87.91\\ \\mu\\text{s}",
    symbols: [
      "conv(x): 챕터가 들고 온 3×3 conv의 출력",
      "+ x: shortcut. 입력 feature map을 그대로 더한다",
      "두 max: 단계마다 계산 시간과 메모리 I/O 시간 가운데 긴 쪽. 단계와 단계는 차례로 돌므로 더한다",
    ],
    takeaway: "shortcut은 FLOPs를 0.09% 늘리지만 이 장치에서 시간을 52% 늘린다. 학습에 필요한 갈래가 쓸 때는 memory traffic으로 값을 치른다.",
    see: "갈래 수를 하나에서 둘로 바꿔 보라. 위 그림에 shortcut과 더하기 단계가 생기고, 아래 시간 막대에 더하기 단계가 이어 붙는다. 단계마다 계산과 메모리 I/O 가운데 긴 쪽이 진하다. 층을 쪼갠 층으로 바꾸면 conv 단계가 짧아져서 더하기 단계의 몫이 더 커진다. 맨 아래 세 줄이 FLOPs, memory I/O 바이트, 시간이고 갈래 하나일 때와 비교한 변화가 옆에 붙는다. 장치는 앞 절들과 같고 손으로 정한 값이다.",
    bridge: "갈래가 여럿이면 학습이 잘 되고 갈래가 하나면 빨리 돈다. 둘 다 가질 수는 없나? 학습할 때는 갈래를 여럿 두고, 다 배운 뒤에 그것을 숫자 하나 틀리지 않고 한 갈래로 합칠 수 있다면 둘 다 가진다. 다음 챕터가 RepVGG에서 시작해 RepViT와 LSNet까지 그 합치기, 곧 re-parameterization을 따라간다.",
  },
];

export const effCopy = {
  title: "빠른 모델은 무엇으로 재나",
  sub: "파라미터 수, FLOPs, memory traffic, latency, throughput은 서로 다른 숫자이고 자주 어긋난다. 이 챕터는 ResNet-50의 3×3 conv 하나를 직접 세고, 설명을 위해 손으로 정한 장치에서 시간을 계산한 뒤, 한 번에 하나씩 바꿔 가며 곱셈이 적은데 느린 경우가 왜 생기는지 따라간다. 그 말로 RepViT와 YOLOv10의 표를 읽는다.",
  prologue,
  sections,
  related: {
    title: "이 챕터와 내 연구",
    text: "메모리 기반 이상 탐지는 사진의 patch마다 memory bank에 저장된 정상 patch 전부와 거리를 잰다. 이 챕터의 말로 하면 bank는 가중치와 같은 자리에 있다. 쓸 때마다 창고에서 가져와야 하는 고정된 숫자다. patch 하나만 비교하면 bank의 숫자 하나를 가져와 MAC 한 번을 하니 arithmetic intensity가 약 1이고, 이 챕터의 장치에서는 memory-bound다. 사진 한 장의 patch 784개를 한꺼번에 비교하면 같은 bank를 한 번 가져와 784번 쓴다. bank에 patch 16,384개를 두고 patch마다 숫자 1,024개라고 손으로 정하면 arithmetic intensity가 약 750으로 올라 compute-bound가 된다. 05절의 batch와 같은 이야기다. coreset으로 bank를 줄이는 것은 모델을 줄이는 일처럼 보이지만, 실제로 아끼는 것은 질의마다의 memory traffic과 MACs다.",
    link: "/anomaly/",
    linkText: "Anomaly detection, visually →",
  },
  ui: {
    count: {
      step: "단계", steps: ["파라미터", "출력 하나", "전부"], vary: "바꿔 보기", variants: ["원래", "해상도 절반", "채널 두 배", "1×1 커널"],
      input: "입력", output: "출력", kernel: "커널", each: "커널 하나", count: "개",
      params: "파라미터", macs: "MACs", perOut: "출력 숫자 하나", outs: "출력 숫자", window: "이 칸이 읽는 창", pairs: "짝지어 곱해 더함",
      times: "배", base: "원래 층 = 1", same: "그대로",
    },
    bytes: {
      bw: "대역폭", device: "손으로 정한 장치: 4 TFLOP/s", moved: "memory traffic", weights: "가중치", input: "입력", output: "출력",
      compute: "계산", memory: "메모리 I/O", time: "걸리는 시간", computeBound: "compute-bound", memoryBound: "memory-bound",
      intensity: "arithmetic intensity", ridge: "ridge point", wait: "계산이 기다리는 몫",
    },
    sep: {
      layer: "층", layers: ["보통 3×3", "dw+pw fusion", "dw+pw 따로"], bw: "대역폭",
      macs: "MACs", bytes: "memory I/O", time: "시간", base: "보통 3×3 = 1",
      roof: "낼 수 있는 계산 속도", axisX: "arithmetic intensity FLOP/B", peak: "지붕 4 TFLOP/s", std: "보통 3×3", fused: "fusion", dw: "dw", pw: "pw",
      formula: "시간 = max(계산, 메모리)", compute: "계산", memory: "메모리",
    },
    twin: {
      step: "단계", steps: ["MACs", "파라미터", "activation", "시간"],
      left: "앞쪽 층 (layer1)", right: "뒤쪽 층 (layer4)", leftShape: "56×56×64", rightShape: "7×7×512",
      macs: "MACs", params: "파라미터", acts: "activation 바이트", time: "시간", same: "같음", times: "배", fraction: "분의 1",
      compute: "계산", memory: "메모리",
    },
    batch: {
      layer: "층", layers: ["앞쪽 층 (layer1)", "뒤쪽 층 (layer4)"], n: "batch 크기",
      thr: "throughput, 초당 끝내는 장수", lat: "latency", held: "들고 있는 바이트", weights: "가중치", maps: "feature map",
      ceiling: "계산이 쉬지 않을 때 17,300장", computeBound: "compute-bound", memoryBound: "memory-bound", perSec: "장/초",
    },
    rep: {
      y: "세로축", ys: ["iPhone 12 latency", "RTX 3090 throughput"], mark: "표시", marks: ["없음", "같은 1.3 GMACs", "0.9ms의 두 모델", "뒤집히는 두 모델"],
      x: "GMACs", lat: "latency ms, batch 1", thr: "throughput 장/초, 큰 batch", legend: ["RepViT", "EfficientFormerV2", "그 밖"],
      source: "RepViT 논문 표 1이 보고한 값",
    },
    yolo: {
      pair: "비교", pairs: ["v9-C 대 v10-B", "v8-N 대 v10-N", "v8-S 대 v10-S"], step: "단계", steps: ["파라미터", "FLOPs", "forward", "end-to-end"],
      rows: ["파라미터", "FLOPs", "forward latency", "end-to-end latency"], units: ["M", "G", "ms", "ms"],
      ap: "COCO AP", forward: "forward", post: "후처리", ms: "ms", older: "이전 모델 = 1", source: "YOLOv10 논문 표 1, T4 GPU, TensorRT FP16, batch 1",
    },
    branch: {
      branches: "갈래 수", branchOpts: ["하나", "둘"], layer: "층", layers: ["보통 3×3", "dw+pw fusion"],
      x: "x", conv: "3×3 conv", sep: "dw+pw", add: "+", y: "y", shortcut: "shortcut",
      stepConv: "conv 단계", stepAdd: "더하기 단계", compute: "계산", memory: "메모리 I/O", total: "합",
      flops: "FLOPs", bytes: "memory I/O", time: "시간", vsOne: "갈래 하나 대비",
    },
  },
};
