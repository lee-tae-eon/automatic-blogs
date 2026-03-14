export interface DomainKeywords {
  highYield: string[];
  entities: string[];
  contextRules: string[];
}

export const DOMAIN_STRATEGIES: Record<string, DomainKeywords> = {
  finance: {
    highYield: ["KOSPI", "ETF", "상장지수펀드", "미국 주식", "개인형 IRP", "연금저축", "절세 전략", "주택담보대출", "금리 비교"],
    entities: ["워렌 버핏", "피터 린치", "코스피 지수", "나스닥", "연금계좌", "담보대출 금리"],
    contextRules: [
      "제목에 제품명 또는 구체적인 금융 상품명을 괄호[]와 함께 사용하세요.",
      "본문 상단 3줄 내에 '수익률', '금리', '세액공제' 중 하나를 반드시 포함하세요."
    ]
  },
  health: {
    highYield: ["실비보험", "암보험", "치아보험", "건강보험료 개정안", "임플란트 비용", "피부양자 자격", "어린이보험"],
    entities: ["국민건강보험공단", "실손 의료보험", "암진단비", "임플란트 수술", "건강보험료 요율"],
    contextRules: [
      "2026년 건강보험 제도 변화를 언급하여 최신 정보임을 강조하세요.",
      "본문 상단에 구체적인 질병명이나 시술명을 노출하여 관련 광고를 유도하세요."
    ]
  }
};

export function getDomainStrategy(topic: string): DomainKeywords | null {
  const t = topic.toLowerCase();
  if (t.includes("금융") || t.includes("재테크") || t.includes("주식") || t.includes("투자") || t.includes("대출")) {
    return DOMAIN_STRATEGIES.finance;
  }
  if (t.includes("건강") || t.includes("의료") || t.includes("보험") || t.includes("병원") || t.includes("수술")) {
    return DOMAIN_STRATEGIES.health;
  }
  return null;
}
