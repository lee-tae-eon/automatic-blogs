import dotenv from "dotenv";
import path from "path";
import { GeminiClient } from "@blog-automation/core/src/ai";
import { BlogPostInput } from "@blog-automation/core/src/types/blog";
import { generatePost } from "@blog-automation/core/src";

// 1. .env 로드 (루트 경로 설정)
dotenv.config({
  path: [
    path.join(__dirname, "../../../.env.local"),
    path.join(__dirname, "../../../.env"),
  ],
});

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY가 없습니다. .env 파일을 확인해주세요.");
    return;
  }

  const input: BlogPostInput = {
    topic: "5살 아이랑 태국 여행 갈 때 챙겨야 할 필수 아이템",
    tone: "casual", // 추천드린 5개 중 하나 선택 가능
  };
  console.log(`\n🚀 블로그 자동 생성 시작!`);
  console.log(`📌 주제: ${input.topic}`);
  console.log(`🎭 톤: ${input.tone}\n`);
  // Gemini 클라이언트 초기화
  const aiClient = new GeminiClient(apiKey);

  try {
    const post = await generatePost(aiClient, input);

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
