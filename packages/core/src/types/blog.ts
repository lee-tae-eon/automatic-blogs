import { BaseAiClient } from "../ai";

export type Persona =
  | "empathetic"
  | "storytelling"
  | "friendly"
  | "experiential";

export interface BlogPostInput {
  topic: string;
  tone: string;
  overrideTone?: string;
  persona: Persona;
  keywords?: string;
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
  keywords?: string; // Optional로 설정
  platform?: BlogPlatform;
  status: "대기" | "진행" | "완료" | "실패";
}
