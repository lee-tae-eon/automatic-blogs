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

  const response = await safeGenerate(async () => {
    return await client.generateJson<AiGeneratedPost>(prompt);
  });

  if (!response || !response.title) {
    throw new Error("AI가 유효한 JSON 데이터를 생성하지 못했습니다.");
  }

  return response;
};
