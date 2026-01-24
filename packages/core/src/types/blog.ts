import { BaseAiClient } from "../ai";

export interface BlogPostInput {
  topic: string;
  tone: string;
  sections: number;
  textLength: {
    min: number;
    max: number;
  };
  overrideTone?: string;
  persona: string;
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
export interface BlogPost extends AiGeneratedPost {
  platform: BlogPlatform;
  createdAt: string;
}

export interface GeneratePostInput {
  client: BaseAiClient;
  input: BlogPostInput;
}

export type BlogPlatform = "naver" | "tistory";
export interface BatchTask {
  topic: string;
  persona: BlogPlatform;
  tone: string;
  category: string;
  keywords?: string; // Optional로 설정
  status: "대기" | "진행" | "완료" | "실패";
}
