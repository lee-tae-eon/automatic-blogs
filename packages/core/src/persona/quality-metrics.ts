// ============================================
// 페르소나별 품질 기준

import { Persona, QualityMetrics } from "@/types/blog";

// ============================================
export const QUALITY_METRICS: Record<Persona, QualityMetrics> = {
  informative: {
    targetLength: [2000, 3500], // 정보 전달형은 길게
    headingCount: 5, // 소제목 5개
    paragraphMaxLength: 200, // 문단당 최대 200자
    sentenceMaxLength: 80, // 문장당 최대 80자
    emojiUsage: "minimal", // 이모지 최소화
    tableRequired: true, // 표 필수
    imageCount: 2, // 이미지 3개 권장
    keywordDensity: [1.5, 2.5], // 키워드 밀도 1.5~2.5%
  },

  empathetic: {
    targetLength: [1500, 2500],
    headingCount: 5,
    paragraphMaxLength: 150, // 짧은 문단으로 가독성 확보
    sentenceMaxLength: 60,
    emojiUsage: "moderate", // 감성 표현용 이모지 적절히 사용
    tableRequired: false,
    imageCount: 2,
    keywordDensity: [1.0, 2.0],
  },

  storytelling: {
    targetLength: [1800, 3000],
    headingCount: 5,
    paragraphMaxLength: 180,
    sentenceMaxLength: 70,
    emojiUsage: "minimal",
    tableRequired: false, // 스토리 흐름 방해 방지
    imageCount: 2, // 시각적 몰입 강화
    keywordDensity: [1.0, 2.0],
  },

  friendly: {
    targetLength: [1200, 2200], // 가볍게 읽히도록 짧게
    headingCount: 5,
    paragraphMaxLength: 120, // 매우 짧은 문단
    sentenceMaxLength: 50,
    emojiUsage: "heavy", // 이모지 활발히 사용
    tableRequired: false,
    imageCount: 3,
    keywordDensity: [1.0, 1.8],
  },

  experiential: {
    targetLength: [1800, 3000],
    headingCount: 5,
    paragraphMaxLength: 150,
    sentenceMaxLength: 70,
    emojiUsage: "moderate",
    tableRequired: true, // 장단점 비교표 필수
    imageCount: 3, // 실제 사용 사진 많이
    keywordDensity: [1.5, 2.5],
  },
};

// ============================================
// 공통 SEO 규칙
// ============================================
export const SEO_RULES = {
  maxImages: 3,
  metaTitleLength: [30, 60], // 메타 제목 글자 수
  metaDescriptionLength: [120, 160], // 메타 설명 글자 수
  focusKeywordCount: [3, 5], // 주요 키워드 개수
  headingKeywordUsage: true, // 소제목에 키워드 포함 필수
  firstParagraphKeyword: true, // 첫 문단에 키워드 필수
  imageAltRequired: true, // 이미지 alt 속성 필수
};

// ============================================
// 가독성 점수 기준
// ============================================
export const READABILITY_SCORES = {
  excellent: 80, // 매우 좋음
  good: 60, // 좋음
  fair: 40, // 보통
  poor: 20, // 개선 필요
};

// ============================================
// 품질 메트릭 가져오기 함수
// ============================================
export const getQualityMetrics = (persona: Persona): QualityMetrics => {
  return QUALITY_METRICS[persona] || QUALITY_METRICS.informative;
};
