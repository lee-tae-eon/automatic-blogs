import { BaseAiClient } from "../ai";
import { BlogPostInput, AiGeneratedPost } from "../types/blog";
import { safeGenerate } from "../util/safeGenerate";
import { generateBlogPrompt } from "./generatePrompt";

/**
 * 메인 블로그 포스트 생성 함수
 */
export const generatePostSingleCall = async (
  client: BaseAiClient,
  input: BlogPostInput,
): Promise<AiGeneratedPost> => {
  const prompt = generateBlogPrompt(input);

  console.log("프롬프트:", prompt);

  const response = await safeGenerate(async () => {
    return await client.generateJson<AiGeneratedPost>(prompt);
  });

  if (!response || !response.title) {
    throw new Error("AI가 유효한 JSON 데이터를 생성하지 못했습니다.");
  }

  return response;
};

/**
 * 생성된 콘텐츠 품질 검증 로직
 */
export const validatePostQuality = (
  post: AiGeneratedPost,
  input: BlogPostInput,
): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // 1. 소제목 개수 및 형식 검증 (5개 고정 및 인용구 문법 체크)
  const quoteH2Count = (post.content.match(/^> ## /gm) || []).length;
  if (quoteH2Count !== 5) {
    errors.push(`소제목 개수 오류: ${quoteH2Count}개 발견 (반드시 5개여야 함)`);
  }

  // 2. 문장 길이 검증 (개별 문장이 200자 이하인지 체크)
  const sentences = post.content.split(/[.!?]\s|\n/);
  for (const s of sentences) {
    if (s.trim().length > 200) {
      errors.push(`문장 길이 초과: 200자를 넘는 문장이 발견되었습니다.`);
      break;
    }
  }

  // 3. 페르소나별 필수 요소 검증
  switch (input.persona) {
    case "experiential":
      if (!post.content.includes("|")) {
        errors.push("체험형: 비교 표가 없습니다.");
      }
      break;
    case "empathetic":
    case "storytelling":
    case "friendly":
      if (post.content.includes("|")) {
        errors.push(`${input.persona}: 표를 제거하고 서술형으로 작성하세요.`);
      }
      break;
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};
