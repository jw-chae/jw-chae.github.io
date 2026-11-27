import type { Prologue, StudySection } from "./chapters";

const prologue: Prologue = {
  title: "이야기의 시작: 답이 몇 개인지 모르는 문제",
  paragraphs: [
    "앞의 챕터들에서 사진을 받는 모델은 대개 사진 한 장에 클래스 하나를 냈다. 공장 카메라나 자동차에 필요한 것은 다르다. 사진에 물체가 몇 개 있는지 모르고, 물체마다 어디 있는지와 무엇인지를 내야 한다. 어디 있는지는 물체를 두르는 상자, 곧 bounding box(줄여서 box)로 적는다. 그것도 한 장을 몇 ms 안에 끝내야 한다. 이것이 실시간 object detection이다.",
    "2016년 Redmon 등의 YOLO는 이 문제를 신경망 한 번의 계산으로 풀었다. 사진을 격자로 나누고, 격자의 칸(grid cell, 줄여서 cell)마다 box 몇 개와 그 클래스 점수를 적게 했다. 대신 한 물체 위에 이웃한 여러 cell이 저마다 box를 적는 일이 생겼다. 겹친 box를 지우는 후처리가 NMS(non-maximum suppression)다. 그 뒤 YOLO는 판을 거듭하는 동안 NMS를 놓지 못했다.",
    "NMS는 신경망 밖에서 돈다. 그래서 FLOPs, 곧 신경망이 하는 곱셈과 덧셈의 횟수에는 잡히지 않고, latency, 곧 사진 한 장에 실제로 걸리는 시간에만 잡힌다. 2024년 YOLOv10 논문이 T4 GPU에서 잰 YOLOv8-S는 신경망 계산이 2.33 ms인데 후처리까지 넣으면 7.07 ms였다.",
    "2024년 칭화대 Guiguang Ding 연구실의 Ao Wang 등은 YOLOv10에서 이 단계를 없앴다. 추론 때의 구조가 아니라 학습 때 정답을 나눠 주는 규칙, 곧 label assignment를 바꿨다. 그러자 남은 시간은 모두 신경망 계산이 됐고, 논문의 둘째 절반은 그 계산을 head, downsampling 층, 블록에서 하나씩 덜어 낸다.",
    "이 챕터는 사진 한 장을 끝까지 들고 간다. 가로세로 160픽셀에 샴고양이 한 마리와 컵 하나가 있고, 그 위에 4×4 격자가 있다. 한 cell이 무엇을 적는지, 한 고양이에 box가 넷 뜨면 무엇을 지우는지, 학습 때 어느 cell에 \"이것이 고양이다\"라고 말해 주는지를 따라간다. 다 읽고 나면, NMS가 왜 필요했는지와 YOLOv10이 학습 규칙 하나로 그것을 어떻게 없앴는지를 같은 사진 위에서 말할 수 있어야 한다.",
  ],
  timeline: [
    { year: "2016", text: "YOLO, 격자의 cell마다 box와 클래스를 적어 한 번에 검출. 겹친 box는 NMS로 지움" },
    { year: "2020", text: "DETR, 물체 하나에 예측 하나만 짝지어 학습해 NMS 없이 검출" },
    { year: "2024", text: "YOLOv10, label assignment를 둘로 두고 추론 때는 한쪽만 써서 NMS를 없앰. 남은 시간은 head와 블록 설계로 줄임" },
  ],
};

