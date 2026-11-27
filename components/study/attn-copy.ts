import type { Prologue, StudySection } from "./chapters";

const prologue: Prologue = {
  title: "이야기의 시작: 표는 토큰 수의 제곱으로 자란다",
  paragraphs: [
    "Transformer 챕터의 attention을 한 문단으로 다시 적는다. 토큰마다 벡터 셋을 만든다. query(Q)는 무엇을 찾는지, key(K)는 무엇으로 찾아지는지, value(V)는 실제로 건네는 내용이다. 한 토큰의 Q를 모든 토큰의 K와 내적하면 점수가 하나씩 나오고, softmax로 그 점수들을 합이 1인 비율, 곧 attention weight로 바꾼 뒤 그 비율대로 V를 섞는다. 이 계산을 여러 세트 따로 두는 것이 head다. 토큰이 N개면 점수는 N × N개이고, 이 표를 score table이라 부른다.",
    "토큰 챕터는 토큰의 수를 줄여 이 표와 나머지 계산을 함께 줄였다. 토큰을 줄일 수 없을 때가 있다. 그림을 1024픽셀로 넣어 16픽셀 patch로 자르면 토큰이 4096개, 2048픽셀이면 16384개다. 긴 문서, 긴 영상, 긴 대화도 그렇다. 그러면 표가 계산의 대부분이 되고, 학습할 때는 표를 메모리에 다 들고 있을 수조차 없다.",
    "2019년부터 여러 길이 나왔다. 이 챕터는 갈래마다 대표 하나를 깊게 본다. FlashAttention은 표를 하나도 버리지 않고 정확히 계산하되 GPU 메모리에 쓰지 않는다. 빨라진 이유가 곱셈이 아니라 memory traffic, 곧 메모리와 칩 사이를 오가는 바이트였다. Swin Transformer는 그림을 window로 나눠 가까운 토큰끼리만 읽는다. linear attention은 곱하는 순서를 바꿔 표 자체를 만들지 않는다. 답을 한 토큰씩 쓰는 생성에서는 KV cache를 읽는 시간이 문제가 되고, MQA와 GQA는 head들이 K와 V를 나눠 쓰게 했다. Longformer, BigBird, Linformer 같은 이웃 방법은 해당 절과 마지막 비교에서 짧게 짚는다.",
    "이 챕터는 샴고양이 그림 한 장을 점점 크게 넣으며 따라간다. 따라가는 것은 눈 patch 하나가 만드는 점수 한 행이다. 손으로 계산할 때는 토큰 챕터의 고양이 조각에서 넷만 고른다. 배경, 크림색 털, 갈색 귀, 그리고 눈이다. 절마다 맨 앞의 \"먼저 큰 그림\"에 답을 먼저 적었다. 그것을 읽고 아래의 계산으로 확인하면 된다.",
    "다 읽고 나면 세 가지를 스스로 따질 수 있다. attention이 느린 것이 곱셈 때문인지 데이터를 옮기는 일 때문인지, 어떤 방법이 답을 그대로 두고 어떤 방법이 모델 자체를 바꾸는지, 그리고 작은 사진, 큰 그림의 학습, 긴 생성 가운데 내 상황에서는 무엇을 먼저 써야 하는지다.",
  ],
  timeline: [
    { year: "2017", text: "Transformer. 토큰마다 모든 토큰을 읽는 N × N score table" },
    { year: "2018", text: "online softmax. 최댓값과 합을 들고 가며 softmax를 한 번 훑어 계산" },
    { year: "2019", text: "MQA, K와 V의 head를 하나로. Sparse Transformer, 정해 둔 토큰만 읽는 sparse 패턴" },
    { year: "2020", text: "linear attention, 곱하는 순서를 바꿔 표를 없앰. Longformer, BigBird, Linformer" },
    { year: "2021", text: "Swin Transformer, 층마다 밀리는 window" },
    { year: "2022", text: "FlashAttention, 표를 GPU 메모리에 쓰지 않는 정확한 attention" },
    { year: "2023", text: "GQA, FlashAttention-2, Mistral의 sliding window, Mamba" },
    { year: "2024", text: "FlashAttention-3. Llama 3이 GQA를 씀" },
  ],
};

