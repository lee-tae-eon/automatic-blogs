import { BaseAiClient } from "../ai";

export interface BlogPostInput {
  topic: string;
  tone: string;
  sections: number;
  textLength: {
    min: number;
    max: number;
  };
  overriedTone?: string;
  persona: "informative" | "empathetic";
}

export interface AiGeneratedPost {
  title: string;
  outline: string[];
  content: string;
  metaDescription: string;
  metaTitle: string;
  focusKeywords: string[];
  internalLinkSuggestions: {
    anchor: string;
    context: string;
  };
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
