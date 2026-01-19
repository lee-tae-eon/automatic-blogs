import { delay } from "../util/delay";
import { BlogPost, GeneratePostInput } from "../types/blog";
// import { generateOutline } from "./generateOutline";
// import { generateArticle } from "./generateArticle";
// import { delay } from "../util/delay";
import { generatePostSingleCall } from "./generatePostSingleCall";

/**
 * @description ai client 로 부터 post 를 반환하는 함수
 * @param param0
 * @returns
 */
export async function generatePost({
  client,
  input,
}: GeneratePostInput): Promise<BlogPost> {
  const MAX_RETRIES = 3; // 최대 3번 재시도
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`🤖 AI 포스팅 생성 시도 중... (${attempt}/${MAX_RETRIES})`);

      const aiPost = await generatePostSingleCall(client, input);

      const post: BlogPost = {
        ...aiPost,
        platform: "naver",
        createdAt: new Date().toISOString(),
      };

      return post; // 성공 시 즉시 반환
    } catch (error) {
      lastError = error;
      console.warn(
        `⚠️ 생성 실패 (시도 ${attempt}):`,
        error instanceof Error ? error.message : error,
      );

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

// * 멀티플용
// // 1. 목차 생성 (input 객체를 통째로 넘겨 주제와 톤을 반영)
// const outlineData = await generateOutline(client, input);

// await delay(3000);
// // 2. 본문 생성 (생성된 목차를 기반으로 상세 내용 작성)
// const content = await generateArticle(client, input, outlineData);

// // 3. 최종 BlogPost 객체로 반환
// return {
//   title: outlineData.title,
//   outline: outlineData.sections,
//   content: content,
// };
