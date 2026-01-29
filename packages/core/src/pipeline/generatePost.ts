import { delay } from "../util/delay";
import { Publication, GeneratePostInput, BlogPostInput } from "../types/blog";
import { generatePostSingleCall } from "./generatePostSingleCall";

/**
 * @description ai client 로 부터 post 를 반환하는 함수
 * @param param0
 * @returns
 */
export async function generatePost({
  client,
  task,
}: GeneratePostInput): Promise<Publication> {
  const MAX_RETRIES = 1; // 최대 3번 재시도
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🤖 AI 포스팅 생성 시도 중... (${attempt}/${MAX_RETRIES})`);

      const inputParams: BlogPostInput = {
        ...task,
        tone: task.tone,
      };

      const aiPost = await generatePostSingleCall(client, inputParams);

      const publication: Publication = {
        ...aiPost,
        platform: task.platform || "naver",
        category: task.category,
        createdAt: new Date().toISOString(),
      };

      return publication; // 성공 시 즉시 반환
    } catch (error) {
      lastError = error;
      console.warn(
        `⚠️ 생성 실패 (시도 ${attempt}):`,
        error instanceof Error ? error.message : error,
        error instanceof Error ? error.name : error,
      );

      // 429 에러(Quota Exceeded)인 경우 재시도하지 않고 즉시 상위로 던져서 모델 변경을 유도함
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (
        errorMsg.includes("429") ||
        errorMsg.includes("Too Many Requests") ||
        errorMsg.includes("exhausted")
      ) {
        throw error;
      }

      if (attempt < MAX_RETRIES) {
        // 다음 시도 전 대기 (재시도 횟수가 늘어날수록 더 오래 대기하는 '지수 백오프' 전략)
        const waitTime = attempt * 2000;
        console.log(`⏱️ ${waitTime / 1000}초 후 다시 시도합니다...`);
        await delay(waitTime);
      }
    }
  }

  // 모든 재시도가 실패한 경우
  console.error("🚨 모든 AI 호출 재시도가 실패했습니다.");
  throw lastError;
}
