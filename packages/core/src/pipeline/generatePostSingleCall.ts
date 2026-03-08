import { BaseAiClient } from "../ai";
import { BlogPostInput, AiGeneratedPost } from "../types/blog";
import { safeGenerate } from "../util/safeGenerate";
import { generateBlogPrompt } from "./generatePrompt";
import { generateAutoPilotPrompt } from "./autoPilotPrompt";
import { generateCoupangPrompt } from "./generateCoupangPrompt"; // 추가

/**
 * 메인 블로그 포스트 생성 함수
 */
export const generatePostSingleCall = async (
  client: BaseAiClient,
  input: BlogPostInput,
): Promise<AiGeneratedPost> => {
  let prompt;
  try {
    // v3.13: 오토파일럿 모드와 일반 모드 분기
    // v3.13: 오토파일럿 모드와 일반 모드 분기
    // v5.6: 쿠팡 파트너스 모드 분기
    if (input.coupangLink) {
      prompt = generateCoupangPrompt(input);
    } else if (input.mode === "auto") {
      prompt = generateAutoPilotPrompt(input);
    } else {
      prompt = generateBlogPrompt(input);
    }
  } catch (error) {
    console.error("🚨 프롬프트 생성 중 에러 발생:", error);
    throw new Error(
      `프롬프트 생성 실패: ${error instanceof Error ? error.message : String(error)}`,
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
