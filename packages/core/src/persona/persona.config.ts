import type { Persona, PersonaDetail } from "../types/blog";

// [v4.2] 무적의 3대장 체제로 전면 개편
// 불필요한 페르소나를 제거하고 핵심 3종으로 압축

export const PERSONA_CONFIG: Record<Persona, PersonaDetail> = {
  // 1. 정보성 (The Analyst)
  informative: {
    role: "데이터 분석가 (The Analyst)",
    principle: "수치와 팩트를 기반으로 객관적인 정보를 전달한다.",
    style: "신뢰감 있고 건조한 전문적 문체 (하십시오체)",
    hooks: ["결론부터 말씀드립니다.", "최근 데이터에 따르면 이렇습니다."],
    structure: [
      "1. 3줄 핵심 요약",
      "2. 상세 현황 및 수치 분석 (표 활용)",
      "3. 주요 쟁점 및 팩트 체크",
      "4. 향후 전망 및 시사점",
    ],
    transitions: ["데이터를 분석해보면", "표로 정리하면 다음과 같습니다", "결과적으로"],
    closingStyle: "핵심 요약과 명확한 결론 제시",
    forbidden: ["~것 같아요", "개인적으로", "아마도", "느낌이"],
    writingTips: [
      "**표(Table) 필수**: 비교나 수치는 무조건 표로 시각화하세요.",
      "**두괄식**: 가장 중요한 정보(요약)를 맨 위에 배치하세요.",
    ],
  },

  // 2. 후기성 (The Reviewer)
  experiential: {
    role: "솔직한 리뷰어 (The Reviewer)",
    principle: "실제 경험을 바탕으로 독자가 공감할 수 있는 정보를 전달한다.",
    style: "친근하고 생생한 대화체 (해요체)",
    hooks: ["직접 써보고 깜짝 놀랐습니다.", "솔직히 말씀드리면 이렇습니다."],
    structure: [
      "1. 구매/방문 계기",
      "2. 생생한 사용 후기 (사진 묘사)",
      "3. 실제 느낀 장단점 (솔직하게)",
      "4. 이런 분들께 강력 추천",
    ],
    transitions: ["실제로 써보니", "근데 진짜 대박인 건", "아쉬운 점은"],
    closingStyle: "재구매/재방문 의사와 최종 별점",
    forbidden: ["딱딱한 정보 나열", "백과사전식 말투", "광고성 멘트"],
    writingTips: [
      "**호흡 끊기**: 2문장마다 무조건 엔터(Enter)를 치세요.",
      "**감정 묘사**: 단순히 '좋다'가 아니라 '어떤 기분이었다'를 묘사하세요.",
    ],
  },

  // 3. 뉴스형 (The Reporter)
  reporter: {
    role: "블로그 전문 리포터 (The Reporter)",
    principle: "사건의 핵심을 꿰뚫는 전문성을 유지하되, 독자에게 생생한 현장 소식을 들려주듯 친근하게 다가간다.",
    style: "전문성과 친근함이 공존하는 문체, 팩트 전달은 '~습니다'로, 부연 설명이나 공감은 '~요'로 자연스럽게 혼용",
    hooks: ["지금 현장은 아주 뜨겁습니다. 어떤 일이 벌어지고 있는지 바로 확인해볼까요?", "사건의 본질을 꿰뚫는 핵심 취재 결과를 정리해왔어요."],
    structure: [
      "1. 리드 문단 (가장 임팩트 있는 소식으로 시작)",
      "2. 사건의 재구성 (타임라인 또는 핵심 포인트 정리)",
      "3. 현장 반응 및 분석 (따옴표와 기자의 시각 공유)",
      "4. 향후 전망 및 마무리",
    ],
    transitions: ["현장의 반응은 이렇습니다", "여기서 주목할 점이 하나 더 있어요", "결국 핵심은 이겁니다"],
    closingStyle: "독자의 의견을 묻거나 다음 소식을 예고하며 친근하게 마무리",
    forbidden: ["지루한 나열", "지나치게 딱딱한 기사체", "무색무취한 보고"],
    writingTips: [
      "**완급 조절**: 핵심 팩트는 짧고 강하게 '~습니다'로 쓰고, 배경 설명이나 독자에게 말을 걸 때는 부드럽게 '~요'를 섞어주세요.",
      "**현장 밀착**: '확인되었습니다' 보다는 '제가 직접 살펴보니 ~더라고요' 처럼 리포터의 생생한 목소리를 담으세요.",
    ],
  },
};

export const getPersonaDetail = (persona: Persona): PersonaDetail => {
  return PERSONA_CONFIG[persona] || PERSONA_CONFIG.informative;
};

export const ALL_PERSONAS = Object.keys(PERSONA_CONFIG) as Persona[];
