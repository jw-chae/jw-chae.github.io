import type { Prologue, StudySection } from "./chapters";

const prologue: Prologue = {
  title: "이야기의 시작: 계산은 거의 같은데 branch가 많으면 느리다",
  paragraphs: [
    "모델이 빠른지는 FLOPs(곱셈과 덧셈의 횟수)가 아니라 latency(입력 하나에 실제로 걸리는 시간)로 재야 한다. 둘이 어긋나는 가장 흔한 이유는 memory traffic이다. 계산은 금방 끝나는데, 그 계산에 쓸 feature map을 메모리에서 읽어 오고 결과를 다시 써 두는 데 시간이 더 드는 단계가 있다. 효율 챕터가 이것을 손으로 정한 장치에서 셌다. 이 챕터는 그 어긋남이 가장 선명한 경우 하나를 끝까지 판다. branch(갈래)가 여럿인 블록이다.",
    "2014년의 VGG는 3×3 conv와 ReLU만 한 줄로 쌓았다. 구조가 단순하고 GPU에서 빠르지만, 깊게 쌓을수록 학습이 어려웠다. 2015년의 ResNet은 블록을 건너뛰는 shortcut branch를 더해 깊은 망을 학습시켰다. 대신 추론(inference), 곧 학습이 끝난 모델을 실제로 쓸 때도 branch가 남는다. branch마다 따로 계산하고, 결과를 더할 때까지 입력을 메모리에 들고 있어야 한다.",
    "2021년 칭화대와 MEGVII의 Xiaohan Ding, Guiguang Ding 등이 낸 RepVGG는 둘을 떼어 놓았다. 학습 때는 branch가 셋인 블록을 쓰고, 학습이 끝나면 그 블록을 3×3 conv 하나로 바꿔 추론한다. 바꾼 뒤의 망은 모든 입력에 똑같은 출력을 낸다. 한 구조의 가중치를 다른 구조의 가중치로 옮겨 적는다는 뜻에서 이 방법을 structural reparameterization(구조적 재매개변수화)이라 부른다.",
    "같은 그룹은 이 생각을 이어 갔다. RepViT는 mobile용 CNN의 depthwise conv에, PBConv는 3×3 안의 가운데가 아닌 자리에 같은 합치기를 썼다. LSNet은 입력에 따라 kernel이 바뀌는 연산을 넣었고, 그 부분은 더는 합쳐지지 않는다. 이 셋은 마지막 두 절에서 짧게 본다.",
    "다 읽고 나면 세 가지를 말할 수 있어야 한다. branch 셋이 어떻게 숫자 하나 틀리지 않고 kernel 하나가 되는지, 그것이 FLOPs가 아니라 무엇을 줄여서 빠른지, 같은 함수인데 왜 굳이 branch를 둔 모양으로 학습하는지다. 들고 갈 것은 가로세로 5픽셀짜리 흑백 사진 한 장과 branch 셋짜리 블록 하나다. 계산으로 정확히 같은 것과 실험으로 보고된 것은 끝까지 나눠 둔다.",
  ],
  timeline: [
    { year: "2014", text: "VGG, 3×3 conv와 ReLU만 한 줄로 쌓음" },
    { year: "2015", text: "ResNet, shortcut branch로 깊은 망을 학습. 추론 때도 branch가 남음" },
    { year: "2019", text: "ACNet, 가로와 세로로 긴 kernel branch를 붙였다가 하나로 합침" },
    { year: "2021", text: "RepVGG, 학습 때는 branch 셋, 추론 때는 3×3 conv 하나" },
    { year: "2023", text: "RepViT, mobile CNN의 depthwise conv에 같은 방법. 학회 발표는 이듬해" },
    { year: "2025", text: "PBConv는 작은 kernel의 자리를, LSNet은 입력에 따라 바뀌는 kernel을" },
  ],
};

