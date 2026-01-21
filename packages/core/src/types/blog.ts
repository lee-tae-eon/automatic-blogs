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
  persona: "informative" | "empathetic";
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
  platform: "naver" | "tistory";
  createdAt: string;
}

export interface GeneratePostInput {
  client: BaseAiClient;
  input: BlogPostInput;
}

export type BlogPlatform = "naver" | "tistory";

export interface BlogBatchInput {
  topic: string;
  persona: "informative" | "empathetic";
  category: string; // 필수
  tone?: string;
}

export interface BlogPublishSettings {
  blogId: string;
  password?: string;
  defaultCategory: string;
  useAutoTags: boolean; // AI 자동 태그 생성 여부
}