const sections: StudySection[] = [
  {
    id: "cell", num: "01", kicker: "cell 하나의 출력",
    question: "격자의 한 cell은 무엇을 적어 내나?",
    gist: [
      "cell마다 같은 양식의 숫자 묶음을 적는다. box를 적는 숫자 넷, \"여기에 물체가 있는가\"를 적는 objectness score 하나, \"있다면 무엇인가\"를 적는 클래스마다의 확률이다. 물체가 몇 개든 신경망이 내는 숫자의 개수는 그대로다. 그 숫자 속에서 물체를 읽어 내는 것이 다음 일이다.",
      "건물 층마다 놓인 신고 양식과 같다. 층(cell)마다 같은 양식을 한 장씩 채우고, 항목은 위치(box), 있기는 한가(objectness), 무엇인가(클래스 확률)다. 위치 항목에는 그 층 밖까지 걸친 물체의 크기도 적을 수 있다. 빈 층의 양식도 채워지는데, \"있기는 한가\"에 낮은 값을 적는다.",
      "흔히 클래스 확률이 낮으면 물체가 없다는 뜻이라고 생각한다. 그런데 클래스 확률은 \"있다면\"이라는 가정 아래 합이 1이라서 빈 cell에서도 낮아지지 않는다. 없다는 것은 objectness가 맡는다.",
    ],
    lead: [
      "검출은 끝에서 내야 하는 것이 분류와 다르다. 물체마다 box 하나와 클래스 하나다. 이 챕터가 들고 갈 사진은 가로세로 160픽셀에 샴고양이 한 마리와 컵 하나가 있는 그림이다. 정답, 곧 ground truth에는 box 둘이 적혀 있다. 고양이 box는 귀 끝에서 꼬리까지를 두르고, 고양이 그림이 덮은 픽셀에서 쟀다. 컵 box는 손잡이까지 컵을 두른다. 모델이 받는 것은 픽셀뿐이고 정답은 보지 못한다.",
      "격자는 4×4이고 cell 하나의 한 변은 40픽셀이다.",
    ],
    walk: [
      {
        q: "cell 하나가 적는 숫자는 몇 개이고, 각각 무엇인가?",
        a: [
          "일곱 개다. box를 적는 숫자 넷, 곧 왼쪽 위와 오른쪽 아래 모서리의 x, y 좌표와, objectness 하나, 클래스마다의 확률 둘이다. 클래스는 고양이와 컵 둘뿐인 모델이다. cell이 16개이니 모델의 출력은 숫자 112개가 전부다. 이 112개 어디에도 \"고양이는 하나\"라고 적혀 있지 않다. 어느 숫자가 고양이를 가리키는지 읽어 내는 것이 이 챕터의 앞 절반이다.",
          "2016년의 YOLO는 7×7 격자에 cell마다 box 둘과 클래스 20개의 확률을 적었다. 여기서는 손으로 따라갈 수 있게 줄였고, box도 cell에 대한 상대 위치 대신 사진의 픽셀 좌표로 적었다.",
        ],
      },
      {
        q: "고양이 한가운데의 cell A는 무엇을 적었나?",
        a: [
          "그림에서 cell A를 고르라. 셋째 줄 둘째 cell로, 고양이의 크림색 가슴과 짙은 앞다리가 들어 있다. 얼굴도 꼬리도 cell 밖이다. 그런데 cell A가 적은 box는 귀 끝에서 꼬리까지 고양이 전체를 두른다. cell은 40픽셀인데 box는 가로 66, 세로 110이다. cell은 숫자를 적는 자리일 뿐이고 box는 cell 밖으로 얼마든지 뻗을 수 있다.",
          "YOLO는 물체의 한가운데가 떨어진 cell이 그 물체를 맡게 했다. 정답 고양이 box의 한가운데는 cell A 안에 있다. cell A의 objectness는 0.9이고 클래스 확률은 고양이 0.8, 컵 0.2다. 학습이 끝난 모델이 적었을 법한 값을 손으로 정했다. 둘을 곱한 고양이 점수는 0.72다.",
        ],
      },
      {
        q: "objectness와 클래스 확률은 무엇이 다른가?",
        a: [
          "cell을 \"배경\"으로 바꿔 보라. 벽만 있는 오른쪽 위 구석 cell이다. objectness는 0.05인데 클래스 확률은 고양이 0.5, 컵 0.5로 합이 여전히 1이다. 이 cell에 고양이가 있을 확률이 절반이라는 뜻이 아니다. 클래스 확률은 \"여기에 물체가 있다면 무엇인가\"를 두 클래스에 나눠 적은 것이다. 고양이 점수는 0.025로 아주 작고, 작게 만든 것은 objectness다.",
          "cell D를 고르면 같은 사정이 다른 쪽에서 보인다. 왼쪽 귀의 가장자리만 걸친 cell이다. 클래스 확률은 cell A와 똑같이 고양이 0.8이고 objectness만 0.3이라, 고양이 점수는 0.24다. 클래스 확률을 그대로 두고 objectness 하나만 바꾸면 점수가 그만큼 달라진다.",
        ],
      },
      {
        q: "objectness는 학습 때 무엇에 맞춰지나?",
        a: [
          "YOLO 논문은 objectness의 target(학습 때 맞추게 하는 값)을 이렇게 정했다. cell이 맡은 물체가 없으면 0이고, 있으면 그 cell의 box와 정답 box가 얼마나 겹치는지, 곧 다음 절의 IoU다. 그래서 objectness에는 \"무언가 있다\"와 \"내 box가 잘 맞는다\"가 함께 들어 있다.",
          "추론 때는 objectness와 클래스 확률을 곱한 점수 하나로 box를 줄 세운다. 다음 절부터는 이 곱을 box의 점수라고만 부른다. YOLOv10의 head에는 objectness가 따로 없고 클래스마다 점수 하나를 바로 낸다. 그 점수가 무엇에 맞춰지는지는 03절에서 본다.",
        ],
      },
      {
        q: "그러면 고양이를 맡은 cell은 A 하나인가?",
        a: [
          "보기를 \"고양이 위 네 cell\"로 바꿔 보라. A의 위 cell B에는 파란 눈과 짙은 얼굴이, 왼쪽 cell C에는 등과 엉덩이가, 왼쪽 위 cell D에는 귀의 가장자리가 들어 있다. 넷 모두 저마다 box를 적었고, 고양이 점수는 A 0.72, B 0.63, C 0.51, D 0.24다. 이 값들도 손으로 정했다. 고양이의 일부를 보고 있는 cell들이 저마다 고양이라고 손을 든 것이다.",
          "출력 112개 안에 고양이 box가 넷 들어 있다. 정답의 고양이는 하나다. 넷 가운데 무엇을 남기나?",
        ],
      },
    ],
    formula: "\\text{score}_c = \\Pr(\\text{object}) \\times \\Pr(c \\mid \\text{object})\n\\text{YOLO: } \\Pr(\\text{Class}_i \\mid \\text{Object}) \\cdot \\Pr(\\text{Object}) \\cdot \\mathrm{IoU}^{\\text{truth}}_{\\text{pred}} = \\Pr(\\text{Class}_i) \\cdot \\mathrm{IoU}^{\\text{truth}}_{\\text{pred}}",
    symbols: [
      "Pr(object): cell의 objectness. cell A에서 0.9, 배경 cell에서 0.05",
      "Pr(c | object): 물체가 있다면 그것이 클래스 c일 확률. 두 클래스의 합이 1이다",
      "score_c: 클래스 c에 대한 box의 점수. cell A의 고양이 점수 0.72",
      "IoU: YOLO 논문의 식에서 objectness의 target에 들어 있는 값. box가 정답과 얼마나 겹치는지이며 다음 절에서 손으로 잰다",
    ],
    takeaway: "cell 하나는 box 숫자 넷, objectness 하나, 클래스마다의 확률을 적는다. 클래스 확률은 물체가 있다는 가정 아래 합이 1이고, 물체가 있는지는 objectness가 따로 맡는다.",
    see: "왼쪽이 사진과 4×4 격자이고 오른쪽이 고른 cell이 적은 숫자 일곱 개다. cell A를 고르면 사진 위에 그 cell이 칠해지고 그 cell이 적은 box가 주황 테두리로 그려진다. box가 cell보다 훨씬 크다. 클래스 확률 아래의 막대는 두 확률을 이어 붙인 것이라 어느 cell에서나 끝이 같다. 배경 cell을 고르면 막대는 그대로 꽉 차 있고 objectness만 작아진다. \"고양이 위 네 cell\"은 A, B, C, D가 적은 box 넷과 고양이 점수를 한꺼번에 보여 준다. 초록 점선은 정답 box이고 모델은 이것을 보지 못한다. 정답 box는 고양이 그림이 덮은 픽셀에서 쟀고, cell이 적은 box와 점수는 설명을 위해 손으로 정한 값이다.",
    bridge: "한 고양이 위에 box가 넷 있다. 넷이 같은 고양이를 가리키는지 어떻게 알고, 무엇을 남기나?",
  },
  {
    id: "nms", num: "02", kicker: "겹친 box 지우기",
    question: "한 고양이에 box가 넷이면 무엇을 남기고 무엇을 지우나?",
    gist: [
      "점수가 가장 높은 box를 남기고, 그 box와 많이 겹치는 같은 클래스의 box를 지운다. 이것을 되풀이하는 후처리가 NMS(non-maximum suppression)다. 얼마나 겹치는지는 IoU(intersection over union), 곧 겹친 넓이를 두 box가 덮은 넓이 전체로 나눈 값으로 잰다.",
      "같은 사건을 기자 여럿이 저마다 기사로 올렸을 때 편집자가 하는 일과 같다. 가장 좋은 기사(점수가 가장 높은 box)를 남기고, 내용이 많이 겹치는 기사(IoU가 threshold를 넘는 box)는 내린다. 편집자는 기사의 내용을 읽지 않고 겹치는 정도만 본다.",
      "흔히 IoU가 높으면 같은 물체라고 생각한다. 그런데 바짝 붙은 두 물체의 box도 많이 겹친다. IoU threshold는 사람이 정하는 손잡이이고, 어떤 값으로도 두 경우를 다 맞히지 못하는 사진이 있다.",
    ],
    lead: [
      "앞 절의 출력에서 이어 간다. 고양이 점수가 A 0.72, B 0.63, C 0.51, D 0.24인 box 넷과, 컵 점수가 0.765인 cell E의 box 하나가 있다. 나머지 열한 cell은 점수가 0.2 아래다. 내놓아야 할 것은 물체마다 box 하나다.",
    ],
    walk: [
      {
        q: "먼저 무엇을 거르나?",
        a: [
          "점수가 너무 낮은 box부터 버린다. score threshold를 0.3으로 정하면 D가 빠진다. 이 threshold는 손으로 정한 값이다. 남는 것은 컵 E와 고양이 A, B, C다.",
          "점수는 box 하나에 붙은 숫자로, \"이 box가 고양이인가\"를 묻는다. A, B, C는 셋 다 꽤 높게 답했다. 셋이 같은 고양이인지 다른 고양이인지는 점수로는 알 수 없다.",
        ],
      },
      {
        q: "두 box가 같은 물체를 가리키는지는 무엇으로 재나?",
        a: [
          "두 box가 얼마나 겹치는지로 잰다. 겹친 넓이(intersection)를 두 box가 덮은 넓이 전체(union)로 나눈 비율이 IoU다.",
          "A와 B로 한 번 해 보자. A의 넓이는 7260이고, 얼굴 cell B가 위로 올려 적은 box는 5500이다. 겹친 네모의 넓이는 5000이다. 두 box가 덮은 넓이는 7260 + 5500 − 5000 = 7760이다. 겹친 넓이를 두 번 세지 않으려고 한 번 뺐다. IoU는 5000 ÷ 7760 = 0.644다. 그림의 2단계에 가로세로 길이부터 풀어 적혀 있다.",
          "같은 계산으로 A와 C는 0.732다. A와 컵 box E는 하나도 겹치지 않아 0이고, 두 box가 똑같으면 1이다. 점수는 box 하나의 숫자이고 IoU는 box 한 쌍의 숫자다.",
        ],
      },
      {
        q: "NMS는 어떤 순서로 지우나?",
        a: [
          "그림의 3단계를 threshold 0.5에 두고 보라. 점수 순으로 줄 세운 뒤 맨 앞의 box를 남긴다. 컵 E다. 같은 클래스의 box가 없으니 잴 것이 없다. 다음은 고양이 A다. A를 남기고 B, C와 IoU를 잰다. 둘 다 0.5를 넘으니 지운다.",
          "남은 box는 A와 E, 물체마다 하나다. IoU는 두 번 쟀다. 가장 높은 것(maximum)만 남기고 그와 많이 겹치는 나머지를 누른다(suppression)고 해서 이 이름이 붙었다.",
        ],
      },
      {
        q: "IoU threshold 0.5는 누가 정했고, 바꾸면 무엇이 달라지나?",
        a: [
          "사람이 정한다. 0.7로 올려 보라. C는 0.732라 지워지지만 B는 0.644라 살아남아, 한 고양이에 box가 둘 남는다. 그러면 낮게 두면 되지 않을까?",
          "사진을 \"겹쳐 앉은 두 마리\"로 바꿔 보라. 첫 고양이 바로 뒤에 같은 샴고양이가 조금 작게 한 마리 더 앉아 있다. 둘째 고양이를 맡은 box F는 그 고양이를 잘 두르고 점수가 0.58인데, A와의 IoU가 0.670이다. threshold가 0.5나 0.6이면 F는 B, C와 함께 지워져 진짜 고양이 한 마리를 잃는다. 0.7이면 F가 살지만 B도 산다.",
          "F를 살리려면 threshold가 0.670 이상이어야 하고 B를 지우려면 0.644보다 낮아야 한다. 둘을 함께 만족하는 값은 없다. NMS가 보는 것은 점수와 IoU뿐이라, 같은 고양이의 중복 box와 옆 고양이의 box가 이 둘로는 비슷하게 보인다. YOLOv10 논문이 NMS 때문에 성능이 이 손잡이 값에 예민해진다고 쓴 사정이 이것이다.",
        ],
      },
      {
        q: "NMS에는 시간이 얼마나 드나?",
        a: [
          "이 예에서는 IoU 계산 두 번이다. 실제 검출기는 cell이 수천 개라 후보도 그만큼 많다. NMS는 box를 하나 남길 때마다 남은 후보와 비교하므로 앞의 결과를 보고서야 다음 차례가 정해지고, 신경망 계산이 다 끝난 뒤에야 시작할 수 있다.",
          "YOLOv10 논문이 T4 GPU, TensorRT FP16, batch 1로 잰 YOLOv8-S는 신경망 계산만 2.33 ms이고 후처리까지 넣으면 7.07 ms다. 후처리가 전체의 67%다. FLOPs는 신경망 안의 곱셈과 덧셈만 세므로 이 몫이 들어 있지 않다. FLOPs가 같아도 latency가 다를 수 있는 이유 하나가 이것이다.",
        ],
      },
    ],
    formula: "\\mathrm{IoU}(a, b) = \\frac{|a \\cap b|}{|a \\cup b|} = \\frac{|a \\cap b|}{|a| + |b| - |a \\cap b|}\n\\text{NMS: keep } b^{*} = \\arg\\max \\text{score}, \\quad \\text{remove } b \\text{ if } \\mathrm{IoU}(b^{*}, b) > \\tau, \\quad \\text{repeat}",
    symbols: [
      "|a ∩ b|: 두 box가 겹친 넓이(intersection). A와 B에서 5000",
      "|a| + |b| − |a ∩ b|: 두 box가 덮은 넓이 전체(union). A와 B에서 7760",
      "b*: 아직 남은 후보 가운데 점수가 가장 높은 box. 고양이에서는 A",
      "τ: IoU threshold. 사람이 정한다",
    ],
    takeaway: "NMS는 점수가 가장 높은 box를 남기고, 그 box와 IoU가 threshold를 넘는 같은 클래스의 box를 지운다. 점수는 box 하나의 숫자이고 IoU는 box 한 쌍의 숫자다.",
    see: "1단계는 점수 순서로 줄 세운 후보이고, score threshold 0.3 아래인 D는 회색 점선이다. 2단계는 고양이 box 가운데 점수가 가장 높은 A와 나머지의 IoU를 적고, A와 B의 계산을 겹친 넓이와 합친 넓이로 풀어 쓴다. 3단계는 IoU threshold로 지운 결과다. 남은 고양이 box는 주황, 컵 box는 파랑, 지운 box는 빨간 점선이다. threshold를 0.7로 올리면 B가 살아난다. 사진을 \"겹쳐 앉은 두 마리\"로 바꾸면 같은 그림을 조금 줄이고 어둡게 칠한 둘째 고양이가 뒤에 앉고, 그 box F가 생긴다. threshold 0.5와 0.6에서는 F가 지워지고, 0.7에서는 F와 함께 B도 남는다. 아래에 IoU를 잰 횟수가 나온다. cell이 적은 box와 점수는 손으로 정한 값이다.",
    bridge: "고양이 위에 box가 셋이나 뜬 것은 모델이 그렇게 배웠기 때문이다. 학습할 때 정답의 고양이는 하나였다. 그 하나를 두고 열여섯 cell 가운데 어느 cell에게 \"이것이 고양이다\"라고 말해 줬기에 추론 때 셋이 손을 드나?",
  },
  {
    id: "assign", num: "03", kicker: "label assignment",
    question: "학습 때 \"이것이 고양이다\"라는 정답은 몇 개의 cell에 주나?",
    gist: [
      "규칙을 정해서 준다. 정답 box 하나와 cell 열여섯을 짝짓는 규칙을 label assignment라 한다. 짝지어진 cell은 그 box를 맞히도록, 나머지는 \"아무것도 없다\"고 말하도록 학습된다. 정답을 여러 cell에 주면 one-to-many, 한 cell에만 주면 one-to-one이다.",
      "반 전체가 같은 문제를 풀고 채점받는 장면과 같다. 잘 푼 학생 셋에게 정답이라고 말해 주면(one-to-many) 여럿이 배우지만, 시험 날에는 셋이 다 손을 든다. 가장 잘 푼 한 명에게만 정답이라고 하면(one-to-one) 시험 날 한 명만 손을 들지만, 나머지는 \"너는 틀렸다\"는 말만 듣고 배운다.",
      "그러니 02절의 중복 box는 모델이 잘못 배운 결과가 아니다. one-to-many로 배운 대로 낸 것이다. NMS가 필요한 이유는 추론이 아니라 학습 규칙에 있다.",
    ],
    lead: [
      "학습 자료는 사진과 정답이다. 정답에는 고양이 box 하나와 컵 box 하나가 있다. 학습 도중 한 순간을 멈춰 놓고 본다. 고양이 위 네 cell A, B, C, D가 지금 내는 고양이 점수는 0.25, 0.9, 0.3, 0.2이고, box는 앞 절의 그 box들이다. 아직 학습이 덜 끝나서 점수가 제멋대로이고, 얼굴이 든 B가 가슴이 든 A보다 훨씬 높다. 이 점수들은 손으로 정했다.",
    ],
    walk: [
      {
        q: "정답을 받을 후보는 어느 cell인가?",
        a: [
          "cell의 한가운데가 정답 고양이 box 안에 있는 cell만 후보가 된다. A, B, C, D 넷이 들어온다. 나머지 열두 cell은 고양이에 대해 처음부터 후보가 아니고, 고양이 점수의 target은 0이다. YOLOv10 논문은 이 조건을 s로 적는다. 한가운데가 box 안이면 1, 아니면 0이다. 논문은 예측이 나오는 이 한가운데 점을 anchor point라 부른다.",
          "이 조건은 cell에 고양이가 얼마나 들었는지와 상관없다. cell D는 고양이가 cell의 6%만 덮지만 한가운데가 box 안이라 후보다. 꼬리와 발이 든 아래 줄 cell은 고양이가 더 많이 덮지만 한가운데가 box의 아래 끝 밖이라 후보가 아니다.",
        ],
      },
      {
        q: "후보 넷 가운데 누가 더 고양이 cell다운가?",
        a: [
          "두 가지를 함께 본다. 그 cell이 지금 고양이라고 얼마나 말하는지, 곧 점수 p와, 그 cell의 box가 정답 box와 얼마나 겹치는지, 곧 IoU다. 넷의 IoU는 A 0.899, B 0.688, C 0.683, D 0.562로 A의 box가 정답에 가장 가깝다.",
          "YOLOv10은 YOLOv8에서 쓰던 matching metric, 곧 짝짓기 기준을 그대로 쓴다. m = s × p^α × IoU^β이고 α는 0.5, β는 6이다. A는 점수가 0.25로 낮은데도 m이 0.264로 1등이고, 점수가 0.9인 B는 0.100이다. C와 D는 더 낮다. β가 6이라 IoU의 작은 차이가 크게 벌어지기 때문이다.",
          "이 기준은 모델이 지금 내놓은 p와 box로 계산한다. 학습이 진행되면 순위도 바뀔 수 있다. 정답만 보고 미리 정해 두는 짝이 아니라 그때그때의 예측을 보고 정하는 짝이다.",
        ],
      },
      {
        q: "여러 cell에 정답을 주면 무엇을 받나?",
        a: [
          "m이 높은 cell부터 몇 개에 정답을 준다. 몇 개인지는 정해 두는 값이고 이 예에서는 셋으로 정했다. A, B, C가 받는다. 이것이 one-to-many assignment다.",
          "세 cell은 두 가지를 받는다. 하나는 box다. 셋 모두 정답 고양이 box를 맞히도록, 정답과 덜 겹칠수록 커지는 IoU 기반 box loss로 고쳐진다. 다른 하나는 고양이 점수의 target t다. target은 1이 아니다. 후보들의 IoU 가운데 가장 큰 값 u*, 여기서는 A의 0.899에, 그 cell의 m이 1등의 m에 비해 얼마인지를 곱한다. A의 target은 0.899, B는 0.341, C는 0.189이고, D와 나머지 cell은 0이다.",
          "01절에서 objectness의 target이 IoU였던 것과 같은 생각이다. 점수가 \"고양이다\"뿐 아니라 \"내 box가 잘 맞는다\"까지 담도록 학습된다. 그래서 objectness를 따로 두지 않아도 클래스 점수 하나로 box를 줄 세울 수 있다.",
        ],
      },
      {
        q: "그렇게 배운 모델을 추론에 쓰면 어떻게 되나?",
        a: [
          "보기를 \"추론 때 출력\"으로 바꿔 보라. 정답은 이제 없다. 세 cell이 고양이라고 배웠으니 세 cell이 손을 든다. 02절에서 NMS로 지웠던 고양이 위의 box 셋이 바로 이것이었다. NMS가 필요한 이유는 학습 때 정답을 여러 cell에 줬기 때문이다.",
          "대신 얻는 것이 있다. 고양이 한 마리가 나올 때마다 세 cell의 loss가 backbone을 고친다. backbone은 사진에서 특징을 만드는 앞부분이다. 고양이를 보는 cell이 고양이답게 반응하도록 더 많은 자리에서 신호가 들어온다. YOLOv10 논문은 이것을 풍부한 supervision signal이라 부르고, 그래서 성능이 좋다고 쓴다.",
        ],
      },
      {
        q: "한 cell에만 정답을 주면 무엇이 달라지나?",
        a: [
          "\"one-to-one\"으로 바꿔 보라. m이 가장 높은 A 하나만 target 0.899를 받는다. B, C, D는 고양이를 보고 있는데도 target이 0이다. 지금 0.9라고 말하는 B에게 \"고양이가 아니다\"라고 가르친다.",
          "추론 때 출력을 보면 고양이 위에서 점수가 0.3을 넘는 box는 A 하나다. NMS가 할 일이 없다. 이 점수들도 그렇게 배운 모델이 낼 법한 값을 손으로 정한 것이다.",
          "잃는 것은 신호다. 고양이 한 마리에서 고양이라고 배우는 cell이 하나뿐이다. 논문은 이것이 약한 supervision이 되어 정확도와 수렴 속도가 떨어진다고 쓴다. 정확도는 AP(average precision)로 잰다. 여러 IoU 기준에서 box를 얼마나 잘 찾았는지를 평균 낸 검출 점수다. 논문 표 3에서 YOLOv8-S로 COCO를 재면 one-to-many만 쓸 때 44.9 AP에 NMS까지 7.07 ms, one-to-one만 쓸 때 43.4 AP에 2.44 ms다.",
          "구분해 둘 것이 있다. label assignment는 학습 때 target을 정하는 규칙이다. 추론 때는 정답이 없으니 할당도 없다. 추론 때의 출력이 하나냐 셋이냐는 학습 규칙이 남긴 결과일 뿐이다.",
        ],
      },
    ],
    formula: "m(\\alpha, \\beta) = s \\cdot p^{\\alpha} \\cdot \\mathrm{IoU}(\\hat{b}, b)^{\\beta}, \\qquad \\alpha = 0.5,\\; \\beta = 6\nt_j = u^{*} \\cdot \\frac{m_j}{m^{*}} \\quad (j \\in \\Omega), \\qquad t_j = 0 \\quad (j \\notin \\Omega)",
    symbols: [
      "s: cell의 한가운데가 정답 box 안에 있으면 1, 아니면 0. A, B, C, D는 1",
      "p: 그 cell이 지금 내는 고양이 점수. B가 가장 높다",
      "IoU(b̂, b): 그 cell의 box b̂와 정답 box b의 IoU. A가 가장 높다",
      "m: matching metric. A가 1등이다",
      "Ω: 정답을 받는 cell들. one-to-many이면 A, B, C이고 one-to-one이면 A",
      "u*: 후보들의 IoU 가운데 가장 큰 값. A의 0.899",
      "t: 고양이 점수의 target. one-to-many에서 A 0.899, B 0.341, C 0.189",
    ],
    takeaway: "label assignment는 학습 때 어느 cell이 그 물체를 맞히도록 고쳐질지 정한다. 여러 cell에 주면 신호가 풍부하지만 추론 때 중복이 나오고, 한 cell에 주면 중복이 없지만 신호가 약하다.",
    see: "초록 점선이 정답 고양이 box이고, 테두리를 두른 네 cell이 한가운데가 그 안에 든 후보다. \"학습 때 정답\"에서는 아래 표에 cell마다 지금의 점수 p, box의 IoU, matching metric m, 받는 target t가 나온다. target을 받는 cell이 주황으로 칠해진다. \"one-to-many\"이면 A, B, C가, \"one-to-one\"이면 A만 칠해진다. \"추론 때 출력\"에서는 그렇게 배운 모델이 낸 점수와 box가 나온다. one-to-many로 배운 모델은 고양이 위에 box 셋이 0.3을 넘고, one-to-one으로 배운 모델은 하나만 넘는다. 학습 도중의 점수와 추론 때의 점수는 손으로 정했고, m과 target은 YOLOv10 논문의 식으로 계산했다.",
    bridge: "one-to-many면 신호가 풍부한 대신 NMS가 필요하고, one-to-one이면 NMS가 없는 대신 신호가 약하다. 둘 중 하나를 골라야 하나?",
  },
  {
    id: "dual", num: "04", kicker: "YOLOv10 · head 둘",
    question: "YOLOv10은 one-to-many와 one-to-one을 어떻게 함께 쓰나?",
    gist: [
      "head를 둘 둔다. 같은 backbone과 neck 위에 구조가 같은 head 둘을 나란히 달고, 하나는 one-to-many로, 다른 하나는 one-to-one으로 정답을 받는다. 학습 때는 둘을 함께 고치고 추론 때는 one-to-one head만 쓴다. 이것을 dual label assignment라 한다.",
      "같은 학생(backbone)이 두 선생에게 배운다. 한 선생은 잘한 답을 넉넉히 칭찬하고(one-to-many), 다른 선생은 가장 좋은 답 하나만 정답으로 인정한다(one-to-one). 시험은 둘째 선생의 방식으로 본다. 그래도 학생의 실력은 두 선생 모두에게서 자랐다.",
      "두 선생이 서로 다른 답을 1등으로 꼽으면 학생이 헷갈린다. 그래서 두 head가 같은 cell을 1등으로 고르게 하는 규칙을 둔다. 논문은 이것을 consistent matching metric이라 부른다.",
    ],
    lead: [
      "YOLOv10은 칭화대의 Ao Wang, Hui Chen, Lihao Liu, Kai Chen, Zijia Lin, Jungong Han, Guiguang Ding이 낸 NeurIPS 2024 논문이다. 앞 절의 갈림길에서 그들은 고르지 않고 둘 다 학습했다.",
    ],
    walk: [
      {
        q: "head를 하나 더 단다는 것은 무엇을 어디에 다는 것인가?",
        a: [
          "검출기는 backbone, neck, head로 되어 있다. backbone은 사진에서 특징을 만들고, neck은 크기가 다른 여러 feature map을 섞는다. YOLO에서는 neck으로 PAN을 쓴다. head는 cell마다 box와 클래스 점수를 낸다. head 안에는 box를 내는 회귀(regression) branch와 점수를 내는 분류(classification) branch가 있다.",
          "YOLOv10은 원래 head와 구조가 똑같은 head를 하나 더 단다. 원래 head는 one-to-many로 정답을 받는다. o2m head라 부르자. 새 head는 one-to-one으로 받는 o2o head다. 두 head는 같은 backbone과 neck 위에 나란히 붙어 있고 loss 함수도 같다. 다른 것은 정답을 나눠 주는 규칙뿐이다.",
          "학습 때는 두 head의 loss가 모두 backbone과 neck으로 흘러가, backbone과 neck이 one-to-many의 풍부한 신호를 그대로 받는다. 추론 때는 o2m head를 떼어 버리고 o2o head로만 예측한다.",
        ],
      },
      {
        q: "두 head가 같은 cell을 두고 서로 다른 말을 들으면 어떻게 되나?",
        a: [
          "앞 절의 순간으로 돌아간다. o2m head는 앞 절의 표대로 A, B, C에 target을 받는다. o2o head도 같은 α와 β로 1등을 고르면 A다. 두 head가 A를 두고 같은 말을 듣는다.",
          "그림에서 o2o의 metric을 α 0.5, β 2로 바꿔 보라. 논문 그림 2가 어긋난 경우로 쓴 값이다. 이제 o2o head는 B를 고른다. cell A는 o2m head에게서 가장 높은 target을, o2o head에게서 0을 듣는다. cell B는 그 반대에 가깝다. 같은 backbone 위의 두 head가 같은 cell을 두고 거꾸로 배운다.",
          "논문은 두 head의 분류 target이 얼마나 다른지를 숫자 하나로 쟀다. 논문의 기호로는 A인데 cell A와는 상관없는 기호라, 여기서는 target 차이라 부른다. 두 head의 metric이 같으면 0.53이고 어긋나면 1.65다. 이 값은 o2o head가 고른 cell이 o2m head의 1등일 때 가장 작다.",
        ],
      },
      {
        q: "α와 β를 어떻게 정하면 1등이 늘 같아지나?",
        a: [
          "o2o의 α와 β를 o2m의 값에 같은 수 r을 곱해 정한다. 그러면 o2o의 m은 o2m의 m을 r제곱한 값이 된다. s는 0 아니면 1이라 몇 제곱해도 그대로다. 0과 1 사이의 양수들은 같은 수만큼 제곱해도 크기 순서가 바뀌지 않으므로 1등이 같다. 이것이 consistent matching metric이고, 논문은 r = 1을 기본으로 쓴다.",
          "그림에서 α 1, β 12를 골라 보라. r = 2인 경우다. m은 훨씬 작아졌지만 순서는 A, B, C, D 그대로다. 논문 표 4(YOLOv8-S)에서 r을 0.5, 1, 2로 둔 세 쌍은 모두 44.3 AP이고, 어긋난 쌍은 42.7 AP다.",
        ],
      },
      {
        q: "추론 때 o2o head만 남기면 같은 사진에서 무엇이 달라지나?",
        a: [
          "보기를 \"추론 때\"로 바꿔 보라. backbone과 neck은 그대로라 같은 사진에서 같은 특징을 만든다. o2o head가 내는 고양이 점수는 A가 0.7이고 B, C, D는 모두 0.3에 한참 못 미친다. 컵 E는 0.68이다. 학습한 대로라면 이런 값이 나와야 한다는 뜻으로 손으로 정했다. 0.3을 넘는 box는 A와 E 둘이고 그것이 출력이다. IoU는 한 번도 재지 않았다.",
          "쓰는 head를 \"o2m head\"로 바꾸면 02절의 출력이 나온다. 고양이 위에 box 셋이 0.3을 넘고 NMS가 필요하다. backbone도 사진도 같고 head만 바꿨다.",
          "앞 절에서 본 논문 표 3의 같은 자리에, 두 head를 함께 학습하고 o2o head로 쓴 값이 있다. 44.3 AP에 2.44 ms다. latency는 one-to-one만 쓴 것과 같고, 정확도는 그보다 0.9 AP 높아 one-to-many의 44.9에 거의 다가갔다.",
        ],
      },
      {
        q: "이것이 보여 주지 않는 것은 무엇인가?",
        a: [
          "NMS를 쓰던 학습보다 아직 조금 낮다. 같은 YOLOv8-S에서 44.9와 44.3이다. 논문의 한계 절은 작은 모델일수록 이 차이가 크고 가장 큰 YOLOv10-X에서는 차이가 없다고 쓴다. 그 원인을 작은 모델의 특징이 one-to-one 짝짓기에 필요한 만큼 서로 구별되지 않는 데서 찾는다.",
          "이 예의 o2o head 점수는 손으로 정했다. B와 C가 정말 그만큼 내려가는지, 어떻게 내려가는지는 이 예로 보일 수 없다. 이 예가 보이는 것은 두 head가 같은 cell을 두고 같은 말을 듣게 만드는 규칙과, 추론 때 head 하나를 떼면 출력에서 무엇이 바뀌는지다.",
        ],
      },
    ],
    formula: "m_{\\text{o2o}} = m(r\\alpha, r\\beta) = s \\cdot p^{r\\alpha} \\cdot \\mathrm{IoU}^{r\\beta} = m_{\\text{o2m}}^{\\,r}\nA = t_{\\text{o2o},i} - \\mathbb{I}(i \\in \\Omega)\\, t_{\\text{o2m},i} + \\sum_{k \\in \\Omega \\setminus \\{i\\}} t_{\\text{o2m},k}",
    symbols: [
      "m_o2m, m_o2o: 두 head의 matching metric. o2m은 α 0.5, β 6",
      "r: o2o의 α와 β에 곱하는 수. 논문의 기본값은 1",
      "i: o2o head가 고른 cell. metric이 같으면 A, β만 2로 바꾸면 B",
      "Ω: o2m head가 고른 cell들. A, B, C",
      "A: 논문의 기호를 따른 두 head의 target 차이. cell A와는 다른 기호다",
    ],
    takeaway: "YOLOv10은 같은 backbone에 head 둘을 달아, o2m head로 풍부한 신호를 받고 추론 때는 o2o head만 쓴다. 두 head의 matching metric을 같은 비율로 맞춰 1등이 같게 한다.",
    see: "\"학습 때\"는 backbone과 neck 위에 head 둘이 나란히 있고, 아래에 두 head가 cell A, B, C, D에 주는 target이 두 열로 나온다. o2o의 metric을 앞의 두 버튼 가운데 하나로 두면 두 열의 1등이 A로 같고 target 차이가 작다. 셋째 버튼으로 바꾸면 o2o 열의 1등이 B로 옮겨 가고 target 차이가 커진다. \"추론 때\"는 o2m head가 흐리게 빠지고 사진 위에 o2o head의 출력이 나온다. 쓰는 head를 바꾸면 같은 사진에서 0.3을 넘는 box가 둘에서 넷으로 는다. 추론 때의 점수는 손으로 정했다.",
    bridge: "NMS가 빠지자 YOLOv10-S의 latency는 2.44 ms가 됐고, 이제 그 전부가 신경망 계산이다. 남은 시간을 줄이려면 신경망 자체를 봐야 한다. 어디가 무거웠나?",
  },
  {
    id: "design", num: "05", kicker: "YOLOv10 · 설계",
    question: "NMS를 뺀 뒤 남은 시간은 어디서 줄였나?",
    gist: [
      "NMS가 빠지자 latency는 전부 신경망 계산이 됐다. YOLOv10은 그 계산을 세 곳에서 덜었다. 분류 branch를 가볍게 하고, downsampling 층에서 채널 늘리기와 크기 줄이기를 나누고, 중복이 많은 stage의 블록을 작은 블록으로 바꿨다. 아낀 몫 일부로 large kernel과 partial self-attention을 넣어 정확도를 되찾았다.",
      "이삿짐 줄이기와 비슷하다. 무게(FLOPs)가 많이 나가면서 덜 중요한 짐부터 뺀다. 그래도 이사 시간은 무게만큼 줄지 않는다. 짐을 몇 번 나르는지, 곧 feature map을 메모리에서 몇 번 읽고 쓰는지도 시간을 정하기 때문이다.",
      "흔히 FLOPs를 줄이면 그만큼 빨라진다고 생각한다. 이 설계에서 FLOPs는 4분의 1 넘게 줄었지만 latency는 5% 남짓 줄었다.",
    ],
    lead: [
      "출발점은 NMS 없이 학습한 YOLOv8-S다. 논문은 YOLO를 stem, downsampling 층, stage마다 쌓인 블록, head로 나누고, 계산이 거의 들지 않는 stem을 뺀 셋을 하나씩 손봤다. 그림의 막대가 그 과정이고 숫자는 모두 논문의 표 2와 표 5에서 왔다.",
    ],
    walk: [
      {
        q: "head의 두 branch 가운데 어느 쪽이 무거웠고, 어느 쪽이 더 중요했나?",
        a: [
          "YOLOv8-S에서 분류 branch는 회귀 branch보다 FLOPs가 2.5배, 파라미터가 2.4배 무겁다. 그런데 어느 쪽의 오류가 성능을 더 깎는지 재 보니 반대였다. 예측의 클래스 점수를 정답으로 바꿔 끼우면 AP가 59.9가 되고, 예측의 box를 정답 box로 바꿔 끼우면 64.5가 된다. box의 오류를 없앨 때 더 많이 오른다.",
          "그래서 분류 branch를 depthwise separable conv로 가볍게 바꿨다. 채널마다 따로 거는 3×3 depthwise conv와 채널을 섞는 1×1 pointwise conv의 짝이다. AP는 44.2로 거의 그대로다. 그림의 셋째 단계다.",
        ],
      },
      {
        q: "downsampling 층은 무엇을 나눴나?",
        a: [
          "YOLO는 보통 stride 2의 3×3 conv 하나로 가로세로를 절반으로 줄이면서 채널을 C에서 2C로 늘린다. YOLOv10은 이 두 일을 나눴다. 먼저 1×1 pointwise conv로 채널만 늘리고, 그다음 3×3 depthwise conv로 채널마다 따로 크기를 줄인다. 곱셈 수는 4.5HWC²에서 2HWC² + 4.5HWC로 준다.",
          "크기를 하나 정해 넣어 보면, H와 W가 80이고 C가 64일 때 곱셈 수가 0.46배가 된다. 이 크기는 손으로 정한 예이고 식은 논문의 것이다. 그림의 넷째 단계가 이것을 모델 전체에 적용한 결과다.",
        ],
      },
      {
        q: "모든 stage에 같은 블록이 필요한가?",
        a: [
          "논문은 stage마다 마지막 블록의 마지막 conv 가중치에서 큰 singular value(특이값)가 몇 개인지 셌다. 가장 큰 특이값의 절반을 넘는 것의 개수다. 그 층이 실제로 쓰는 독립 방향의 수, 곧 rank를 어림한 것이다. LoRA 챕터에서 본 바로 그 rank다. 그 수가 작은 stage는 가중치에 겹치는 내용이 많다고 봤다.",
          "rank가 작은 stage부터 블록을 CIB(compact inverted block)로 바꿨다. CIB는 공간을 섞는 일은 값싼 depthwise conv에, 채널을 섞는 일은 pointwise conv에 맡긴 작은 블록이다. 바꿀 때마다 AP를 재고 떨어지면 멈춘다. YOLOv10-S에서는 두 stage를 바꿀 때까지 AP가 지켜지고, 셋째를 바꾸자 떨어졌다. 그림의 다섯째 단계다.",
        ],
      },
      {
        q: "FLOPs는 4분의 1 넘게 줄었는데 latency는 왜 5%만 줄었나?",
        a: [
          "NMS 없는 YOLOv8-S에서 다섯째 단계까지 오는 동안 파라미터는 44.6%, FLOPs는 27.3% 줄었다. latency는 2.44 ms에서 2.31 ms로 5.3% 줄었다. FLOPs는 곱셈과 덧셈의 횟수일 뿐이고, latency에는 feature map을 메모리에서 읽고 쓰는 시간과 층마다 계산을 시작하는 비용도 들어 있다. 그래서 둘은 같은 비율로 움직이지 않는다.",
          "다만 이 표들만으로는 남은 시간이 정확히 어디에 쓰이는지 알 수 없다. 말할 수 있는 것은 이 설계가 FLOPs와 파라미터를 크게 줄이면서 AP를 지켰고, T4에서의 latency는 그보다 훨씬 덜 줄었다는 것이다.",
        ],
      },
      {
        q: "아낀 계산으로 정확도는 어떻게 되찾았나?",
        a: [
          "두 가지를 더했다. 첫째는 large kernel이다. 깊은 stage의 CIB에서 depthwise conv 하나를 7×7로 키웠다. 학습 때는 3×3 depthwise branch를 하나 더 나란히 붙였다가 추론 때 7×7 하나로 합친다. 재매개변수화 챕터에서 본 structural reparameterization, 곧 학습 때 나란히 둔 branch의 kernel을 추론 때 하나로 더해 두는 방법이다. 큰 모델은 이미 넓게 보므로 N과 S에만 썼다. YOLOv10-S에서 0.4 AP를 얻고 latency가 0.03 ms 늘었다.",
          "둘째는 PSA(partial self-attention)다. self-attention은 모든 cell이 서로를 비교해 섞는 계산이라 cell 수의 제곱으로 비싸다. 그래서 채널을 절반으로 나눠 한쪽만 multi-head self-attention과 FFN을 지나게 한 뒤 다시 이어 붙이고, cell 수가 가장 적은 마지막 stage 뒤에만 둔다. 1.4 AP를 얻고 0.15 ms가 늘었다. 그림의 마지막 단계가 YOLOv10-S다.",
        ],
      },
      {
        q: "다른 검출기와 나란히 놓으면 어떤가?",
        a: [
          "논문의 표 1이다. 모두 COCO 검증 세트, T4, TensorRT FP16, batch 1이다. YOLOv10-S는 46.3 AP에 2.49 ms이고, 같은 NMS 없는 검출기인 RT-DETR-R18은 46.5 AP에 4.58 ms다. 정확도는 거의 같고 논문은 1.8배 빠르다고 썼다. 더 큰 모델끼리의 비교에서도 같은 AP에서 latency가 적었다.",
          "이 비교는 T4 한 종류에서 잰 것이다. CPU나 mobile 기기, 큰 batch에서 같은 차이가 나는지는 이 표가 말하지 않는다.",
        ],
      },
    ],
    formula: "\\text{3×3, stride 2, } C \\to 2C: \\quad \\tfrac{H}{2}\\cdot\\tfrac{W}{2}\\cdot 9 \\cdot C \\cdot 2C = 4.5\\,HWC^2\n\\text{1×1 } (C \\to 2C) + \\text{3×3 depthwise, stride 2}: \\quad 2\\,HWC^2 + 4.5\\,HWC",
    symbols: [
      "H, W: 줄이기 전 feature map의 세로와 가로 cell 수",
      "C: 줄이기 전의 채널 수. 줄인 뒤에는 2C",
      "4.5HWC²: conv 하나로 두 일을 함께 할 때의 곱셈 수",
      "2HWC² + 4.5HWC: 채널 늘리기와 크기 줄이기를 나눌 때. 앞 항이 pointwise, 뒤 항이 depthwise의 몫이다",
    ],
    takeaway: "YOLOv10은 가벼운 분류 branch, 채널과 크기를 나눠 줄이는 downsampling, rank를 보고 고른 작은 블록으로 FLOPs를 4분의 1 넘게 줄이고, large kernel과 PSA로 정확도를 되찾았다. latency는 FLOPs만큼 줄지 않았다.",
    see: "가로 막대 셋이 파라미터, FLOPs, latency이고 그 아래에 AP가 있다. 막대는 출발점인 NMS를 쓰는 YOLOv8의 값에 대한 비율로 그렸고 오른쪽에 실제 값을 적었다. 단계를 하나씩 올리면 앞 단계보다 줄어든 몫은 초록, 늘어난 몫은 빨강으로 표시된다. 둘째 단계에서는 latency 막대만 크게 줄고, 파라미터와 FLOPs는 그대로이며 AP는 조금 내려간다. 셋째에서 다섯째 단계까지는 FLOPs와 파라미터가 크게 줄고 latency는 조금 준다. 모델을 M으로 바꾸면 같은 단계의 YOLOv10-M 값이 나온다. M에는 large kernel을 쓰지 않았다. 모든 값은 YOLOv10 논문의 표 2와 표 5에서 왔다.",
    bridge: "YOLOv10은 정답을 나눠 주는 규칙을 바꿔 NMS를 없앴다. 그래도 답은 여전히 격자의 cell마다 하나씩 나오고, one-to-one 규칙은 물체마다 그 cell들 가운데 하나를 고른다. 표 1에서 나란히 선 RT-DETR은 처음부터 cell을 고르지 않는 계열이다. cell이라는 틀을 아예 버리고, 정해진 개수의 빈 슬롯에 물체를 하나씩 채우게 하면 어떻게 될까? 2020년의 DETR이 그렇게 했다.",
  },
];