const sections: StudySection[] = [
  {
    id: "wall", num: "01", kicker: "시간과 공간",
    question: "고양이 그림을 1024픽셀로 키우면 점수 표는 얼마나 무거워지나?",
    gist: [
      "attention에서는 토큰마다 자기 Q를 모든 토큰의 K와 내적해 점수를 하나씩 낸다. 토큰이 N개면 점수는 N × N개이고, 이 표가 score table이다. 그림의 가로세로를 두 배로 키우면 토큰은 네 배, 표는 열여섯 배가 된다. \"attention은 N²\"이라는 말이 가리키는 것이 이 표다.",
      "방에 모인 사람 모두가 모든 사람에게 한 번씩 질문하는 회의와 같다. 사람이 토큰이고, 질문 하나가 점수 하나(Q와 K의 내적)이고, 질문을 적은 기록표가 score table이다. 사람이 두 배가 되면 질문은 네 배가 된다.",
      "흔히 이 표가 계산 시간만 늘린다고 생각한다. 그런데 학습할 때는 시간보다 메모리가 먼저 바닥난다. gradient를 거꾸로 계산하는 backward pass가 이 표를 다시 쓰기 때문에, 모든 층의 표를 그때까지 들고 있어야 한다.",
    ],
    lead: [
      "토큰 챕터는 Transformer 층 하나의 계산을 두 몫으로 나눴다. 토큰마다 따로 하는 일(Q, K, V를 만드는 행렬 곱과 MLP)은 토큰 수 N에 비례하고, 토큰 사이의 일(score table을 만들고 그 비율로 V를 섞는 일)은 N²에 비례한다. 토큰 벡터의 길이를 d라 하면 뒤의 몫은 N/(N + 6d)이고, 토큰 수가 d의 여섯 배를 넘어야 절반을 넘는다. 그 챕터는 토큰 수를 줄여서 두 몫을 함께 줄였다. 이 챕터는 토큰을 줄일 수 없을 때에서 시작한다.",
      "줄일 수 없는 경우는 흔하다. 고양이의 수염 한 올까지 경계를 그려야 하는 분할 모델은 그림을 작게 넣을 수 없다. 긴 문서는 어느 문장이 답에 필요할지 미리 모른다. 이 챕터는 같은 샴고양이 그림을 점점 크게 넣고, 16 × 16픽셀 patch 하나를 토큰 하나로 삼는다. [CLS] 토큰은 빼고 센다. 그림이 1024픽셀이면 토큰이 4096개다. 실제로 SAM의 이미지 인코더가 1024픽셀 그림을 이렇게 잘라 토큰 4096개를 만든다.",
      "이 챕터가 끝까지 따라가는 것은 눈 patch 하나가 만드는 점수 한 행이다. 눈의 Q를 모든 토큰의 K와 내적한 점수 N개다. 토큰마다 이런 행이 하나씩 있으니 표는 N행 N열이다. 뒤의 방법들은 모두 이 한 행에 무언가를 한다. 저장하지 않거나, 짧게 자르거나, 아예 만들지 않는다. 그때마다 눈이 읽어 오는 것이 그대로인지를 본다.",
    ],
    walk: [
      {
        q: "그림의 가로세로를 두 배로 키우면 무엇이 몇 배가 되나?",
        a: [
          "가로세로가 두 배면 patch 수가 네 배다. 512픽셀의 토큰 1024개가 1024픽셀에서 4096개가 된다. 눈의 행도 네 배로 길어지고 행의 수도 네 배이니 표는 열여섯 배다. 토큰마다 하는 일은 네 배, 토큰 사이의 일은 열여섯 배로 는다.",
          "ViT-B로 세면 층의 계산 가운데 토큰 사이의 몫이 512픽셀에서 18.2%, 1024픽셀에서 47.1%, 2048픽셀에서 78.0%다. 1024픽셀은 문턱인 6d 바로 앞이고 2048픽셀은 문턱을 훌쩍 넘었다. 여기서부터 층의 계산은 대부분 표를 만들고 그 비율로 V를 섞는 일이다.",
        ],
      },
      {
        q: "계산 말고 메모리는 어떤가? 표 하나는 몇 바이트인가?",
        a: [
          "표의 원소 하나는 숫자 하나이고, 16비트로 적으면 2바이트다. 1024픽셀에서 표 하나는 32MB다. 표는 head마다 하나이고 ViT-B는 head가 12개라서 층 하나에 384MB다.",
          "견줄 것을 놓아 보자. 같은 층을 나오는 토큰 벡터 전체가 6MB다. 표가 그 64배다. 토큰이 늘수록 표는 토큰 벡터보다 빨리 커진다.",
        ],
      },
      {
        q: "추론할 때와 학습할 때 들고 있어야 하는 표가 다른가?",
        a: [
          "추론할 때는 쓰고 나면 버린다. 층 하나의 표로 V를 섞고 나면 다음 층에는 섞은 결과만 넘어간다. 한 번에 들고 있는 것은 많아야 층 하나의 표다.",
          "학습할 때는 버릴 수 없다. backward pass에서 score를 softmax에 넣은 표, 곧 attention weight 표 P가 다시 쓰이기 때문이다. V에 대한 gradient도 점수에 대한 gradient도 P로 계산한다. 그래서 forward pass 동안 모든 층의 P를 남겨 둔다. ViT-B의 모든 층을 합하면 1024픽셀 그림 한 장에 4.5GB이고, 여러 장을 한 batch로 학습하면 그 배수다. 2048픽셀이면 한 장에 72GB다. 시간보다 메모리가 먼저 바닥난다.",
        ],
      },
      {
        q: "N²을 줄이는 길은 몇 가지인가?",
        a: [
          "눈의 행으로 보면 이 챕터가 다룰 길은 넷이다. 첫째, 행을 끝까지 계산하되 메모리에 저장하지 않는다. 02절의 online softmax와 03절의 FlashAttention이다. 계산은 그대로이고 memory traffic과 학습 메모리가 준다. 둘째, 행을 가까운 토큰 몇 개로 자른다. 04절의 window attention이다. 셋째, 곱하는 순서를 바꿔 행을 아예 만들지 않는다. 05절의 linear attention이다.",
          "넷째는 생성 쪽이다. 답을 한 토큰씩 쓸 때는 새 토큰 하나의 행만 계산하지만, 그 행을 위해 앞의 K와 V를 매번 다 읽는다. 06절에서 K와 V를 head끼리 나눠 쓰는 MQA와 GQA를 본다. 이 가운데 답이 정확히 같은 것은 첫째뿐이다. 나머지는 모델이 계산하는 것 자체가 바뀐다.",
        ],
      },
    ],
    formula: "\\text{one table} = N^2 \\times 2 \\text{ bytes, per head and layer}\n\\frac{h\\,N^2}{N\\,d} = \\frac{h\\,N}{d}\n\\text{training keeps } P:\\; L \\times h \\times N^2 \\times 2 \\text{ bytes}",
    symbols: [
      "N: 토큰 수. 눈의 행의 길이이기도 하다",
      "h: head 수. 표는 head마다 하나다",
      "d: 토큰 벡터의 길이. hN/d는 층 하나의 표가 토큰 벡터의 몇 배인지다",
      "L: 층 수. 학습은 모든 층의 P를 backward pass까지 남긴다",
      "2 bytes: 16비트로 적은 숫자 하나",
    ],
    takeaway: "그림의 가로세로를 두 배로 키우면 score table은 열여섯 배가 된다. ViT-B에서 1024픽셀부터는 계산의 절반 가까이가 표이고, 학습할 때는 모든 층의 표를 backward pass까지 들고 있어야 해서 메모리가 먼저 바닥난다.",
    see: "그림 크기를 64픽셀에서 2048픽셀까지 바꿔 보라. 왼쪽 고양이 위의 격자가 16픽셀 patch이고 파란 칸이 눈 patch다. 그림이 커지면 눈 patch가 작아져 동그라미로 둘렀고, 격자가 너무 촘촘해지면 그리지 않았다. 오른쪽 숫자는 토큰 수, 눈의 행의 길이, 표의 원소 수와 한 단계 작은 그림에 견준 배수다. 아래 첫 막대는 층의 계산 가운데 토큰 사이의 몫이다. 그 아래 막대들이 바이트다. 토큰 벡터, 표 하나, 층 하나의 표 12개이고, \"학습\"을 고르면 12층의 P를 모두 남긴 크기가 더해진다. 막대 길이는 그때 가장 큰 막대에 맞췄다. 바이트는 숫자 하나를 16비트로, 1MB를 2²⁰바이트로 셌다.",
    bridge: "학습에서 표를 들고 있는 이유는 backward pass가 P를 쓰기 때문이었다. 그런데 forward pass에서도 표 전체가 한꺼번에 있어야 하나? softmax는 행 전체의 합으로 나누니 행을 다 펼쳐야 할 것 같다. 정말 그런가?",
  },
  {
    id: "online", num: "02", kicker: "online softmax",
    question: "행을 다 펼치지 않고도 softmax를 할 수 있나?",
    gist: [
      "할 수 있다. 점수를 tile(몇 개씩 묶은 조각) 단위로 받으며 지금까지의 최댓값(running max)과 지수의 합(running sum), 아직 나누지 않은 출력만 들고 가면 된다. 이것이 online softmax이고, 마지막에 한 번 나누면 답이 정확히 같다.",
      "시험지를 한 묶음씩 받으며 점수를 지금까지의 최고점에 대한 비율로만 적어 두는 사람과 같다. 새 최고점이 나와도 옛 시험지를 다시 볼 필요 없이, 적어 둔 합계에 \"옛 최고점 ÷ 새 최고점\"을 한 번 곱하면 된다. 최고점이 running max, 비율의 합계가 running sum, 곱하는 수가 보정 계수다.",
      "softmax에서는 비율이 점수끼리가 아니라 e의 거듭제곱끼리의 비라는 점만 다르다. 행 전체의 합으로 나눈다고 행 전체가 한꺼번에 있어야 하는 것은 아니다. 나누기는 맨 끝으로 미루고, 최댓값이 바뀌면 앞의 합을 곱 하나로 고치면 된다.",
    ],
    lead: [
      "1024픽셀 고양이의 눈 행은 점수 수천 개다. 손으로 따라가려고 넷으로 줄인다. 토큰 챕터의 고양이 조각에서 배경, 크림색 털, 갈색 귀, 눈을 골랐다. 벡터는 그 챕터가 그림에서 잰 두 숫자, 곧 밝기와 푸른 정도를 조각들의 평균을 빼고 표준편차로 나눈 것이다. 눈이 가장 어둡다.",
      "눈의 Q는 손으로 정한 [−1.41, 0]이다. 점수는 Q와 K의 내적을 √d로 나눈 것이고 여기서 d는 2다. 그러면 점수가 각 조각의 밝기 숫자에서 부호만 바꾼 값이 된다. 배경 −0.78, 크림색 −0.27, 귀 1.63, 눈 2.51이다. 어두운 조각일수록 점수가 높다. K와 V는 조각의 벡터 그대로다.",
    ],
    walk: [
      {
        q: "행을 한 번에 다 펼치면 눈은 무엇을 읽어 오나?",
        a: [
          "softmax는 점수마다 e의 거듭제곱을 하고 그 합으로 나눈다. attention weight는 배경 2.5%, 크림색 4.1%, 귀 27.5%, 눈 65.9%다. 이 비율로 V를 섞으면 [−2.07, 0.32]다. 눈은 자기 자신을 가장 많이 읽고 어두운 귀를 그다음으로 섞는다.",
          "실제 구현은 지수를 계산하기 전에 행의 최댓값 m을 먼저 뺀다. 16비트 숫자는 65504까지만 적을 수 있어서 점수가 커지면 e의 거듭제곱이 넘친다(overflow). 최댓값을 빼면 가장 큰 지수가 e^0이 되어 넘칠 일이 없고, 나눈 결과는 같다. 문제는 m이 행 전체의 최댓값이라는 것이다. 행을 다 보기 전에는 m을 모른다.",
        ],
      },
      {
        q: "K와 V가 tile 두 개로 나뉘어 차례로 들어오면, 첫 tile로 무엇을 할 수 있나?",
        a: [
          "GPU 칩 안의 빠른 메모리(SRAM, 03절에서 다시 본다)는 작아서 긴 행의 K와 V를 한꺼번에 담지 못한다. 그래서 tile로 나눠 차례로 들인다. 이 그림에서는 두 개씩이고, 첫 tile은 배경과 크림색이다.",
          "이것만 보고 할 수 있는 일을 한다. 지금까지의 최댓값 m은 −0.27이다. m을 뺀 지수의 합 ℓ은 0.598 + 1 = 1.598이다. 같은 지수로 V를 섞어 더한 acc는 [0.74, −0.91]이다. 아직 ℓ로 나누지 않는다. 합이 끝나지 않았기 때문이다.",
        ],
      },
      {
        q: "둘째 tile에 더 큰 점수가 오면 앞의 계산은 버려야 하나?",
        a: [
          "버리지 않고 고친다. 둘째 tile은 귀와 눈이고 새 최댓값은 2.51이다. 첫 tile의 지수는 −0.27을 빼고 계산했는데 이제 2.51을 빼야 한다. 그 차이만큼 곱해 주면 된다. 보정 계수는 e^(−0.27 − 2.51) = 0.0623이다.",
          "앞의 ℓ과 acc에 이것을 곱하고 둘째 tile의 몫을 더한다. ℓ = 1.598 × 0.0623 + e^(1.63 − 2.51) + e^0 = 1.517이고 acc는 [−3.14, 0.49]다. 마지막에 acc를 ℓ로 나누면 [−2.07, 0.32]다. 한 번에 한 것과 같다. 근사가 아니라 지수의 성질 e^(a − c) = e^(a − b) × e^(b − c)를 쓴 것뿐이다.",
        ],
      },
      {
        q: "tile의 순서나 크기를 바꾸면 무엇이 달라지나?",
        a: [
          "그림에서 \"눈이 먼저\"를 골라 보라. 첫 tile이 눈과 귀이면 m이 처음부터 2.51이라 보정 계수가 1이다. 고칠 것이 없다. 중간의 ℓ과 acc는 다르지만 마지막 결과는 같다. tile 크기를 하나로 바꿔도 같다.",
          "행마다 들고 다니는 것은 숫자 둘, m과 ℓ, 그리고 아직 나누지 않은 출력 하나다. 행이 아무리 길어도 그렇다. 2018년 NVIDIA의 Milakov와 Gimelshein이 softmax를 메모리를 덜 읽고 계산하려고 정리한 것이 이 online softmax이고, FlashAttention 논문도 이 분해를 인용해 쓴다.",
        ],
      },
    ],
    formula: "m' = \\max(m,\\ \\max_j s_j), \\qquad \\ell' = e^{\\,m - m'}\\,\\ell + \\sum_j e^{\\,s_j - m'}\na' = e^{\\,m - m'}\\,a + \\sum_j e^{\\,s_j - m'}\\,v_j, \\qquad o = a_{\\text{last}} / \\ell_{\\text{last}}",
    symbols: [
      "s_j: 이번 tile에 들어온 key j의 점수",
      "m: 지금까지 본 점수의 최댓값, 곧 running max",
      "ℓ: m을 뺀 지수의 합, 곧 running sum",
      "a: 같은 지수로 V를 섞어 더한 것. 아직 나누지 않은 출력이다",
      "e^(m − m'): 최댓값이 바뀔 때 앞의 합을 고치는 보정 계수",
      "o: 눈이 읽어 온 것. 한 번에 계산한 것과 같다",
    ],
    takeaway: "softmax는 행 전체를 펼치지 않고 tile마다 최댓값과 합만 들고 가도 정확히 같은 답을 낸다. 더 큰 점수가 늦게 오면 앞의 합에 보정 계수 하나를 곱해 고치고, 나누기는 맨 끝에 한 번 한다.",
    see: "위에 네 조각이 들어오는 순서대로 놓여 있고 조각마다 점수가 적혀 있다. 테두리 상자가 tile이다. 단계를 \"한 번에\"부터 차례로 눌러 보라. \"한 번에\"는 지수 넷과 그 합, 그리고 attention weight를 보여 준다. \"tile 1\"에서 첫 tile만 진해지고 가운데 표의 첫 줄에 m, ℓ, acc가 적힌다. \"tile 2\"에서 둘째 줄이 생기고, 최댓값이 바뀌면 보정 계수가 주황으로 표시된다. \"나누기\"에서 acc를 ℓ로 나눈 값이 맨 아래에 나오고, 한 번에 계산한 값 밑에 초록으로 \"같다\"가 적힌다. 순서를 \"눈이 먼저\"로 바꾸면 보정 계수가 1이 되고 가운데 숫자는 달라지지만 마지막 줄은 그대로다. 조각 벡터는 그림에서 쟀고 눈의 Q는 손으로 정했다.",
    bridge: "행을 tile로 나눠 계산할 수 있다는 것은 확인했다. 그런데 곱셈의 수는 하나도 줄지 않았다. 같은 곱셈을 하는데 왜 빨라진다는 것인가?",
  },
  {
    id: "flash", num: "03", kicker: "FlashAttention",
    question: "곱셈 수는 같은데 왜 빨라지나?",
    gist: [
      "흔히 attention이 느린 것은 곱셈이 많아서라고 생각한다. 실제 원인은 N × N 표를 GPU 메모리에 썼다가 다시 읽는 일, 곧 memory traffic이다. 설명을 위해 손으로 정한 장치에서 세면 계산은 약 1ms, 옮기기는 약 3.4ms다. 이런 상태가 memory-bound다.",
      "GPU 메모리(HBM)는 크지만 느린 창고, SRAM은 칩 안의 작지만 읽고 쓰기가 빠른 작업대다. 곱셈이 빨라지는 곳은 아니다. FlashAttention은 Q, K, V를 작업대에 올라갈 tile로 잘라(tiling) 점수를 작업대에서 만들고 버리고, 창고에는 출력만 보낸다.",
      "tile마다 softmax를 끝낼 수 있는 것은 02절의 online softmax 덕분이다. running max와 running sum이 있으면 늦게 온 큰 점수도 곱 하나로 고쳐서 답이 정확히 같다. backward pass에 쓸 표는 저장하지 않고 다시 계산한다(recomputation).",
    ],
    lead: [
      "효율 챕터의 말을 먼저 가져온다. 층 하나의 시간은 두 시간 가운데 긴 쪽이다. 계산 시간은 FLOPs를 장치의 계산 속도로 나눈 것이고, 메모리 I/O 시간은 memory traffic을 메모리 대역폭으로 나눈 것이다. 계산이 길면 compute-bound, 메모리 I/O가 길면 memory-bound다. 이 절도 그 챕터가 설명을 위해 손으로 정한 장치를 쓴다. 계산 속도는 초당 FLOP 4조 개, 메모리 대역폭은 초당 400억 바이트다. 어느 실제 GPU의 값도 아니다.",
      "2022년 Stanford의 Dao 등이 낸 FlashAttention은 02절의 online softmax를 GPU 위에서 한다. 논문 제목에 성격이 적혀 있다. 정확한 attention이고, 메모리를 읽고 쓰는 양(IO)을 따진다. 따라갈 것은 1024픽셀 고양이를 읽는 head 하나다. 토큰이 4096개이고 head 하나의 벡터 길이는 64다. 눈의 행은 이 head의 행 가운데 하나다.",
    ],
    walk: [
      {
        q: "보통의 구현은 무엇을 얼마나 옮기나?",
        a: [
          "논문은 보통의 구현을 세 걸음으로 적는다. Q와 K를 HBM에서 읽어 점수 표 S를 만들고 HBM에 쓴다. S를 다시 읽어 softmax로 P를 만들고 쓴다. P와 V를 읽어 출력 O를 만들고 쓴다. 표가 HBM을 네 번 오간다. S를 쓰고, 읽고, P를 쓰고, 읽는다.",
          "표 하나가 01절의 32MB이니 네 번이면 128MB다. Q, K, V, O는 넷을 합쳐 2MB뿐이다. 모두 130MB이고 거의 전부가 표다. 곱셈은 QKᵀ와 PV 두 행렬 곱을 합쳐 FLOP 약 43억 개다.",
        ],
      },
      {
        q: "손으로 정한 장치에서는 얼마나 걸리나?",
        a: [
          "계산 시간은 FLOP 수를 계산 속도로 나눠 1.07ms다. 메모리 I/O 시간은 130MB를 대역폭으로 나눠 3.41ms다. 메모리 I/O가 세 배 넘게 길다. 이 attention은 memory-bound이고, 계산하는 쪽은 대부분의 시간 동안 데이터를 기다린다.",
          "효율 챕터의 잣대로 봐도 같다. arithmetic intensity, 곧 바이트 하나를 가져와 하는 FLOP의 수가 31.5다. 장치의 ridge point는 계산 속도를 대역폭으로 나눈 값으로 100이다. arithmetic intensity가 이보다 작으면 memory-bound다. 표가 HBM을 오가는 한 이 사정은 바뀌지 않는다.",
        ],
      },
      {
        q: "FlashAttention은 무엇을 옮기지 않나?",
        a: [
          "표를 옮기지 않는다. Q를 128행씩 SRAM에 들인다. 눈의 행도 그 가운데 하나다. 이 Q tile이 SRAM에 머무는 동안 K와 V를 tile로 하나씩 들이며 02절의 계산, 곧 최댓값과 합을 고쳐 가며 더하는 일을 한다. 행마다 m, ℓ, 아직 나누지 않은 출력을 SRAM에 들고 있다가, K와 V가 다 지나가면 나눠서 O만 HBM에 쓴다. 점수 tile은 SRAM에서 만들어지고 SRAM에서 사라진다.",
          "옮기는 것은 Q와 O 한 번씩, 그리고 K와 V다. K와 V는 Q tile마다 한 번씩 다시 읽으니 32번이다. 합하면 약 33MB로 표준 방식의 4분의 1쯤이다. 계산 시간은 그대로이고 메모리 I/O 시간은 0.87ms로 줄었다. 이제 계산이 더 길다. 걸리는 시간이 3.41ms에서 계산 시간인 1.07ms로 준다. 곱셈은 하나도 줄지 않았다.",
        ],
      },
      {
        q: "tile을 키우면 더 빨라지나?",
        a: [
          "그림에서 Q tile을 64행으로 내려 보라. K와 V를 두 배로 자주 읽어야 해서 memory traffic이 65MB이고 시간이 1.70ms다. 다시 memory-bound다. 256행으로 올리면 memory traffic은 17MB로 더 줄지만 시간은 1.07ms 그대로다. 이미 계산이 시간을 정하고 있기 때문이다.",
          "논문이 잰 결과도 같은 모양이다. block 크기가 커질수록 HBM 접근이 줄고 빨라지다가, 256을 넘으면 산술 같은 다른 것이 시간을 정한다. 그리고 tile이 너무 크면 SRAM에 들어가지 않는다.",
        ],
      },
      {
        q: "학습할 때 backward pass에 필요한 P는 어디서 오나?",
        a: [
          "다시 계산한다. 이것이 recomputation이다. forward pass에서는 행마다 m과 ℓ 두 숫자만 남긴다. backward pass에서 Q, K, V tile을 다시 SRAM에 들여 S와 P를 그 자리에서 다시 만든다. m과 ℓ이 있으니 행 전체를 다시 볼 필요 없이 tile마다 정확한 P가 나온다. 남겨 두는 양이 head 하나에 32MB에서 32KB로 준다. ViT-B 12층 전체로는 그림 한 장에 4.5GB가 4.5MB가 된다.",
          "계산은 오히려 는다. 논문이 GPT-2 medium의 attention을 A100 GPU에서 forward와 backward까지 잰 값이 있다(sequence length 1024). FLOP은 보통의 구현이 66.6G, FlashAttention이 75.2G로 다시 계산한 만큼 많다. 그런데 HBM을 읽고 쓴 양은 40.3GB에서 4.4GB로, 시간은 41.7ms에서 7.3ms로 줄었다. 손으로 정한 장치에서 센 것과 같은 방향이다.",
        ],
      },
      {
        q: "FlashAttention이 줄이지 않는 것은 무엇인가?",
        a: [
          "곱셈의 수다. 표는 여전히 원소마다 계산한다. compute-bound가 된 뒤로는 tile을 바꿔서 더 빨라질 길이 없다. 2048픽셀이면 head 하나에 계산만 17.2ms다.",
          "짧은 입력에서는 얻을 것도 적다. 224픽셀 사진이면 표가 작고 층 계산의 4.1%뿐이다. 다음 절부터는 계산 자체를 줄인다. 그 대신 답이 달라진다.",
        ],
      },
    ],
    formula: "\\text{standard: } \\underbrace{4N^2}_{S,\\,P\\ \\text{written and read}} + 4Nd \\quad\\text{numbers moved}\n\\text{tiled: } 2Nd + 2Nd \\cdot \\tfrac{N}{B_r} \\quad\\text{numbers moved}, \\qquad \\text{FLOPs} = 4N^2 d \\text{ in both}",
    symbols: [
      "N: 토큰 수. d: head 하나의 벡터 길이",
      "4N²: 표가 HBM을 네 번 오간 것",
      "B_r: SRAM에 머무는 Q tile의 행 수. 그림의 손잡이다",
      "N/B_r: K와 V를 다시 읽는 횟수. FlashAttention-2처럼 Q tile을 바깥 루프에 둔 순서로 셌다",
      "4N²d: 두 행렬 곱의 FLOP. 두 방식이 같다",
    ],
    takeaway: "FlashAttention은 표를 HBM에 쓰지 않고 SRAM에서 tile마다 만들고 버린다. 곱셈은 그대로이거나 오히려 늘지만 memory traffic이 줄어 memory-bound였던 attention이 compute-bound가 되고, 학습 메모리는 N²에서 N으로 준다. 답은 정확히 같다.",
    see: "방식을 \"표준\"과 \"Flash\"로 바꿔 보라. 맨 위 막대가 memory traffic을 무엇을 옮겼는지로 나눈 것이고, 길이는 같은 크기의 표준 방식에 맞췄다. 표준에서는 막대 대부분이 표의 네 번 왕복이다. 가운데 두 막대가 계산 시간과 메모리 I/O 시간이고, 진한 테두리가 붙은 쪽이 실제로 걸리는 시간이다. 1024픽셀에서 표준은 메모리 I/O가 길고, Flash는 Q tile 128행에서 계산이 길다. Q tile을 64로 내리면 Flash도 memory-bound가 되고, 256으로 올리면 바이트는 줄어도 시간은 그대로다. 아래 줄은 backward pass를 위해 남기는 것, 맨 아래는 arithmetic intensity와 ridge point다. 장치의 값은 효율 챕터에서 설명을 위해 손으로 정한 것이다.",
    bridge: "FlashAttention 뒤에도 남는 것은 계산이다. 2048픽셀 고양이의 눈 행은 점수 16384개이고 하나하나 내적을 한다. 그런데 눈이 정말 그림 전체를 봐야 하나? 그림의 대부분은 눈에서 먼 배경이다. 가까운 토큰만 보면 어떤가?",
  },
  {
    id: "window", num: "04", kicker: "window attention",
    question: "가까운 토큰만 보면 무엇을 아끼고 무엇을 잃나?",
    gist: [
      "토큰마다 가까운 몇 개만 읽게 하는 것이 window attention이다. 점수가 N × N개에서 N × w개(w는 window 안의 토큰 수)로 준다. 대표인 Swin Transformer는 그림을 겹치지 않는 window로 나누고, 층마다 window를 반만큼 밀어(shifted window) 이웃 window와도 정보를 섞는다.",
      "큰 회사가 전체 회의 대신 부서 회의만 여는 것과 같다. 사람이 토큰, 부서가 window, 부서 회의가 window 안의 attention이다. 회의 비용은 회사 크기에 비례할 뿐이다. 대신 다른 부서 소식은 부서를 다시 짠 다음 회의(shifted window)에서야 한 부서씩 건너가고, 회의를 연 횟수가 층 수다.",
      "흔히 window를 쓰면 먼 곳을 영영 못 본다고 생각한다. 실제로는 층을 거듭하며 번져서 닿는다. 다만 그림이 크면 닿기 전에 층이 바닥날 수 있다.",
    ],
    lead: [
      "그림에서는 가까운 조각끼리 관계가 많다. 눈의 테두리와 눈 옆의 갈색 털은 바로 옆 patch에 있다. 그렇다면 눈의 행을 이웃 몇 개로 자르자.",
      "이 절은 고양이를 256픽셀로 넣어 16 × 16개의 토큰으로 놓는다. 눈은 위에서 다섯째 줄, 왼쪽에서 열째 칸에 있고, 꼬리 끝은 열다섯째 줄 다섯째 칸에 있다. 따라갈 질문은 하나다. 눈에서 나온 정보가 몇 층 만에 꼬리 끝 토큰에 닿나. 어떤 토큰이 한 층에서 그 정보를 가진 토큰을 읽으면 정보가 닿은 것으로 센다.",
    ],
    walk: [
      {
        q: "window 안에서만 읽으면 계산은 얼마가 되나?",
        a: [
          "토큰마다 w개만 읽으면 표는 N행 w열이다. 점수가 N²에서 N·w로 준다. w를 고정하면 토큰 수에 비례한다.",
          "2021년 Microsoft Research Asia의 Liu 등이 낸 Swin Transformer는 그림을 한 변이 patch M개인 window로 겹치지 않게 나누고 window 안에서만 attention을 한다. 논문은 두 방식의 계산을 아래 식처럼 적었다. hw가 토큰 수, C가 벡터 길이다. 앞의 항은 토큰마다 하는 행렬 곱이라 두 방식이 같고, 토큰 사이의 몫인 뒤의 항만 (hw)²에서 M²·hw로 바뀐다. 논문의 기본 M은 7이다.",
          "그림의 \"window\"는 4 × 4 window다. 눈은 자기 window의 토큰 16개만 읽는다. 한 층의 점수가 모든 쌍을 읽을 때의 16분의 1이 된다.",
        ],
      },
      {
        q: "window 안에서만 읽으면 눈의 정보는 꼬리까지 가나?",
        a: [
          "층을 올려 보라. 아무리 쌓아도 눈의 정보는 자기 window를 벗어나지 않는다. window 안의 토큰은 window 안만 읽고, 밖의 토큰은 이 window를 읽지 않는다. window들이 서로 이어지지 않은 섬이다.",
          "Swin은 층마다 window의 자리를 번갈아 바꾼다. 둘째 층의 window는 첫째 층의 window를 가로세로로 반 window씩 민 것이다. 이것이 shifted window다. \"shifted window\"를 고르면 둘째 층에서 눈의 정보가 이웃 window로 번져 토큰 64개에 닿고, 다섯째 층에서 꼬리 끝에 닿는다.",
        ],
      },
      {
        q: "window가 토큰마다 따로 있으면 무엇이 다른가?",
        a: [
          "2020년의 Longformer는 토큰마다 자기를 가운데 둔 window를 읽게 했다. 이것을 sliding window라 한다. window가 토큰을 따라 움직이니 경계가 없다. 그림의 \"sliding window\"는 이것을 평면에 옮겨 자기를 가운데 둔 5 × 5를 읽게 했다. 눈의 정보는 층마다 두 patch씩 넓어지고, 눈과 꼬리 끝은 가로세로 가운데 먼 쪽으로 열 patch 떨어져 있으니 역시 다섯째 층에서 닿는다.",
          "2023년의 Mistral 7B는 같은 sliding window를 LLM에 썼다. 토큰마다 앞쪽 4096개만 읽는다. 06절에서 다시 본다.",
        ],
      },
      {
        q: "그림이 커지면 몇 층이 필요한가?",
        a: [
          "1024픽셀이면 64 × 64 토큰이고 눈과 꼬리 끝이 42 patch 떨어진다. 5 × 5 sliding window로는 21층, 7 × 7로도 14층이 필요하다. ViT-B는 12층뿐이다. 눈의 정보가 꼬리에 닿기 전에 모델이 끝난다.",
          "그래서 실제 모델은 window만 쓰지 않는다. SAM의 이미지 인코더는 14 × 14 window attention을 쓰고, 그 사이에 모든 토큰을 읽는 층 네 개를 고르게 끼웠다. Swin은 단계가 바뀔 때마다 이웃한 2 × 2 patch를 하나로 합쳐(patch merging) 토큰을 4분의 1로 줄인다. 그러면 뒤 단계의 window 하나가 그림의 더 넓은 곳을 덮는다.",
        ],
      },
      {
        q: "window에 먼 토큰 몇 개를 더 읽게 하면 어떤가?",
        a: [
          "이 길을 간 것이 sparse attention 패턴들이다. Longformer는 sliding window에 global attention을 더했다. 분류의 [CLS]처럼 정해 둔 몇 토큰은 모든 토큰을 읽고 모든 토큰이 그 토큰을 읽는다. 그러면 어떤 두 토큰이든 그 토큰을 거쳐 두 층 만에 이어진다. 대신 그림의 모든 먼 정보가 벡터 몇 개를 지나가야 한다.",
          "2020년 Google의 BigBird는 여기에 토큰마다 무작위로 고른 몇 개(random attention)를 더해, 한 곳으로 몰리지 않는 지름길을 여럿 만들었다. 대가는 어느 쌍을 이을지가 내용을 보기 전에 정해진다는 것이다. BigBird 논문도 이런 패턴으로는 벡터마다 가장 먼 벡터를 찾는 일 같은 문제에 거의 토큰 수만큼의 층이 필요하다고 증명했다.",
        ],
      },
      {
        q: "window가 잃는 것은 무엇인가?",
        a: [
          "먼 두 토큰이 같은 층에서 직접 비교되지 않는다. 눈과 꼬리가 같은 고양이의 것인지 따지는 일은 여러 층을 거쳐 전달된 요약끼리만 할 수 있다. 전달되는 동안 눈의 정보는 지나는 토큰들의 정보와 섞인다.",
          "그리고 이것은 다른 모델이다. 모든 토큰을 읽도록 학습된 ViT에 window를 끼우면 학습 때와 다른 계산을 하게 된다. Swin은 처음부터 window로 학습했고, Longformer는 RoBERTa에서 출발해 window로 사전학습을 더 했다.",
        ],
      },
    ],
    formula: "\\Omega(\\text{MSA}) = 4hwC^2 + 2(hw)^2C, \\qquad \\Omega(\\text{W-MSA}) = 4hwC^2 + 2M^2hwC\n\\text{layers to carry the eye to the tail} = \\left\\lceil \\frac{\\text{gap}}{r} \\right\\rceil",
    symbols: [
      "hw: 토큰 수",
      "C: 토큰 벡터의 길이",
      "M: Swin window의 한 변. 그림에서 4, 논문의 기본값 7",
      "r: sliding window가 한 층에 넓히는 patch 수. 5 × 5 window에서 2",
      "gap: 눈과 꼬리 끝 사이의 patch 수. 가로세로 가운데 먼 쪽이다. 그림에서 10, 1024픽셀에서 42",
    ],
    takeaway: "window attention은 토큰마다 가까운 w개만 읽어 표를 N·w로 줄인다. 대신 먼 토큰의 정보는 층마다 window 하나만큼씩만 건너가므로, 그림이 클수록 눈과 꼬리가 만나는 데 더 많은 층이 든다. 먼 토큰 몇 개를 더하는 sparse 패턴은 길을 줄이지만 어느 쌍을 이을지를 미리 정해 둔다.",
    see: "window의 종류를 고르고 층을 1부터 올려 보라. 고양이 위의 파란 칸이 그 층까지 눈의 정보가 닿은 토큰이고, 주황 테두리가 그 층의 window다. 눈은 초록 테두리, 꼬리 끝은 빨간 테두리이고 정보가 닿으면 초록으로 바뀐다. \"window\"는 몇 층을 올려도 눈의 window 안에 머문다. \"shifted window\"는 짝수 층마다 window가 두 patch씩 밀리고 5층에서 꼬리에 닿는다. \"sliding window\"는 눈의 window만 그렸고, 층마다 두 patch씩 번져 역시 5층에서 닿는다. 숫자 넷은 눈이 한 층에 읽는 토큰 수, 한 층의 점수 수와 모든 쌍의 수, 정보가 닿은 토큰 수, 꼬리 끝에 닿은 층이다. patch의 자리는 그림을 16픽셀 격자로 자른 것이다.",
    bridge: "window와 sparse 패턴은 행의 일부를 골라 남겼다. 남긴 점수는 원래 그대로다. 행 전체를 지키면서 표를 만들지 않는 길은 없나? 행렬 곱은 묶는 순서를 바꿔도 답이 같다.",
  },
  {
    id: "linear", num: "05", kicker: "곱하는 순서",
    question: "곱하는 순서를 바꾸면 N²이 사라지나?",
    gist: [
      "softmax를 빼면 attention은 Q, Kᵀ, V 세 행렬의 곱이고, 행렬 곱은 묶는 순서를 바꿔도 답이 같다. (QKᵀ)V로 하면 가운데에 N × N 표가 생기고 Q(KᵀV)로 하면 d × d 표만 생긴다. 표를 만들지 않아 계산이 토큰 수에 비례하는 이 방식이 linear attention이다.",
      "학생들이 서로에게 쓴 쪽지를 각자 다 읽는 대신, 쪽지를 게시판 한 장에 겹쳐 적어 두고 각자 게시판만 읽는 것과 같다. 학생이 토큰, 쪽지 하나가 한 토큰의 K와 V를 곱한 작은 표, 게시판이 KᵀV다. 게시판 크기는 학생 수와 상관없다. 대신 겹쳐 적은 쪽지는 골라 읽을 수 없다.",
      "흔히 linear attention을 softmax의 빠른 근사로 생각한다. 그런데 softmax의 지수는 이렇게 나눠지지 않아서, 실제로는 비교 방식 자체를 바꾼 다른 모델이다. 그 대가로 한 토큰에 비율을 몰아주는 날카로움을 잃는다.",
    ],
    lead: [
      "04절은 행의 길이를 줄였다. 이 절은 행을 그대로 두고 곱하는 순서를 바꾼다. softmax를 잠시 빼고 보자. 그러면 attention은 Q, K를 뒤집은 Kᵀ, V 세 행렬의 곱이다. (QKᵀ)V로 계산하면 가운데에 N × N 표가 생기고, Q(KᵀV)로 계산하면 가운데에 생기는 것은 d × d 표다. 행렬 곱은 묶는 순서를 바꿔도 답이 같다.",
    ],
    walk: [
      {
        q: "두 순서의 곱셈-덧셈을 세면 얼마나 차이 나나?",
        a: [
          "02절의 네 토큰(N = 4, d = 2)으로 세 보자. (QKᵀ)V는 4 × 4 표를 만드는 데 32번, 그 표로 V를 섞는 데 32번, 모두 64번이다. Q(KᵀV)는 2 × 2짜리 KᵀV를 만드는 데 16번, Q에 곱하는 데 16번, 모두 32번이다.",
          "1024픽셀 고양이의 head 하나(N = 4096, d = 64)라면 앞의 순서의 곱셈-덧셈이 뒤의 순서의 64배다. 이 비가 N/d다. 토큰이 벡터 길이보다 많으면 뒤의 순서가 이긴다.",
        ],
      },
      {
        q: "softmax가 있으면 왜 순서를 바꿀 수 없나?",
        a: [
          "softmax는 표의 원소마다 e^(q·k)를 계산하고 행마다 합으로 나눈다. e^(q·k)는 q만의 무엇과 k만의 무엇의 내적으로 나눠 쓸 수 없다. 그래서 표를 먼저 만들어야 한다.",
          "2020년 Katharopoulos 등은 \"Transformers are RNNs\"에서 e^(q·k) 자리에 φ(q)·φ(k)를 넣었다. q와 k를 각각 함수 φ에 넣은 뒤 내적한다. 그러면 attention weight는 φ(q)·φ(k_j)를 행의 합으로 나눈 것이고, 곱하는 순서를 바꿀 수 있다. 논문은 φ(x) = elu(x) + 1을 썼다. 양수 원소에는 1을 더하고 음수 원소는 e^x가 된다. 모든 값이 양수라서 attention weight가 음수가 되지 않는다.",
          "논문은 정확한 softmax를 이렇게 바꿀 수는 없다고 적었다. 지수에 해당하는 φ는 무한 차원이기 때문이다. 같은 해의 Performer는 무작위 특징(random features)으로 e^(q·k)를 평균적으로 맞히는 φ를 만들었다.",
        ],
      },
      {
        q: "같은 눈의 Q로 attention weight를 계산하면 무엇이 다른가?",
        a: [
          "φ(q)는 [0.24, 1]이다. 네 토큰의 φ(k)와 내적해서 합으로 나누면 배경 44.4%, 크림색 10.2%, 귀 6.5%, 눈 39.0%다. softmax에서는 배경이 2.5%, 눈이 65.9%였다. 순위가 바뀌었다.",
          "q의 첫 원소 −1.41이 φ를 지나며 작은 양수 0.24가 되어, \"어두울수록 높다\"는 질문이 거의 사라졌다. 이 φ로 어두운 토큰을 찾게 하려면 Q와 K를 만드는 행렬이 다르게 학습돼야 한다. softmax로 학습한 모델에 φ만 바꿔 끼울 수는 없다.",
        ],
      },
      {
        q: "q를 키우면 attention weight는 어떻게 되나?",
        a: [
          "그림에서 q 배율을 올려 보라. softmax에서는 점수가 모두 배율만큼 커지고 가장 큰 점수와 나머지의 차이도 커진다. 배율 4에서 눈의 몫이 97.1%가 된다. 한 토큰에 몰아줄 수 있다.",
          "φ에서는 거의 움직이지 않는다. 배율 4에서 눈이 45.4%이고 아무리 키워도 45.5%를 넘지 못한다. q를 키우면 φ(q)가 [0, 1]에 다가가서, 비율이 각 φ(k)의 둘째 원소에 비례하는 것으로 굳는다. 배경과 눈의 둘째 원소가 비슷해서 둘이 거의 반씩 나눠 가진다.",
          "이것이 softmax의 날카로움이다. 지수는 점수의 차이를 비율로 바꾼다. 점수가 1 차이 나면 비율은 e배 차이 난다. 그래서 학습은 Q와 K를 키워 한 행에서 한 토큰만 골라내게 할 수 있다. 이 φ에는 그런 손잡이가 없다.",
        ],
      },
      {
        q: "표를 만들지 않으면 생성할 때는 무엇을 들고 가나?",
        a: [
          "앞쪽만 읽는 생성이라면 KᵀV는 지금까지의 토큰들로 만든 합이다. 새 토큰이 오면 그 토큰의 φ(k)와 v의 곱을 더하기만 하면 된다. 논문은 이 합을 state S와 정규화 z로 적고, 앞쪽만 읽는 linear attention이 RNN과 같은 꼴임을 보였다. 제목의 \"Transformers are RNNs\"가 이 뜻이다.",
          "1024픽셀 고양이의 head 하나라면 state는 숫자 4,160개다. 06절에서 볼 KV cache, 곧 앞쪽 토큰들의 K와 V를 적어 둔 기록은 같은 head에서 그 126배다. 논문은 아주 긴 생성에서 최대 4000배 빨랐다고 보고했다.",
          "대가는 같은 자리에 있다. 토큰이 아무리 많아도 정해진 크기의 state 안에 겹쳐 쓰인다. 무엇을 남기고 무엇을 덮을지 고르지 못한다. 2023년의 Mamba는 이 state에 무엇을 남기고 잊을지를 입력에 따라 고르게 만든 state space model이고, Transformer보다 5배 높은 추론 throughput을 보고했다.",
        ],
      },
      {
        q: "순서를 바꾸는 대신 K의 수를 줄이는 길은 없나?",
        a: [
          "2020년의 Linformer가 그 길이다. 학습된 attention weight 표가 low rank, 곧 몇 개의 무늬로 거의 다 설명되는 표에 가깝다는 관찰에서 출발해, K와 V를 sequence 방향으로 섞어 N개를 k개로 만들었다. 표는 N × k가 된다.",
          "대가는 섞는 법이 내용이 아니라 자리로 정해진다는 것이다. 많은 토큰에 공통인 무늬는 남고 드문 토큰이 먼저 묻힌다. 고양이 조각이라면 k를 줄여 갈수록 하나뿐인 눈이 이웃과 평균 나고, 결국 배경에 섞여 더는 어두운 토큰이 아니게 된다. 그리고 섞인 K 하나에 아직 오지 않은 토큰이 들어가므로 앞쪽만 읽는 생성에는 그대로 쓰기 어렵다.",
        ],
      },
    ],
    formula: "(QK^{\\top})V:\\ 2N^2 d \\qquad\\qquad Q(K^{\\top}V):\\ 2Nd^2\no_i = \\frac{\\phi(q_i)^{\\top} \\sum_j \\phi(k_j)\\, v_j^{\\top}}{\\phi(q_i)^{\\top} \\sum_j \\phi(k_j)}, \\qquad \\phi(x) = \\mathrm{elu}(x) + 1",
    symbols: [
      "2N²d, 2Nd²: 두 순서의 곱셈-덧셈",
      "φ: 원소마다 적용한다. 양수는 1을 더하고 음수는 e^x로 바꾼다",
      "Σ φ(k_j) v_jᵀ: d × d state S. 토큰 수와 상관없이 크기가 같다",
      "Σ φ(k_j): 정규화 z. attention weight의 합을 1로 맞춘다",
    ],
    takeaway: "softmax 자리에 φ(q)·φ(k)를 넣으면 곱하는 순서를 바꿔 N × N 표 없이 계산하고, 생성할 때는 크기가 고정된 state만 들고 간다. 대신 지수가 주던 날카로움, 곧 한 토큰에 몰아주는 능력을 잃는다.",
    see: "위는 두 곱하는 순서다. 크기를 바꾸면 가운데에 생기는 표의 크기와 곱셈-덧셈 수가 바뀐다. 네 토큰에서는 64와 32이고, 1024픽셀 head에서는 64배 차이다. 아래는 눈이 네 토큰에 준 attention weight다. 파란 막대가 softmax, 보라 막대가 φ다. q 배율을 올려 보라. 파란 막대는 눈으로 몰려 4에서 97.1%가 되고, 보라 막대는 거의 그대로 45% 언저리에 머문다. 맨 아래 줄이 그때 눈이 읽어 오는 것이다. 조각 벡터는 그림에서 쟀고 눈의 Q는 손으로 정했다.",
    bridge: "linear attention은 생성할 때 KV cache 대신 작은 state를 들고 간다. softmax를 지키면서 cache를 줄일 수는 없나? 그 전에, 답을 한 토큰씩 쓰는 동안 실제로 시간을 먹는 것이 무엇인지부터 보자.",
  },
  {
    id: "decode", num: "06", kicker: "생성: MQA와 GQA",
    question: "답을 한 토큰씩 쓸 때 attention의 시간은 무엇이 정하나?",
    gist: [
      "답을 한 토큰씩 쓰는 생성(decoding)에서는 새 토큰 하나의 Q만 계산한다. 그 대신 앞의 모든 토큰의 K와 V를 step마다 HBM에서 다시 읽는다. 이 K, V 기록이 KV cache다. 읽어 온 숫자 하나로 계산을 한 번쯤만 하니 memory-bound이고, 시간은 거의 다 cache를 읽는 데 든다.",
      "질문자 여럿이 각자 다른 질문을 들고 책장을 훑는다고 하자. 질문자가 Q head, 책장이 K, V head, 책장을 가져오는 일이 cache 읽기다. 원래는 질문자마다 전용 책장이 있어 step마다 책장을 질문자 수만큼 가져왔다. MQA는 모두가 책장 하나를 같이 읽게 했고, GQA는 질문자 몇 명씩 group을 지어 group마다 책장 하나를 쓰게 했다. 가져올 책장이 준 만큼 step이 빨라지고 곱셈의 수는 그대로다. 질문은 여전히 각자 다르니 읽는 비율도 head마다 다르다.",
    ],
    lead: [
      "KV cache를 먼저 다시 적는다. 답을 한 토큰씩 쓸 때 층마다 앞쪽 토큰들의 K와 V를 적어 두면, 새 토큰은 자기 Q, K, V만 새로 만들고 앞쪽은 적어 둔 것을 읽으면 된다. Transformer 챕터와 토큰 챕터에서 본 그 기록이다. 눈의 행으로 말하면 이제 행은 하나뿐이고, 그 행의 길이가 지금까지의 토큰 수 n이다.",
      "이 절은 고양이 그림을 받은 LLM이 \"고양이 눈은 무슨 색인가?\"에 긴 답을 쓰는 장면에서 센다. 모델은 Llama 2 7B의 모양을 쓴다. 32층, Q head 32개, head 하나의 벡터 길이 128이다.",
    ],
    walk: [
      {
        q: "토큰 하나를 쓰는 step에서 계산과 메모리 I/O는 각각 얼마인가?",
        a: [
          "head 하나, 층 하나에서 새 Q 하나를 K n개와 내적하고 V n개를 섞는다. 그동안 K와 V를 n개씩 HBM에서 읽는다. 읽어 온 숫자 하나(16비트라 2바이트)로 곱셈-덧셈을 한 번(FLOP 2개) 하니, FLOP의 수와 바이트의 수가 같다. arithmetic intensity가 1이다.",
          "손으로 정한 장치의 ridge point는 100이다. 1은 그보다 훨씬 작다. step의 시간은 cache를 읽는 시간이다. 2019년 Google의 Shazeer가 이것을 짚었다. 한 토큰씩 하는 추론이 느린 것은 큰 K와 V를 매번 다시 읽는 메모리 대역폭 때문이라는 것이다.",
        ],
      },
      {
        q: "Llama 2 7B의 cache는 얼마이고, step 하나는 얼마나 걸리나?",
        a: [
          "토큰 하나의 K와 V가 모든 층과 head를 합쳐 16비트로 512KB다. 학습한 길이 4096토큰을 다 채우면 cache가 2GB다.",
          "손으로 정한 장치는 step마다 이것을 다 읽는 데 53.7ms를 쓴다. 답 한 토큰마다 그만큼 걸린다. 곱셈은 그 시간의 극히 일부만 쓴다.",
        ],
      },
      {
        q: "MQA는 무엇을 바꿨나?",
        a: [
          "Shazeer의 multi-query attention(MQA)은 Q head는 그대로 두고 K, V head를 하나로 줄였다. 모든 Q head가 같은 K와 V를 읽는다. Q가 head마다 다르니 attention weight는 여전히 head마다 다르다. cache가 32분의 1, 토큰 하나에 16KB가 된다. 읽는 바이트가 그만큼 줄고 곱셈은 그대로라 arithmetic intensity가 32가 된다.",
          "논문은 WMT14 영어-독일어 번역에서 디코더의 토큰당 추론 시간이 46µs에서 3.8µs로 줄고, 번역 점수 BLEU가 26.7에서 26.5로 조금 내려갔다고 보고했다. TPU에서 sequence 여러 개를 한 batch로 처리하며 잰 값이다.",
        ],
      },
      {
        q: "GQA는 그 사이의 무엇을 골랐나?",
        a: [
          "2023년 Google의 Ainslie 등이 낸 grouped-query attention(GQA)은 Q head를 G개 group으로 나누고 group마다 K, V head를 하나씩 두었다. G가 1이면 MQA, G가 head 수이면 원래의 multi-head attention이다. 이미 학습된 multi-head 모델의 K, V head를 group마다 평균 내어 시작점을 만들고, 원래 사전학습 계산의 5%만큼 더 학습시키는 방법(uptraining)도 냈다.",
          "T5-XXL에서 group을 여덟 개 둔 GQA는 표에 적힌 샘플당 시간이 multi-head의 1.51에서 0.28로 MQA의 0.24에 가까웠고, 여러 과제의 평균 점수는 47.1로 multi-head의 47.2에 가까웠다. MQA는 46.6이었다.",
          "Llama 3 8B가 이 방식이다. Q head 32개에 K, V head가 8개다. 토큰 하나에 128KB로 앞의 모델의 4분의 1이다. 그림에서 모델을 바꿔 보라. 같은 context 길이에서 cache와 step 시간이 그만큼 줄고, arithmetic intensity는 Q head 수를 K, V head 수로 나눈 값이 된다.",
        ],
      },
      {
        q: "Mistral 7B는 무엇이 다른가?",
        a: [
          "GQA에 04절의 sliding window를 더했다. K, V head가 8개이고 토큰마다 앞쪽 4096개만 읽는다. 그보다 앞의 K와 V는 다시 읽을 일이 없으니 cache를 window 크기의 고리로 만들어 덮어쓴다. 논문은 이것을 rolling buffer cache라 불렀다. 입력이 아무리 길어져도 cache가 512MB에서 멈춘다. 논문은 32K 토큰에서 cache 메모리가 8분의 1이 된다고 썼다.",
          "그림에서 context 길이를 올려 보라. 다른 모델은 길이에 비례해 cache가 커지고 Mistral만 4K에서 평평해진다. 대신 window보다 앞의 내용은 층을 거쳐 전달된 것만 남는다.",
        ],
      },
      {
        q: "MQA와 GQA가 줄이지 않는 것은 무엇인가?",
        a: [
          "질문을 처음 읽는 prefill 단계는 질문 전체의 표를 만든다. 그 계산은 MQA나 GQA로 줄지 않는다. 그쪽은 FlashAttention이 맡는다. 그리고 MQA와 GQA는 모델을 바꾼다. K, V head를 합친 모델은 처음부터 그렇게 학습하거나 적어도 더 학습해야 한다.",
          "cache를 줄였다고 가중치가 주는 것도 아니다. step마다 가중치도 한 번씩 읽는다. Llama 3 8B의 가중치는 이름 그대로 80억 개쯤이고 16비트로 그대로다.",
        ],
      },
    ],
    formula: "\\text{KV bytes per token} = 2 \\times L \\times H_{kv} \\times d_h \\times 2\n\\text{intensity of one step} = \\frac{4\\,H_q\\, n\\, d_h}{4\\,H_{kv}\\, n\\, d_h} = \\frac{H_q}{H_{kv}}",
    symbols: [
      "L: 층 수",
      "H_q: Q head 수",
      "H_kv: K, V head 수. Q head와 같으면 multi-head, 하나면 MQA, 그 사이면 GQA",
      "d_h: head 하나의 벡터 길이",
      "n: cache에 든 토큰 수. Mistral은 window 크기를 넘지 않는다",
    ],
    takeaway: "생성의 step 하나는 KV cache 전체를 한 번 읽는 일이라 memory-bound다. MQA와 GQA는 Q head 여럿이 K, V head 하나를 나눠 써서 읽을 바이트를 head 수의 비만큼 줄이고, Mistral은 sliding window로 cache의 길이 자체를 묶어 둔다.",
    see: "모델을 바꾸고 context 길이를 1K에서 128K까지 올려 보라. 위의 작은 칸 32개가 Q head이고 선으로 이어진 아래 칸이 K, V head다. Llama 2는 하나씩, Llama 3과 Mistral은 넷씩, MQA는 모두가 하나로 이어진다. 가운데 그래프는 context 길이에 따른 cache 크기다. 두 축 모두 두 배마다 같은 간격이다. 고른 모델의 선이 진하고 점이 지금 길이다. Mistral의 선만 4K에서 평평해진다. 아래 숫자는 토큰 하나의 cache, 지금 cache, 손으로 정한 장치에서 step마다 cache를 읽는 시간, arithmetic intensity다. 학습한 길이를 넘으면 \"학습 길이 밖\"으로 표시했다. Mistral은 window가 있어 표시하지 않았다. MQA는 Llama 2의 모양에 K, V head를 하나로 둔 가정이다.",
    bridge: "여기까지 갈래 넷을 대표 하나씩으로 봤다. 정확한 것과 근사, 계산을 줄이는 것과 메모리를 줄이는 것, 다시 학습해야 하는 것과 끼워 넣기만 하면 되는 것이 섞여 있다. 내 상황에서는 무엇을 써야 하나?",
  },
  {
    id: "choose", num: "07", kicker: "고르기",
    question: "내 상황에서는 무엇을 줄여야 하나?",
    gist: [
      "먼저 무엇이 시간이나 메모리를 먹는지 잰다. 사진이 작으면 표가 작아서 이 챕터의 어떤 방법도 얻을 것이 적다. 학습 메모리가 모자라면 답을 바꾸지 않는 FlashAttention이 먼저다. 계산의 대부분이 표일 만큼 토큰이 많을 때만 window나 linear attention처럼 모델을 바꾸는 방법이 값을 하고, 생성에서는 KV cache의 바이트를 줄이는 GQA가 값을 한다.",
      "의사가 증상을 먼저 재고 약을 고르는 것과 같다. 증상은 셋이다. 계산의 대부분이 표인가, 학습 때 남기는 표가 메모리를 넘치는가, step마다 cache를 읽는 데 시간이 드는가. 약마다 부작용도 다르다. 답이 그대로인 것은 FlashAttention뿐이고, window는 먼 쌍을, linear attention은 날카로움을, GQA는 head마다 다른 K와 V를 내준다.",
    ],
    lead: [
      "같은 고양이로 상황 넷을 놓는다. 224픽셀 사진 한 장을 ViT-B로 추론하는 경우, 1024픽셀 고양이로 ViT-B를 학습하는 경우, 2048픽셀로 학습하는 경우, 그리고 LLM이 32K 토큰 길이까지 답을 쓰는 경우다. 앞의 셋은 ViT-B의 층으로, 마지막은 Llama 2 7B의 모양으로 센다.",
      "비교할 방법은 여섯이다. 앞에서 깊게 본 넷은 FlashAttention, 7 × 7 window, linear attention, GQA다. 나머지 둘은 짧게 짚은 이웃이다. \"행과 열\"은 2019년 OpenAI의 Sparse Transformer가 쓴 sparse 패턴으로, 토큰마다 그림 격자에서 자기와 같은 가로줄과 같은 세로줄의 토큰만 읽는다. 그림 같은 격자라면 두 층이면 어느 토큰이든 닿는다. \"Linformer\"는 05절 끝에서 본 대로 K와 V를 k개로 섞어 줄이는 방법이고, 여기서는 k = 256이다.",
    ],
    walk: [
      {
        q: "224픽셀 사진 한 장에서는 무엇이 도움이 되나?",
        a: [
          "거의 없다. 토큰이 196개이고 토큰 사이의 몫은 4.1%다. 이 챕터의 어떤 방법도 층의 계산을 4%보다 많이 줄일 수 없다. 7 × 7 window를 써도 층의 계산은 96.9%로 남는다. Linformer는 k가 N보다 커서 줄일 것이 없다.",
          "여기서 시간을 줄이려면 토큰 챕터처럼 토큰 수를 줄이거나, 다음 챕터처럼 가중치를 줄여야 한다.",
        ],
      },
      {
        q: "1024픽셀 고양이를 학습할 때는?",
        a: [
          "토큰 사이의 몫이 47.1%이고 학습 때 남기는 P가 한 장에 4.5GB다. 가장 먼저 쓸 것은 FlashAttention이다. 답이 똑같고, 학습한 모델을 그대로 쓰고, P가 행마다 숫자 둘인 4.5MB로 바뀐다. 계산은 그대로라서 층 계산의 절반 가까이는 여전히 표다.",
          "계산까지 줄이려면 모델을 바꿔야 한다. 7 × 7 window면 층의 계산이 53.5%로 준다. 대신 눈과 꼬리는 여러 층을 거쳐야 만나고 window로 다시 학습해야 한다. SAM처럼 window 층 사이에 모든 토큰을 읽는 층을 몇 개 끼우는 것이 그 절충이다.",
        ],
      },
      {
        q: "2048픽셀이면 무엇이 달라지나?",
        a: [
          "토큰 사이의 몫이 78.0%이고 P가 한 장에 72GB다. FlashAttention 없이는 한 장도 올리기 어렵다. FlashAttention으로 메모리를 풀어도 계산의 대부분은 여전히 표다.",
          "여기서는 계산의 차수를 바꾸는 방법이 값을 한다. 7 × 7 window면 층의 계산이 22.2%, linear attention이면 22.3%가 된다. 대신 04절에서 본 대로 먼 토큰끼리 직접 비교하지 못하거나, 05절에서 본 대로 한 토큰에 몰아주는 날카로움을 잃는다.",
        ],
      },
      {
        q: "32K 토큰의 답을 쓸 때는?",
        a: [
          "Llama 2의 모양이면 32K 토큰의 cache가 16GB이고 step마다 그것을 다 읽는다. FlashAttention은 cache를 줄이지 않는다. 숫자는 그대로 다 읽어야 한다. 행과 열 패턴도 계산은 줄지만 먼 세로줄의 K와 V가 언젠가 다시 읽히니 cache를 버릴 수 없다.",
          "GQA-8이면 cache가 4GB, Mistral처럼 4096개짜리 window면 2GB, linear attention의 state면 약 32MB다. 생성에서 값을 하는 것은 읽을 바이트를 줄이는 쪽이다. Linformer는 앞쪽만 읽는 생성에 그대로 쓸 수 없어 이 상황에서는 빠진다.",
        ],
      },
      {
        q: "정확한 것과 근사는 무엇이 갈리나?",
        a: [
          "FlashAttention만 같은 모델에서 같은 답을 낸다. 계산의 순서만 바꿨기 때문이다. 나머지는 모델이 계산하는 함수가 바뀐다. window와 sparse 패턴은 일부 쌍을 아예 계산하지 않고, Linformer는 K를 섞고, linear attention은 비교 방식을 바꾸고, GQA는 head들이 K와 V를 나눠 갖게 한다. 그래서 모두 그 모양으로 학습하거나 적어도 더 학습해야 한다.",
          "잃는 것도 다르다. window는 먼 쌍을, sparse 패턴은 미리 정하지 않은 쌍을, Linformer는 드문 토큰을, linear attention은 날카로움을, GQA는 head마다 다른 K와 V를 잃는다. 이 챕터의 눈도 매번 다르게 손해를 봤다. 04절에서는 꼬리까지 다섯 층이 걸렸고, 05절의 φ로는 배경과 비율을 거의 반씩 나눴고, Linformer로 섞으면 배경에 묻혔다.",
        ],
      },
    ],
    formula: "\\text{exact, tiled: } 4N^2 d \\text{ FLOPs},\\ O(N) \\text{ memory}\n\\text{window: } N w \\qquad \\text{row and column: } N\\sqrt{N}\n\\text{low rank: } N k \\qquad \\text{linear: } N d^2\n\\text{GQA: cache} \\times H_{kv} / H_q",
    symbols: [
      "w: window 안의 토큰 수. 7 × 7이면 49",
      "k: Linformer가 섞은 K 수. 256",
      "H_kv / H_q: K, V head 수와 Q head 수의 비. GQA-8에서 cache가 4분의 1",
      "계산의 %는 ViT-B 층 하나의 곱셈-덧셈 가운데 남는 몫이고, 생성에서는 step 하나의 attention 계산 가운데 남는 몫이다",
    ],
    takeaway: "먼저 정확한 FlashAttention으로 메모리를 푼다. 계산의 대부분이 표일 때만 모델을 바꾸는 근사를 고르고, 생성에서는 cache의 바이트를 줄이는 쪽을 고른다. 근사마다 잃는 것이 다르다.",
    see: "상황을 바꿔 보라. 맨 위 줄이 그 상황에서 아무것도 하지 않았을 때다. 토큰 사이의 몫과 표 또는 cache의 바이트가 적혀 있다. 표의 한 줄이 방법 하나다. \"같은 답\"과 \"다시 학습\"은 상황과 상관없이 같다. \"계산\"은 아무것도 하지 않았을 때를 100%로 본 몫이고, \"메모리\"는 학습이면 남기는 표, 추론이면 층 하나의 표, 생성이면 cache의 바이트다. 초록 글자는 계산이 60% 아래로, 메모리가 4분의 1 아래로 준 칸이고, \"같은 답\"과 \"다시 학습\"에서는 좋은 쪽이다. \"·\"은 그 상황에 해당하지 않는 칸이다.",
    bridge: "attention은 싸졌다. 표를 저장하지 않고, 행을 자르고, cache를 줄였다. 그런데 이 챕터의 어느 방법도 가중치는 건드리지 않았다. ViT-B의 층마다 Q, K, V와 출력과 MLP를 만드는 행렬은 개수도 폭도 그대로이고, 224픽셀 사진에서는 계산의 95.9%가 그 행렬 곱이다. LLM의 가중치도 개수와 비트 수가 그대로다. 모델 자체를 작게 할 수는 없나?",
  },
];

