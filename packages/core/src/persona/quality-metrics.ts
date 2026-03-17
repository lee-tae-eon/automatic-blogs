import { QualityMetrics, Persona } from "../types/blog";

export const SEO_RULES = {
  metaTitleLength: [20, 40],
  metaDescriptionLength: [80, 150],
  keywordDensity: [0.01, 0.03],
};

export const QUALITY_METRICS: Record<Persona, QualityMetrics> = {
  // 1. 정보성 (The Analyst)
  informative: {
    targetLength: [2500, 4000],
    headingCount: 6,
    paragraphMaxLength: 150,
    sentenceMaxLength: 50,
    emojiUsage: "minimal",
    tableRequired: true,
    imageCount: 4,
    keywordDensity: [0.01, 0.03],
  },

  // 2. 후기성 (The Reviewer)
  experiential: {
    targetLength: [2000, 3500],
    headingCount: 5,
    paragraphMaxLength: 120,
    sentenceMaxLength: 40,
    emojiUsage: "moderate",
    tableRequired: true,
    imageCount: 6,
    keywordDensity: [0.01, 0.02],
  },

  // 3. 뉴스형 (The Reporter)
  reporter: {
    targetLength: [1500, 2500],
    headingCount: 5,
    paragraphMaxLength: 100,
    sentenceMaxLength: 45,
    emojiUsage: "minimal",
    tableRequired: true,
    imageCount: 3,
    keywordDensity: [0.01, 0.02],
  },

  // 4. 엔터형 (The Fan/Watcher)
  entertainment: {
    targetLength: [1500, 2500],
    headingCount: 5,
    paragraphMaxLength: 100,
    sentenceMaxLength: 40,
    emojiUsage: "heavy",
    tableRequired: false,
    imageCount: 5,
    keywordDensity: [0.01, 0.02],
  },

  // 6. 여행 가이드 (The Travel Guide)
  travel: {
    targetLength: [2500, 4000],
    headingCount: 6,
    paragraphMaxLength: 120,
    sentenceMaxLength: 45,
    emojiUsage: "moderate",
    tableRequired: true,
    imageCount: 5,
    keywordDensity: [0.01, 0.02],
  },

  // 7. 재테크/금융 전문가 (The Finance Master)
  financeMaster: {
    targetLength: [3000, 5000],
    headingCount: 7,
    paragraphMaxLength: 150,
    sentenceMaxLength: 50,
    emojiUsage: "minimal",
    tableRequired: true,
    imageCount: 4,
    keywordDensity: [0.02, 0.04],
  },

  // 8. 건강/의학 큐레이터 (The Health Expert)
  healthExpert: {
    targetLength: [3000, 4500],
    headingCount: 7,
    paragraphMaxLength: 130,
    sentenceMaxLength: 50,
    emojiUsage: "minimal",
    tableRequired: true,
    imageCount: 4,
    keywordDensity: [0.02, 0.04],
  },
};

export const getQualityMetrics = (persona: Persona): QualityMetrics => {
  return QUALITY_METRICS[persona] || QUALITY_METRICS.informative;
};