export const yoloCopy = {
  title: "실시간 검출은 어떻게 빨라졌나: YOLO에서 YOLOv10까지",
  sub: "YOLO는 사진 한 장을 한 번 계산해 물체 여럿의 bounding box와 클래스를 낸다. 한 물체 위에 겹쳐 뜬 box는 NMS라는 후처리가 지웠다. YOLOv10은 학습 때 정답을 나눠 주는 규칙, label assignment를 바꿔 그 단계를 없앴고, 남은 신경망 계산을 head와 블록의 설계로 줄였다. 샴고양이와 컵이 있는 사진 한 장과 4×4 격자를 다섯 개 질문으로 끝까지 따라간다.",
  prologue,
  sections,
  ui: {
    pic: { size: "사진 160 × 160, 격자 4 × 4", gt: "정답 box", cat: "고양이", cup: "컵", loading: "그림을 불러오는 중" },
    cell: {
      cell: "cell", cells: ["A", "B", "C", "D", "E", "배경"], view: "보기", views: ["고른 cell", "고양이 위 네 cell"], bgName: "배경 cell",
      writes: "적은 숫자 7개", box: "box", obj: "objectness", pCat: "P(고양이 | 물체)", pCup: "P(컵 | 물체)",
      sumOne: "두 확률의 합은 늘 1", score: "점수 = objectness × 확률", catS: "고양이", cupS: "컵",
      bigger: "box가 cell보다 크다", four: "한 고양이 위에 box 넷", catScore: "고양이 점수", modelBlind: "모델은 정답 box를 보지 못한다",
    },
    nms: {
      step: "단계", steps: ["후보", "IoU 재기", "지운 뒤"], thr: "IoU threshold", pic: "사진", pics: ["한 마리", "겹쳐 앉은 두 마리"],
      order: "점수 순서", below: "0.3 아래, 버림", top: "남길 box", inter: "겹친 넓이", union: "합친 넓이",
      kept: "남김", removed: "지움", count: "IoU를 잰 횟수", ok: "물체마다 box 하나", dup: "한 고양이에 box가 둘 남았다", miss: "둘째 고양이를 잃었다",
      sameCls: "같은 클래스끼리만 잰다", noOverlap: "겹치지 않음",
    },
    assign: {
      rule: "정답 주기", rules: ["one-to-many", "one-to-one"], view: "보기", views: ["학습 때 정답", "추론 때 출력"],
      moment: "학습 도중 한 순간", cols: ["cell", "p", "IoU", "m", "target t"], pos: "target을 받는 cell", zero: "나머지 열두 cell의 고양이 target은 0",
      fire: "점수 0.3을 넘는 box", needNms: "고양이 위에 셋. NMS가 필요하다", noNms: "고양이 위에 하나. NMS가 할 일이 없다", ustar: "u* = A의 IoU",
    },
    dual: {
      view: "보기", views: ["학습 때", "추론 때"], metric: "o2o의 metric", metrics: ["α 0.5 · β 6", "α 1 · β 12", "α 0.5 · β 2"],
      head: "쓰는 head", heads: ["o2o head", "o2m head"], input: "사진", backbone: "backbone", neck: "+ neck (PAN)", o2m: "o2m head", o2o: "o2o head", cellCol: "cell",
      o2mRule: "α 0.5, β 6", dropped: "떼어 냄", targets: "cell마다 받는 target t", gap: "두 head의 target 차이",
      same: "두 head의 1등이 같다", differ: "두 head의 1등이 다르다", rank: "o2o metric 순서", out: "0.3을 넘는 box", noIou: "IoU는 한 번도 재지 않는다", nmsNeeded: "NMS가 필요하다",
    },
    design: {
      step: "단계", model: "모델", models: ["S", "M"],
      steps: ["YOLOv8 + NMS", "NMS 없이 학습", "가벼운 분류 branch", "나눠 줄이는 downsampling", "rank로 고른 블록", "large kernel + PSA"], lastM: "PSA만, large kernel 없음", from: "에서", to: "까지",
      rows: ["파라미터", "FLOPs", "latency", "AP"], units: ["M", "G", "ms", ""], ofBase: "출발점 대비", vsPrev: "앞 단계에서",
      source: "YOLOv10 논문 표 2, 표 5. COCO, T4 TensorRT FP16",
    },
  },
};
