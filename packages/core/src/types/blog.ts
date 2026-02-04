import { BaseAiClient } from "../ai";

// ============================================
// 톤
// ============================================
export type Tone =
  | "professional"
  | "witty"
  | "candid"
  | "energetic"
  | "incisive"
  | "serious";

export const TONE_INSTRUCTIONS: Record<Tone, string> = {
  professional:
    "신뢰감을 주는 격식 있는 표현을 사용하며, 객관적인 단어를 선택함",
  witty: "적절한 비유와 가벼운 농담을 섞어 읽는 재미를 주되 선을 넘지 않음",
  candid: "꾸밈없이 솔직하고 담백한 문체를 사용하며 본인의 사견을 적극 반영함",
  energetic: "느낌표와 활기찬 감탄사를 사용하여 독자의 의욕을 고취함",
  serious: "간결하고 힘 있는 문장을 사용하여 사안의 중요성을 강조함",
  incisive: "",
};

// ============================================
// 페르소나
// ============================================

export type Persona =
  | "informative"
  | "empathetic"
  | "storytelling"
  | "friendly"
  | "experiential";

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
  tone: Tone;
  category: string;
  keywords?: string[];
  latestNews?: string;
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
  references?: { name: string; url: string }[];
}
export interface Publication extends AiGeneratedPost {
  platform: BlogPlatform;
  category: string;
  createdAt: string;
}

export interface GeneratePostInput {
  client: BaseAiClient;
  task: BatchTask;
  projectRoot?: string;
  onProgress?: (message: string) => void;
}

export type BlogPlatform = "naver" | "tistory";
export interface BatchTask {
  topic: string;
  persona: Persona;
  tone: Tone;
  category: string;
  keywords?: string[]; // Optional로 설정
  platform?: BlogPlatform;
  status: "대기" | "진행" | "완료" | "실패";
}
