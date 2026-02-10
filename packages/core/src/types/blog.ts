import { BaseAiClient } from "../ai";

// ============================================
// 톤
// ============================================
export type Tone = "professional" | "incisive" | "serious";

export const TONE_INSTRUCTIONS: Record<Tone, string> = {
  professional:
    "신뢰감을 주는 격식 있는 표현을 사용하며, 객관적인 단어를 선택함",
  serious: "간결하고 힘 있는 문장을 사용하여 사안의 중요성을 강조함",
  incisive: "사안의 핵심을 찌르는 날카롭고 직설적인 비판적 화법을 사용함",
};

// ============================================
// 페르소나
// ============================================

export type Persona =
  | "informative"
  | "empathetic"
  | "storytelling"
  | "experiential"
  | "travelLog"
  | "hollywood-reporter"; // 헐리우드 전문 리포터 추가

export interface PersonaDetail {
  role: string; // AI 역할 정의
  principle: string; // 글쓰기 핵심 원칙
  style: string; // 문체 및 톤
  hooks: string[]; // 도입부 패턴 (3~5개)
  structure: string[]; // 본문 구조 가이드
  transitions: string[]; // 문단 연결어 스타일
  closingStyle: string; // 마무리 방식
  forbidden: string[]; // 금지 표현 리스트
  writingTips?: string[]; // [v3.5] 가독성을 높이는 작문 팁
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

// v3.13: 오토파일럿 전용 전략 데이터 인터페이스
export interface AutoPilotStrategy {
  headings: string[];
  suggestedOutline: string[];
  differentiationStrategy: string;
  styleDNA: string;
  estimatedLength: number;
  hasTable: boolean;
}

export interface BlogPostInput {
  topic: string;
  persona: Persona;
  tone: Tone;
  category: string;
  keywords?: string[];
  latestNews?: string;
  additionalInstructions?: string;
  mode?: "manual" | "auto";
  strategy?: AutoPilotStrategy;
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
  category: string;
  createdAt: string;
  persona: Persona;
  tone: Tone;
  keywords?: string[];
  latestNews?: string;
}

export interface GeneratePostInput {
  client: BaseAiClient;
  task: BatchTask;
  projectRoot?: string;
  onProgress?: (message: string) => void;
}

export interface BatchTask {
  topic: string;
  persona: Persona;
  tone: Tone;
  category: string;
  keywords?: string[];
  status: "대기" | "진행" | "완료" | "실패";
  additionalInstructions?: string;
  mode?: "manual" | "auto";
  strategy?: AutoPilotStrategy;
}
