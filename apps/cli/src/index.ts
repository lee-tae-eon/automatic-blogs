import { GeminiClient } from "@blog-automation/core/src/ai";
import { BlogPostInput } from "@blog-automation/core/src/types/blog";
import { generatePost, saveMarkdown } from "@blog-automation/core/src";
import { ENV } from "./env";
import { BLOG_PRESET } from "@blog-automation/core/src/util/platform";
import { processPublish } from "./processPublish/processPublishNaver";

const preset = BLOG_PRESET["naver"];

// 사용자 인터페이스 (입구)
async function main() {
  const apiKey = ENV.GEMINI_API_KEY;
  const modelName = ENV.GEMINI_MODEL_FAST;

  if (!apiKey || !modelName) {
    console.error(
      "❌ GEMINI_API_KEY 또는 modelName이 없습니다. .env 파일을 확인해주세요.",
    );
    return;
  }

  const input: BlogPostInput = {
    topic: "5살 아이랑 태국 여행 갈 때 챙겨야 할 필수 아이템",
    tone: preset.tone,
    textLength: preset.textLength,
    sections: preset.sections,
  };
  console.log(`\n🚀 블로그 자동 생성 시작!`);
  console.log(`📌 주제: ${input.topic}`);
  // Gemini 클라이언트 초기화
  const aiClient = new GeminiClient(apiKey, modelName);

  try {
    const post = await generatePost({ client: aiClient, input });

    try {
      console.log("--------------------------------------");
      console.log(post.content);
      console.log("--------------------------------------");
      console.log("\n✅ 포스트 생성이 완료되었습니다!");

      const filePath = await saveMarkdown(post);

      console.log("--------------------------------------");
      console.log(filePath);
      console.log("--------------------------------------");
      console.log("\n md 생성이 완료되었습니다!");

      const fileHtml = processPublish(filePath);

      console.log("--------------------------------------");
      console.log(fileHtml);
      console.log("--------------------------------------");
      console.log("\n html 생성이 완료되었습니다!");
    } catch (fileError) {
      // 포스트는 생성됐는데 파일 시스템 에러가 난 경우
      console.error("🚨 파일 처리 중 오류 발생:", fileError);
      // 여기서 post 데이터를 로그로 찍어두면 나중에 수동 복구라도 가능합니다.
    }
  } catch (aiError) {
    console.error("🚨 Ai agent 오류 발생:", aiError);
  }
}

main();
