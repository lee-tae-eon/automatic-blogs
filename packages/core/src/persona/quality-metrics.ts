import { QualityMetrics, Persona } from "../types/blog";

export const SEO_RULES = {
  metaTitleLength: [20, 40],
  metaDescriptionLength: [80, 150],
  keywordDensity: [0.01, 0.03],
};

export const QUALITY_METRICS: Record<Persona, QualityMetrics> = {
  // 1. 정보성 (The Analyst)
  informative: {
    targetLength: [1500, 3000],
    headingCount: 5,
    paragraphMaxLength: 150,
    sentenceMaxLength: 50,
    emojiUsage: "minimal",
    tableRequired: true,
    imageCount: 3,
    keywordDensity: [0.01, 0.03],
  },

  // 2. 후기성 (The Reviewer)
  experiential: {
    targetLength: [1000, 2000],
    headingCount: 4,
    paragraphMaxLength: 120,
    sentenceMaxLength: 40,
    emojiUsage: "moderate",
    tableRequired: false,
    imageCount: 5,
    keywordDensity: [0.01, 0.02],
  },

  // 3. 뉴스형 (The Reporter)
  reporter: {
    targetLength: [800, 1500],
    headingCount: 4,
    paragraphMaxLength: 100,
    sentenceMaxLength: 45,
    emojiUsage: "minimal",
    tableRequired: false,
    imageCount: 2,
    keywordDensity: [0.01, 0.02],
  },
};

export const getQualityMetrics = (persona: Persona): QualityMetrics => {
  return QUALITY_METRICS[persona] || QUALITY_METRICS.informative;
};