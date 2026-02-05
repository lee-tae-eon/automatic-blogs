import type { Persona } from "../types/blog";

// ============================================
// 간소화된 자동 추론 시스템
// (키워드는 AI가 직접 추론하므로 제거)
// ============================================

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
    informative: "정보를 찾는 사람들",
    empathetic: "고민이 있는 사람들",
    storytelling: "이야기를 좋아하는 독자",
    friendly: "가볍게 읽고 싶은 사람들",
    experiential: "실제 경험담을 원하는 사람들",
    travelLog: "여행지의 생생한 분위기를 느끼고 싶은 사람들",
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
      empathetic: "engagement", // 감정적 연결
      storytelling: "engagement", // 독자 몰입
      friendly: "engagement", // 친근한 소통
      experiential: "conversion", // 구매/행동 유도
      travelLog: "engagement", // 여행지 공감 및 소통
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
  needsCurrentInfo: boolean;
} {
  const lower = topic.toLowerCase();

  const needsCurrentInfo =
    /오늘|최근|2026|현재|지금|이번|트렌드|뉴스|사건|속보/.test(topic);

  return {
    isReview: /후기|리뷰|사용|써본|개월|년/.test(lower),
    isHowTo: /방법|가이드|팁|꿀팁|하는법/.test(lower),
    isComparison: /vs|비교|차이|어떤|선택/.test(lower),
    isOpinion: /생각|의견|관점|견해/.test(lower),
    isScandal: /논란|의혹|탈세|혐의|사건|사고|폭로|충격|비판|실체|진실/.test(
      lower,
    ),
    needsCurrentInfo,
  };
}
