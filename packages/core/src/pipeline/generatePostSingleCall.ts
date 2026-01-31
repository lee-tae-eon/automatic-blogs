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
  let prompt;
  try {
    prompt = generateBlogPrompt(input);
  } catch (error) {
    console.error("🚨 [generateBlogPrompt] 프롬프트 생성 중 에러 발생:", error);
    throw new Error(
      `[generateBlogPrompt] 프롬프트 생성 실패: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const response = await safeGenerate(async () => {
    return await client.generateJson<AiGeneratedPost>(prompt);
  });

  if (!response || !response.title) {
    throw new Error(
      `[generatePostSingleCall] AI가 유효한 JSON 데이터를 생성하지 못했습니다. `,
    );
  }

  return response;
};