const sections: StudySection[] = [
  {
    id: "branches", num: "01", kicker: "branch 셋",
    question: "학습 때의 블록은 사진의 한 자리에서 무엇을 계산하고, 추론 때 무엇이 비싼가?",
    gist: [
      "세 branch가 같은 입력을 받아 각자 계산하고, 블록은 세 결과를 자리끼리 더한다. 3×3 conv branch, 1×1 conv branch, 그리고 입력을 그대로 내보내는 identity branch다. 이런 블록을 multi-branch 블록이라 한다.",
      "원고 한 부를 세 사람이 복사해 각자 손본 뒤 마지막에 한 장으로 합치는 일과 같다. 원고는 입력 feature map, 세 사람은 세 branch, 합치는 책상은 더하기다. 손보는 품은 3×3 branch가 거의 다 들인다. 그런데 복사본을 나눠 주고 세 장을 다시 모으는 시간은 따로 든다.",
      "흔히 branch가 셋이면 계산도 세 배라고 생각한다. 곱셈은 거의 늘지 않는다. 느려지는 것은 feature map을 따로 써 두고 다시 읽는 memory traffic 때문이다.",
    ],
    lead: [
      "따라갈 사진은 가로세로 5픽셀, 채널 하나짜리 흑백 사진이다. 픽셀마다 작은 정수가 적혀 있다. 세 branch가 이 사진을 받아 각자 같은 크기의 feature map을 내고, 블록은 세 map을 자리끼리 더한다. 숫자는 모두 설명을 위해 손으로 정한 값이다. 이 절의 주인공은 사진 한가운데 자리의 출력 하나다.",
    ],
    walk: [
      {
        q: "가운데 자리에서 3×3 branch는 무엇을 계산하나?",
        a: [
          "conv의 기본 계산이다. 출력 자리를 가운데에 둔 3×3 창을 사진에 대고, 창 안의 픽셀 아홉 개와 kernel(커널)의 숫자 아홉 개를 같은 자리끼리 곱해 더한다. 그림의 첫 단계에 창과 kernel이 나란히 있고, 0이 아닌 곱 다섯 개를 더하면 7이다.",
          "kernel의 가운데 값은 −1이다. 가운데 픽셀 2에 −1이 곱해져 −2가 됐다. 이 값을 기억해 두자. 다음 절에서 바로 이 자리의 숫자가 바뀐다.",
        ],
      },
      {
        q: "1×1 branch와 identity branch는 무엇을 계산하나?",
        a: [
          "1×1 conv는 창이 픽셀 하나다. 채널이 하나뿐이니 kernel도 숫자 하나, 여기서는 2다. 가운데 픽셀 2에 곱해 4가 나온다. 채널이 여럿이면 이 conv는 같은 자리의 채널들을 섞는데, 이 챕터는 채널을 하나로 두어 곱셈 한 번이 됐다.",
          "identity branch는 아무것도 곱하지 않고 가운데 픽셀 2를 그대로 내보낸다. ResNet의 shortcut, 곧 블록의 입력을 출력에 그대로 더하는 선과 같은 모양이다. 다른 점은 건너뛰는 것이 conv 하나뿐이고, 더하기 전에 ReLU 같은 비선형이 끼어 있지 않다는 것이다. 이 차이가 다음 절의 합치기를 가능하게 한다.",
        ],
      },
      {
        q: "세 값을 더하면 무엇이 정해지나?",
        a: [
          "7 + 4 + 2 = 13이다. 블록이 이 자리에 내는 값이다. 실제 블록은 더한 뒤 ReLU를 한 번 거는데, 합치기는 더하기 앞에서 끝나는 일이라 이 챕터는 더하기까지만 따라간다.",
          "다른 자리도 같은 일을 하고, 25자리를 다 채우면 블록의 출력 feature map이 된다. 자리를 \"윗변\"으로 옮기면 창의 윗줄이 사진 밖으로 나간다. 사진 밖은 0으로 채운다. 이것을 zero padding이라 한다.",
        ],
      },
      {
        q: "가운데 픽셀 하나를 1 올리면 무엇이 달라지나?",
        a: [
          "먼저 예상해 보라. 가운데 자리의 출력에는 세 branch가 그 픽셀에 곱하는 숫자 −1, 2, 1이 모두 더해진다. 그러니 13이 2만큼 올라 15가 된다.",
          "바뀌는 출력은 그 자리만이 아니다. 그 픽셀은 이웃 자리들의 3×3 창에도 들어가므로, kernel에서 그 픽셀과 만나는 값이 0이 아닌 자리마다 출력이 바뀐다. 이 kernel은 0이 아닌 값이 여섯이라 여섯 자리가 바뀐다. 그림의 \"더하기\" 단계에서 가운데 픽셀을 +1로 바꿔 확인할 수 있다.",
        ],
      },
      {
        q: "이 블록은 추론 때 무엇이 비싼가?",
        a: [
          "곱셈의 수로는 거의 같다. 한 자리에서 3×3 branch가 아홉 번, 1×1 branch가 한 번이고 identity는 곱셈이 없다. 3×3 conv 하나만 있을 때보다 한 번 많다. FLOPs로 보면 branch는 거의 공짜다.",
          "비싼 것은 memory traffic이다. branch마다 계산을 따로 시작하고, branch마다 feature map을 따로 메모리에 써 둔다. 세 map이 다 나올 때까지 입력도 지우지 못한다. 그다음 세 map을 다시 읽어 더한다. branch가 하나라면 입력을 한 번 읽고 결과를 한 번 쓰면 끝이다.",
          "이렇게 계산은 적고 읽고 쓰는 양이 많은 단계는 계산 속도가 아니라 메모리 속도에 걸린다. 이것을 memory-bound라 한다. FLOPs는 거의 같은데 latency가 다른 이유가 이것이다.",
        ],
      },
    ],
    formula: "y_{i,j} = \\sum_{u=0}^{2}\\sum_{v=0}^{2} k^{(3)}_{u,v}\\, x_{i+u-1,\\,j+v-1} \\;+\\; k^{(1)}\\, x_{i,j} \\;+\\; x_{i,j}",
    symbols: [
      "x_{i,j}: 사진의 i번째 줄 j번째 픽셀. 0부터 세고 가운데는 i = j = 2다. 사진 밖은 0이다",
      "k^{(3)}: 3×3 branch의 kernel. 가운데 값이 −1이다",
      "k^{(1)}: 1×1 branch의 숫자 하나",
      "마지막 x_{i,j}: identity branch",
      "y_{i,j}: 세 branch를 더한 출력. 가운데에서 13",
    ],
    takeaway: "학습 때의 블록은 한 자리에서 창 안 아홉 픽셀의 곱해서 더하기, 가운데 픽셀에 숫자 하나 곱하기, 가운데 픽셀 그대로를 따로 계산해 더한다. 곱셈은 거의 늘지 않고 memory traffic이 는다.",
    see: "단계를 차례로 눌러 보라. 왼쪽이 사진이고 주황 테두리가 지금 자리의 창이다. 사진 둘레의 흐린 칸은 사진 밖이라 0으로 채운 padding이다. 오른쪽에 세 branch가 위에서부터 놓여 있다. 첫 단계에서 창과 kernel과 0이 아닌 곱이, 둘째 단계에서 가운데 픽셀 하나만 쓰는 두 branch가, \"더하기\"에서 세 값의 합과 25자리의 출력 feature map이 나온다. 자리를 바꾸면 창이 옮겨 가고 세 값이 다시 계산된다. \"더하기\" 단계에서 가운데 픽셀을 +1로 바꾸면 출력 map에서 값이 바뀐 여섯 자리에 테두리가 쳐진다. 사진과 kernel의 숫자는 손으로 정한 값이다.",
    bridge: "세 branch 가운데 둘은 가운데 픽셀 하나만 쓰고, 3×3 kernel의 가운데 값도 그 픽셀에 곱해진다. 같은 픽셀에 숫자 셋을 따로 곱해서 더할 바에야, 곱할 숫자를 먼저 더해 두면 되지 않을까?",
  },
  {
    id: "merge", num: "02", kicker: "kernel 하나로",
    question: "세 branch를 3×3 kernel 하나로 바꾸면 모든 자리에서 같은 값이 나오나?",
    gist: [
      "나온다. 1×1 branch와 identity branch는 가운데 값만 있고 나머지가 0인 3×3 kernel로 고쳐 쓸 수 있다. 그러면 세 kernel을 자리끼리 더한 kernel 하나가 모든 자리에서 세 branch의 합과 똑같은 값을 낸다. structural reparameterization의 핵심 계산이 이것이다.",
      "세 kernel을 투명 필름 세 장이라고 하자. 1×1과 identity의 필름에는 가운데에만 숫자가 적혀 있다. 세 장을 포개어 겹친 자리의 숫자를 더하면 한 장이 된다. 사진에 세 장을 따로 대고 결과를 더하나, 포갠 한 장을 대나 같은 값이 나온다. 필름은 kernel, 포개기는 kernel끼리 더하기, 사진에 대기는 conv다.",
      "세 branch가 같은 창을 보고, 저마다 곱해서 더하기만 하는 linear 계산이라서 된다. branch 안에 ReLU가 끼면 깨진다.",
    ],
    lead: [
      "앞 절의 가운데 출력 13은 세 branch의 값 7, 4, 2를 더한 것이었다. 4와 2는 가운데 픽셀에 숫자 하나를 곱한 값이고, 7 안에도 가운데 픽셀에 kernel의 가운데 값을 곱한 몫이 들어 있다. 같은 픽셀에 숫자 셋을 따로 곱해 더하고 있다.",
    ],
    walk: [
      {
        q: "1×1 kernel을 3×3 kernel로 고쳐 쓸 수 있나?",
        a: [
          "있다. 3×3 kernel의 아홉 자리 중 한가운데에 2를 적고 나머지를 0으로 채운다. 이 kernel을 창에 대면 가운데 픽셀에만 2가 곱해지니 결과는 1×1 conv와 같다.",
          "identity branch도 같은 방법으로, 가운데만 1인 kernel로 적는다. 아무것도 하지 않는 branch도 conv 한 번으로 적힌다.",
        ],
      },
      {
        q: "그러면 세 kernel을 자리끼리 더해 두면 되나?",
        a: [
          "된다. 가운데가 아닌 여덟 값은 3×3 branch의 것 그대로이고, 가운데만 −1 + 2 + 1 = 2가 된다. 이 kernel 하나로 가운데 자리를 계산하면 13으로, 세 branch를 따로 계산해 더한 값과 같다. 앞 절에서 −2였던 가운데 곱이 4로 바뀌었고, 늘어난 몫이 다른 두 branch가 내던 값이다.",
          "같을 수밖에 없다. 세 branch가 같은 창을 보고 곱해서 더하기만 하므로, kernel을 먼저 더하나 결과를 나중에 더하나 같다. LoRA 챕터에서 학습한 작은 행렬 곱 BA를 원래 가중치 W에 더해 행렬 하나로 만든 것, 곧 Wx + BAx = (W + BA)x와 같은 종류의 계산이다. 거기서는 행렬 둘을 더했고 여기서는 kernel 셋을 더한다.",
        ],
      },
      {
        q: "가장자리 자리에서도 같은가?",
        a: [
          "그림의 \"25자리 비교\"를 눌러 보라. 세 branch를 더한 map과 합친 kernel의 map을 빼면 25자리 모두 0이다.",
          "가장자리가 걱정되는 이유는 창의 일부가 사진 밖으로 나가 0으로 채워지기 때문이다. 그런데 다른 두 branch에서 온 숫자는 kernel의 가운데에만 있고, 가운데는 언제나 사진 안의 그 자리 픽셀에 놓인다. 그래서 padding이 결과를 바꾸지 않는다. RepVGG 논문은 이 조건을 두 conv의 stride가 같고, 3×3 conv가 사진 둘레에 padding을 한 겹 두면 1×1 conv는 두지 않아야 한다고 적었다.",
        ],
      },
      {
        q: "합친 kernel만 보고 branch를 되찾을 수 있나?",
        a: [
          "합친 kernel의 가운데 값 2는 앞 절의 예상, 곧 \"가운데 픽셀을 1 올리면 출력이 2 오른다\"를 숫자 하나로 담고 있다. 세 branch가 하던 일이 숫자 아홉 개에 모두 들어 있다.",
          "거꾸로는 안 된다. 가운데의 2를 세 숫자의 합으로 나누는 방법은 얼마든지 있다. 남는 것은 합뿐이고, 추론에는 합만 있으면 된다.",
        ],
      },
    ],
    formula: "y = k^{(3)} * x \\;+\\; k^{(1)}\\, x \\;+\\; x \\;=\\; \\big(k^{(3)} + \\mathrm{pad}(k^{(1)}) + I\\big) * x \\;=\\; k' * x",
    symbols: [
      "pad(k^{(1)}): 1×1의 숫자를 가운데에 적고 나머지를 0으로 채운 kernel",
      "I: 가운데만 1인 kernel. identity branch를 conv로 쓴 것",
      "k': 합친 kernel. 가운데가 −1 + 2 + 1이고 나머지 여덟 값은 k^{(3)} 그대로다",
      "*: 창마다 같은 자리끼리 곱해서 더하는 conv. 사진 밖은 0으로 채운다",
    ],
    takeaway: "1×1과 identity branch를 가운데만 차 있는 kernel로 고쳐 쓰고 세 kernel을 더하면, kernel 하나가 모든 자리에서 세 branch의 합과 똑같은 값을 낸다.",
    see: "\"고쳐 쓰기\"에서 세 branch가 같은 크기의 kernel 셋으로 나란히 놓인다. 1×1과 identity의 숫자가 가운데에 들어가고 나머지는 0이다. \"더하기\"에서 세 kernel이 합친 kernel 하나가 되고 가운데 값이 바뀐다. 아래에 가운데 자리의 계산이 두 가지로 적히고 값이 같다. \"25자리 비교\"에서 세 branch를 더한 map, 합친 kernel의 map, 둘의 차이가 나란히 나온다. 차이 map은 모든 자리가 0이다.",
    bridge: "실제 RepVGG 블록에는 branch마다 conv 뒤에 BatchNorm이 붙어 있다. BatchNorm은 평균을 빼고 표준편차로 나눈다. 곱해서 더하기가 아닌 계산이 끼어 있는데도 합칠 수 있나?",
  },
  {
    id: "bn", num: "03", kicker: "BatchNorm folding",
    question: "branch마다 붙은 BatchNorm은 합친 kernel의 어디로 들어가나?",
    gist: [
      "추론 때의 BatchNorm은 숫자 하나를 곱하고 숫자 하나를 더하는 계산이다. 곱하는 숫자는 kernel에 미리 곱해 두고, 더하는 숫자는 bias로 옮기면 BatchNorm이 사라진다. 이것을 BatchNorm folding(접어 넣기)이라 한다. 그다음은 앞 절처럼 branch를 합친다.",
      "달러 가격표를 원화로 바꿔 받는 가게와 같다. 계산대에서 매번 환율을 곱하고 수수료를 더하는 대신, 가격표에 처음부터 원화 값을 고쳐 적어 두면 계산대 단계가 없어진다. 달러 가격은 conv의 출력, 환율은 γ/σ, 수수료는 β − γμ/σ, 고쳐 적은 가격표는 접은 kernel과 bias다.",
      "흔히 BatchNorm은 들어온 데이터의 평균을 빼므로 미리 접을 수 없다고 생각한다. 학습 때는 맞다. 추론 때는 평균과 분산이 고정된 숫자라서 접힌다.",
    ],
    lead: [
      "BatchNorm은 채널마다 평균 μ를 빼고 표준편차 σ로 나눈 뒤 γ를 곱하고 β를 더하는 정규화다. ResNet 챕터에서 conv마다 붙어 깊은 망의 학습을 안정시킨 그것이다. 학습 때 μ와 σ는 함께 들어온 mini-batch에서 그때그때 구한다. 이 절은 앞의 세 branch에 BatchNorm을 하나씩 붙이고 같은 가운데 자리를 다시 계산한다.",
    ],
    walk: [
      {
        q: "추론 때의 BatchNorm은 무엇을 기준으로 평균을 빼나?",
        a: [
          "학습하는 동안 batch마다 구한 평균과 분산을 조금씩 섞어 따로 적어 둔다. 이것을 running mean과 running variance라 한다. 학습이 끝나면 이 값을 고정하고, 추론 때는 어떤 사진이 들어오든 그 고정된 값을 쓴다.",
          "그래서 추론 때의 BatchNorm은 정해진 숫자 넷, μ, σ, γ, β로 하는 계산이다. 여기서 σ는 고정한 분산에 아주 작은 ε을 더하고 제곱근을 씌운 값이다. 세 branch의 네 숫자는 손으로 정했고 그림에 적혀 있다.",
        ],
      },
      {
        q: "이 계산을 conv의 숫자 안으로 옮길 수 있나?",
        a: [
          "BatchNorm의 식을 풀어 쓰면 들어온 값에 γ/σ를 곱하고 β − γμ/σ를 더하는 일이다. 들어온 값은 conv의 출력이고, conv의 출력에 숫자를 곱하는 것은 kernel의 아홉 값에 그 숫자를 먼저 곱해 두는 것과 같다.",
          "3×3 branch로 한 번 해 보자. 이 branch의 BatchNorm은 μ = 3, σ = 2, γ = 1, β = 0.5다. 그대로 거치면 conv 값 7에서 3을 빼고 2로 나눈 2에 0.5를 더해 2.5다. 접으면 kernel에 γ/σ = 0.5를 곱하고, 더할 숫자 0.5 − 3/2 = −1을 bias로 둔다. 반으로 줄인 kernel은 7의 절반인 3.5를 내고, bias를 더하면 2.5다. 같은 값이다.",
          "1×1과 identity branch도 같은 식으로 곱할 숫자 하나와 bias 하나가 된다. 세 branch 모두 BatchNorm이 사라지고 kernel과 bias만 남는다.",
        ],
      },
      {
        q: "그다음은 앞 절과 같은가?",
        a: [
          "같다. 세 kernel을 같은 크기로 고쳐 써서 더하고, bias 셋도 더한다. 그림의 \"접기\" 단계에 합친 kernel과 bias −2가 나온다. 가운데 자리에서 이 kernel 하나와 bias가 내는 값은 branch마다 BatchNorm을 거쳐 더한 5.5와 같다. 25자리 모두 차이가 0이다.",
          "BatchNorm이 붙어도 추론 때의 블록은 kernel 하나와 bias 하나다.",
        ],
      },
      {
        q: "학습 때도 이렇게 접어 두면 되지 않나?",
        a: [
          "안 된다. 학습 때의 BatchNorm은 μ와 σ를 함께 들어온 사진들에서 구한다. 그림에서 \"학습 때\"를 고르고 옆 사진을 바꿔 보라. 우리 사진도, 가운데 자리의 conv 값 7도 그대로다. batch에 함께 든 다른 사진 하나만 밝게 했는데, batch의 평균이 바뀌면서 BatchNorm을 지난 값이 2.27에서 1.38로 바뀐다.",
          "같은 사진의 같은 자리인데 옆 사진에 따라 결과가 달라진다. 이런 계산은 고정된 kernel 하나로 적을 수 없다. 접을 수 있는 것은 학습이 끝나 μ와 σ가 고정된 뒤다. \"추론 때\"로 돌아가면 옆 사진이 무엇이든 2.5가 나온다.",
        ],
      },
    ],
    formula: "\\mathrm{BN}(z) = \\gamma\\,\\frac{z-\\mu}{\\sigma} + \\beta = \\frac{\\gamma}{\\sigma}\\,z + \\Big(\\beta - \\frac{\\gamma\\mu}{\\sigma}\\Big)\n\\mathrm{BN}(k * x) = \\Big(\\frac{\\gamma}{\\sigma}\\,k\\Big) * x + \\Big(\\beta - \\frac{\\gamma\\mu}{\\sigma}\\Big)",
    symbols: [
      "z: conv가 낸 값. 3×3 branch의 가운데 자리에서 7",
      "μ, σ: 학습하는 동안 모아 고정해 둔 평균과 표준편차. σ에는 ε이 들어 있다. 추론 때는 바뀌지 않는다",
      "γ, β: 학습된 두 숫자",
      "γ/σ: kernel에 먼저 곱해 둘 숫자",
      "β − γμ/σ: 새로 생기는 bias",
    ],
    takeaway: "추론 때의 BatchNorm은 곱하기 하나와 더하기 하나라서 kernel과 bias에 접혀 들어간다. 학습 때는 평균과 분산이 batch마다 바뀌므로 접을 수 없다.",
    see: "\"추론 때\"에서 branch마다 conv의 값, BatchNorm의 네 숫자, 지난 뒤의 값이 한 줄에 적혀 있다. \"접기\"를 누르면 BatchNorm이 적힌 네모 대신 kernel에 곱할 숫자와 새 bias가 들어간다. branch마다 값은 그대로다. 아래에 합친 kernel과 bias 하나로 계산한 5.5가 나온다. \"학습 때\"로 바꾸면 옆 사진을 고를 수 있고, batch의 평균과 표준편차와 함께 3×3 branch의 값이 바뀐다. BatchNorm의 네 숫자는 손으로 정했고, 학습 때의 평균과 표준편차는 두 사진에서 실제로 계산한 값이다.",
    bridge: "여기까지가 계산이다. branch 셋에 BatchNorm까지 붙은 블록이 추론 때는 conv 하나와 bias 하나가 된다. 이런 블록만 쌓아 한 줄짜리 망을 만든 것이 RepVGG다. 왜 굳이 이렇게까지 했고, 무엇을 얻었나?",
  },
  {
    id: "repvgg", num: "04", kicker: "RepVGG, 2021",
    question: "RepVGG는 무엇을 바꿨고, 합친 뒤에 왜 빨라졌나?",
    gist: [
      "RepVGG는 branch를 학습 때만 둔다. 학습이 끝나면 앞 세 절의 계산으로 블록마다 conv 하나와 bias 하나를 만들고, 추론 때의 망은 3×3 conv와 ReLU만 한 줄로 쌓인 VGG 모양이 된다.",
      "공사장의 비계와 같다. 지을 때는 비계가 있어야 높이 올릴 수 있지만, 완공되면 걷어 내고 건물만 쓴다. 비계는 학습 때의 1×1과 identity branch, 건물은 conv 한 줄이다. 다만 진짜 비계와 달리 이 branch들은 걷어 낼 때 버려지지 않고, 그 숫자가 kernel의 가운데 값에 더해져 남는다.",
      "흔히 빨라진 이유를 계산이 줄어서라고 생각한다. 줄어든 곱셈은 한 자리에서 열 번 가운데 한 번뿐이다. 빨라진 것은 branch마다 feature map을 쓰고 다시 읽던 memory traffic이 사라지고, GPU 라이브러리가 가장 잘 다듬어 둔 3×3 conv 하나만 남았기 때문이다.",
    ],
    lead: [
      "RepVGG는 칭화대와 MEGVII의 Xiaohan Ding, Xiangyu Zhang, Ningning Ma, Jungong Han, Guiguang Ding, Jian Sun이 쓴 CVPR 2021 논문이다. 이 절의 숫자는 모두 논문(arXiv 2101.03697v3)이 보고한 값이다.",
    ],
    walk: [
      {
        q: "저자들이 마주한 상황은 무엇이었나?",
        a: [
          "한 줄로 쌓은 망의 장점은 알려져 있었다. 빠르고, 메모리를 덜 쓰고, 구조를 고치기 쉽다. 빠른 이유로 논문은 GPU 라이브러리가 3×3 conv를 특히 잘 다듬어 놓았다는 것을 든다. 논문 표 1에서 같은 크기의 층을 재면 3×3 conv가 1×1 conv보다 같은 시간에 네 배쯤 많은 연산을 해낸다.",
          "메모리 쪽은 그림 하나로 설명했다. shortcut이 있는 블록은 입력을 더할 때까지 들고 있어야 해서 feature map 두 장 분량이 필요하고, 한 줄짜리 블록은 층이 끝나는 대로 입력을 버려 한 장이면 된다.",
          "문제는 정확도였다. 같은 조건으로 학습한 VGG-16의 ImageNet top-1이 표 4에서 72.21%다. 깊은 망이 잘 배우려면 ResNet처럼 branch가 있어야 했다.",
        ],
      },
      {
        q: "RepVGG가 바꾼 한 가지는 무엇인가?",
        a: [
          "branch를 학습 때만 두었다. 학습 때의 블록이 앞 세 절에서 계산한 바로 그 모양이다. identity branch는 입력과 출력의 채널 수와 크기가 같을 때만 둔다. 학습이 끝나면 블록마다 conv 하나와 bias 하나를 만든다.",
          "그림의 \"학습 때\"와 \"추론 때\"를 번갈아 눌러 보라. 한 stage의 처음 네 층을 그렸다. 첫 층은 stride 2로 크기를 줄여서 identity branch가 없다. 추론 때는 네 층 모두 conv 하나다.",
        ],
      },
      {
        q: "합쳐서 얻은 것은 숫자로 얼마인가?",
        a: [
          "논문 표 6이 같은 RepVGG-B0을 두 모양으로 잰다. 1080Ti, batch 128에서 합치기 전의 학습 때 모양은 초당 1061장을 처리하고, 합친 뒤의 모양은 1810장이다. 같은 함수이므로 정확도는 75.14% 그대로다. 정확도를 그대로 두고 throughput(초당 처리하는 사진 수)이 1.7배가 됐다.",
          "FLOPs로는 이 차이가 설명되지 않는다. 01절에서 본 대로 합치면서 줄어드는 곱셈은 한 자리에서 열 번 가운데 한 번이다. 사라진 것은 branch마다 따로 시작하던 계산과, 중간 feature map을 쓰고 다시 읽던 memory traffic이다.",
          "ResNet과의 비교는 그림의 셋째 단계에 있다. 같은 120 epoch 학습에서 RepVGG는 크기가 비슷한 ResNet보다 정확도가 같거나 높으면서 빠르다. 논문 초록이 앞세운 쌍은 RepVGG-A2와 ResNet-50이다. 정확도는 거의 같고 throughput이 초당 1322장 대 719장이라 83% 빠르다.",
        ],
      },
      {
        q: "이 결과가 보여 주지 않는 것은 무엇인가?",
        a: [
          "속도는 1080Ti 한 종류에서 큰 batch로 잰 throughput이다. 사진 한 장을 받자마자 답해야 하는 mobile 기기의 latency와는 다른 조건이다. 논문도 RepVGG가 GPU와 전용 칩에서의 속도를 겨냥했고, 전력이 작은 기기에서는 MobileNet 같은 모델이 나을 수 있다고 적었다.",
          "branch 셋이 아무 망에나 도움이 되는 것도 아니다. ResNet-50의 3×3 conv를 모두 RepVGG 블록으로 바꿔 학습했더니 76.34%로, 원래 ResNet-50의 76.31%와 거의 같았다. 이미 shortcut이 있는 망에 branch를 더 붙여 얻은 것은 거의 없었다.",
        ],
      },
    ],
    formula: "\\text{train: } \\; y = \\mathrm{ReLU}\\big(\\mathrm{BN}_3(k^{(3)} * x) + \\mathrm{BN}_1(k^{(1)} * x) + \\mathrm{BN}_0(x)\\big)\n\\text{deploy: } \\; y = \\mathrm{ReLU}\\big(k' * x + b'\\big)",
    symbols: [
      "BN_3, BN_1, BN_0: branch마다 붙은 BatchNorm. 03절에서 kernel과 bias에 접었다",
      "k', b': 블록마다 하나씩 남는 kernel과 bias",
      "ReLU: 더한 뒤에 한 번 건다. 합치기는 그 앞에서 끝나므로 ReLU는 추론 때도 그대로 남는다",
    ],
    takeaway: "RepVGG는 branch를 학습 때만 두고, 추론 때는 블록마다 conv 하나로 바꿔 한 줄짜리 VGG 모양으로 돌린다. 같은 B0이 정확도는 그대로이고 throughput이 1.7배가 됐다. 줄어든 것은 FLOPs가 아니라 memory traffic이다.",
    see: "\"학습 때\"와 \"추론 때\"는 한 stage의 처음 네 층이다. 학습 때는 층마다 branch가 둘이나 셋이고 더하기가 있다. 추론 때는 층마다 conv 하나다. 아래 막대가 RepVGG-B0의 초당 처리하는 사진 수이고 지금 고른 모양의 막대가 진하게 칠해진다. 정확도는 두 모양 모두 75.14%다. \"ResNet과 비교\"에서는 표 4의 네 쌍이 나온다. 쌍마다 왼쪽 두 막대가 top-1이고 오른쪽 두 막대가 초당 처리하는 사진 수다. 막대의 숫자는 모두 논문이 보고한 값이다.",
    bridge: "남는 질문이 있다. 학습이 끝난 RepVGG는 conv 한 줄과 똑같은 함수다. 그렇다면 처음부터 그 한 줄을 학습시켜도 같은 곳에 닿아야 하지 않나? 그런데 표 6에서 branch 없이 학습한 B0은 72.39%였다.",
  },
  {
    id: "why", num: "05", kicker: "정확한 것과 보고된 것",
    question: "합친 모양과 같은 함수라면 왜 처음부터 합친 모양으로 학습하지 않나?",
    gist: [
      "branch가 있든 없든 블록이 표현할 수 있는 함수는 같다. 달라지는 것은 학습이 그 함수에 가는 길이다. 같은 loss에서 출발해도, 같은 kernel을 어떤 숫자들로 나눠 적었느냐에 따라 gradient가 주는 한 step이 달라진다.",
      "kernel의 가운데 값에 손잡이가 둘 달린 셈이다. 합친 모양에서는 손잡이가 하나라 gradient만큼 한 번 돌아간다. branch 모양에서는 3×3 branch의 가운데와 1×1 branch의 숫자, 두 손잡이가 같은 gradient를 받아 함께 돌아가므로 가운데 값이 두 배로 움직인다. 손잡이는 학습하는 숫자, 돌리는 힘은 gradient다.",
      "그러니 \"같은 함수\"는 계산으로 정확한 말이고, \"branch로 학습하면 더 좋은 kernel에 닿는다\"는 RepVGG가 실험으로 보고한 말이다. 이 절은 둘을 갈라 놓는다.",
    ],
    lead: [
      "앞의 말은 앞 세 절에서 숫자로 확인했다. 뒤의 말은 손으로 만든 작은 문제로는 보일 수 없다. 작은 문제가 보여 줄 수 있는 것과 없는 것을 먼저 나누고, 그다음 논문의 실험으로 간다.",
    ],
    walk: [
      {
        q: "branch가 있든 없든 표현할 수 있는 함수는 같은가?",
        a: [
          "같다. branch 셋이 낼 수 있는 것은 언제나 kernel 하나와 bias 하나로 적힌다. 거꾸로 어떤 kernel이든 가운데 값을 나눠 가지면 branch 셋으로 적힌다. branch는 망이 할 수 있는 일을 늘리지 않는다. 바뀌는 것은 학습이 그 kernel에 어떤 길로 가느냐다.",
        ],
      },
      {
        q: "같은 출발점에서 한 step을 가면 무엇이 다른가?",
        a: [
          "작은 문제로 본다. 01절의 사진과 블록을 그대로 두고, 손으로 정한 목표 kernel을 사진에 댄 출력 25개를 정답으로 둔다. loss는 25자리 차이의 제곱을 평균 낸 것의 절반이다. 출발점은 두 쪽 모두 02절의 합친 kernel이다. 한쪽은 합친 kernel의 아홉 값을 직접 고친다. 다른 쪽은 3×3 branch의 아홉 값과 1×1 branch의 숫자 하나를 고친다. identity에는 고칠 숫자가 없다.",
          "고치는 규칙은 같다. 값마다 gradient를 구하고, learning rate 0.05를 곱한 만큼 반대쪽으로 옮긴다. 출발점의 가운데 값에서 gradient는 1.32다. 합친 쪽은 가운데 값이 0.066 내려간다. branch 쪽은 3×3 branch의 가운데와 1×1의 숫자가 똑같이 이 gradient를 받아 각각 그만큼 내려가므로, 합쳐 보면 가운데 값이 두 배를 내려간다. 나머지 여덟 값은 같다.",
        ],
      },
      {
        q: "끝까지 가면 어디에 닿나?",
        a: [
          "그림의 step을 끝까지 올려 보라. 800 step 뒤에는 두 쪽 모두 목표 kernel에 닿는다. 이 작은 문제는 답이 하나뿐이라서 길이 달라도 도착점이 같다. 중간에는 branch 쪽의 loss가 조금 더 빨리 주는데, 가운데 값만 두 배로 움직이는 이 문제의 사정일 뿐이다.",
          "그러니 이 예가 보여 주는 것은 하나다. 같은 함수를 적는 숫자의 모양이 바뀌면 학습의 step이 바뀐다. 그 step이 더 좋은 곳으로 이끄는지는 깊은 망과 학습 때의 BatchNorm과 많은 사진이 함께 있어야 생기는 일이고, 이 예로는 알 수 없다.",
        ],
      },
      {
        q: "실제 망에서는 무엇이 보고됐나?",
        a: [
          "RepVGG 논문 표 6이 RepVGG-B0을 120 epoch 학습하며 branch를 하나씩 뺀다. 둘 다 빼면 72.39%, 둘 다 두면 75.14%이고, 1×1만 두거나 identity만 두면 그 사이다. 네 모델 모두 합친 뒤의 모양은 같다. 추론 때 같은 모양의 망이 학습 때의 모양에 따라 2.75%포인트 차이가 났다.",
          "표 7은 학습 때의 BatchNorm이 branch를 진짜 branch로 만든다는 쪽을 가리킨다. 3×3 kernel에 가운데 1을 더해 놓고 그 합을 conv 하나로 학습하면 73.51%이고, BatchNorm을 branch마다 두지 않고 더한 뒤에 하나만 두면 73.52%다. 학습 때의 BatchNorm은 batch에 따라 달라지는 계산이라, branch 블록과 똑같이 학습되는 conv 하나는 만들 수 없다는 것이 논문의 설명이다.",
          "branch 안에 ReLU를 넣으면 75.69%로 더 높다. 하지만 더하기 전에 비선형이 끼면 02절에서 kernel을 먼저 더해 둔 합치기가 깨진다. 논문도 쓸모가 없다고 적고 비교로만 남겼다.",
        ],
      },
    ],
    formula: "K = k^{(3)} + \\big(k^{(1)} + 1\\big)\\,E\n\\text{merged: } \\Delta K = -\\eta\\, G \\qquad \\text{branches: } \\Delta K = -\\eta\\,\\big(G + G_{c}\\, E\\big)",
    symbols: [
      "K: 합친 kernel. branch 쪽에서는 branch의 숫자로부터 계산된다",
      "E: 가운데만 1인 kernel. 1×1 branch와 identity branch가 들어가는 자리",
      "G: kernel의 값마다 그 값을 조금 올릴 때 loss가 늘어나는 정도, 곧 gradient. G_c는 그 가운데 값",
      "η: learning rate. 손으로 정했다",
      "G_c E: branch 쪽에만 더해지는 몫. 가운데 값이 한 번 더 움직인다",
    ],
    takeaway: "branch는 표현할 수 있는 함수를 늘리지 않고 학습의 step을 바꾼다. 합친 뒤 같은 함수라는 것은 계산으로 정확하고, branch로 학습하면 더 좋아진다는 것은 RepVGG가 실험으로 보고한 것이다.",
    see: "\"step별\"에서 step 수를 올려 보라. 왼쪽이 합친 kernel을 직접 고친 쪽, 가운데가 branch로 고친 뒤 합친 쪽, 오른쪽이 둘의 차이다. 1 step에서는 가운데 값만 차이가 나고, 몇 step 뒤에는 차이가 다른 자리로 번진다. 800 step에서 둘 다 목표 kernel에 닿고 차이가 0이 된다. 아래 두 숫자가 그 step의 loss다. 경사 하강을 실제로 돌린 값이고, 목표 kernel과 learning rate는 손으로 정했다. \"논문의 실험\"에서는 표 6과 표 7의 정확도가 막대로 나온다. 빨간 막대는 합칠 수 없는 모양이다.",
    bridge: "RepVGG는 GPU에서 큰 batch로 잰 throughput을 앞세웠다. mobile 기기에서 사진 한 장을 받아 바로 답해야 하는 작은 망에서도 이 합치기가 쓸모가 있나? mobile용 CNN은 보통의 conv 대신 채널마다 따로 거는 depthwise conv를 쓴다. 그리고 1×1이 아닌 작은 kernel은 가운데가 아닌 자리에도 둘 수 있을까?",
  },
  {
    id: "repvit", num: "06", kicker: "RepViT와 PBConv, 2023 · 2025",
    question: "같은 합치기를 mobile용 depthwise conv와 kernel의 가운데가 아닌 자리에도 쓸 수 있나?",
    gist: [
      "쓸 수 있다. 조건은 02절과 같다. 작은 kernel이 보는 픽셀이 3×3 창 안에 있고, branch마다 kernel이 자리와 입력에 상관없이 고정되어 있으면 된다. RepViT는 이 합치기를 depthwise conv, 곧 채널마다 자기 kernel을 따로 거는 conv에 채널마다 따로 썼다. PBConv는 가로나 세로로 긴 작은 kernel을 창 안의 가운데가 아닌 자리에 두었다.",
      "앞 절의 필름 비유가 그대로 통한다. depthwise conv는 채널마다 필름 묶음이 따로 있어서 채널마다 따로 포갠다. PBConv의 작은 kernel은 한 줄이나 한 귀퉁이에만 숫자가 적힌 필름이다. 같은 틀 안에만 있으면 어디에 적혀 있든 포갤 수 있다.",
      "두 논문 모두 추론 때의 모양은 kernel 하나 그대로다. 정확도가 오른 것은 학습 때의 branch 덕이고, 그 몫은 실험으로 보고됐다.",
    ],
    lead: [
      "RepViT는 Ao Wang, Hui Chen, Zijia Lin, Jungong Han, Guiguang Ding의 CVPR 2024 논문이다. 판마다 숫자가 조금씩 달라서 이 절은 arXiv 2307.09283v8의 숫자를 쓴다. PBConv는 Tianxiang Hao, Hui Chen, Guiguang Ding의 IJCAI 2025 논문이다. 그림 위의 탭으로 두 논문을 오간다.",
    ],
    walk: [
      {
        q: "depthwise conv에서 합치기는 어떻게 되나?",
        a: [
          "채널 하나만 떼어 보면 01절의 사진 그대로다. 그 채널의 kernel, 그 채널의 숫자 하나, identity가 그 채널만 본다. depthwise에서는 1×1도 채널을 섞지 않으므로 정말로 숫자 하나 곱하기다. 그래서 02절과 03절의 계산, 곧 branch 합치기와 BatchNorm folding을 채널마다 따로 하면 되고, 채널이 C개면 합친 kernel이 C개 생긴다.",
          "그림의 RepViT 탭에서 \"채널마다 합치기\"가 채널 셋을 나란히 놓은 것이다. 바뀌는 것은 채널마다 가운데 값뿐이고, 한 채널의 kernel에 다른 채널의 숫자가 섞이지 않는다.",
        ],
      },
      {
        q: "RepViT는 이것으로 mobile에서 무엇을 없앴나?",
        a: [
          "출발점은 mobile용 CNN인 MobileNetV3였다. 이 블록은 1×1 conv로 채널을 늘리고, depthwise conv를 걸고, 다시 1×1 conv로 채널을 줄인다. RepViT는 가벼운 ViT의 설계를 하나씩 옮겨 오면서, depthwise conv를 블록 앞으로 떼어 내고 학습 때 branch 블록으로 만들었다. 학습 때는 01절과 같은 세 branch가 채널마다 나란히 있고, 추론 때는 depthwise conv 하나만 남는다.",
          "논문은 이 덕에 추론 때 skip connection에 드는 계산과 메모리 비용이 사라진다고 적었다. 02절에서 identity branch가 가운데 값의 1로 들어간 것이 바로 그 일이다. 효율 챕터에서 본 대로 shortcut의 더하기는 FLOPs로는 거의 공짜지만 feature map을 두 장 읽고 한 장 쓰는 memory-bound 단계라서, 짧은 층일수록 그 몫이 크다.",
          "합치기만의 정확도 몫은 논문 표 6이 잰다. 학습 때 branch를 빼면 RepViT-M0.9가 78.47%, 두면 78.74%다. 다른 크기에서도 차이는 0.2%포인트 남짓이다. 작지만 추론 때의 모양이 같으므로 latency를 더 쓰지 않고 얻는 몫이다. 그림의 \"MobileNetV3에서 RepViT까지\"는 블록과 폭과 깊이를 차례로 바꾼 길을 iPhone 12의 latency와 top-1로 찍은 것이다.",
        ],
      },
      {
        q: "작은 kernel을 가운데가 아닌 자리에 두어도 합쳐지나?",
        a: [
          "PBConv 탭에서 작은 kernel을 \"1×3 가운데 줄\"로 골라 보라. 이 kernel은 출력 자리의 왼쪽, 자기, 오른쪽 픽셀을 곱해 더한다. 이 세 픽셀은 3×3 창의 가운데 줄과 정확히 같은 자리다. 그러니 3×3 kernel의 가운데 줄에 적고 위아래 줄을 0으로 채우면 된다. 가운데 자리에서 따로 계산해 더한 값과 합친 kernel 하나로 계산한 값이 같다.",
          "\"2×2 오른쪽 아래\"처럼 가운데를 비껴 놓은 kernel도 같다. 창이 출력 자리에서 오른쪽과 아래로 한 칸씩 뻗으니 오른쪽 아래 네 자리에 적는다. 다만 사진 가장자리에서도 3×3 branch와 같은 픽셀을 보려면 padding을 아래쪽과 오른쪽에만 둬야 한다.",
          "조건은 하나다. 작은 kernel의 창이 언제나 3×3 창의 한 부분이어야 한다. 그러면 02절과 같은 이유, 곧 모든 branch가 같은 창을 보고 곱해서 더하기만 한다는 이유로 더한 kernel 하나가 모든 자리에서 같은 값을 낸다. 그림의 25자리 차이가 넷 모두 0이다.",
        ],
      },
      {
        q: "PBConv는 무엇을 보고 자리를 고르고, 무엇을 얻었나?",
        a: [
          "저자들은 학습이 끝난 kernel의 아홉 자리가 똑같이 중요하지 않다는 데서 출발했다. 자리마다 가중치의 크기를 층 전체에서 평균 내면 모델마다 모양이 다르고, 크기가 큰 자리를 0으로 지우면 성능이 더 떨어졌다.",
          "그래서 작은 kernel 여러 개로 아홉 자리를 덮는 조합을 무작위로 여럿 만들어 잠깐씩 학습해 보고, 초반 kernel에서 자리별 크기가 얼마나 퍼졌는지를 기준으로 고른다. ImageNet의 ResNet-18에서 70.75%가 72.08%가 됐다. 학습이 끝나면 모든 branch가 원래 크기의 kernel 하나로 합쳐져 추론 비용은 그대로다.",
          "합친 뒤 같은 함수라는 것은 계산이고, 정확도가 오른 것은 실험이다. RepVGG에서와 같다.",
        ],
      },
    ],
    formula: "y_c = \\big(k^{(3)}_c + \\mathrm{pad}(k^{(1)}_c) + I\\big) * x_c, \\qquad c = 1, \\dots, C\nk' = k^{(3)} + \\sum_{l} \\mathrm{place}_l\\big(k^{(l)}\\big)",
    symbols: [
      "x_c: c번째 채널의 feature map. 01절의 사진이 c = 1이다",
      "k^{(3)}_c, k^{(1)}_c: 그 채널만의 kernel과 숫자 하나. 합친 kernel이 채널 수 C만큼 생긴다",
      "k^{(l)}: PBConv의 l번째 작은 kernel",
      "place_l: 그 작은 kernel의 창이 3×3 창의 어느 자리와 겹치는지에 따라 그 자리에 적는 일. 나머지는 0이다",
    ],
    takeaway: "작은 kernel의 창이 3×3 창 안에 있고 kernel이 고정되어 있으면, 채널마다든 가운데가 아닌 자리든 더해서 하나로 만들 수 있다. RepViT는 mobile CNN의 depthwise conv에서 추론 때의 skip connection을 없앴고, PBConv는 창 안의 자리마다 다른 몫을 학습 때만 배운다.",
    see: "그림 위의 탭으로 논문을 고른다. RepViT 탭의 \"채널마다 합치기\"에는 채널 셋이 한 줄씩 있다. 줄마다 그 채널의 kernel, 1×1의 숫자를 가운데에 적은 것, identity, 합친 kernel이다. 바뀌는 것은 가운데 값뿐이다. \"MobileNetV3에서 RepViT까지\"는 가로가 iPhone 12의 latency, 세로가 top-1인 점 아홉 개다. 단계를 올리면 점이 하나씩 이어지고, 블록을 바꾸며 branch를 붙인 둘째 점에 주황 테두리가 있다. 점의 숫자는 논문 그림 2의 값이고 증류 없이 잰 것이다. PBConv 탭에서는 작은 kernel을 넷 가운데 하나로 고른다. 파란 테두리가 가운데 자리의 창, 주황 칸이 작은 kernel이 보는 픽셀이다. 오른쪽에 작은 kernel을 3×3에 적은 모양과 합친 kernel이 있고, 맨 아래 줄이 두 방식으로 계산한 가운데 자리의 값과 25자리 차이의 최댓값이다. 둘째와 셋째 채널의 숫자와 작은 kernel의 숫자는 손으로 정했다.",
    bridge: "지금까지의 kernel은 모두 자리와 사진에 상관없이 같은 아홉 숫자였다. 그래서 branch를 미리 더해 둘 수 있었다. kernel의 숫자가 자리마다, 사진마다 입력에서 새로 만들어진다면 어떻게 되나?",
  },
  {
    id: "lsnet", num: "07", kicker: "LSNet, 2025",
    question: "자리마다 kernel이 입력에서 만들어지면 왜 더는 미리 합칠 수 없나?",
    gist: [
      "02절의 합치기는 kernel이 자리와 입력에 상관없이 고정된 숫자라서 됐다. LSNet의 LS convolution은 자리마다 주변의 입력을 넓게 보고 가중치를 새로 계산한 뒤, 그 가중치로 좁은 3×3 이웃을 모은다. 가중치가 입력에서 나오니 미리 더해 둘 kernel 자체가 없다.",
      "고정 kernel은 미리 새겨 둔 도장이다. 도장이 몇 개든 미리 겹쳐 새 도장 하나로 만들 수 있다. LS convolution은 찍을 자리 주변을 둘러보고 그때그때 도장을 새로 새기는 셈이라, 미리 겹쳐 둘 도장이 없다. 도장은 자리마다의 가중치, 둘러보기는 넓게 보는 단계, 찍기는 좁게 모으는 단계다.",
      "LSNet 전체가 합칠 수 없는 것은 아니다. 고정된 부분은 여전히 합치고, 입력에 따라 바뀌는 부분만 추론 때도 계산한다.",
    ],
    lead: [
      "LSNet은 RepViT와 같은 저자들의 CVPR 2025 논문이고, 이 절은 arXiv 2503.23135v1을 따른다. 제목 See Large, Focus Small이 방법을 요약한다. 넓게 보고 좁게 모은다.",
    ],
    walk: [
      {
        q: "LS convolution은 무엇을 계산하나?",
        a: [
          "논문은 이웃을 섞는 일을 둘로 나눴다. 이웃과의 관계를 재는 일과, 잰 관계대로 이웃의 값을 모으는 일이다. conv에서는 둘 다 고정 kernel이 한다. self-attention, 곧 자리끼리 서로 비교해 가중치를 그때그때 만드는 계산에서는 둘이 같은 넓이에서 일어난다. LS convolution은 넓게 재고 좁게 모은다.",
          "넓게 보는 단계(large-kernel perception)는 채널을 줄이는 1×1 conv, 큰 depthwise conv, 다시 1×1 conv를 거쳐 자리마다 가중치 아홉 개를 낸다. 좁게 모으는 단계(small-kernel aggregation)는 그 가중치로 그 자리의 이웃 아홉 픽셀을 곱해 더한다. 큰 depthwise kernel 자체는 고정된 숫자다. 그 kernel이 낸 값으로 만든 가중치가 자리마다, 사진마다 달라진다.",
        ],
      },
      {
        q: "같은 5×5 사진에서는 어떻게 보이나?",
        a: [
          "채널 하나로 줄인 작은 식을 만든다. 넓게 보기는 그 자리를 가운데로 한 5×5 창의 평균 하나로 줄였다. 가중치는 01절의 kernel에서 윗줄 가운데 값에만 이 평균의 두 배를 더한 것이다.",
          "가운데 자리에서 평균은 1.2이고, 좁게 모은 출력은 14.2다. 고정 kernel이 낸 7보다 크다. 실제 LS convolution의 정규화와 비선형은 뺐고, 식과 숫자는 손으로 정했다.",
        ],
      },
      {
        q: "3×3 창 밖의 픽셀 하나를 바꾸면 무엇이 달라지나?",
        a: [
          "먼저 예상해 보라. 왼쪽 위 모서리 픽셀을 1에서 6으로 바꾼다. 이 픽셀은 가운데 자리의 3×3 창 밖에 있다. 01절의 고정 kernel이라면 가운데 자리의 출력은 7 그대로다.",
          "작은 식에서는 바뀐다. 그 픽셀이 가운데 자리의 5×5 창 안에 있어서 평균이 오르고, 윗줄 가운데 가중치가 커져서 출력이 14.2에서 15.4가 된다. 좁은 창 안의 픽셀은 하나도 바뀌지 않았는데 가중치가 바뀌어 출력이 바뀌었다.",
          "그림 아래의 map은 25자리 각각에서 쓰인 윗줄 가운데 가중치다. 고정 kernel이면 모두 같다. 작은 식에서는 자리마다 다르고, 모서리 픽셀을 바꾸면 그 픽셀을 넓은 창에 넣는 아홉 자리만 바뀐다.",
        ],
      },
      {
        q: "왜 이것은 미리 합칠 수 없나?",
        a: [
          "02절의 합치기는 두 사실에 기댔다. branch마다 kernel이 자리와 상관없이 하나였고, 출력이 입력에 곱해서 더하기만 한 linear 계산이었다. 작은 식의 가중치는 입력에서 계산되므로 미리 적어 둘 kernel이 없다. 사진을 넣어 봐야 그 자리의 가중치가 나온다.",
          "linear인지는 사진 전체를 두 배로 해 보면 드러난다. 고정 kernel의 가운데 출력은 7에서 정확히 두 배인 14가 된다. 작은 식은 14.2의 두 배인 28.4가 아니라 42.8이 된다. 가중치도 입력에 따라 커져서 입력이 두 번 곱해진 꼴이기 때문이다.",
          "공개 코드에서 LSNet의 블록에는 RepViT에서 본 것과 같은 branch 셋짜리 depthwise 모듈이 들어 있고, 그 모듈에는 합치는 함수가 붙어 있다. LS convolution에는 그런 함수가 없다. 고정된 부분은 합치고, 입력에 따라 바뀌는 부분은 추론 때도 계산한다.",
        ],
      },
      {
        q: "논문은 무엇을 보고했고, 무엇은 보여 주지 않나?",
        a: [
          "ImageNet에서 LSNet-B는 같은 표의 RepViT-M1.1과 FLOPs가 같으면서 top-1이 80.3% 대 79.4%로 높고, RTX3090에서 잰 throughput도 조금 많다. LSNet-T의 짧은 학습 비교에서 좁게 모으는 단계를 고정 kernel의 depthwise conv로 바꾸면 정확도가 1.5%포인트 낮았다.",
          "이 논문의 표에는 mobile latency가 없고 속도는 GPU throughput이다. 그래서 RepViT의 iPhone 12 숫자와 바로 견줄 수 없다. 입력에 따라 바뀌는 가중치는 추론 때 계산이 남는다는 뜻이다. 그 계산은 FLOPs에 들어 있지만, mobile에서 실제로 얼마나 걸리는지는 이 표로 알 수 없다.",
        ],
      },
    ],
    formula: "\\text{static: } \\; y_p = \\sum_{q \\in N_3(p)} k_{q-p}\\; x_q\n\\text{LS: } \\; y_p = \\sum_{q \\in N_3(p)} w_{q-p}\\big(x_{N_7(p)}\\big)\\; x_q",
    symbols: [
      "p: 출력 자리. q: 그 자리의 3×3 이웃. q − p는 이웃이 3×3의 어느 자리인지를 가리킨다",
      "k: 자리와 사진에 상관없는 고정 kernel. 미리 더해 둘 수 있다",
      "w(x_{N_7(p)}): 그 자리 주변의 넓은 창에서 계산된 가중치. 논문은 7×7이고 그림에서는 5×5 평균으로 줄였다",
      "w가 x에 기대므로 y는 x에 곱해서 더하기만 하는 linear 계산이 아니다",
    ],
    takeaway: "고정 kernel은 자리와 사진에 상관없이 같아서 branch를 미리 더해 둘 수 있다. LS convolution의 가중치는 넓게 본 입력에서 자리마다 계산되므로, 그 부분에는 미리 합칠 kernel이 없고 추론 때도 계산한다.",
    see: "\"계산\"에서 고정 3×3과 LS 식을 바꿔 보라. 왼쪽이 사진이고, 점선이 넓게 보는 창, 주황 테두리가 좁게 모으는 창이다. 오른쪽에 그 자리의 가중치와 출력이 있다. \"모서리 픽셀\"을 6으로 바꾸면 고정 3×3에서는 출력이 7 그대로이고, LS 식에서는 평균과 가중치와 출력이 함께 바뀐다. 아래 map은 25자리마다 쓰인 윗줄 가운데 가중치다. 고정 kernel이면 모두 같고, LS 식이면 자리마다 다르며, 모서리 픽셀을 바꾸면 빨간 테두리의 아홉 자리만 바뀐다. 식과 숫자는 설명을 위해 손으로 만든 것이다.",
    bridge: "이 챕터는 사진 한 장을 분류하는 backbone을 빠르게 하는 이야기였다. 물체 여럿의 자리와 클래스를 한꺼번에 내야 하는 detection에서는 backbone 뒤에도 시간이 든다. 한 물체 위에 겹쳐 뜬 bounding box를 지우는 NMS가 그렇다. 그 단계는 왜 필요했고, 없앨 수 있나? 다음 챕터의 YOLOv10이 이 질문에서 시작한다.",
  },
];

