import type { Persona } from "../types/blog";

// ============================================
// 간소화된 자동 추론 시스템
// (키워드는 AI가 직접 추론하므로 제거)
// ============================================

/**
 * 카테고리 및 주제 기반으로 최적의 페르소나 자동 추론
 */
export function inferPersona(category: string, topic: string): Persona {
  const cat = category.toLowerCase();
  const top = topic.toLowerCase();

  if (cat.includes("경제") || cat.includes("금융") || cat.includes("비즈니스") || top.match(/배당|계좌|ISA|대출|금리|주식|코인/)) {
    return "financeMaster";
  }
  if (cat.includes("건강") || cat.includes("의학") || cat.includes("의료") || top.match(/수술|보험|비타민|영양제|증상|치료/)) {
    return "healthExpert";
  }
  if (cat.includes("여행") || cat.includes("맛집") || top.match(/여행|항공|호텔|맛집|코스/)) {
    return "travel";
  }
  if (cat.includes("연예") || cat.includes("방송") || cat.includes("entertainment") || top.match(/드라마|배우|가수|아이돌/)) {
    return "entertainment";
  }
  if (cat.includes("테크") || cat.includes("it") || top.match(/삼성|애플|아이폰|갤럭시|출시|성능/)) {
    return "informative"; // IT 분석가
  }
  if (top.match(/후기|리뷰|사용기|써본/)) {
    return "experiential";
  }
  if (cat.includes("이슈") || cat.includes("뉴스") || top.match(/속보|상황|실체/)) {
    return "reporter";
  }

  return "informative"; // 기본값
}

/**
 * 주제 기반으로 최적의 톤 자동 추론
 */
export function inferTone(topic: string): "professional" | "empathetic" | "incisive" | "serious" {
  const top = topic.toLowerCase();

  if (top.match(/배당|계좌|ISA|대출|금리|성능|분석|전망/)) {
    return "professional";
  }
  if (top.match(/논란|실체|비판|충격|폭로|진실/)) {
    return "incisive";
  }
  if (top.match(/사건|사고|사망|주의|경고/)) {
    return "serious";
  }
  
  return "empathetic"; // 일반적인 소통형
}

/**
 * 페르소나 + 주제 기반으로 타겟 독자 자동 추론
 */
export function inferTargetAudience(topic: string, persona: Persona): string {
  const lowerTopic = topic.toLowerCase();

  // ==========================================
  // 1단계: 주제에서 명시적 타겟 추출
  // ==========================================
  const explicitTargets: Record<string, string> = {
    직장인: "직장인",
    회사원: "직장인",
    대학생: "대학생",
    학생: "학생",
    주부: "주부",
    엄마: "육아맘",
    아빠: "육아대디",
    개발자: "개발자",
    디자이너: "디자이너",
    마케터: "마케터",
    창업: "예비 창업자",
    취준생: "취업준비생",
    이직: "이직 준비자",
  };

  for (const [keyword, target] of Object.entries(explicitTargets)) {
    if (lowerTopic.includes(keyword)) {
      return target;
    }
  }

  // ==========================================
  // 2단계: 주제 패턴 기반 추론
  // ==========================================
  if (lowerTopic.match(/초보|입문|처음|시작/)) {
    return "초보자";
  }

  if (lowerTopic.match(/고급|전문|심화|마스터/)) {
    return "숙련자";
  }

  if (lowerTopic.match(/\d+대/)) {
    const ageMatch = lowerTopic.match(/(\d+)대/);
    if (ageMatch) {
      return `${ageMatch[1]}대`;
    }
  }

  // ==========================================
  // 3단계: 페르소나 기반 기본 타겟
  // ==========================================
  const personaDefaultTargets: Record<Persona, string> = {
    informative: "정보와 분석을 필요로 하는 전문가 및 학습자",
    experiential: "실제 사용 후기와 생생한 경험담을 찾는 소비자",
    reporter: "최신 이슈와 트렌드를 빠르게 파악하고 싶은 독자",
    entertainment: "연예, 방송, 문화 트렌드를 즐기는 팬들과 대중",
    travel: "항공권 예약부터 현지 도착까지 구체적이고 정확한 정보가 필요한 실제 여행자",
    financeMaster: "자산 증식, 절세, 대출 이자 절감 등에 관심 있는 경제 주체",
    healthExpert: "건강 관리, 예방, 전문적인 의학/영양 정보를 찾는 분",
  };

  return personaDefaultTargets[persona] || "일반 독자";
}

/**
 * 페르소나 기반으로 콘텐츠 목표 자동 설정
 */
export function inferContentGoal(
  persona: Persona,
): "informative" | "conversion" | "engagement" {
  const goalMap: Record<Persona, "informative" | "conversion" | "engagement"> =
    {
      informative: "informative", // 정보 전달
      experiential: "conversion", // 구매/행동 유도
      reporter: "engagement", // 이슈 공유 및 소통
      entertainment: "engagement", // 팬들과의 소통 및 공감
      travel: "informative", // 정확한 정보 전달 및 가이드
      financeMaster: "conversion", // 금융상품/서비스 전환 유도 (수익화)
      healthExpert: "conversion", // 의료/건강 제품 전환 유도 (수익화)
    };

  return goalMap[persona] || "informative";
}

/**
 * 주제 분석을 통한 추가 인사이트
 */
export function analyzeTopicIntent(topic: string): {
  isReview: boolean;
  isHowTo: boolean;
  isComparison: boolean;
  isOpinion: boolean;
  isScandal: boolean;
  isPlace: boolean;
  needsCurrentInfo: boolean;
} {
  const lower = topic.toLowerCase();

  const needsCurrentInfo =
    /오늘|최근|2026|현재|지금|이번|트렌드|뉴스|사건|속보|발언|논란|상황|공개|발표/.test(
      topic,
    );

  return {
    isReview: /후기|리뷰|사용|써본|개월|년/.test(lower),
    isHowTo: /방법|가이드|팁|꿀팁|하는법/.test(lower),
    isComparison: /vs|비교|차이|어떤|선택/.test(lower),
    isOpinion: /생각|의견|관점|견해/.test(lower),
    isScandal: /논란|의혹|탈세|혐의|사건|사고|폭로|충격|비판|실체|진실/.test(
      lower,
    ),
    isPlace: /맛집|카페|명소|가볼만한곳|위치|가게|매장|식당/.test(lower),
    needsCurrentInfo,
  };
}
