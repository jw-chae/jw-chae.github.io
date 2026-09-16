export type ProjectFigure = { src: string; alt: string; caption: string; width: number; height: number };

export type ProjectSection = {
  id: string;
  label: string;
  title: string;
  paras: string[];
  formula?: string;
  figure?: ProjectFigure;
  table?: { head: string[]; rows: string[][]; note?: string };
  bullets?: string[];
};

export type Project = {
  id: string;
  num: string;
  status: string;
  title: string;
  hook: string;          // 왜 시작했나, 한 문장
  lead: string;
  mascot?: { src: string; alt: string };
  sections: ProjectSection[];
  honest: string;        // 지금 정직하게 말할 수 있는 것
  next: string;          // 다음 하나
  links: { label: string; href: string }[];
  tone: string;
};

export const projectsCopy = {
  kicker: "Projects",
  title: "진행 중인 프로젝트",
  sub: "그냥 재밌어서 하고 있는 것들. 논문이 되든 안 되든 상관없고, 대신 실제로 돌아가는 코드와 실제로 나온 숫자만 적는다. 결과가 좋게 안 나온 것도 그대로 둔다.",
  labels: { hook: "왜 시작했나", honest: "지금 정직하게 말할 수 있는 것", next: "다음에 하나만 바꾼다면", links: "자료" },
};

