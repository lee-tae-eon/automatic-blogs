import { BaseAiClient } from "../ai";

// ============================================
// 톤
// ============================================
export type Tone = "professional" | "incisive" | "serious" | "empathetic";

export const TONE_INSTRUCTIONS: Record<Tone, string> = {
  professional:
    "신뢰감을 주는 격식 있는 표현을 사용하며, 객관적인 단어를 선택함",
  serious: "간결하고 힘 있는 문장을 사용하여 사안의 중요성을 강조함",
  incisive: "사안의 핵심을 찌르는 날카롭고 직설적인 비판적 화법을 사용함",
  empathetic:
    "독자의 마음에 공감하고 따뜻한 위로와 응원을 전하는 부드러운 화법을 사용함",
};

// ============================================
// 페르소나
// ============================================

export type Persona =
  | "informative" // 정보형 (The Analyst)
  | "experiential" // 후기형 (The Reviewer)
  | "reporter" // 이슈형 (The Reporter)
  | "entertainment" // 엔터형 (The Fan/Watcher)
  | "travel" // 여행 가이드 (The Travel Guide)
  | "financeMaster" // 재테크/금융 전문가 (The Finance Master)
  | "healthExpert"; // 건강/의학 큐레이터 (The Health Expert)

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
  topicGuidance?: Record<string, { focus: string; avoidOverEmphasis: string }>; // [v5.3] 주제별 강조점
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
  useImage?: boolean; // v4.7: 이미지 사용 여부
  useNotebookLM?: boolean; // v5.0: NotebookLM 고도화 사용 여부
  notebookMode?: "manual" | "auto"; // v5.0: 직접 검수 vs 자동 검수
  internalLinkSuggestions?: { title: string; url: string }[]; // ✅ [v5.2] 내부 링크 추천 데이터
  coupangLink?: string; // v5.6: 쿠팡 파트너스 단축 링크
  extractedImages?: string[]; // v5.6: 스크래핑된 쿠팡 상품 이미지 URL 배열
}

export interface AiGeneratedPost {
  title: string;
  outline: string[];
  content: string;
  metaDescription: string;
  metaTitle: string;
  focusKeywords: string[];
  lsiKeywords?: string[]; // ✅ [v5.3] SEO LSI 키워드
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
  status: "대기" | "진행" | "검수중" | "완료" | "실패";
  additionalInstructions?: string;
  mode?: "manual" | "auto";
  strategy?: AutoPilotStrategy;
  useImage?: boolean; // v4.7: 이미지 사용 여부
  useNotebookLM?: boolean; // v5.0: NotebookLM 고도화 사용 여부
  notebookMode?: "manual" | "auto"; // v5.0: 직접 검수 vs 자동 검수
  isReviewed?: boolean; // v5.0: 검수 완료 여부
  naverCategory?: string; // v5.4: 수동 발행 계정별 게시판 스냅샷 저장
  naverCategory2?: string; // v5.4: 수동 발행 계정별 게시판 스냅샷 저장
  coupangLink?: string; // v5.6: 쿠팡 파트너스 단축 링크
  targetAccount?: "naver1" | "naver2"; // v5.6: 단일 타겟 계정 직접 지정 (쿠팡 등)
}
