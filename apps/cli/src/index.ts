import { GeminiClient } from "@blog-automation/core/src/ai";
import { BlogPostInput } from "@blog-automation/core/src/types/blog";
import { generatePost } from "@blog-automation/core/src";
import { ENV } from "./env";

// 1. .env 로드 (루트 경로 설정)

async function main() {
  const apiKey = ENV.GEMINI_API_KEY;
  const modelName = ENV.GEMINI_MODEL_NORMAL;

  if (!apiKey || !modelName) {
    console.error(
      "❌ GEMINI_API_KEY 또는 modelName이 없습니다. .env 파일을 확인해주세요.",
    );
    return;
  }

  const input: BlogPostInput = {
    topic: "5살 아이랑 태국 여행 갈 때 챙겨야 할 필수 아이템",
    platform: "tistory",
  };
  console.log(`\n🚀 블로그 자동 생성 시작!`);
  console.log(`📌 주제: ${input.topic}`);
  // Gemini 클라이언트 초기화
  const aiClient = new GeminiClient(apiKey, modelName);

  try {
    const post = await generatePost({ client: aiClient, input });

    console.log("--------------------------------------");
    console.log(`제목: ${post.title}`);
    console.log(`목차: ${post.outline.join(", ")}`);
    console.log("--------------------------------------");
    console.log(post.content);
    console.log("--------------------------------------");
    console.log("\n✅ 생성이 완료되었습니다!");
  } catch (error) {
    console.error("🚨 오류 발생:", error);
  }
}

main();
