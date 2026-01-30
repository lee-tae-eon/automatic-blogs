import { BaseAiClient } from "../ai";

export type Persona =
  | "empathetic"
  | "storytelling"
  | "friendly"
  | "experiential"
  | "informative";

export interface PersonaDetail {
  role: string; // AI 역할 정의
  principle: string; // 글쓰기 핵심 원칙
  style: string; // 문체 및 톤
  hooks: string[]; // 도입부 패턴 (3~5개)
  structure: string[]; // 본문 구조 가이드
  transitions: string[]; // 문단 연결어 스타일
  closingStyle: string; // 마무리 방식
  forbidden: string[]; // 금지 표현 리스트
}

export interface PersonaExamples {
  goodSentences: string[]; // 모범 예시 (10개)
  badSentences: string[]; // 피해야 할 예시 (5개)
  transitions: string[]; // 문단 전환 예시 (5개)
}

// ============================================
// 품질 메트릭
// ============================================
export interface QualityMetrics {
  targetLength: [number, number]; // [최소, 최대] 글자 수
  headingCount: number; // 소제목 개수
  paragraphMaxLength: number; // 문단 최대 길이
  sentenceMaxLength: number; // 문장 최대 길이
  emojiUsage: "minimal" | "moderate" | "heavy";
  tableRequired: boolean; // 표 필수 여부
  imageCount: number; // 권장 이미지 개수
  keywordDensity: [number, number]; // [최소%, 최대%]
}

export interface BlogPostInput {
  topic: string;
  persona: Persona;
  keywords?: string[];
}

export interface AiGeneratedPost {
  title: string;
  outline: string[];
  content: string;
  metaDescription: string;
  metaTitle: string;
  focusKeywords: string[];
  tags?: string[];
  internalLinkSuggestions: {
    anchor: string;
    context: string;
  }[];
  imageAltTexts?: string[];
}
export interface Publication extends AiGeneratedPost {
  platform: BlogPlatform;
  category: string;
  createdAt: string;
}

export interface GeneratePostInput {
  client: BaseAiClient;
  task: BatchTask;
}

export type BlogPlatform = "naver" | "tistory";
export interface BatchTask {
  topic: string;
  persona: Persona;
  tone: string;
  category: string;
  keywords?: string[]; // Optional로 설정
  platform?: BlogPlatform;
  status: "대기" | "진행" | "완료" | "실패";
}