export const repCopy = {
  title: "학습할 때와 쓸 때 모양이 다른 모델: RepVGG에서 LSNet까지",
  sub: "학습할 때는 branch가 여럿인 블록으로 배우고, 추론할 때는 그 블록을 3×3 conv 하나로 바꿔 돌린다. 바꾸기 전과 후의 출력은 숫자 하나 다르지 않다. 이 챕터는 5×5 사진 한 장과 branch 셋짜리 블록 하나로 branch 합치기와 BatchNorm folding을 손으로 한 뒤, 대표로 RepVGG를 깊게 읽는다. 왜 빨라지는지와 왜 굳이 branch로 학습하는지다. 끝으로 같은 합치기를 mobile과 다른 자리로 넓힌 RepViT와 PBConv, 자리마다 kernel이 달라져 더는 합칠 수 없는 LSNet을 짧게 본다.",
  prologue,
  sections,
  ui: {
    common: { input: "입력 x", window: "3×3 창", kernel: "kernel", out: "출력 feature map", center: "가운데", value: "값", same: "같음", step: "단계", paper: "논문이 보고한 값", hand: "손으로 정한 값" },
    branches: {
      steps: ["3×3 branch", "1×1과 identity", "더하기"], spot: "자리", spots: ["가운데", "윗변", "모서리"], poke: "가운데 픽셀", pokeOff: "그대로", pokeOn: "+1",
      b3: "3×3 branch", b1: "1×1 branch, 숫자 하나", b0: "identity branch", nonzero: "0이 아닌 곱", sum: "세 branch의 합", outside: "사진 밖은 0 (padding)", moved: "값이 바뀐 자리", waiting: "아직 계산 전",
    },
    merge: {
      steps: ["고쳐 쓰기", "더하기", "25자리 비교"], k3: "3×3 branch", k1: "1×1을 3×3으로", id: "identity를 3×3으로", k1Short: "1×1", idShort: "identity", merged: "합친 kernel", centre: "가운데 값",
      twoWays: "가운데 자리를 두 가지로", branches: "세 branch를 따로", one: "합친 kernel 하나", sumMap: "세 branch의 합", mergedMap: "합친 kernel", diffMap: "차이", allZero: "25자리 모두 0",
    },
    bn: {
      mode: "언제", infer: "추론 때", train: "학습 때", steps: ["BatchNorm 지나기", "접기"], other: "옆 사진", otherA: "옆 사진 A", otherB: "A를 전체 +2",
      rows: ["3×3 branch", "1×1 branch", "identity branch"], conv: "conv 값", after: "지난 뒤", folded: "접은 뒤", scale: "곱할 수", bias: "bias", total: "더한 값",
      mergedLine: "합친 kernel 하나 + bias", batch: "batch = 우리 사진 + 옆 사진", batchStats: "두 사진의 3×3 branch 값 50개", ours: "우리 사진", fixed: "추론 때라면 고정된 μ = 3, σ = 2",
    },
    repvgg: {
      views: ["학습 때", "추론 때", "ResNet과 비교"], stage: "한 stage의 처음 네 층", stride: "stride 2", add: "+", relu: "ReLU", identity: "identity",
      speed: "RepVGG-B0, 1080Ti, batch 128, 초당 사진 수", trainShape: "합치기 전 모양", deployShape: "합친 뒤 모양", acc: "top-1 75.14%, 두 모양 같음",
      trainNote: "층마다 branch 둘이나 셋, branch마다 BatchNorm, 더한 뒤 ReLU", deployNote: "층마다 3×3 conv 하나와 bias",
      table: "표 4, ImageNet, 120 epoch, 1080Ti batch 128", top1: "top-1 %", tput: "초당 사진 수", from70: "top-1 막대는 70%에서 시작",
    },
    why: {
      views: ["step별", "논문의 실험"], steps: "step", direct: "합친 kernel을 직접", viaBranch: "branch로 고친 뒤 합침", diff: "차이", target: "목표 kernel", loss: "loss",
      firstStep: "첫 step의 가운데 값", grad: "출발점 가운데 값의 gradient", table: "RepVGG-B0, 120 epoch, top-1 %", t6: "표 6: 학습 때 남긴 branch", t7: "표 7: 다른 모양",
      from72: "막대는 72%에서 시작", rows6: ["branch 없음", "identity만", "1×1만", "둘 다"], rows7: ["가운데 1을 kernel에 더해 학습", "BN을 더한 뒤 하나만", "identity의 BN 없음", "branch마다 BN", "branch 안에 ReLU"], cannot: "합칠 수 없음",
    },
    reach: { paper: "논문", tabs: ["RepViT · 채널마다", "PBConv · 자리"] },
    repvit: {
      views: ["채널마다 합치기", "MobileNetV3에서 RepViT까지"], channel: "채널", k3: "3×3", k1: "1×1", id: "identity", merged: "합친 kernel", ours: "이 챕터의 예",
      noMix: "채널끼리 섞이지 않고, 추론 때 skip이 없다", stepLabel: "단계",
      names: ["MobileNetV3-L", "블록 분리 + branch", "채널 폭", "첫 층", "downsampling 층", "분류기", "stage별 블록 수", "kernel 크기", "SE 자리"],
      xAxis: "iPhone 12 latency, ms", yAxis: "top-1 %", source: "논문 그림 2, 증류 없음",
    },
    pbconv: {
      pick: "작은 kernel", names: ["1×1 가운데", "1×3 가운데 줄", "3×1 가운데 열", "2×2 오른쪽 아래"], small: "작은 kernel", placed: "3×3에 적은 것", base: "3×3 branch", merged: "합친 kernel",
      twoWays: "가운데 자리", separate: "따로 계산해 더함", one: "합친 kernel 하나", gap: "25자리 차이의 최댓값", sees: "작은 kernel이 보는 픽셀",
    },
    lsnet: {
      calc: "계산", fixed: "고정 3×3", ls: "LS 식", far: "모서리 픽셀", wide: "넓게 본 평균", weights: "이 자리의 3×3 가중치", output: "출력",
      map: "25자리마다 쓰인 윗줄 가운데 가중치", changed: "바뀐 자리", sameAll: "고정 kernel: 25자리 모두 같다", noWide: "고정 kernel은 넓게 보지 않는다", formula: "가중치 = kernel + 2 × 평균, 윗줄 가운데에만",
    },
  },
};