export const attnCopy = {
  title: "Attention은 왜 N²이고, 어떻게 줄이나",
  sub: "토큰이 수천 개를 넘으면 score table이 계산과 메모리를 다 먹는다. 샴고양이 그림을 2048픽셀까지 키우며 눈 patch 하나가 만드는 점수 한 행을 따라간다. 그 행을 저장하지 않을 때(FlashAttention), 짧게 자를 때(window attention), 아예 만들지 않을 때(linear attention) 무엇이 그대로이고 무엇이 달라지는지, 그리고 답을 한 토큰씩 쓸 때는 무엇이 시간을 먹는지(MQA, GQA). 일곱 개의 질문이다.",
  prologue,
  sections,
  related: {
    title: "이 챕터와 내 연구",
    text: "memory bank 기반 이상 탐지의 점수는 attention의 한 행과 모양이 같다. 시험 사진의 patch 하나가 Q이고 memory bank에 넣어 둔 정상 patch M개가 K다. 다른 것은 softmax 대신 가장 가까운 하나와의 거리를 쓴다는 것뿐이다. 그래서 이 챕터의 셈이 그대로 옮겨 온다. 정확한 최근접 탐색은 patch마다 M번의 비교이고, 사진 한 장의 patch N개면 N × M이다. memory bank를 tile로 나눠 읽으며 지금까지의 최솟값만 들고 가는 것은 02절에서 running max와 running sum을 들고 간 것과 같은 꼴이다. coreset으로 memory bank를 줄이는 것은 K의 수를 줄이는 일이지만, 05절 끝의 Linformer처럼 섞지 않고 골라 남기며 드문 정상 무늬를 일부러 남긴다는 점이 다르다. 섞으면 고양이의 눈처럼 드문 무늬부터 평균에 묻힌다. 후보 몇 개와만 거리를 재는 approximate nearest neighbor search는 04절 끝의 sparse 패턴과 닮았고 같은 대가를 치른다. 미리 정한 후보 밖에 있는 진짜 최근접을 놓칠 수 있다.",
    link: "/anomaly/",
    linkText: "Anomaly detection, visually →",
  },
  ui: {
    loading: "그림을 불러오는 중",
    wall: {
      side: "그림 크기", mode: "때", infer: "추론", train: "학습", tokens: "토큰", row: "눈의 행", cells: "개", table: "표",
      times: "앞 크기의", share: "층의 계산 가운데 토큰 사이의 몫", vec: "토큰 벡터 N × d", head: "표 하나", layer: "층 하나의 표 12개", all: "12층의 P",
      eye: "눈",
    },
    online: {
      step: "단계", steps: ["한 번에", "tile 1", "tile 2", "나누기"], order: "순서", late: "눈이 나중", early: "눈이 먼저",
      names: { bg: "배경", cream: "크림색", brown: "귀", eye: "눈" } as Record<string, string>,
      score: "점수", block: "tile", mult: "보정 계수", full: "한 번에 계산", now: "tile로 계산", same: "같다", wait: "아직 나누지 않음", shares: "attention weight",
    },
    flash: {
      method: "방식", std: "표준", flash: "Flash", block: "Q tile", side: "그림",
      moved: "memory traffic", qkvo: "Q, K, V, O", sw: "S 쓰기", sr: "S 읽기", pw: "P 쓰기", pr: "P 읽기", qo: "Q, O", kv: "K, V", stats: "m, ℓ", passes: "번",
      compute: "계산", move: "메모리 I/O", ms: "ms", kept: "backward pass를 위해 남기는 것", keptStd: "P 표", keptFlash: "행마다 m, ℓ",
      intensity: "arithmetic intensity", pb: "ridge point", memBound: "memory-bound", compBound: "compute-bound", head: "head 하나",
    },
    reach: {
      pattern: "window", layer: "층", names: { swin: "window", swinShift: "shifted window", slide2: "sliding window" } as Record<string, string>,
      eyeReads: "눈이 한 층에 읽는 토큰", pairs: "한 층의 점수 수", full: "전부", reached: "정보가 닿은 토큰", tail: "꼬리 끝", at: "층에서 닿음", notYet: "아직", never: "닿지 않음",
      eye: "눈", tailName: "꼬리", global: "global",
    },
    linear: {
      size: "크기", sizes: { four: "네 토큰", k1: "1024px head", k2: "2048px head" } as Record<string, string>, scale: "q 배율",
      tableFirst: "(QKᵀ)V", stateFirst: "Q(KᵀV)", middle: "가운데 표", madds: "곱셈-덧셈", soft: "softmax", kern: "φ(q)·φ(k)", shares: "눈의 attention weight", reads: "읽어 온 것",
      names: { bg: "배경", cream: "크림색", brown: "귀", eye: "눈" } as Record<string, string>,
    },
    decode: {
      model: "모델", names: { llama2: "Llama 2 7B", llama3: "Llama 3 8B", mistral: "Mistral 7B", mqa: "MQA 가정" } as Record<string, string>,
      ctx: "context 길이", qHeads: "Q head 32개", kvHeads: "K, V head", perToken: "토큰 하나", cache: "KV cache", step: "step마다 cache 읽기", intensity: "arithmetic intensity", outside: "학습 길이 밖",
      axisX: "context 길이", axisY: "KV cache",
    },
    choose: {
      situation: "상황", names: { small: "224px 한 장", cat1k: "1024px 학습", cat2k: "2048px 학습", longgen: "32K 생성" } as Record<string, string>,
      method: "방법", exact: "같은 답", retrain: "다시 학습", retrainShort: "학습", compute: "계산", memory: "메모리", yes: "예", no: "아니오", part: "5%만",
      methods: { flash: "FlashAttention", window: "7×7 window", sparse: "행과 열", linformer: "Linformer k=256", linear: "linear", gqa: "GQA-8" } as Record<string, string>,
      none: "아무것도 안 함", share: "토큰 사이의 몫", tables: "남기는 P", layerTables: "층 하나의 표", cache: "KV cache", na: "·",
    },
  },
};
