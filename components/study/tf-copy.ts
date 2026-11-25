import type { Prologue, StudySection } from "./chapters";
import { tfRestSections } from "./tf-rest-copy";
import { tfWalkSections } from "./tf-walk-copy";

const prologue: Prologue = {
  title: "이야기의 시작: 번역 한 줄을 먼저 해 보자",
  paragraphs: [
    "Transformer는 번역 문제에서 나왔다. 그래서 이 챕터는 구조도를 펼치기 전에 문장 하나를 번역한다. 영어 I love cats를 한국어 \"나는 고양이를 사랑한다\"로 옮긴다.",
    "앞의 네 절은 이 한 문장의 빈칸 하나만 따라간다. 사람이 번역할 때 손과 눈이 어디에 있는지를 먼저 보고, 같은 빈칸을 번역기가 어떻게 채우는지를 계산으로 따라가고, 한 번 읽어서는 놓치는 것을 보고, 그렇게 읽는 법을 어떻게 배웠는지로 돌아간다. attention, Q와 K와 V, head라는 말은 그 과정에서 필요해질 때 나온다.",
    "그다음에 같은 문장을 그대로 들고 역사로 돌아가 부품을 하나씩 채운다. 2017년 이전에 문장을 다루던 신경망은 RNN이었다. 단어를 하나씩 차례로 읽으면서 읽은 내용을 작은 메모 한 장에 덮어썼다. 문장이 길어지면 앞의 내용이 흐려졌고, 차례대로 읽어야 해서 계산을 동시에 할 수 없었다. 2014년에 번역문을 쓸 때마다 원문을 다시 훑어보게 하는 attention이 보조 장치로 나왔다.",
    "2017년 Google의 연구자 여덟 명이 낸 논문 \"Attention Is All You Need\"가 한 걸음 더 갔다. 보조 장치였던 attention만 남기고 RNN을 통째로 뺐다. 이 모델은 GPU 8개로 12시간 만에 학습됐고, 당시 최고의 번역기들을 넘었다. 이미지와 LLM은 다음 두 챕터에서 이 부품들을 그대로 가져다 쓴다.",
  ],
  timeline: [
    { year: "1997", text: "LSTM, 오래 기억하도록 다듬은 RNN" },
    { year: "2014", text: "RNN 두 개로 번역. 같은 해 attention이 보조 장치로 등장" },
    { year: "2017", text: "Transformer, RNN을 빼고 attention만 남김" },
    { year: "2018", text: "BERT와 GPT, 이 구조의 절반씩을 떼어 내 언어 전체로 확장" },
  ],
};

const sections: StudySection[] = [...tfWalkSections, ...tfRestSections];