export const projects: Project[] = [
  {
    id: "researchos",
    num: "01",
    status: "진행 중 · 로컬에서만 돌아감",
    title: "ResearchOS",
    hook: "공부를 하면 까먹는다. 그리고 연구의 영감은 종종 다른 분야에서 나온다. 그렇다면 내 연구 궤적을 기반으로 나만의 연구 에이전트를 만들 수 없을까?",
    lead: "AI와 이야기하며 이해한 설명·비유·계산·의문을 내 컴퓨터에 남기고, 다음 대화가 그 기억에서 이어지게 만드는 개인 연구 OS. 그 위에 논문 근거와 연구 추론을 연결한다. 논문 요약 모음이 아니라, 왜 그 비유가 맞았는지·어디까지 유효한지·나중에 무엇을 정정했는지까지 다시 읽을 수 있어야 한다는 것이 출발점이다.",
    tone: "#0e7fc7",
    sections: [
      {
        id: "loop", label: "구조", title: "세 개의 반복",
        paras: [
          "학습 루프: 질문 → 실제 AI 설명 → 원문 보존 → 기존 노트 갱신. 다음 질문에서 관련 노트와 원문을 검색해 이어 간다.",
          "논문 분석 루프: 논문 원문 → Blogger의 독립 설명과 Researcher의 독립 분석 → 각각의 Verifier 검토 → 같은 지식 저장소에 draft로 기록.",
          "연구 루프: 근거 → 실패 → 의심할 가정 → 바꿀 축 → 판별 실험 → 후보 메커니즘. 실제 결과가 있을 때만 관찰과 연결한다.",
          "역할은 셋이다. Blogger는 개인 학습 기억, Researcher는 과학적 문제와 방향, Verifier는 산출물을 원문과 대조한다. 같은 모델을 써도 입력·세션·권한·저장 상태를 분리한다. 로컬 실행 코드는 예약·호출·저장·재개만 맡고 과학적 답을 만들지 않는다.",
        ],
      },
      {
        id: "memory", label: "기억", title: "지우지 않고 정정한다",
        paras: [
          "대화의 완료 턴마다 노트에 \"기여\"가 쌓인다. 설명, 비유, 미해결 질문, 정정, 충돌, 관찰, 가설, 실험 제안 같은 종류가 있고, 각 기여는 원래 메시지와 원문 위치를 가리킨다.",
          "정정은 이전 기여를 삭제하지 않고 supersedes 관계로 덮는다. 현재 화면은 철회되지 않은 정정을 따라 가려진 조상을 빼고 계산하고, 이력 화면에서는 A·B·C와 변경 이유를 전부 본다. 기여 하나만 되돌려도 무관한 기여·개인 메모·원문은 남는다.",
          "사용자가 정한 조건(\"지연은 27ms 이내\")과 AI가 제안한 것(\"p95로 보자\")은 같은 노트에 있어도 화자를 실제 메시지에서 계산해 구분한다. 과학적으로 맞는지의 검토 상태와 누가 정했는지는 다른 축이다.",
        ],
      },
      {
        id: "retrieval", label: "검색", title: "임베딩 없이, 예산 안에서",
        paras: [
          "다음 대화의 기억 검색은 로컬 어휘 검색과 규칙 기반 예산 배분이다. 벡터 DB를 만들지 않았다. 단어·수치·하이픈 이름을 뽑고, 노트를 idf 가중 점수로 고른 뒤, 설명·계산·현재 연구 조건·원래 메시지·논문 구간을 문자 예산 안에서 선택한다.",
          "예를 들어 2/41이라는 분수는 4/82와 같다고 보지 않고 문자열 단서로 남긴다. 수학적 동치를 증명하는 게 아니라 이전 계산을 찾아오는 장치이기 때문이다. 어떤 노트를 찾았고, 찾고도 예산에서 밀렸는지, 링크만 있고 원문이 없었는지를 요청마다 진단으로 남긴다.",
        ],
        formula: "\\operatorname{score}(d, q) = \\sum_{t \\in d \\cap q} \\log\\!\\Big(1 + \\frac{N}{1 + \\mathrm{df}(t)}\\Big)\\cdot w_{\\text{field}}(t), \\qquad w = 16 / 8 / 3 / 1\\ \\text{(수치·이름 / 제목 / 질문 / 본문)}",
      },
      {
        id: "recon", label: "실험", title: "과거 근거로 미래 논문의 방향을 복원할 수 있나",
        paras: [
          "최신 논문 20편을 각각 숨긴 정답으로 두고, 그 이전 선행 논문 3–8편만 준 뒤 내부 Researcher가 후보 방향 10개를 만들게 했다. 정답을 아는 평가 준비와 정답을 모르는 추론을 시점·입력에서 분리하고, 후보·순위·검토를 해시로 봉인한 뒤 정답과 비교했다.",
          "결과: 10개 후보 중 하나라도 실패·축·원리가 부분 이상 맞는 과제는 20개 중 16개, 축과 원리가 엄격히 맞는 과제는 20개 중 1개, 초기 1위 후보가 엄격히 맞는 경우는 0개. 근거 예산을 50% 늘린 조건(E2)에서도 개선되지 않았다.",
          "가장 좋은 사례(MoE 병합)는 \"라우터와 FFN을 분리해 교체하라\"는 판별 실험까지 맞혔지만 최종 해법(Hessian 기반 라우터 보정)은 못 냈다. 진단은 맞고 해법은 틀린 경우를 하나의 실패로 묶는 평가 설계의 간극도 여기서 드러났다.",
        ],
        table: {
          head: ["", "Broad any10", "Strict any10", "Top-1 strict", "호출"],
          rows: [["E1 (원문 65k자)", "16/20", "1/20", "0/20", "220"], ["E2 (원문 97.5k자)", "11/20", "0/20", "0/20", "202"]],
          note: "E2의 2과제는 후보 생성 전 KG 추출 실패. 같은 18과제만 보면 broad 14/18 → 11/18.",
        },
      },
      {
        id: "retract", label: "실험", title: "근거 하나를 철회하면 파생 주장이 따라 바뀌는가",
        paras: [
          "원관측 → 재서술 → 파생 주장의 명시적 AND/OR 의존 관계에서, 원관측이 철회되면 그것에만 기대는 주장은 unresolved로, 독립 관측이 남으면 available로 유지되는 최소 고정점 계산을 구현했다. 반복해서 원관측 ID 집합을 키우기만 하므로 종료하고, 관측 없이 서로를 참조하는 순환은 빈 집합에 머문다.",
          "이 위에서 원문 이력만 준 조건, 갱신 상태를 Markdown으로 준 조건, 같은 상태를 구조화 JSON으로 준 조건을 비교했다. 별도 평가 6사례에서 세 조건 모두 근거 상태·양립 모델 집합·최적 다음 측정을 6/6 맞혔다. 짧고 명시적인 환경에서는 원문 이력만으로 충분했다는 뜻이다.",
        ],
        formula: "R(n) = \\begin{cases} \\{n\\} & n \\text{ 이 철회되지 않은 원관측} \\\\ \\bigcup_{\\text{절 } c \\in \\text{clauses}(n),\\ \\forall p \\in c:\\ R(p)\\neq\\varnothing} \\ \\bigcup_{p\\in c} R(p) & \\text{그 외} \\end{cases}",
      },
    ],
    honest: "대화·원문 보존·노트 갱신·정정·후속 재사용·제한된 실험 연결은 실제로 작동한다. 그러나 현재 비교 결과로는 ResearchOS가 강한 Markdown이나 원문 이력보다 연구를 더 잘한다는 주장을 입증하지 못했다. 문헌 비교에는 평가·검색 결함이 있었고, 그것을 고친 뒤의 합성 비교에서는 세 조건이 모두 성공해 차이가 없었다. 37종 온톨로지와 1만 7천 개 기록이 있다는 사실이 성능의 증거는 아니다.",
    next: "짧은 합성 과제의 깊이를 더 늘리는 대신, 실제 실패를 찾는다. 정정이 어느 주장까지 적용되는지, 재인용이 독립 근거인지가 애매한 실제 사례를 원문과 함께 고르고, 원문 전달 실패·관계 추출 실패·사용자 결정 오인·올바른 상태를 보고도 틀린 행동을 고른 경우를 나눈다.",
    links: [{ label: "로컬 앱 (localhost:5173, 비공개)", href: "#" }, { label: "마스터 문서 28장 (비공개)", href: "#" }],
  },
  {
    id: "flymem",
    num: "02",
    status: "진행 중 · 첫 비교 완료",
    title: "초파리 뇌 기반 이상탐지",
    hook: "초파리의 뇌를 기반으로 이상탐지를 할 수는 없을까? 초파리는 몇 번 본 냄새를 시냅스 하나에 겹쳐 기억하고 새 냄새를 \"낯설다\"고 판별한다. 우리가 정상 패치를 통째로 저장하는 memory bank와 정반대다.",
    lead: "두 갈래로 나눠 봤다. 하나는 버섯체(mushroom body)의 희소 코드와 익숙함 기억을 고정 DINOv2 특징 위에 얹어, 정상 패치를 따로 저장하는 것과 한 시냅스 기억에 합쳐 저장하는 것이 결함 검출을 어떻게 바꾸는지 보는 것. 다른 하나는 실제 시각계 커넥톰 모델(flyvis)에 이미지를 넣고 결함 신호가 시간에 따라 살아남는지 보는 것. 둘 다 \"초파리가 좋다\"가 아니라 어느 단계에서 무엇이 바뀌는지를 묻는다.",
    tone: "#c27300",
    mascot: { src: "/projects/flymem-mascot.png", alt: "DINO 고글을 쓴 초파리 마스코트" },
    sections: [
      {
        id: "memories", label: "설계", title: "같은 정상 패치, 네 가지 기억",
        paras: [
          "정상 support 이미지의 패치 특징 z(L2 정규화된 DINOv2 ViT-S/14 토큰, 384차원)를 고정된 희소 투영으로 KC 코드 h로 바꾼다. m = 10,000개 좌표 중 정확히 k = 10개만 1인 이진 코드다. 투영 행렬은 정답이나 테스트로 최적화하지 않는다.",
          "A는 연속 특징을 각각 저장하고 최근접 cosine 거리를 점수로 쓴다(PatchCore의 골격). B는 코드를 각각 저장하고 가장 많이 겹치는 코드와의 거리를 쓴다. C0는 한 번이라도 켜진 좌표의 합집합만 남기고 아직 안 쓰인 활성 좌표의 비율을 점수로 쓴다(Fly Bloom filter). Cβ는 좌표별 활성 횟수를 세어 e^{−βc}를 가중치로 남긴다(counting memory).",
          "C0와 Cβ는 B가 만든 바로 그 코드를 받는다. 그래서 B와 C의 차이는 표현의 차이가 아니라 저장 방식의 차이만 잰다.",
        ],
        formula: "h(x) = \\operatorname{BinaryTopK}(Mz(x)) \\in \\{0,1\\}^{m}\ns_B(x) = 1 - \\tfrac{1}{k}\\max_{u\\in S} h(x)^{\\top}h(u), \\qquad s_{C0}(x) = \\tfrac{1}{k}\\sum_i \\mathbf{1}[i\\notin U]\\,h_i(x), \\qquad s_{C\\beta}(x) = \\tfrac{1}{k}\\sum_i e^{-\\beta c_i} h_i(x)",
      },
      {
        id: "result", label: "결과", title: "합쳐서 저장하면 정상 이미지가 늘수록 나빠진다",
        paras: [
          "MVTec tile·metal_nut, 정상 이미지 1·4·16·64장, seed 3쌍. 개별 코드 기억 B는 정상 이미지 수와 무관하게 평평하다. 합쳐진 기억 C0·Cβ는 이미지가 늘수록 내려가고, 64장에서 metal_nut C0는 B보다 26점 낮다.",
          "메모리 상태도 같이 움직였다. 사용된 KC 비율은 6%에서 17%로 늘고 남은 가중치는 0.53에서 0.33으로 줄었다. 그런데 이 상태 변화는 합쳐진 기억에서만 성능 하락을 동반했고, 같은 코드를 따로 저장한 B는 아무 일도 없었다.",
          "왜 무너지나 하는 두 설명이 남았다. (i) 합치는 순간 B가 쓰는 패치 안 공활성 정보가 사라진다. (ii) β = 0.1과 수천 단위 count에서 뜨거운 좌표의 가중치가 0으로 포화해 Cβ가 C0처럼 된다. β를 0.001까지 줄여 봤더니 metal_nut에서 오히려 34까지 떨어졌다. 포화 설명은 기각.",
          "5단계 통제가 (i)를 직접 확인했다. 각 패치의 활성 수와 각 좌표의 총 횟수를 정확히 유지한 채 어느 좌표가 같은 패치에서 함께 켜지는지만 섞으면, C0·Cβ는 정의상 그대로인데 B는 metal_nut에서 65에서 30으로 무너진다. B가 가진 것은 패치 안의 공활성 패턴이고, 합집합·count는 그것을 버린다.",
        ],
        table: {
          head: ["정상 이미지", "A 연속 NN", "B 개별 코드", "C0 합집합", "Cβ count"],
          rows: [["metal_nut · 1장", "65.0", "49.3", "46.0", "41.1"], ["metal_nut · 64장", "78.5", "68.5", "42.4", "53.8"], ["tile · 1장", "56.8", "61.8", "59.0", "59.4"], ["tile · 64장", "60.9", "62.1", "52.2", "56.2"]],
          note: "P-AP, 3 seed 평균. tile에서 B ≥ A로 보이는 것은 projection seed 2 하나가 만든 결과이고, 5단계에서 support seed를 바꿔도 seed 2의 B는 67–68로 유지돼 투영 의존적임을 확인했다.",
        },
        figure: { src: "/projects/flymem-pap.webp", alt: "정상 이미지 수에 따른 네 기억의 P-AP", caption: "정상 support 이미지 수에 따른 P-AP. 굵은 선이 seed 평균, 얇은 선이 seed 쌍.", width: 1400, height: 520 },
      },
      {
        id: "state", label: "상태", title: "고정 투영이 활성을 상위 1% 좌표에 몰아넣는다",
        paras: [
          "독립적인 k-hot 코드라면 정상 이미지 4장이면 좌표의 98%가 쓰여야 한다. 실제로는 64장을 기록해도 12–17%만 쓰였고, 활성의 66–90%가 상위 1%(100개) 좌표에 몰렸다. DINO 특징의 몇몇 큰 차원이 무작위 투영을 지배하기 때문이다. Dasgupta 등이 다룬 균등한 입력 분포와는 다른 상황이다.",
          "그래서 이 실험에서 확인된 실패 조건은 명확하다. m = 10,000, k = 10, 행당 연결 6의 고정 투영을 L2 정규화 DINOv2 특징에 적용하면, 합집합·count 기억은 정상 이미지 16장이면 정상·결함 패치의 중앙값 점수가 모두 0에 닿는다. metal_nut에서는 결함 패치의 61%가 C0에서 정확히 0이 되어 정상과 동점이다.",
        ],
        figure: { src: "/projects/flymem-state.webp", alt: "KC 사용 비율, 남은 가중치, 활성 집중도", caption: "왼쪽부터 사용된 KC 비율(점선은 독립 코드 가정), Cβ의 남은 가중치, 상위 1% 좌표가 차지하는 활성 비율.", width: 1400, height: 370 },
      },
      {
        id: "example", label: "예시", title: "합치면 무엇이 사라지는가",
        paras: [
          "metal_nut 16장, seed 0에서 B에서 C0로 갈 때 이미지 단위 grid-AP가 가장 크게 떨어진 예. A와 B는 결함 위치가 살아 있는데 C0는 대부분 0이 되고, Cβ는 그 사이에 있다. 이 예시는 미리 정한 규칙(가장 큰 하락·중앙값·가장 큰 상승)으로 골랐고 유리한 것만 고르지 않았다.",
        ],
        figure: { src: "/projects/flymem-example.webp", alt: "metal_nut bent 결함의 A/B/C0/Cβ 점수 지도", caption: "bent/008: 원본, A, B, C0, Cβ, 그리고 Δ = B − C0.", width: 1400, height: 460 },
      },
      {
        id: "flyvis", label: "두 번째 갈래", title: "실제 시각계 회로에 이미지를 넣으면",
        paras: [
          "flyvis의 사전학습 optic lobe 모델(721 column 육각 격자, 63 세포 유형)에 정상 이미지와 합성 scratch·밝기 변화를 넣고 1.5초 동안 반응을 기록했다. 조명 변화는 0.1초쯤 transient를 만든 뒤 가라앉고, scratch 신호는 결함 column 안에 국소적으로 남는다. 세포 유형 중앙값은 항상 조명보다 결함에 덜 반응하지만 T4/T5 계열은 3–5배로 반응한다. 다만 어느 유형이 그런지는 앙상블 모델마다 달라, \"transient 뒤에 읽어라\"는 견고하고 \"어느 유형을 읽어라\"는 모델 특이적이다.",
          "실제 MVTec 결함에서 시점별 활성을 특징으로 1-NN을 하면 0.02초 읽기가 최악, 0.1–0.2초가 최고다. 그러나 고정 회로 + 1-NN은 7차원 휘도 baseline과 같은 수준(leather P-AP 17.7 vs 17.3)이고 DINOv2 memory bank(60+)와는 비교가 안 된다. 같은 격자에 무작위 희소 recurrent 망을 두면 시간이 갈수록 결함 신호가 퍼지고 희석돼, 초파리 회로의 \"transient 뒤 비가 올라감\"은 일반 recurrent의 성질이 아니라 적응과 국소 억제가 있는 이 회로의 성질이다.",
        ],
        figure: { src: "/projects/flyvis-maps.webp", alt: "leather fold 결함의 휘도 baseline과 초파리 회로 시점별 점수 지도", caption: "leather fold/009: 휘도 baseline, 그리고 초파리 회로를 0.02 / 0.1 / 1.5초에 읽은 점수 지도.", width: 1400, height: 330 },
      },
    ],
    honest: "\"초파리 기억이 이상탐지에 좋다\"는 결과는 없다. 확인한 것은 같은 코드 아래에서 개별 저장은 정상 이미지 수에 안정하고 합집합·count 저장은 함께 내려가며, 그 원인이 포화가 아니라 합침 자체(패치 안 공활성의 소실)라는 관계, 그리고 고정 희소 투영이 DINO 특징 위에서 활성을 1%에 집중시킨다는 상태 관측이다. k-center coreset이 연속 NN을 올리는 것(+12)은 PatchCore의 재현이다. 두 카테고리, 세 seed 범위다.",
    next: "투영을 바꿔 활성 집중을 푼다. 입력 차원을 좌표마다 표준화하거나 행당 연결 수를 늘려 상위 1% 점유를 낮춘 뒤, 같은 support에서 B와 C0·Cβ를 다시 비교한다. 이것이 \"합침의 손실이 뜨거운 좌표 때문인가(집중을 풀면 C가 B에 가까워짐), 아니면 합침 자체의 성질인가(풀어도 격차 유지)\"를 가른다.",
    links: [{ label: "코드와 보고서 (lab/flymem, 비공개)", href: "#" }, { label: "PatchCore", href: "https://arxiv.org/abs/2106.08265" }, { label: "A neural algorithm for a fundamental computing problem (Dasgupta 2017)", href: "https://www.science.org/doi/10.1126/science.aam9868" }, { label: "A neural theory for counting memories (Dasgupta 2022)", href: "https://www.nature.com/articles/s41467-022-33577-2" }, { label: "flyvis", href: "https://github.com/TuragaLab/flyvis" }],
  },
];
