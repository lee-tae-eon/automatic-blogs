// ============================================
// 주제 + 페르소나 기반 자동 추론 시스템
// ============================================

import { Persona } from "@/types/blog";

/**
 * 주제에서 키워드 자동 추출
 */
export function inferKeywords(topic: string): string[] {
  // 1. 특수문자 제거 및 정규화
  const normalized = topic
    .replace(/[^\w\s가-힣]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // 2. 불용어 제거 (조사, 접속사 등)
  const stopWords = [
    "을",
    "를",
    "이",
    "가",
    "은",
    "는",
    "의",
    "에",
    "와",
    "과",
    "도",
    "으로",
    "로",
    "에서",
    "부터",
    "까지",
    "위한",
    "대한",
    "있는",
    "하는",
    "되는",
    "한",
    "및",
    "그리고",
    "또는",
  ];

  const words = normalized.split(" ").filter((word) => {
    return word.length >= 2 && !stopWords.includes(word);
  });

  // 3. 중요 키워드 우선순위 (앞 3~5개)
  const uniqueWords = [...new Set(words)];
  return uniqueWords.slice(0, Math.min(5, uniqueWords.length));
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
    informative: "정보를 찾는 사람들",
    empathetic: "고민이 있는 사람들",
    storytelling: "이야기를 좋아하는 독자",
    friendly: "가볍게 읽고 싶은 사람들",
    experiential: "실제 경험담을 원하는 사람들",
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
} {
  const lower = topic.toLowerCase();

  return {
    isReview: /후기|리뷰|사용|써본|개월|년/.test(lower),
    isHowTo: /방법|가이드|팁|꿀팁|하는법/.test(lower),
    isComparison: /vs|비교|차이|어떤|선택/.test(lower),
    isOpinion: /생각|의견|관점|견해/.test(lower),
  };
}

/**
 * 통합 자동 추론 함수
 */
export function autoInferMetadata(topic: string, persona: Persona) {
  return {
    keywords: inferKeywords(topic),
    targetAudience: inferTargetAudience(topic, persona),
    contentGoal: inferContentGoal(persona),
    topicIntent: analyzeTopicIntent(topic),
  };
}

// ============================================
// 사용 예시
// ============================================
export function exampleUsage() {
  const examples = [
    { topic: "30대 직장인을 위한 아침 루틴", persona: "empathetic" as Persona },
    {
      topic: "맥북 프로 M3 3개월 사용 후기",
      persona: "experiential" as Persona,
    },
    { topic: "초보 개발자를 위한 Git 가이드", persona: "friendly" as Persona },
  ];

  examples.forEach(({ topic, persona }) => {
    console.log(`\n주제: ${topic}`);
    console.log(`페르소나: ${persona}`);
    console.log(autoInferMetadata(topic, persona));
  });
}