export const tfCopy = {
  title: "Transformer는 어떻게 작동하는가",
  sub: "Transformer는 입력을 토큰이라는 조각들로 나누고, 토큰마다 \"다른 토큰 중 누구를 얼마나 참고할지\"를 스스로 정하게 하는 구조다. 2017년에 번역을 위해 만들어졌고, 지금은 글과 그림과 소리를 다루는 거의 모든 모델의 뼈대다. 이 챕터는 그 구조만을, 부품 하나하나가 왜 필요했는지와 함께 열네 개의 질문으로 따라간다. 앞의 네 절은 짧은 문장 하나의 빈칸을 따라가고, 뒤의 열 절은 같은 문장에 부품을 하나씩 채운다.",
  prologue,
  sections,
  ui: {
    patch: { size: "조각 크기", tokens: "토큰 수", patch: "조각 하나", flat: "픽셀을 한 줄로", token: "토큰 벡터", loading: "이미지 불러오는 중", image: "392 × 392 사진" },
    compare: { layers: "CNN 층 수", cnn: "CNN", attn: "Attention (1층)", sees: "보는 칸", of: "/ 121", hint: "칸을 누르면 기준 칸이 바뀐다" },
    rnn: {
      after: "cats 뒤의 단어 수", keep: "유지 비율", memo: "메모 한 장: 방금 읽은 단어를 100%로 둘 때 남은 몫", direct: "02절의 방식: 빈칸이 원문의 자리를 직접 읽는다",
      sentence: "I love cats", tail: "뒤에 붙은 단어", unit: "개", blank: "나는 ____", left: "메모에 남은 cats의 몫", path: "cats에서 빈칸까지",
      overwrite: "덮어쓰기", hop: "직접 읽기 1걸음", times: "번", serial: "차례로 하는 계산", memoN: "메모", directN: "직접 읽기 1번",
    },
    embed: {
      mode: "장면", sentence: "문장 넣기", pair: "두 단어 비교", verb: "둘째 단어", a: "단어 1", b: "단어 2", id: "번호",
      lookup: "단어마다 번호를 찾고, 표에서 그 번호의 행을 꺼낸다", compare: "두 단어의 행을 꺼내 비교한다",
      table: "임베딩 표", map: "행의 숫자 둘을 좌표로", same: "cats의 행은 둘째 단어를 바꿔도 그대로다", dot: "내적", cos: "코사인 유사도",
    },
    self: {
      step: "단계", steps: ["읽기 전", "한 칸이 읽는다", "세 칸 모두"], owner: "Q의 주인", verb: "둘째 단어", row: "원문 한 줄",
      before: "층에 들어가기 전에는 표에서 꺼낸 x뿐이다", shareOf: "가 읽는 비중 (세 칸의 합 100%)", score: "점수", read: "읽어 온 것",
      after: "층을 지난 뒤의", afterIs: "= x + 읽어 온 것", table: "칸마다 읽는 비중 (줄마다 합 100%)", sum: "합 100%", together: "세 줄은 동시에 계산된다",
    },
    matrix: {
      make: "Q 만들기", raw: "x 그대로", withM: "W_Q를 곱해서", owner: "Q의 주인", heads: "헤드 수", row: "원문 한 줄 · K와 V는 x 그대로", shareOf: "가 읽는 비중",
      score: "점수", qOf: "의 Q", none: "행렬 없음", read: "가 읽어 온 것", split: "숫자 512개짜리 벡터를 헤드 수만큼 나눠 쓴다",
      one: "헤드 하나", cells: "칸", sets: "따로 정하는 비중", setUnit: "벌", weights: "Q, K, V 행렬의 숫자", constant: "헤드 수를 바꿔도 합계는 같다",
    },
    order: {
      posCtl: "자리 벡터", on: "켬", off: "끔", owner: "Q의 주인", a: "첫 문장", b: "둘째 문장", shareOf: "가 읽는 비중", pos: "자리", noPos: "자리 벡터 없음",
      after: "읽은 뒤", delta: "두 문장에서 같은 단어의 읽은 뒤 벡터가 얼마나 다른가", same: "세 단어 모두 차이 0. 두 문장을 구별할 수 없다", differ: "같은 단어라도 놓인 자리에 따라 달라진다",
    },
    posenc: { pos: "자리", stripes: "자리 벡터 (가로: 자리, 세로: 칸)", sim: "고른 자리와의 닮은 정도", fast: "빠른 바늘", slow: "느린 바늘", one: "한 칸 옆", two: "두 칸 옆" },
    block: {
      step: "단계", auto: "자동", track: "따라가는 칸: I love cats의 cats",
      rows: ["입력 x", "LayerNorm", "attention 출력", "x + attention", "LayerNorm", "MLP 출력", "출력"],
      boxes: ["x", "LN", "Attention", "+", "LN", "MLP", "+"],
    },
    mask: {
      mask: "가리개", on: "켬", off: "끔", row: "줄", sees: "줄이 읽을 수 있는 칸", query: "읽는 칸", key: "읽히는 칸", must: "맞힐 말",
      leak: "맞힐 말이 든 칸을 읽는다:", hidden: "가려져 있다", last: "입력 줄에 없다",
      tokens: ["<시작>", "나는", "고양이를", "사랑한다"], answers: ["나는", "고양이를", "사랑한다", "<끝>"],
    },
    encdec: {
      step: "단계", auto: "자동", source: "원문 (인코더)", target: "번역문 (디코더)", owner: "Q를 만드는 칸", writing: "그 칸이 내놓는 다음 말", start: "<시작>", first: "<시작>만 넣고 첫 말을 기다린다",
      src: ["I", "love", "cats"], tgt: ["나는", "고양이를", "사랑한다"], reads: "읽는 줄", cross: "원문 (cross)", self: "번역문 (self)", masked: "아직 쓰지 않은 칸은 가리개에 막혀 있다",
    },
    output: {
      context: "원문 I love cats · 번역문 나는 ____", prob: "후보 여섯의 확률 (합 100%)", fix: "점수를 고칠 양", train: "한 걸음 학습", reset: "처음으로", loss: "오차", step: "학습 걸음",
      rule: "고칠 양 = 정답 여부 − 준 확률", vocab: ["고양이를", "개를", "사랑한다", "나는", "고양이에게", "<끝>"],
    },
  },
};
