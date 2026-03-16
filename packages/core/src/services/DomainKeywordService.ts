export interface DomainKeywords {
  highYield: string[];
  entities: string[];
  contextRules: string[];
}

export const DOMAIN_STRATEGIES: Record<string, DomainKeywords> = {
  finance: {
    highYield: ["KOSPI", "ETF", "상장지수펀드", "미국 주식", "개인형 IRP", "연금저축", "절세 전략", "주택담보대출", "금리 비교", "대환대출", "신용대출"],
    entities: ["워렌 버핏", "피터 린치", "코스피 지수", "나스닥", "연금계좌", "담보대출 금리", "한국은행 기준금리"],
    contextRules: [
      "제목에 제품명 또는 구체적인 금융 상품명을 괄호[]와 함께 사용하세요. (예: [주택담보대출])",
      "본문 상단 3줄 내에 '수익률', '금리', '세액공제' 중 하나를 반드시 포함하세요.",
      "**PAS(Problem-Agitate-Solution) 기법 적용**: 독자의 경제적 위기감(고금리, 인플레이션 등)을 자극하고, 이대로 방치 시 발생할 손실을 경고한 뒤, 구체적 상품이나 절세 전략을 해결책으로 제시하세요."
    ]
  },
  health: {
    highYield: ["실비보험", "암보험", "치아보험", "건강보험료 개정안", "임플란트 비용", "피부양자 자격", "어린이보험", "라식 라섹", "건강검진"],
    entities: ["국민건강보험공단", "실손 의료보험", "암진단비", "임플란트 수술", "건강보험료 요율", "식약처 인증"],
    contextRules: [
      "2026년 건강보험 제도 변화를 언급하여 최신 정보임을 강조하세요.",
      "본문 상단에 구체적인 질병명이나 시술명을 노출하여 관련 광고를 유도하세요.",
      "**PAS(Problem-Agitate-Solution) 기법 적용**: 특정 증상(피로, 통증 등)에 대한 독자의 공감을 이끌어내고, 방치 시 발생할 수 있는 심각한 질환을 경고한 뒤, 예방법 및 검증된 성분/치료법을 제시하세요."
    ]
  },
  it_tech: {
    highYield: ["ERP", "SaaS", "클라우드 서비스", "AI 도입", "데이터 분석", "개발자 국비지원", "보안 솔루션", "그룹웨어"],
    entities: ["AWS", "MS Azure", "OpenAI", "머신러닝", "클라우드 보안", "B2B 솔루션"],
    contextRules: [
      "제목에 '기업용', '솔루션', '업무 효율' 등의 비즈니스 키워드를 포함하세요.",
      "도입부에서 '최근 기업들의 AI 도입 트렌드'나 '업무 자동화의 필요성'을 강조하여 B2B 고단가 광고 매칭을 유도하세요.",
      "**수익성 유도**: 개인 사용자보다 기업/실무자 타겟의 말투를 사용하여, 솔루션 도입 시 절감되는 시간과 비용을 수치화하여 강조하세요."
    ]
  },
  real_estate: {
    highYield: ["아파트 분양", "청약 가점", "오피스텔 임대", "전세자금대출", "부동산 세금", "양도소득세", "재건축 재개발"],
    entities: ["LH 한국토지주택공사", "HUG 주택도시보증공사", "LTV", "DSR", "공시지가"],
    contextRules: [
      "제목에 구체적인 지역명(예: 서울, 강남, 신도시)과 '분양가', '청약 일정' 등을 포함하세요.",
      "본문 초반에 국토교통부나 부동산원의 최신 정책/규제 변화를 언급하여 신뢰도를 높이세요.",
      "**투자/실거주 가치 부각**: 단순 매물 소개를 넘어 향후 가치 상승 여력, 교통 호재, 학군 등을 구체적으로 분석하여 독자의 투자 심리를 자극하세요."
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
  if (t.includes("it") || t.includes("테크") || t.includes("ai") || t.includes("소프트웨어") || t.includes("개발")) {
    return DOMAIN_STRATEGIES.it_tech;
  }
  if (t.includes("부동산") || t.includes("아파트") || t.includes("청약") || t.includes("분양") || t.includes("전세")) {
    return DOMAIN_STRATEGIES.real_estate;
  }
  return null;
}
